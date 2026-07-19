const floydWarshall = require("../dsa/FloydWarshall");
const { kruskalMST } = require("../dsa/UnionFind");
const config = require("../config");

/**
 * analyticsService.js
 * Floyd-Warshall is O(V^3) - cheap for a few dozen nodes, but pointless to
 * recompute from scratch on every dashboard poll when traffic (the only
 * thing that changes the weights) only actually moves every few seconds.
 * A short TTL cache means the expensive all-pairs computation runs at most
 * once per cache window no matter how many clients are polling the
 * dashboard - a real scalability lever as the number of connected clients grows.
 */
class AnalyticsService {
  constructor(graph, ambulanceService, hospitalService, dispatchService) {
    this.graph = graph;
    this.ambulanceService = ambulanceService;
    this.hospitalService = hospitalService;
    this.dispatchService = dispatchService;
    this._coverageCache = null;
    this._coverageCacheAt = 0;
  }

  summary() {
    const incidents = this.dispatchService.list();
    const resolved = incidents.filter((i) => i.status === "resolved");
    const dispatched = incidents.filter((i) => i.totalResponseMin != null);
    const avgResponse =
      dispatched.length > 0
        ? +(dispatched.reduce((s, i) => s + i.totalResponseMin, 0) / dispatched.length).toFixed(1)
        : 0;

    const fleet = this.ambulanceService.list();
    const busy = fleet.filter((a) => a.status !== "available").length;

    const hospitals = this.hospitalService.list().map((h) => ({
      id: h.id,
      name: h.name,
      freeBeds: h.freeBeds,
      occupied: h.occupied,
      utilization: +((h.occupied / h.beds) * 100).toFixed(0),
    }));

    const queued = incidents.filter((i) => i.status === "queued").length;

    return {
      totalIncidents: incidents.length,
      resolvedIncidents: resolved.length,
      queuedIncidents: queued,
      avgResponseMinutes: avgResponse,
      fleetSize: fleet.length,
      fleetBusy: busy,
      fleetUtilizationPct: fleet.length ? +((busy / fleet.length) * 100).toFixed(0) : 0,
      hospitals,
      recentIncidents: incidents.slice(0, 10),
    };
  }

  /** Average shortest-path distance from every station to every hospital - TTL cached. */
  coverageMatrix() {
    const now = Date.now();
    if (this._coverageCache && now - this._coverageCacheAt < config.analyticsCacheTtlMs) {
      return this._coverageCache;
    }

    const { ids, matrix, idx } = floydWarshall(this.graph);
    const stationIds = ids.filter((id) => this.graph.nodes.get(id).type === "station");
    const hospitalIds = ids.filter((id) => this.graph.nodes.get(id).type === "hospital");

    const rows = stationIds.map((sid) => {
      const distances = hospitalIds.map((hid) => ({
        hospitalId: hid,
        distance: +matrix[idx.get(sid)][idx.get(hid)].toFixed(2),
      }));
      const avg = +(distances.reduce((s, d) => s + d.distance, 0) / distances.length).toFixed(2);
      return { stationId: sid, distances, avgDistanceToHospitals: avg };
    });

    this._coverageCache = rows;
    this._coverageCacheAt = now;
    return rows;
  }

  networkResilience() {
    const { mstEdges, totalWeight } = kruskalMST(this.graph);
    return {
      criticalRoadCount: mstEdges.length,
      totalCriticalLengthKm: +totalWeight.toFixed(2),
      edges: mstEdges.map((e) => ({ edgeId: e.edgeId, a: e.a, b: e.b, distanceKm: e.base })),
    };
  }
}

module.exports = AnalyticsService;
