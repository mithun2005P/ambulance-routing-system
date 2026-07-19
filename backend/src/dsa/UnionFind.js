/**
 * UnionFind.js
 * Disjoint Set Union with path compression + union by rank.
 * Backs Kruskal's MST, used by the "Network Optimization" analytics module
 * to suggest the minimum set of roads that must stay open to keep every
 * hospital/station connected during a large-scale disaster / road-closure event.
 */
class UnionFind {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
    this.rank = new Map(ids.map((id) => [id, 0]));
  }

  find(x) {
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)));
    }
    return this.parent.get(x);
  }

  union(x, y) {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return false;
    if (this.rank.get(rx) < this.rank.get(ry)) {
      this.parent.set(rx, ry);
    } else if (this.rank.get(rx) > this.rank.get(ry)) {
      this.parent.set(ry, rx);
    } else {
      this.parent.set(ry, rx);
      this.rank.set(rx, this.rank.get(rx) + 1);
    }
    return true;
  }
}

/** Kruskal's MST - minimum total road length that keeps the whole city connected. */
function kruskalMST(graph) {
  const edges = graph.allEdges().sort((a, b) => a.base - b.base);
  const uf = new UnionFind([...graph.nodes.keys()]);
  const mstEdges = [];
  let totalWeight = 0;

  for (const e of edges) {
    if (uf.union(e.a, e.b)) {
      mstEdges.push(e);
      totalWeight += e.base;
    }
  }

  return { mstEdges, totalWeight };
}

module.exports = { UnionFind, kruskalMST };
