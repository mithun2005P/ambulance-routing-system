const RouteService = require("./routeService");
const logger = require("../logger");

const SEVERITY_WEIGHT = { critical: 100, moderate: 50, minor: 10 };
const AGING_RATE_PER_SEC = 0.8; // priority points gained per second waiting - prevents starvation

/**
 * dispatchService.js
 *
 * Two paths:
 *  1. Normal load: an incident is reported, an ambulance + hospital are
 *     free, dispatch happens immediately and synchronously.
 *  2. Mass-casualty / surge load: resources are exhausted (every ambulance
 *     busy, or every nearby hospital full). Rather than reject the report,
 *     the incident enters a PENDING QUEUE. A background ticker re-evaluates
 *     that queue on every cycle, recomputing each incident's priority as
 *     severity + (waitTimeSeconds * agingRate). This "recompute don't
 *     decrease-key" approach deliberately sidesteps the classic
 *     decrease-key problem that comes with mutable-priority heaps: with a
 *     small pending list (realistically a handful of incidents at once)
 *     a full resort every tick is cheap and trivially correct, and it's
 *     the same aging technique OS schedulers use to stop a low-priority
 *     process from starving forever.
 */
class DispatchService {
  constructor(graph, ambulanceService, hospitalService, repository, io = null) {
    this.graph = graph;
    this.ambulanceService = ambulanceService;
    this.hospitalService = hospitalService;
    this.repository = repository;
    this.io = io;
    this.routeService = new RouteService(graph);
    this.incidents = new Map();
    this.pendingQueue = []; // incident ids waiting for resources
    this._counter = 1;
    this._timer = null;

    for (const inc of repository.loadIncidents()) {
      this.incidents.set(inc.id, inc);
      const m = inc.id.match(/^INC(\d+)$/);
      if (m) this._counter = Math.max(this._counter, parseInt(m[1], 10) + 1);
      if (inc.status === "queued") this.pendingQueue.push(inc.id);
    }
  }

  startQueueProcessor(intervalMs) {
    if (this._timer) return;
    this._timer = setInterval(() => this._drainQueue(), intervalMs);
  }

  stopQueueProcessor() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  _priorityScore(incident) {
    const waitSec = (Date.now() - incident.reportedAt) / 1000;
    return SEVERITY_WEIGHT[incident.severity] + waitSec * AGING_RATE_PER_SEC;
  }

  /** Attempts to immediately allocate an ambulance + hospital. Returns null if resources are exhausted. */
  _tryAllocate(incident) {
    const nearestAmb = this.ambulanceService.findNearestAvailable(incident.nodeId);
    if (!nearestAmb) return null;
    const nearestHospital = this.hospitalService.findNearestWithCapacity(incident.nodeId);
    if (!nearestHospital) return null;

    const toIncident = this.routeService.computeRoute(nearestAmb.ambulance.currentNode, incident.nodeId, "astar");
    const toHospital = this.routeService.computeRoute(incident.nodeId, nearestHospital.hospital.id, "astar");

    this.ambulanceService.setStatus(nearestAmb.ambulance.id, "dispatched", incident.id);
    this.hospitalService.admit(nearestHospital.hospital.id);

    incident.ambulanceId = nearestAmb.ambulance.id;
    incident.hospitalId = nearestHospital.hospital.id;
    incident.etaToSceneMin = toIncident.etaMinutes;
    incident.etaToHospitalMin = toHospital.etaMinutes;
    incident.totalResponseMin = +(toIncident.etaMinutes + toHospital.etaMinutes).toFixed(1);
    incident.dispatchedAt = Date.now();
    incident.status = "dispatched";
    incident.routeToIncident = toIncident.polyline;
    incident.routeToHospital = toHospital.polyline;
    incident.candidatesEvaluated = nearestAmb.candidatesEvaluated;

    return incident;
  }

  dispatch({ nodeId, severity = "moderate", description = "" }) {
    const incident = {
      id: `INC${this._counter++}`,
      nodeId,
      severity,
      description,
      ambulanceId: null,
      hospitalId: null,
      etaToSceneMin: null,
      etaToHospitalMin: null,
      totalResponseMin: null,
      reportedAt: Date.now(),
      dispatchedAt: null,
      resolvedAt: null,
      status: "queued",
      routeToIncident: [],
      routeToHospital: [],
    };

    const allocated = this._tryAllocate(incident);

    if (allocated) {
      this.incidents.set(incident.id, incident);
      this.repository.insertIncident(incident);
      logger.info({ incidentId: incident.id, ambulanceId: incident.ambulanceId }, "Incident dispatched immediately");
      return { success: true, incident, queued: false };
    }

    // Resources exhausted - enter the priority queue instead of failing outright.
    this.incidents.set(incident.id, incident);
    this.repository.insertIncident(incident);
    this.pendingQueue.push(incident.id);
    logger.warn({ incidentId: incident.id, queueDepth: this.pendingQueue.length }, "Incident queued - resources exhausted");
    return { success: true, incident, queued: true, reason: "All nearby units/hospitals busy - queued for dispatch." };
  }

  _drainQueue() {
    if (this.pendingQueue.length === 0) return;

    const ranked = this.pendingQueue
      .map((id) => this.incidents.get(id))
      .filter((inc) => inc && inc.status === "queued")
      .sort((a, b) => this._priorityScore(b) - this._priorityScore(a));

    const stillPending = [];
    for (const incident of ranked) {
      const allocated = this._tryAllocate(incident);
      if (allocated) {
        this.repository.updateIncidentDispatch(incident);
        if (this.io) this.io.emit("dispatch:new", incident);
        logger.info({ incidentId: incident.id }, "Queued incident dispatched");
      } else {
        stillPending.push(incident.id);
      }
    }
    this.pendingQueue = stillPending;
  }

  resolve(incidentId) {
    const inc = this.incidents.get(incidentId);
    if (!inc) return null;
    this.ambulanceService.setStatus(inc.ambulanceId, "available", null);
    this.ambulanceService.moveTo(inc.ambulanceId, inc.hospitalId);
    this.hospitalService.discharge(inc.hospitalId);
    inc.status = "resolved";
    inc.resolvedAt = Date.now();
    this.repository.resolveIncident(inc.id, inc.resolvedAt);
    return inc;
  }

  list() {
    return [...this.incidents.values()].sort((a, b) => b.reportedAt - a.reportedAt);
  }

  queueDepth() {
    return this.pendingQueue.length;
  }

  /** Pending incidents ranked by their live (aging-adjusted) priority score. */
  queueSnapshot() {
    return this.pendingQueue
      .map((id) => this.incidents.get(id))
      .filter((inc) => inc && inc.status === "queued")
      .map((inc) => ({ ...inc, priorityScore: +this._priorityScore(inc).toFixed(1) }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }
}

module.exports = DispatchService;
