const Graph = require("../dsa/Graph");

/**
 * cityNetwork.js
 * Synthetic mid-size city grid (~42 nodes) centered on Jalandhar, Punjab
 * coordinates so the map renders somewhere real by default. Swap this
 * loader for a real OSM/GeoJSON import later without touching any DSA code -
 * everything downstream only depends on the Graph interface.
 */
function buildCityNetwork() {
  const g = new Graph();
  const baseLat = 31.326;
  const baseLng = 75.5762;

  // 6x7 grid of junctions
  const rows = 6;
  const cols = 7;
  const id = (r, c) => `J${r}_${c}`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = baseLat + r * 0.011 + (Math.random() - 0.5) * 0.002;
      const lng = baseLng + c * 0.013 + (Math.random() - 0.5) * 0.002;
      g.addNode(id(r, c), `Junction ${r}-${c}`, lat, lng, "junction");
    }
  }

  // grid edges (roads) with slight randomized length in km
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1) {
        g.addEdge(id(r, c), id(r, c + 1), +(0.9 + Math.random() * 0.6).toFixed(2));
      }
      if (r < rows - 1) {
        g.addEdge(id(r, c), id(r + 1, c), +(0.9 + Math.random() * 0.6).toFixed(2));
      }
    }
  }
  // a few diagonal shortcuts / ring roads for realism & alternate-route variety
  const diagonals = [
    ["J0_0", "J1_1"], ["J1_2", "J2_3"], ["J2_4", "J3_5"], ["J3_1", "J4_2"],
    ["J4_4", "J5_5"], ["J0_5", "J1_4"], ["J2_0", "J3_1"], ["J1_5", "J2_6"],
  ];
  for (const [a, b] of diagonals) {
    if (g.nodes.has(a) && g.nodes.has(b)) {
      g.addEdge(a, b, +(1.1 + Math.random() * 0.7).toFixed(2));
    }
  }

  // Hospitals - attached to specific junctions
  const hospitals = [
    { id: "H1", name: "City Central Hospital", junction: "J1_1", beds: 12 },
    { id: "H2", name: "Sunrise Multi-Specialty Hospital", junction: "J2_5", beds: 8 },
    { id: "H3", name: "Lovely Trauma & Emergency Center", junction: "J4_3", beds: 15 },
    { id: "H4", name: "Riverside General Hospital", junction: "J5_1", beds: 6 },
  ];
  for (const h of hospitals) {
    const j = g.nodes.get(h.junction);
    g.addNode(h.id, h.name, j.lat + 0.001, j.lng + 0.001, "hospital");
    g.addEdge(h.id, h.junction, 0.2);
  }

  // Ambulance stations - attached to specific junctions
  const stations = [
    { id: "S1", name: "Station Alpha", junction: "J0_2" },
    { id: "S2", name: "Station Bravo", junction: "J2_1" },
    { id: "S3", name: "Station Charlie", junction: "J3_4" },
    { id: "S4", name: "Station Delta", junction: "J5_5" },
    { id: "S5", name: "Station Echo", junction: "J1_6" },
  ];
  for (const s of stations) {
    const j = g.nodes.get(s.junction);
    g.addNode(s.id, s.name, j.lat - 0.001, j.lng - 0.001, "station");
    g.addEdge(s.id, s.junction, 0.15);
  }

  return { graph: g, hospitals, stations };
}

module.exports = { buildCityNetwork };
