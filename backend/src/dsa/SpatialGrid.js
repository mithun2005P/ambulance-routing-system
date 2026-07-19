const { haversine } = require("./AStar");

/**
 * SpatialGrid.js
 * Bucket-grid spatial index over node coordinates.
 *
 * WHY THIS EXISTS (the actual optimization):
 * Naive dispatch runs Dijkstra from every single available ambulance to the
 * incident and keeps the cheapest - O(A * (V + E) log V) for A available
 * ambulances. That's fine for a demo with 10 ambulances, but does not scale:
 * a real city fleet has hundreds of units, and running a full shortest-path
 * search from every one of them on every incident report is wasteful, since
 * the overwhelming majority are obviously too far away to ever win.
 *
 * Instead: bucket every node into a uniform lat/lng grid. To dispatch, first
 * pull the K geographically-closest AVAILABLE ambulances via an expanding
 * ring search over the grid (cheap - O(1) amortized per ring cell, using
 * straight-line haversine distance as a cheap admissible lower bound on road
 * distance). Only THOSE K candidates get an exact Dijkstra/A* run. This
 * turns dispatch from O(A * graph search) into O(K * graph search) with
 * K constant (default 4) regardless of fleet size - the same pattern real
 * dispatch systems use (coarse geo pre-filter, then exact routing).
 */
class SpatialGrid {
  constructor(cellSizeDeg = 0.01) {
    this.cellSize = cellSizeDeg;
    this.cells = new Map(); // "cx,cy" -> [{ id, lat, lng }]
  }

  _cellKey(lat, lng) {
    const cx = Math.floor(lat / this.cellSize);
    const cy = Math.floor(lng / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(id, lat, lng) {
    const key = this._cellKey(lat, lng);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push({ id, lat, lng });
  }

  /**
   * Returns up to k nearest points (by straight-line distance) to (lat, lng)
   * for which `filterFn(id)` is true, expanding the search ring outward
   * until enough candidates are found or the grid is exhausted.
   */
  kNearest(lat, lng, k, filterFn = () => true) {
    const cx = Math.floor(lat / this.cellSize);
    const cy = Math.floor(lng / this.cellSize);
    const found = [];
    const seen = new Set();
    let ring = 0;
    const maxRing = 40; // safety bound (~40 * cellSize degrees out)

    while (found.length < k && ring <= maxRing) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue; // only the new ring's edge
          const key = `${cx + dx},${cy + dy}`;
          const bucket = this.cells.get(key);
          if (!bucket) continue;
          for (const pt of bucket) {
            if (seen.has(pt.id) || !filterFn(pt.id)) continue;
            seen.add(pt.id);
            const d = haversine({ lat, lng }, { lat: pt.lat, lng: pt.lng });
            found.push({ id: pt.id, straightLineKm: d });
          }
        }
      }
      ring++;
    }

    found.sort((a, b) => a.straightLineKm - b.straightLineKm);
    return found.slice(0, k);
  }
}

module.exports = SpatialGrid;
