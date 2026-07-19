const Trie = require("../dsa/Trie");
const { UnionFind, kruskalMST } = require("../dsa/UnionFind");
const SpatialGrid = require("../dsa/SpatialGrid");
const Graph = require("../dsa/Graph");

describe("Trie", () => {
  it("matches by prefix, case-insensitively", () => {
    const t = new Trie();
    t.insert("City Central Hospital", "H1");
    t.insert("Sunrise Hospital", "H2");
    const results = t.search("cit");
    expect(results.map((r) => r.id)).toContain("H1");
  });

  it("returns an empty array for a prefix with no matches", () => {
    const t = new Trie();
    t.insert("Riverside", "H4");
    expect(t.search("zzz")).toEqual([]);
  });
});

describe("UnionFind + Kruskal's MST", () => {
  it("union/find correctly merges and detects components", () => {
    const uf = new UnionFind(["a", "b", "c"]);
    expect(uf.find("a")).not.toBe(uf.find("b"));
    uf.union("a", "b");
    expect(uf.find("a")).toBe(uf.find("b"));
  });

  it("kruskalMST connects every node with the minimum total edge weight", () => {
    const g = new Graph();
    g.addNode("A", "A", 0, 0);
    g.addNode("B", "B", 0, 0);
    g.addNode("C", "C", 0, 0);
    g.addEdge("A", "B", 1);
    g.addEdge("B", "C", 2);
    g.addEdge("A", "C", 5); // redundant, more expensive edge - should be excluded
    const { mstEdges, totalWeight } = kruskalMST(g);
    expect(mstEdges.length).toBe(2); // n-1 edges for 3 nodes
    expect(totalWeight).toBe(3);
  });
});

describe("SpatialGrid", () => {
  it("finds the k nearest points by straight-line distance", () => {
    const grid = new SpatialGrid(0.01);
    grid.insert("near", 31.3, 75.5);
    grid.insert("mid", 31.32, 75.52);
    grid.insert("far", 31.5, 75.8);
    const results = grid.kNearest(31.3, 75.5, 2);
    expect(results.map((r) => r.id)).toEqual(["near", "mid"]);
  });

  it("respects the filter function", () => {
    const grid = new SpatialGrid(0.01);
    grid.insert("busy", 31.3, 75.5);
    grid.insert("free", 31.31, 75.51);
    const results = grid.kNearest(31.3, 75.5, 2, (id) => id !== "busy");
    expect(results.map((r) => r.id)).toEqual(["free"]);
  });
});
