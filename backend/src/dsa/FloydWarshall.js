/**
 * FloydWarshall.js
 * All-pairs shortest paths across every hospital/station/junction node.
 * Powers the Analytics Dashboard: "average city-wide response time",
 * "most isolated zone", "hospital coverage heatmap".
 *
 * Time complexity: O(V^3) - fine here since city graphs in this simulator
 * stay in the tens/low-hundreds of nodes.
 */
function floydWarshall(graph) {
  const ids = [...graph.nodes.keys()];
  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const dist = Array.from({ length: n }, () => Array(n).fill(Infinity));

  for (let i = 0; i < n; i++) dist[i][i] = 0;

  for (const edge of graph.allEdges()) {
    const w = edge.base * edge.traffic;
    const i = idx.get(edge.a);
    const j = idx.get(edge.b);
    dist[i][j] = Math.min(dist[i][j], w);
    dist[j][i] = Math.min(dist[j][i], w);
  }

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (dist[i][k] === Infinity) continue;
      for (let j = 0; j < n; j++) {
        const alt = dist[i][k] + dist[k][j];
        if (alt < dist[i][j]) dist[i][j] = alt;
      }
    }
  }

  return { ids, matrix: dist, idx };
}

module.exports = floydWarshall;
