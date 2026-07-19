const dijkstra = require("../dsa/Dijkstra");
const MinHeap = require("../dsa/MinHeap");
const SpatialGrid = require("../dsa/SpatialGrid");
const config = require("../config");

/**
 * hospitalService.js
 * Tracks each hospital's free bed capacity (persisted). Nearest-hospital
 * lookup uses the same spatial-grid prefilter + exact-Dijkstra + MinHeap
 * pattern as ambulanceService, and only ever considers hospitals that
 * currently have a free bed - a full hospital is filtered out before the
 * heap is even built, so a patient is never routed somewhere that can't
 * take them.
 */
class HospitalService {
  constructor(graph, hospitals, repository) {
    this.graph = graph;
    this.repository = repository;
    this.hospitals = new Map();
    this.grid = new SpatialGrid(0.01);

    const persisted = repository.loadHospitals();
    if (persisted.length > 0) {
      for (const h of persisted) this.hospitals.set(h.id, h);
    } else {
      for (const h of hospitals) {
        const record = { id: h.id, name: h.name, beds: h.beds, freeBeds: h.beds, occupied: 0 };
        this.hospitals.set(h.id, record);
        this.repository.saveHospital(record);
      }
    }

    for (const h of this.hospitals.values()) {
      const node = this.graph.nodes.get(h.id);
      if (node) this.grid.insert(h.id, node.lat, node.lng);
    }
  }

  list() {
    return [...this.hospitals.values()];
  }

  admit(hospitalId) {
    const h = this.hospitals.get(hospitalId);
    if (h && h.freeBeds > 0) {
      h.freeBeds -= 1;
      h.occupied += 1;
      this.repository.saveHospital(h);
      return true;
    }
    return false;
  }

  discharge(hospitalId) {
    const h = this.hospitals.get(hospitalId);
    if (h && h.occupied > 0) {
      h.freeBeds += 1;
      h.occupied -= 1;
      this.repository.saveHospital(h);
      return true;
    }
    return false;
  }

  findNearestWithCapacity(fromNodeId, k = config.spatialPrefilterK) {
    const fromNode = this.graph.nodes.get(fromNodeId);
    if (!fromNode) return null;

    const candidateIds = this.grid.kNearest(
      fromNode.lat,
      fromNode.lng,
      k,
      (id) => (this.hospitals.get(id)?.freeBeds ?? 0) > 0
    );
    if (candidateIds.length === 0) return null;

    const pq = new MinHeap();
    for (const c of candidateIds) {
      const h = this.hospitals.get(c.id);
      const result = dijkstra(this.graph, fromNodeId, h.id);
      if (result) pq.push({ priority: result.distance, hospital: h, route: result });
    }
    if (pq.isEmpty()) return null;
    const best = pq.pop();
    return { hospital: best.hospital, distanceKm: best.priority, route: best.route };
  }
}

module.exports = HospitalService;
