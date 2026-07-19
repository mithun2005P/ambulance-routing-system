export default function FleetPanel({ ambulances, hospitals, incidents, onResolve }) {
  const available = ambulances.filter((a) => a.status === "available").length;

  return (
    <>
      <div className="panel">
        <div className="panel__title">
          Fleet Status
          <span className="badge">
            {available}/{ambulances.length} available
          </span>
        </div>
        <div className="list">
          {ambulances.map((a) => (
            <div className="list-item" key={a.id}>
              <div className="list-item__main">
                <span className="list-item__title">
                  <span className={`status-dot status-dot--${a.status === "available" ? "available" : "busy"}`} />
                  {a.id}
                </span>
                <span className="list-item__meta">{a.homeStation} · {a.currentNode}</span>
              </div>
              <span className="badge">{a.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel__title">Hospital Capacity</div>
        <div className="list">
          {hospitals.map((h) => (
            <div className="list-item" key={h.id}>
              <div className="list-item__main">
                <span className="list-item__title">{h.name}</span>
                <span className="list-item__meta">{h.freeBeds}/{h.beds} beds free</span>
              </div>
              <span className="badge mono">{Math.round((h.occupied / h.beds) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel__title">Active Incidents</div>
        {incidents.length === 0 && <div className="empty-hint">No incidents reported yet.</div>}
        <div className="list">
          {incidents.map((i) => (
            <div className="list-item" key={i.id}>
              <div className="list-item__main">
                <span className="list-item__title">{i.id} · {i.nodeId}</span>
                <span className="list-item__meta">
                  {i.status === "queued"
                    ? `Waiting for resources · priority ${i.priorityScore ?? "—"}`
                    : `${i.ambulanceId} → ${i.hospitalId} · ${i.totalResponseMin}m`}
                </span>
              </div>
              {i.status === "dispatched" ? (
                <button className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onResolve(i.id)}>
                  Resolve
                </button>
              ) : i.status === "queued" ? (
                <span className="badge badge--moderate">queued</span>
              ) : (
                <span className="badge badge--live">resolved</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
