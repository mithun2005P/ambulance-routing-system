const dijkstra = require("../dsa/Dijkstra");
const { aStar } = require("../dsa/AStar");
const bellmanFord = require("../dsa/BellmanFord");

/**
 * routeService.js
 * Thin orchestration layer: picks the routing algorithm and shapes the
 * response with lat/lng polylines so the frontend can draw it on Leaflet.
 */
class RouteService {
  constructor(graph) {
    this.graph = graph;
  }

  _toPolyline(path) {
    return path.map((id) => {
      const n = this.graph.nodes.get(id);
      return { id, name: n.name, lat: n.lat, lng: n.lng, type: n.type };
    });
  }

  computeRoute(sourceId, targetId, algorithm = "dijkstra", blockedEdgeIds = [], options = {}) {
    let result;
    if (algorithm === "astar") {
      result = aStar(this.graph, sourceId, targetId, options);
    } else if (algorithm === "bellman-ford") {
      result = bellmanFord(this.graph, sourceId, targetId, new Set(blockedEdgeIds));
    } else {
      result = dijkstra(this.graph, sourceId, targetId, options);
    }
    if (!result) return null;
    return {
      ...result,
      etaMinutes: this._estimateEta(result.distance),
      polyline: this._toPolyline(result.path),
    };
  }

  /** Rough ETA model: avg 40km/h city driving for an ambulance with priority lanes. */
  _estimateEta(distanceKm) {
    const avgSpeedKmh = 40;
    return +((distanceKm / avgSpeedKmh) * 60).toFixed(1);
  }

  /** Full node-expansion trace for the Algorithm Visualizer - shows Dijkstra vs A* side by side. */
  traceRoute(sourceId, targetId) {
    const d = this.computeRoute(sourceId, targetId, "dijkstra", [], { trace: true });
    const a = this.computeRoute(sourceId, targetId, "astar", [], { trace: true });
    return {
      dijkstra: d && {
        distance: d.distance,
        visitedCount: d.visitedCount,
        visitOrder: d.visitOrder.map((v) => ({ ...this._toPolyline([v.id])[0], order: v.order, cost: v.cost })),
        path: this._toPolyline(d.path),
      },
      astar: a && {
        distance: a.distance,
        visitedCount: a.visitedCount,
        visitOrder: a.visitOrder.map((v) => ({ ...this._toPolyline([v.id])[0], order: v.order, cost: v.cost })),
        path: this._toPolyline(a.path),
      },
    };
  }

  /** Returns both Dijkstra and A* results side by side for the "compare algorithms" panel. */
  compareAlgorithms(sourceId, targetId) {
    const d = this.computeRoute(sourceId, targetId, "dijkstra");
    const a = this.computeRoute(sourceId, targetId, "astar");
    return {
      dijkstra: d && { distance: d.distance, visitedCount: d.visitedCount, etaMinutes: d.etaMinutes },
      astar: a && { distance: a.distance, visitedCount: a.visitedCount, etaMinutes: a.etaMinutes },
    };
  }
}

module.exports = RouteService;
