/**
 * BellmanFord.js
 * Used for the "Alternate Route" feature: when a road segment is reported
 * blocked/closed (modelled as a huge penalty edge), Bellman-Ford recomputes
 * the shortest path while tolerating those penalty ("negative-like" relative
 * cost change) edges safely, and detects if a requested closure set makes the
 * target unreachable. Included for DSA-breadth (handles graphs where edge
 * weights change sign relative to a previous baseline, which Dijkstra cannot
 * safely handle).
 *
 * Time complexity: O(V * E)
 */
function bellmanFord(graph, sourceId, targetId, blockedEdgeIds = new Set()) {
  const dist = new Map();
  const prev = new Map();
  for (const id of graph.nodes.keys()) dist.set(id, Infinity);
  dist.set(sourceId, 0);

  const edges = [];
  for (const [id, list] of graph.adj) {
    for (const e of list) {
      if (!blockedEdgeIds.has(e.edgeId)) {
        edges.push({ from: id, to: e.to, weight: graph.effectiveWeight(e) });
      }
    }
  }

  const V = graph.nodes.size;
  for (let i = 0; i < V - 1; i++) {
    let changed = false;
    for (const e of edges) {
      if (dist.get(e.from) + e.weight < dist.get(e.to)) {
        dist.set(e.to, dist.get(e.from) + e.weight);
        prev.set(e.to, e.from);
        changed = true;
      }
    }
    if (!changed) break;
  }

  if (dist.get(targetId) === Infinity) return null;

  const path = [];
  let cur = targetId;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return { distance: dist.get(targetId), path, algorithm: "Bellman-Ford" };
}

module.exports = bellmanFord;
