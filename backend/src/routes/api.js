const express = require("express");
const validate = require("../middleware/validate");
const { AppError } = require("../middleware/errorHandler");
const { dispatchSchema, routeQuerySchema, searchQuerySchema, relocateSchema } = require("../schemas");

function buildApiRouter(services) {
  const {
    graph,
    ambulanceService,
    hospitalService,
    routeService,
    trafficService,
    dispatchService,
    analyticsService,
    locationService,
    repositioningService,
  } = services;

  const router = express.Router();

  // ---- Map / world data ----
  router.get("/nodes", (req, res) => {
    res.json([...graph.nodes.values()]);
  });

  router.get("/edges", (req, res) => {
    res.json(graph.allEdges());
  });

  // ---- Search / autocomplete (Trie) ----
  router.get("/search", validate(searchQuerySchema, "query"), (req, res) => {
    res.json(locationService.search(req.query.q));
  });

  // ---- Fleet ----
  router.get("/ambulances", (req, res) => {
    res.json(ambulanceService.list());
  });

  router.post("/ambulances/:id/relocate", validate(relocateSchema), (req, res) => {
    const amb = ambulanceService.get(req.params.id);
    if (!amb) throw new AppError("Ambulance not found", 404, "AMBULANCE_NOT_FOUND");
    if (amb.status !== "available") {
      throw new AppError("Only available (idle) ambulances can be manually relocated", 409, "AMBULANCE_BUSY");
    }
    if (!graph.nodes.has(req.body.nodeId)) {
      throw new AppError("Unknown target nodeId", 400, "NODE_NOT_FOUND");
    }
    const updated = ambulanceService.moveTo(req.params.id, req.body.nodeId);
    res.json(updated);
  });

  // ---- Hospitals ----
  router.get("/hospitals", (req, res) => {
    res.json(hospitalService.list());
  });

  // ---- Traffic ----
  router.get("/traffic", (req, res) => {
    res.json(trafficService.snapshot());
  });

  // ---- Route planning ----
  router.get("/route", validate(routeQuerySchema, "query"), (req, res) => {
    const { from, to, algorithm } = req.query;
    if (!graph.nodes.has(from) || !graph.nodes.has(to)) {
      throw new AppError("Unknown node id", 404, "NODE_NOT_FOUND");
    }
    const result = routeService.computeRoute(from, to, algorithm);
    if (!result) throw new AppError("No path found between the given nodes", 404, "NO_PATH");
    res.json(result);
  });

  router.get("/route/compare", (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) throw new AppError("from and to are required", 400, "MISSING_PARAMS");
    res.json(routeService.compareAlgorithms(from, to));
  });

  // Algorithm Visualizer: full node-expansion trace for Dijkstra vs A*
  router.get("/route/trace", (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) throw new AppError("from and to are required", 400, "MISSING_PARAMS");
    if (!graph.nodes.has(from) || !graph.nodes.has(to)) {
      throw new AppError("Unknown node id", 404, "NODE_NOT_FOUND");
    }
    res.json(routeService.traceRoute(from, to));
  });

  // ---- Emergency dispatch (core feature) ----
  router.post("/dispatch", validate(dispatchSchema), (req, res) => {
    const { nodeId, severity, description } = req.body;
    if (!graph.nodes.has(nodeId)) {
      throw new AppError("Valid nodeId is required", 400, "NODE_NOT_FOUND");
    }
    const result = dispatchService.dispatch({ nodeId, severity, description });

    if (result.incident.status === "dispatched" && services.io) {
      services.io.emit("dispatch:new", result.incident);
    }
    res.json(result);
  });

  router.post("/dispatch/:id/resolve", (req, res) => {
    const inc = dispatchService.resolve(req.params.id);
    if (!inc) throw new AppError("Incident not found", 404, "INCIDENT_NOT_FOUND");
    if (services.io) services.io.emit("dispatch:resolved", inc);
    res.json(inc);
  });

  router.get("/dispatch/queue", (req, res) => {
    res.json({
      depth: dispatchService.queueDepth(),
      incidents: dispatchService.queueSnapshot(),
    });
  });

  router.get("/incidents", (req, res) => {
    res.json(dispatchService.list());
  });

  // ---- Predictive repositioning (greedy k-center + greedy matching) ----
  router.get("/reposition/suggest", (req, res) => {
    const k = parseInt(req.query.k, 10) || 3;
    res.json(repositioningService.suggest(k));
  });

  // ---- Analytics ----
  router.get("/analytics/summary", (req, res) => {
    res.json(analyticsService.summary());
  });

  router.get("/analytics/coverage", (req, res) => {
    res.json(analyticsService.coverageMatrix());
  });

  router.get("/analytics/resilience", (req, res) => {
    res.json(analyticsService.networkResilience());
  });

  return router;
}

module.exports = buildApiRouter;
