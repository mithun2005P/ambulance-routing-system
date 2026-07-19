import { useEffect, useState } from "react";
import api from "../api";

/**
 * RepositioningPanel.jsx
 * Surfaces the greedy k-center hot-zone analysis + greedy nearest-match
 * suggestions from repositioningService, with a one-click "Move" action that
 * calls the manual relocate endpoint.
 */
export default function RepositioningPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [movedIds, setMovedIds] = useState(new Set());

  async function load() {
    setLoading(true);
    const res = await api.suggestReposition(3);
    setData(res);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMove(s) {
    await api.relocateAmbulance(s.ambulanceId, s.suggestedNode);
    setMovedIds((prev) => new Set(prev).add(s.ambulanceId));
  }

  return (
    <div className="section-scroll">
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__title">
          Predictive Standby Repositioning
          <button className="btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={load} disabled={loading}>
            {loading ? "Analyzing…" : "Refresh"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 0 }}>
          Greedy farthest-point k-center clustering finds "hot zones" from
          incident history, then greedily matches the nearest idle ambulance
          to each zone — so units drift toward likely-demand areas instead of
          sitting idle at their home station.
        </p>
      </div>

      {!data || data.zones.length === 0 ? (
        <div className="panel">
          <div className="empty-hint">
            {data?.note || "Not enough incident history yet — dispatch a few incidents first."}
          </div>
        </div>
      ) : (
        <div className="grid-2">
          <div className="panel">
            <div className="panel__title">Hot Zones (greedy k-center)</div>
            <div className="list">
              {data.zones.map((z, i) => (
                <div className="list-item" key={i}>
                  <div className="list-item__main">
                    <span className="list-item__title">Zone {i + 1}</span>
                    <span className="list-item__meta mono">
                      {z.lat.toFixed(4)}, {z.lng.toFixed(4)}
                    </span>
                  </div>
                  <span className="badge badge--critical">{z.incidentCount} incidents</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel__title">Suggested Moves</div>
            {data.suggestions.length === 0 && (
              <div className="empty-hint">No idle ambulances to reposition right now.</div>
            )}
            <div className="list">
              {data.suggestions.map((s) => (
                <div className="list-item" key={s.ambulanceId}>
                  <div className="list-item__main">
                    <span className="list-item__title">{s.ambulanceId}</span>
                    <span className="list-item__meta">
                      {s.fromNode} → {s.suggestedNode} · {s.straightLineKm} km
                    </span>
                  </div>
                  {movedIds.has(s.ambulanceId) ? (
                    <span className="badge badge--live">moved</span>
                  ) : (
                    <button className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => handleMove(s)}>
                      Move
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
