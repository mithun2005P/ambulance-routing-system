/**
 * trafficService.js
 * Simulates "live traffic" by periodically nudging each edge's traffic
 * multiplier up or down (mean-reverting random walk, clamped [1.0, 3.5]).
 * A multiplier of 1.0 = free flow, 3.5 = severe jam. This is what makes
 * Dijkstra/A* re-route dynamically over time instead of always returning
 * the same static shortest path.
 */
class TrafficService {
  constructor(graph, io = null) {
    this.graph = graph;
    this.io = io;
    this.timer = null;
  }

  start(intervalMs = 5000) {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    const edges = this.graph.allEdges();
    const changed = [];
    for (const e of edges) {
      const drift = (Math.random() - 0.55) * 0.35; // slight upward bias -> occasional jams
      let next = e.traffic + drift;
      next = Math.max(1.0, Math.min(3.5, next));
      next = +next.toFixed(2);
      if (Math.abs(next - e.traffic) > 0.02) {
        this.graph.setTraffic(e.edgeId, next);
        changed.push(e.edgeId);
      }
    }
    // Only broadcast edges that actually moved - keeps the socket payload
    // small as the road network grows, instead of resending every edge every tick.
    if (this.io && changed.length > 0) {
      const changedSet = new Set(changed);
      const diff = this.graph.allEdges().filter((e) => changedSet.has(e.edgeId));
      this.io.emit(
        "traffic:update",
        diff.map((e) => ({ edgeId: e.edgeId, a: e.a, b: e.b, traffic: e.traffic, congestion: this._level(e.traffic) }))
      );
    }
  }

  snapshot() {
    return this.graph.allEdges().map((e) => ({
      edgeId: e.edgeId,
      a: e.a,
      b: e.b,
      traffic: e.traffic,
      congestion: this._level(e.traffic),
    }));
  }

  _level(multiplier) {
    if (multiplier < 1.4) return "low";
    if (multiplier < 2.2) return "moderate";
    return "heavy";
  }
}

module.exports = TrafficService;
