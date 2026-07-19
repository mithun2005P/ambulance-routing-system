import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "../api";

const PIE_COLORS = ["#e6394f", "#2ec4b6", "#f0a84e", "#8b93a7"];

export default function AnalyticsPanel() {
  const [summary, setSummary] = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [resilience, setResilience] = useState(null);

  useEffect(() => {
    async function load() {
      const [s, c, r] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getCoverage(),
        api.getResilience(),
      ]);
      setSummary(s);
      setCoverage(c);
      setResilience(r);
    }
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  if (!summary) return <div className="empty-hint">Loading analytics…</div>;

  const utilizationData = [
    { name: "Busy", value: summary.fleetBusy },
    { name: "Available", value: summary.fleetSize - summary.fleetBusy },
  ];

  const coverageData = coverage.map((c) => ({
    station: c.stationId,
    avgKm: c.avgDistanceToHospitals,
  }));

  return (
    <div className="section-scroll">
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="panel stat">
          <span className="stat__value">{summary.avgResponseMinutes}m</span>
          <span className="stat__label">Avg. response time</span>
        </div>
        <div className="panel stat">
          <span className="stat__value">{summary.totalIncidents}</span>
          <span className="stat__label">Total incidents</span>
        </div>
        <div className="panel stat">
          <span className="stat__value">{summary.fleetUtilizationPct}%</span>
          <span className="stat__label">Fleet utilization</span>
        </div>
        <div className="panel stat">
          <span className="stat__value">{resilience?.criticalRoadCount ?? "—"}</span>
          <span className="stat__label">Critical roads (MST)</span>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="chart-card">
          <div className="panel__title">Station → Hospital Coverage (Floyd–Warshall)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={coverageData}>
              <CartesianGrid stroke="#232a38" vertical={false} />
              <XAxis dataKey="station" stroke="#8b93a7" fontSize={11} />
              <YAxis stroke="#8b93a7" fontSize={11} unit="km" />
              <Tooltip
                contentStyle={{ background: "#171c27", border: "1px solid #232a38", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="avgKm" fill="#2ec4b6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="empty-hint" style={{ padding: "8px 0 0" }}>
            Average shortest-path distance from each ambulance station to every hospital.
          </div>
        </div>

        <div className="chart-card">
          <div className="panel__title">Fleet Utilization</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={utilizationData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {utilizationData.map((entry, idx) => (
                  <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#171c27", border: "1px solid #232a38", borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card">
        <div className="panel__title">Hospital Bed Utilization</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={summary.hospitals} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid stroke="#232a38" horizontal={false} />
            <XAxis type="number" stroke="#8b93a7" fontSize={11} unit="%" />
            <YAxis type="category" dataKey="name" stroke="#8b93a7" fontSize={11} width={160} />
            <Tooltip
              contentStyle={{ background: "#171c27", border: "1px solid #232a38", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="utilization" fill="#e6394f" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
