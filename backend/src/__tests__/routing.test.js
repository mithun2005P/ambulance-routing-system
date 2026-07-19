const Graph = require("../dsa/Graph");
const dijkstra = require("../dsa/Dijkstra");
const { aStar, haversine } = require("../dsa/AStar");
const bellmanFord = require("../dsa/BellmanFord");

function buildTestGraph() {
  const g = new Graph();
  g.addNode("A", "A", 0, 0);
  g.addNode("B", "B", 0, 0.01);
  g.addNode("C", "C", 0, 0.02);
  g.addNode("D", "D", 0.01, 0.01);
  g.addEdge("A", "B", 1);
  g.addEdge("B", "C", 1);
  g.addEdge("A", "D", 4);
  g.addEdge("D", "C", 1);
  return g;
}

describe("Dijkstra", () => {
  it("finds the shortest path by weight, not by hop count", () => {
    const g = buildTestGraph();
    const result = dijkstra(g, "A", "C");
    expect(result.distance).toBe(2);
    expect(result.path).toEqual(["A", "B", "C"]);
  });

  it("returns null for an unreachable target", () => {
    const g = new Graph();
    g.addNode("X", "X", 0, 0);
    g.addNode("Y", "Y", 1, 1);
    expect(dijkstra(g, "X", "Y")).toBeNull();
  });

  it("respects live traffic multipliers on edge weight", () => {
    const g = buildTestGraph();
    g.setTraffic(g.allEdges().find((e) => e.a === "A" && e.b === "B").edgeId, 5);
    const result = dijkstra(g, "A", "C");
    // A->B is now heavily congested (1*5=5 vs A->D->C = 4+1=5); either path is now tied/comparable
    expect(result.distance).toBeGreaterThanOrEqual(5);
  });
});

describe("A*", () => {
  it("finds the same optimal distance as Dijkstra", () => {
    const g = buildTestGraph();
    const d = dijkstra(g, "A", "C");
    const a = aStar(g, "A", "C");
    expect(a.distance).toBeCloseTo(d.distance, 5);
  });

  it("typically visits fewer or equal nodes than Dijkstra thanks to the heuristic", () => {
    const g = buildTestGraph();
    const d = dijkstra(g, "A", "C");
    const a = aStar(g, "A", "C");
    expect(a.visitedCount).toBeLessThanOrEqual(d.visitedCount);
  });
});

describe("haversine", () => {
  it("returns ~0 for identical points", () => {
    expect(haversine({ lat: 31.3, lng: 75.5 }, { lat: 31.3, lng: 75.5 })).toBeCloseTo(0, 5);
  });

  it("is symmetric", () => {
    const a = { lat: 31.3, lng: 75.5 };
    const b = { lat: 31.4, lng: 75.6 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 8);
  });
});

describe("Bellman-Ford", () => {
  it("finds an alternate path when the direct edge is blocked", () => {
    const g = buildTestGraph();
    const blockedEdge = g.allEdges().find((e) => e.a === "A" && e.b === "B");
    const result = bellmanFord(g, "A", "C", new Set([blockedEdge.edgeId]));
    expect(result.path).toEqual(["A", "D", "C"]);
  });

  it("returns null if blocking edges disconnects the target entirely", () => {
    const g = new Graph();
    g.addNode("P", "P", 0, 0);
    g.addNode("Q", "Q", 0, 0.01);
    const onlyEdge = g.addEdge("P", "Q", 1);
    const result = bellmanFord(g, "P", "Q", new Set([onlyEdge]));
    expect(result).toBeNull();
  });
});
