import { useEffect, useRef } from "react";
import L from "leaflet";

const ICON_COLORS = {
  junction: "#565f72",
  hospital: "#2ec4b6",
  station: "#8b93a7",
};

function dotIcon(color, size = 10) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #0a0d13;box-shadow:0 0 0 1px ${color}55;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ambulanceIcon(status) {
  const color = status === "available" ? "#2ec4b6" : "#e6394f";
  return L.divIcon({
    className: "",
    html: `<div style="font-size:16px;transform:translate(-2px,-2px);filter:drop-shadow(0 0 4px ${color});">🚑</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function incidentIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="font-size:18px;transform:translate(-2px,-2px);">🚨</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/**
 * MapView.jsx
 * Thin imperative wrapper around Leaflet (kept out of React's diff cycle for
 * performance - markers/polylines are mutated directly). Renders:
 *   - all graph nodes (junctions, hospitals, stations)
 *   - live ambulance positions
 *   - traffic-colored road edges
 *   - the active dispatch route (station -> incident -> hospital)
 */
export default function MapView({ nodes, edges, ambulances, activeIncident, trafficByEdge }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layersRef = useRef({ edges: new Map(), nodes: new Map(), ambulances: new Map(), route: null, incident: null });

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const center = nodes.length ? [nodes[0].lat, nodes[0].lng] : [31.326, 75.5762];
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 14);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
  }, [nodes]);

  // Draw / update road edges colored by traffic congestion
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !edges.length || !nodes.length) return;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const e of edges) {
      const a = nodeMap.get(e.a);
      const b = nodeMap.get(e.b);
      if (!a || !b) continue;
      const traffic = trafficByEdge?.get(e.edgeId) ?? e.traffic ?? 1;
      const color = traffic > 2.2 ? "#e6394f" : traffic > 1.4 ? "#f0a84e" : "#2a3140";
      const weight = traffic > 2.2 ? 3 : traffic > 1.4 ? 2.4 : 1.6;

      let line = layersRef.current.edges.get(e.edgeId);
      if (!line) {
        line = L.polyline(
          [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ],
          { color, weight, opacity: 0.85 }
        ).addTo(map);
        layersRef.current.edges.set(e.edgeId, line);
      } else {
        line.setStyle({ color, weight });
      }
    }
  }, [edges, nodes, trafficByEdge]);

  // Draw static nodes (junctions/hospitals/stations)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !nodes.length) return;
    for (const n of nodes) {
      if (layersRef.current.nodes.has(n.id)) continue;
      const size = n.type === "junction" ? 5 : 11;
      const marker = L.marker([n.lat, n.lng], { icon: dotIcon(ICON_COLORS[n.type], size) }).addTo(map);
      if (n.type !== "junction") {
        marker.bindTooltip(n.name, { direction: "top", opacity: 0.9 });
      }
      layersRef.current.nodes.set(n.id, marker);
    }
  }, [nodes]);

  // Draw ambulances (redraws position + status color on every update)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ambulances?.length || !nodes.length) return;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const amb of ambulances) {
      const pos = nodeMap.get(amb.currentNode);
      if (!pos) continue;
      let marker = layersRef.current.ambulances.get(amb.id);
      if (!marker) {
        marker = L.marker([pos.lat, pos.lng], { icon: ambulanceIcon(amb.status) })
          .addTo(map)
          .bindTooltip(`${amb.id} — ${amb.status}`, { direction: "top" });
        layersRef.current.ambulances.set(amb.id, marker);
      } else {
        marker.setLatLng([pos.lat, pos.lng]);
        marker.setIcon(ambulanceIcon(amb.status));
      }
    }
  }, [ambulances, nodes]);

  // Draw the active dispatch route (incident scene + hospital transport legs)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layersRef.current.route) {
      map.removeLayer(layersRef.current.route);
      layersRef.current.route = null;
    }
    if (layersRef.current.incident) {
      map.removeLayer(layersRef.current.incident);
      layersRef.current.incident = null;
    }

    if (!activeIncident) return;

    const toIncident = activeIncident.routeToIncident || [];
    const toHospital = activeIncident.routeToHospital || [];
    const group = L.layerGroup();

    if (toIncident.length > 1) {
      L.polyline(
        toIncident.map((p) => [p.lat, p.lng]),
        { color: "#2ec4b6", weight: 4, opacity: 0.95, dashArray: "1 8", lineCap: "round" }
      ).addTo(group);
    }
    if (toHospital.length > 1) {
      L.polyline(
        toHospital.map((p) => [p.lat, p.lng]),
        { color: "#e6394f", weight: 4, opacity: 0.95 }
      ).addTo(group);
    }
    group.addTo(map);
    layersRef.current.route = group;

    const scene = toIncident[toIncident.length - 1];
    if (scene) {
      const marker = L.marker([scene.lat, scene.lng], { icon: incidentIcon() }).addTo(map);
      layersRef.current.incident = marker;
      map.flyTo([scene.lat, scene.lng], 15, { duration: 0.6 });
    }
  }, [activeIncident]);

  return (
    <>
      <div id="map" ref={containerRef} />
      <div className="map-legend">
        <div className="map-legend__item">
          <span className="map-legend__swatch" style={{ background: "#2ec4b6" }} />
          Hospital
        </div>
        <div className="map-legend__item">
          <span className="map-legend__swatch" style={{ background: "#8b93a7" }} />
          Station
        </div>
        <div className="map-legend__item">
          <span className="map-legend__swatch" style={{ background: "#e6394f" }} />
          Heavy traffic
        </div>
        <div className="map-legend__item">
          <span className="map-legend__swatch" style={{ background: "#f0a84e" }} />
          Moderate
        </div>
      </div>
    </>
  );
}
