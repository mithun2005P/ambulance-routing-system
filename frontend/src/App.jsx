import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import MapView from "./components/MapView";
import DispatchPanel from "./components/DispatchPanel";
import FleetPanel from "./components/FleetPanel";
import SearchBar from "./components/SearchBar";
import api from "./api";
import { socket } from "./socket";

// Code-split the heavier, less-frequently-opened views so the initial bundle
// (map + dispatch console, what most sessions actually use) stays small.
const AnalyticsPanel = lazy(() => import("./components/AnalyticsPanel"));
const AlgorithmVisualizerPanel = lazy(() => import("./components/AlgorithmVisualizerPanel"));
const RepositioningPanel = lazy(() => import("./components/RepositioningPanel"));

const NAV_ITEMS = [
  { key: "dispatch", label: "Dispatch Console" },
  { key: "visualizer", label: "Algorithm Visualizer" },
  { key: "reposition", label: "Repositioning" },
  { key: "analytics", label: "Analytics" },
];

function PanelLoading() {
  return <div className="empty-hint" style={{ padding: 40 }}>Loading…</div>;
}

export default function App() {
  const [view, setView] = useState("dispatch");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const [activeIncident, setActiveIncident] = useState(null);
  const [trafficByEdge, setTrafficByEdge] = useState(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function loadWorld() {
      const [n, e] = await Promise.all([api.getNodes(), api.getEdges()]);
      setNodes(n);
      setEdges(e);
      setTrafficByEdge(new Map(e.map((edge) => [edge.edgeId, edge.traffic])));
    }
    loadWorld();
  }, []);

  useEffect(() => {
    async function refresh() {
      const [a, h, i, q] = await Promise.all([
        api.getAmbulances(),
        api.getHospitals(),
        api.getIncidents(),
        api.getQueue(),
      ]);
      setAmbulances(a);
      setHospitals(h);
      setIncidents(i);
      setQueueDepth(q.depth);
    }
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onTraffic(diffOrSnapshot) {
      // Backend now sends only changed edges after the initial connect
      // snapshot - merge into the existing map instead of replacing it,
      // so we don't discard state for edges that simply didn't move this tick.
      setTrafficByEdge((prev) => {
        const next = new Map(prev);
        for (const e of diffOrSnapshot) next.set(e.edgeId, e.traffic);
        return next;
      });
    }
    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onDispatchNew(incident) {
      setIncidents((cur) => {
        const withoutOld = cur.filter((i) => i.id !== incident.id);
        return [incident, ...withoutOld];
      });
    }
    socket.on("traffic:update", onTraffic);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("dispatch:new", onDispatchNew);
    return () => {
      socket.off("traffic:update", onTraffic);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("dispatch:new", onDispatchNew);
    };
  }, []);

  async function handleResolve(incidentId) {
    await api.resolveIncident(incidentId);
    const i = await api.getIncidents();
    setIncidents(i);
    if (activeIncident?.id === incidentId) setActiveIncident(null);
  }

  const summaryChip = useMemo(() => {
    const available = ambulances.filter((a) => a.status === "available").length;
    return `${available}/${ambulances.length} ambulances ready`;
  }, [ambulances]);

  return (
    <div className="shell">
      <div className="brand">
        <span className="brand__pulse" />
        <div>
          <div className="brand__title">SENTINEL</div>
          <div className="brand__subtitle">Emergency Routing</div>
        </div>
      </div>

      <div className="topbar">
        <SearchBar onSelect={() => {}} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {queueDepth > 0 && <span className="badge badge--moderate">{queueDepth} queued</span>}
          <span className="badge">{summaryChip}</span>
          <span className={`badge ${connected ? "badge--live" : ""}`}>
            {connected ? "● Live traffic connected" : "○ Connecting…"}
          </span>
        </div>
      </div>

      <div className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav__item ${view === item.key ? "active" : ""}`}
            onClick={() => setView(item.key)}
          >
            <span className="dot" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="main">
        <Suspense fallback={<PanelLoading />}>
          {view === "dispatch" && (
            <MapView
              nodes={nodes}
              edges={edges}
              ambulances={ambulances}
              activeIncident={activeIncident}
              trafficByEdge={trafficByEdge}
            />
          )}
          {view === "analytics" && <AnalyticsPanel />}
          {view === "visualizer" && <AlgorithmVisualizerPanel />}
          {view === "reposition" && <RepositioningPanel />}
        </Suspense>
      </div>

      <div className="aside">
        <DispatchPanel
          onDispatched={(incident, queued) => {
            if (!queued) setActiveIncident(incident);
            setIncidents((cur) => [incident, ...cur.filter((i) => i.id !== incident.id)]);
          }}
        />
        <FleetPanel ambulances={ambulances} hospitals={hospitals} incidents={incidents} onResolve={handleResolve} />
      </div>
    </div>
  );
}
