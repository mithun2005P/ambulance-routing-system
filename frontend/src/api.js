import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const client = axios.create({ baseURL: BASE_URL });

export const api = {
  getNodes: () => client.get("/nodes").then((r) => r.data),
  getEdges: () => client.get("/edges").then((r) => r.data),
  search: (q) => client.get("/search", { params: { q } }).then((r) => r.data),
  getAmbulances: () => client.get("/ambulances").then((r) => r.data),
  getHospitals: () => client.get("/hospitals").then((r) => r.data),
  getTraffic: () => client.get("/traffic").then((r) => r.data),
  getRoute: (from, to, algorithm = "dijkstra") =>
    client.get("/route", { params: { from, to, algorithm } }).then((r) => r.data),
  compareRoutes: (from, to) =>
    client.get("/route/compare", { params: { from, to } }).then((r) => r.data),
  traceRoute: (from, to) =>
    client.get("/route/trace", { params: { from, to } }).then((r) => r.data),
  dispatch: (payload) => client.post("/dispatch", payload).then((r) => r.data),
  resolveIncident: (id) => client.post(`/dispatch/${id}/resolve`).then((r) => r.data),
  getIncidents: () => client.get("/incidents").then((r) => r.data),
  getQueue: () => client.get("/dispatch/queue").then((r) => r.data),
  getAnalyticsSummary: () => client.get("/analytics/summary").then((r) => r.data),
  getCoverage: () => client.get("/analytics/coverage").then((r) => r.data),
  getResilience: () => client.get("/analytics/resilience").then((r) => r.data),
  suggestReposition: (k = 3) => client.get("/reposition/suggest", { params: { k } }).then((r) => r.data),
  relocateAmbulance: (id, nodeId) => client.post(`/ambulances/${id}/relocate`, { nodeId }).then((r) => r.data),
};

export default api;
