const { haversine } = require("../dsa/AStar");
const dijkstra = require("../dsa/Dijkstra");
const MinHeap = require("../dsa/MinHeap");

/**
 * repositioningService.js
 * "Predictive standby repositioning": instead of leaving idle ambulances
 * parked at their home station, suggest moving them toward zones with a
 * history of incidents so the NEXT call is answered faster.
 *
 * Two classic greedy algorithms chained together:
 *
 * 1. Greedy farthest-point k-center: pick K "hot zone" centers from past
 *    incident locations. Start with the busiest single location, then
 *    repeatedly add whichever remaining incident location is FARTHEST from
 *    every center chosen so far. This is the standard greedy 2-approximation
 *    for k-center facility location - each new center maximizes the minimum
 *    distance to the existing set, spreading coverage instead of clustering
 *    centers on top of each other.
 *
 * 2. Greedy bipartite matching: for each hot zone (in order of how many
 *    incidents it represents, most first), assign the nearest still-unassigned
 *    IDLE ambulance to cover it. Not globally optimal (true optimal
 *    assignment is the Hungarian algorithm, O(n^3)), but greedy nearest-match
 *    is O(n^2) and gives a solid answer for the fleet sizes this simulator runs.
 */
class RepositioningService {
  constructor(graph, ambulanceService, dispatchService) {
    this.graph = graph;
    this.ambulanceService = ambulanceService;
    this.dispatchService = dispatchService;
  }

  _incidentPoints() {
    return this.dispatchService
      .list()
      .map((inc) => this.graph.nodes.get(inc.nodeId))
      .filter(Boolean);
  }

  /** Greedy farthest-point k-center over historical incident locations. */
  _hotZones(k) {
    const points = this._incidentPoints();
    if (points.length === 0) return [];

    // seed with the first point; then repeatedly add the farthest point
    // from the current center set until k centers are chosen (or points run out)
    const centers = [points[0]];
    const dedupe = new Set([`${points[0].lat},${points[0].lng}`]);

    while (centers.length < Math.min(k, points.length)) {
      let farthest = null;
      let farthestDist = -1;
      for (const p of points) {
        const key = `${p.lat},${p.lng}`;
        if (dedupe.has(key)) continue;
        const minDistToCenters = Math.min(...centers.map((c) => haversine(p, c)));
        if (minDistToCenters > farthestDist) {
          farthestDist = minDistToCenters;
          farthest = p;
        }
      }
      if (!farthest) break;
      centers.push(farthest);
      dedupe.add(`${farthest.lat},${farthest.lng}`);
    }

    // weight each center by how many incidents fall closer to it than to any other center
    const weights = centers.map(() => 0);
    for (const p of points) {
      let bestIdx = 0;
      let bestDist = Infinity;
      centers.forEach((c, i) => {
        const d = haversine(p, c);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      weights[bestIdx]++;
    }

    return centers
      .map((c, i) => ({ lat: c.lat, lng: c.lng, incidentCount: weights[i] }))
      .sort((a, b) => b.incidentCount - a.incidentCount);
  }

  /** Greedy nearest-match of idle ambulances to hot zones. */
  suggest(k = 3) {
    const zones = this._hotZones(k);
    if (zones.length === 0) {
      return { zones: [], suggestions: [], note: "Not enough incident history yet to infer hot zones." };
    }

    const idle = this.ambulanceService.list().filter((a) => a.status === "available");
    const assignedAmbulanceIds = new Set();
    const suggestions = [];

    for (const zone of zones) {
      const pq = new MinHeap();
      for (const amb of idle) {
        if (assignedAmbulanceIds.has(amb.id)) continue;
        const node = this.graph.nodes.get(amb.currentNode);
        if (!node) continue;
        const straightLine = haversine(node, zone);
        pq.push({ priority: straightLine, ambulanceId: amb.id, currentNode: amb.currentNode });
      }
      if (pq.isEmpty()) continue;
      const nearest = pq.pop();
      assignedAmbulanceIds.add(nearest.ambulanceId);

      // find the nearest station/junction node to the zone centroid to give a concrete "move to" target
      let targetNodeId = null;
      let targetDist = Infinity;
      for (const node of this.graph.nodes.values()) {
        const d = haversine(node, zone);
        if (d < targetDist) {
          targetDist = d;
          targetNodeId = node.id;
        }
      }

      suggestions.push({
        ambulanceId: nearest.ambulanceId,
        fromNode: nearest.currentNode,
        suggestedNode: targetNodeId,
        zoneIncidentCount: zone.incidentCount,
        straightLineKm: +nearest.priority.toFixed(2),
      });
    }

    return { zones, suggestions };
  }
}

module.exports = RepositioningService;
