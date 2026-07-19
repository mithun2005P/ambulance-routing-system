/**
 * Graph.js
 * Weighted, undirected road-network graph using an adjacency list.
 * Each node represents a junction / landmark / hospital / ambulance station.
 * Each edge represents a road segment with a base distance (km) and a
 * live "trafficMultiplier" (>= 1) that TrafficService mutates over time
 * to simulate congestion. effectiveWeight = baseDistance * trafficMultiplier.
 */
class Graph {
  constructor() {
    this.nodes = new Map(); // id -> { id, name, lat, lng, type }
    this.adj = new Map();   // id -> [{ to, base, traffic, edgeId }]
    this.edgeIndex = new Map(); // edgeId -> { a, b }
    this._edgeCounter = 0;
  }

  addNode(id, name, lat, lng, type = "junction") {
    this.nodes.set(id, { id, name, lat, lng, type });
    if (!this.adj.has(id)) this.adj.set(id, []);
  }

  addEdge(a, b, baseDistanceKm) {
    const edgeId = `e${this._edgeCounter++}`;
    this.adj.get(a).push({ to: b, base: baseDistanceKm, traffic: 1.0, edgeId });
    this.adj.get(b).push({ to: a, base: baseDistanceKm, traffic: 1.0, edgeId });
    this.edgeIndex.set(edgeId, { a, b });
    return edgeId;
  }

  neighbors(id) {
    return this.adj.get(id) || [];
  }

  effectiveWeight(edge) {
    return edge.base * edge.traffic;
  }

  setTraffic(edgeId, multiplier) {
    const { a, b } = this.edgeIndex.get(edgeId);
    for (const e of this.adj.get(a)) if (e.edgeId === edgeId) e.traffic = multiplier;
    for (const e of this.adj.get(b)) if (e.edgeId === edgeId) e.traffic = multiplier;
  }

  allEdges() {
    const seen = new Set();
    const out = [];
    for (const [id, list] of this.adj) {
      for (const e of list) {
        if (!seen.has(e.edgeId)) {
          seen.add(e.edgeId);
          out.push({ edgeId: e.edgeId, a: id, b: e.to, base: e.base, traffic: e.traffic });
        }
      }
    }
    return out;
  }

  /** BFS - used for connectivity checks / hop-count nearest-node fallback */
  bfs(startId) {
    const visited = new Set([startId]);
    const order = [];
    const queue = [startId];
    while (queue.length) {
      const cur = queue.shift();
      order.push(cur);
      for (const e of this.neighbors(cur)) {
        if (!visited.has(e.to)) {
          visited.add(e.to);
          queue.push(e.to);
        }
      }
    }
    return order;
  }

  /** DFS - used for reachability validation before dispatch */
  dfs(startId) {
    const visited = new Set();
    const order = [];
    const stack = [startId];
    while (stack.length) {
      const cur = stack.pop();
      if (visited.has(cur)) continue;
      visited.add(cur);
      order.push(cur);
      for (const e of this.neighbors(cur)) {
        if (!visited.has(e.to)) stack.push(e.to);
      }
    }
    return order;
  }
}

module.exports = Graph;
