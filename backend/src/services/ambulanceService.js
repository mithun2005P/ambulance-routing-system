const dijkstra = require("../dsa/Dijkstra");
const MinHeap = require("../dsa/MinHeap");
const SpatialGrid = require("../dsa/SpatialGrid");
const config = require("../config");

/**
 * ambulanceService.js
 * Owns the live fleet state (in-memory Map, write-through to SQLite via the
 * repository). findNearestAvailable() is the optimized dispatch path:
 *   1. SpatialGrid.kNearest() cheaply narrows the field to K geographically
 *      closest AVAILABLE ambulances (straight-line distance).
 *   2. Only those K get an exact Dijkstra run.
 *   3. A MinHeap over the K exact results pops the true winner.
 * This keeps dispatch latency roughly constant as fleet size grows, instead
 * of scaling linearly with the number of available ambulances.
 */
class AmbulanceService {
  constructor(graph, stations, repository) {
    this.graph = graph;
    this.repository = repository;
    this.ambulances = new Map();
    this.grid = new SpatialGrid(0.01);

    const persisted = repository.loadAmbulances();
    if (persisted.length > 0) {
      for (const amb of persisted) this.ambulances.set(amb.id, amb);
    } else {
      let n = 1;
      for (const s of stations) {
        for (let i = 0; i < 2; i++) {
          const id = `AMB${n++}`;
          const amb = {
            id,
            homeStation: s.id,
            currentNode: s.id,
            status: "available",
            incidentId: null,
          };
          this.ambulances.set(id, amb);
          this.repository.saveAmbulance(amb);
        }
      }
    }

    this._rebuildGrid();
  }

  _rebuildGrid() {
    this.grid = new SpatialGrid(0.01);
    for (const amb of this.ambulances.values()) {
      const node = this.graph.nodes.get(amb.currentNode);
      if (node) this.grid.insert(amb.id, node.lat, node.lng);
    }
  }

  list() {
    return [...this.ambulances.values()];
  }

  get(id) {
    return this.ambulances.get(id);
  }

  setStatus(id, status, incidentId = null) {
    const amb = this.ambulances.get(id);
    if (!amb) return null;
    amb.status = status;
    amb.incidentId = incidentId;
    this.repository.saveAmbulance(amb);
    return amb;
  }

  moveTo(id, nodeId) {
    const amb = this.ambulances.get(id);
    if (!amb) return null;
    amb.currentNode = nodeId;
    this.repository.saveAmbulance(amb);
    this._rebuildGrid();
    return amb;
  }

  countAvailable() {
    let n = 0;
    for (const a of this.ambulances.values()) if (a.status === "available") n++;
    return n;
  }

  /**
   * Optimized nearest-available lookup: spatial-grid prefilter to K
   * candidates, exact Dijkstra only on those, MinHeap picks the winner.
   */
  findNearestAvailable(incidentNodeId, k = config.spatialPrefilterK) {
    const incidentNode = this.graph.nodes.get(incidentNodeId);
    if (!incidentNode) return null;

    const candidateIds = this.grid.kNearest(
      incidentNode.lat,
      incidentNode.lng,
      k,
      (id) => this.ambulances.get(id)?.status === "available"
    );
    if (candidateIds.length === 0) return null;

    const pq = new MinHeap();
    for (const c of candidateIds) {
      const amb = this.ambulances.get(c.id);
      const result = dijkstra(this.graph, amb.currentNode, incidentNodeId);
      if (result) pq.push({ priority: result.distance, ambulance: amb, route: result });
    }
    if (pq.isEmpty()) return null;
    const best = pq.pop();
    return {
      ambulance: best.ambulance,
      distanceKm: best.priority,
      route: best.route,
      candidatesEvaluated: candidateIds.length,
    };
  }
}

module.exports = AmbulanceService;
