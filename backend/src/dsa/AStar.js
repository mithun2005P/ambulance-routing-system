const MinHeap = require("./MinHeap");

/** Haversine great-circle distance in km - admissible heuristic (never overestimates
 *  the real road distance since roads are never shorter than the straight line). */
function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * AStar.js
 * A* search: g(n) = accumulated traffic-weighted distance, h(n) = haversine to target.
 * Faster than Dijkstra in practice because the heuristic focuses expansion toward
 * the target instead of exploring uniformly in all directions.
 */
function aStar(graph, sourceId, targetId, options = {}) {
  const { trace = false } = options;
  const target = graph.nodes.get(targetId);
  const g = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const id of graph.nodes.keys()) g.set(id, Infinity);
  g.set(sourceId, 0);

  const pq = new MinHeap();
  pq.push({ priority: haversine(graph.nodes.get(sourceId), target), id: sourceId });

  let visitedCount = 0;
  const visitOrder = [];

  while (!pq.isEmpty()) {
    const { id: u, priority: f } = pq.pop();
    if (visited.has(u)) continue;
    visited.add(u);
    visitedCount++;
    if (trace) visitOrder.push({ id: u, order: visitedCount, cost: f });

    if (u === targetId) break;

    for (const edge of graph.neighbors(u)) {
      const w = graph.effectiveWeight(edge);
      const tentativeG = g.get(u) + w;
      if (tentativeG < g.get(edge.to)) {
        g.set(edge.to, tentativeG);
        prev.set(edge.to, u);
        const f = tentativeG + haversine(graph.nodes.get(edge.to), target);
        pq.push({ priority: f, id: edge.to });
      }
    }
  }

  if (g.get(targetId) === Infinity) return null;

  const path = [];
  let cur = targetId;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }

  return {
    distance: g.get(targetId),
    path,
    visitedCount,
    algorithm: "A*",
    ...(trace ? { visitOrder } : {}),
  };
}

module.exports = { aStar, haversine };
