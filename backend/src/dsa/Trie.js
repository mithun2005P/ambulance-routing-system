/**
 * Trie.js
 * Prefix tree powering the Search Bar's autocomplete for locations,
 * hospitals, and ambulance stations. O(k) lookup where k = prefix length,
 * independent of how many locations exist in the city.
 */
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEnd = false;
    this.refs = []; // node ids that share this exact name-fragment ending here
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(text, nodeId) {
    let cur = this.root;
    const norm = text.toLowerCase();
    for (const ch of norm) {
      if (!cur.children.has(ch)) cur.children.set(ch, new TrieNode());
      cur = cur.children.get(ch);
    }
    cur.isEnd = true;
    cur.refs.push(nodeId);
  }

  _collect(node, prefix, out, limit) {
    if (out.length >= limit) return;
    if (node.isEnd) {
      for (const id of node.refs) {
        out.push({ id, matched: prefix });
        if (out.length >= limit) return;
      }
    }
    for (const [ch, child] of node.children) {
      this._collect(child, prefix + ch, out, limit);
      if (out.length >= limit) return;
    }
  }

  search(prefix, limit = 8) {
    let cur = this.root;
    const norm = prefix.toLowerCase();
    for (const ch of norm) {
      if (!cur.children.has(ch)) return [];
      cur = cur.children.get(ch);
    }
    const out = [];
    this._collect(cur, norm, out, limit);
    return out;
  }
}

module.exports = Trie;
