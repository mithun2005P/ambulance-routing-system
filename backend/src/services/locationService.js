const Trie = require("../dsa/Trie");

/**
 * locationService.js
 * Builds a Trie over every node name (junctions, hospitals, stations) so the
 * frontend Search Bar can offer instant autocomplete as the user types.
 */
class LocationService {
  constructor(graph) {
    this.graph = graph;
    this.trie = new Trie();
    for (const node of graph.nodes.values()) {
      this.trie.insert(node.name, node.id);
      // also index each word separately so "hospital" or "central" match mid-name
      for (const word of node.name.split(" ")) {
        this.trie.insert(word, node.id);
      }
    }
  }

  search(prefix, limit = 8) {
    const matches = this.trie.search(prefix, limit * 3);
    const seen = new Set();
    const out = [];
    for (const m of matches) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const node = this.graph.nodes.get(m.id);
      out.push({ id: node.id, name: node.name, type: node.type, lat: node.lat, lng: node.lng });
      if (out.length >= limit) break;
    }
    return out;
  }

  all() {
    return [...this.graph.nodes.values()];
  }
}

module.exports = LocationService;
