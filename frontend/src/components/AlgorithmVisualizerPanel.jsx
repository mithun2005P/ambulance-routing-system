import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import SearchBar from "./SearchBar";
import api from "../api";

/**
 * AlgorithmVisualizerPanel.jsx
 * Runs Dijkstra and A* on the same start/end pair and animates the order in
 * which each algorithm expands ("visits") nodes. This is the single most
 * useful thing to pull up in a viva: it makes the abstract "A* is Dijkstra
 * with a heuristic that focuses the search" claim visually undeniable -
 * Dijkstra's teal dots spread out roughly in a circle, A*'s amber dots
 * visibly stretch toward the destination and stop early.
 */
export default function AlgorithmVisualizerPanel() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [trace, setTrace] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(
      [31.35, 75.6],
      13
    );
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
  }, []);

  async function runTrace() {
    if (!from || !to) return;
    const result = await api.traceRoute(from.id, to.id);
    setTrace(result);
    animate(result);
  }

  function animate(result) {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current.clearLayers();
    setPlaying(true);

    const dijkstraOrder = result.dijkstra?.visitOrder || [];
    const astarOrder = result.astar?.visitOrder || [];
    const maxSteps = Math.max(dijkstraOrder.length, astarOrder.length);

    // fit bounds to all visited points across both algorithms
    const allPts = [...dijkstraOrder, ...astarOrder].map((p) => [p.lat, p.lng]);
    if (allPts.length) map.fitBounds(allPts, { padding: [40, 40] });

    let step = 0;
    const timer = setInterval(() => {
      if (step < dijkstraOrder.length) {
        const p = dijkstraOrder[step];
        L.circleMarker([p.lat, p.lng], {
          radius: 4,
          color: "#2ec4b6",
          fillColor: "#2ec4b6",
          fillOpacity: 0.85,
          weight: 1,
        }).addTo(layerRef.current);
      }
      if (step < astarOrder.length) {
        const p = astarOrder[step];
        L.circleMarker([p.lat, p.lng], {
          radius: 4,
          color: "#f0a84e",
          fillColor: "#f0a84e",
          fillOpacity: 0.55,
          weight: 1,
        }).addTo(layerRef.current);
      }
      step++;
      if (step >= maxSteps) {
        clearInterval(timer);
        // draw final paths on top
        if (result.dijkstra?.path?.length > 1) {
          L.polyline(
            result.dijkstra.path.map((p) => [p.lat, p.lng]),
            { color: "#2ec4b6", weight: 3, opacity: 0.9 }
          ).addTo(layerRef.current);
        }
        if (result.astar?.path?.length > 1) {
          L.polyline(
            result.astar.path.map((p) => [p.lat, p.lng]),
            { color: "#f0a84e", weight: 3, opacity: 0.9, dashArray: "2 6" }
          ).addTo(layerRef.current);
        }
        setPlaying(false);
      }
    }, speed);
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <div id="map" ref={containerRef} />
        <div className="map-legend">
          <div className="map-legend__item">
            <span className="map-legend__swatch" style={{ background: "#2ec4b6" }} />
            Dijkstra expansion
          </div>
          <div className="map-legend__item">
            <span className="map-legend__swatch" style={{ background: "#f0a84e" }} />
            A* expansion
          </div>
        </div>
      </div>

      <div style={{ width: 320, borderLeft: "1px solid var(--border)", padding: 16, overflowY: "auto" }}>
        <div className="panel__title">Algorithm Visualizer</div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 0 }}>
          Watch how Dijkstra expands outward uniformly while A* narrows toward
          the destination using a haversine heuristic — same guaranteed
          shortest path, far fewer nodes explored.
        </p>

        <div style={{ marginBottom: 10 }}>
          <SearchBar placeholder="Start location…" onSelect={setFrom} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <SearchBar placeholder="Destination…" onSelect={setTo} />
        </div>

        <button className="btn btn--primary btn--block" onClick={runTrace} disabled={!from || !to || playing}>
          {playing ? "Animating…" : "Run Trace"}
        </button>

        {trace && (
          <div className="list" style={{ marginTop: 16 }}>
            <div className="list-item">
              <div className="list-item__main">
                <span className="list-item__title">Dijkstra</span>
                <span className="list-item__meta">{trace.dijkstra?.distance?.toFixed(2)} km</span>
              </div>
              <span className="badge mono">{trace.dijkstra?.visitedCount} nodes</span>
            </div>
            <div className="list-item">
              <div className="list-item__main">
                <span className="list-item__title">A*</span>
                <span className="list-item__meta">{trace.astar?.distance?.toFixed(2)} km</span>
              </div>
              <span className="badge mono">{trace.astar?.visitedCount} nodes</span>
            </div>
            {trace.dijkstra && trace.astar && (
              <div className="empty-hint" style={{ padding: "10px 0 0", textAlign: "left" }}>
                A* explored{" "}
                <strong style={{ color: "var(--teal)" }}>
                  {Math.round((1 - trace.astar.visitedCount / trace.dijkstra.visitedCount) * 100)}%
                </strong>{" "}
                fewer nodes for the same shortest distance.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
