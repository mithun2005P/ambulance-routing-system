import { useState } from "react";
import SearchBar from "./SearchBar";
import api from "../api";

const SEVERITIES = [
  { key: "critical", label: "Critical" },
  { key: "moderate", label: "Moderate" },
  { key: "minor", label: "Minor" },
];

export default function DispatchPanel({ onDispatched }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [severity, setSeverity] = useState("critical");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [queued, setQueued] = useState(false);

  async function handleDispatch() {
    if (!selectedNode) {
      setError("Pick an incident location first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.dispatch({
        nodeId: selectedNode.id,
        severity,
        description: description || `${severity} incident at ${selectedNode.name}`,
      });
      setLastResult(res.incident);
      setQueued(!!res.queued);
      onDispatched?.(res.incident, res.queued);
    } catch (e) {
      setError(e.response?.data?.error || "Dispatch failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel__title">
        Report Emergency
        <span className="badge badge--live">Live dispatch</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <SearchBar
          placeholder="Incident location…"
          onSelect={(n) => {
            setSelectedNode(n);
            setError(null);
          }}
        />
      </div>

      <div className="severity-row" style={{ marginBottom: 12 }}>
        {SEVERITIES.map((s) => (
          <div
            key={s.key}
            className={`severity-chip ${severity === s.key ? "active" : ""}`}
            data-level={s.key}
            onClick={() => setSeverity(s.key)}
          >
            {s.label}
          </div>
        ))}
      </div>

      <textarea
        className="search-input"
        style={{ width: "100%", minHeight: 56, resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
        placeholder="Short description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button className="btn btn--primary btn--block" onClick={handleDispatch} disabled={loading}>
        {loading ? "Dispatching…" : "Dispatch Nearest Ambulance"}
      </button>

      {error && (
        <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{error}</div>
      )}

      {lastResult && queued && (
        <div className="list-item" style={{ marginTop: 14 }}>
          <div className="list-item__main">
            <span className="list-item__title">{lastResult.id} queued</span>
            <span className="list-item__meta">All nearby units/hospitals busy — will dispatch automatically once free</span>
          </div>
          <span className="badge badge--moderate">waiting</span>
        </div>
      )}

      {lastResult && !queued && (
        <div className="list" style={{ marginTop: 14 }}>
          <div className="list-item">
            <div className="list-item__main">
              <span className="list-item__title">{lastResult.ambulanceId} en route</span>
              <span className="list-item__meta">ETA to scene: {lastResult.etaToSceneMin} min</span>
            </div>
            <span className="badge badge--critical">{lastResult.severity}</span>
          </div>
          <div className="list-item">
            <div className="list-item__main">
              <span className="list-item__title">→ {lastResult.hospitalId}</span>
              <span className="list-item__meta">Transport ETA: {lastResult.etaToHospitalMin} min</span>
            </div>
            <span className="badge mono">{lastResult.totalResponseMin}m total</span>
          </div>
        </div>
      )}
    </div>
  );
}
