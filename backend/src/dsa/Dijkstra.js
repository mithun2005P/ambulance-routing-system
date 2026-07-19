const MinHeap = require("./MinHeap");

/**
 * Dijkstra.js
 * Classic single-source shortest path over non-negative, traffic-weighted edges.
 * Returns { distance, path[], visitedCount } or null if unreachable.
 *
 * Time complexity: O((V + E) log V) using a binary min-heap.
 */
function dijkstra(graph, sourceId, targetId, options = {}) {
  const { trace = false } = options;
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const id of graph.nodes.keys()) dist.set(id, Infinity);
  dist.set(sourceId, 0);

  const pq = new MinHeap();
  pq.push({ priority: 0, id: sourceId });

  let visitedCount = 0;
  const visitOrder = [];

  while (!pq.isEmpty()) {
    const { id: u, priority: d } = pq.pop();
    if (visited.has(u)) continue;
    visited.add(u);
    visitedCount++;
    if (trace) visitOrder.push({ id: u, order: visitedCount, cost: d });

    if (u === targetId) break;
    if (d > dist.get(u)) continue;

    for (const edge of graph.neighbors(u)) {
      const w = graph.effectiveWeight(edge);
      const alt = dist.get(u) + w;
      if (alt < dist.get(edge.to)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
        pq.push({ priority: alt, id: edge.to });
      }
    }
  }

  if (dist.get(targetId) === Infinity) return null;

  const path = [];
  let cur = targetId;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }

  return {
    distance: dist.get(targetId),
    path,
    visitedCount,
    algorithm: "Dijkstra",
    ...(trace ? { visitOrder } : {}),
  };
}

module.exports = dijkstra;
