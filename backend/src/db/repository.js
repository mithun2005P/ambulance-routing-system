/**
 * repository.js
 * Thin data-access layer over SQLite. Every query is a prepared statement
 * (compiled once, reused) - the main reason hand-rolled SQL here is fast
 * enough to sit on the write path of every dispatch without adding
 * noticeable latency.
 *
 * Services keep an in-memory Map as a read cache and call through to this
 * repository to persist mutations (write-through). That gives us in-memory
 * speed for the hot path (finding the nearest ambulance) while still being
 * durable across restarts - the best of both without needing a cache
 * invalidation strategy, since this process is the only writer.
 */
function createRepository(db) {
  const stmts = {
    upsertAmbulance: db.prepare(`
      INSERT INTO ambulances (id, home_station, current_node, status, incident_id)
      VALUES (@id, @homeStation, @currentNode, @status, @incidentId)
      ON CONFLICT(id) DO UPDATE SET
        current_node = excluded.current_node,
        status = excluded.status,
        incident_id = excluded.incident_id
    `),
    allAmbulances: db.prepare(`SELECT * FROM ambulances`),

    upsertHospital: db.prepare(`
      INSERT INTO hospitals (id, name, beds, free_beds)
      VALUES (@id, @name, @beds, @freeBeds)
      ON CONFLICT(id) DO UPDATE SET free_beds = excluded.free_beds
    `),
    allHospitals: db.prepare(`SELECT * FROM hospitals`),

    insertIncident: db.prepare(`
      INSERT INTO incidents (
        id, node_id, severity, description, ambulance_id, hospital_id,
        eta_to_scene_min, eta_to_hospital_min, total_response_min, status,
        reported_at, dispatched_at, route_to_incident_json, route_to_hospital_json
      ) VALUES (
        @id, @nodeId, @severity, @description, @ambulanceId, @hospitalId,
        @etaToSceneMin, @etaToHospitalMin, @totalResponseMin, @status,
        @reportedAt, @dispatchedAt, @routeToIncidentJson, @routeToHospitalJson
      )
    `),
    resolveIncident: db.prepare(`
      UPDATE incidents SET status = 'resolved', resolved_at = @resolvedAt WHERE id = @id
    `),
    updateIncidentStatus: db.prepare(`UPDATE incidents SET status = @status WHERE id = @id`),
    updateIncidentDispatch: db.prepare(`
      UPDATE incidents SET
        ambulance_id = @ambulanceId,
        hospital_id = @hospitalId,
        eta_to_scene_min = @etaToSceneMin,
        eta_to_hospital_min = @etaToHospitalMin,
        total_response_min = @totalResponseMin,
        status = 'dispatched',
        dispatched_at = @dispatchedAt,
        route_to_incident_json = @routeToIncidentJson,
        route_to_hospital_json = @routeToHospitalJson
      WHERE id = @id
    `),
    allIncidents: db.prepare(`SELECT * FROM incidents ORDER BY reported_at DESC LIMIT @limit`),
    incidentById: db.prepare(`SELECT * FROM incidents WHERE id = @id`),
  };

  function rowToAmbulance(r) {
    return {
      id: r.id,
      homeStation: r.home_station,
      currentNode: r.current_node,
      status: r.status,
      incidentId: r.incident_id,
    };
  }

  function rowToHospital(r) {
    return { id: r.id, name: r.name, beds: r.beds, freeBeds: r.free_beds, occupied: r.beds - r.free_beds };
  }

  function rowToIncident(r) {
    return {
      id: r.id,
      nodeId: r.node_id,
      severity: r.severity,
      description: r.description,
      ambulanceId: r.ambulance_id,
      hospitalId: r.hospital_id,
      etaToSceneMin: r.eta_to_scene_min,
      etaToHospitalMin: r.eta_to_hospital_min,
      totalResponseMin: r.total_response_min,
      status: r.status,
      reportedAt: r.reported_at,
      dispatchedAt: r.dispatched_at,
      resolvedAt: r.resolved_at,
      routeToIncident: r.route_to_incident_json ? JSON.parse(r.route_to_incident_json) : [],
      routeToHospital: r.route_to_hospital_json ? JSON.parse(r.route_to_hospital_json) : [],
    };
  }

  return {
    saveAmbulance(amb) {
      stmts.upsertAmbulance.run({
        id: amb.id,
        homeStation: amb.homeStation,
        currentNode: amb.currentNode,
        status: amb.status,
        incidentId: amb.incidentId,
      });
    },
    loadAmbulances() {
      return stmts.allAmbulances.all().map(rowToAmbulance);
    },

    saveHospital(h) {
      stmts.upsertHospital.run({ id: h.id, name: h.name, beds: h.beds, freeBeds: h.freeBeds });
    },
    loadHospitals() {
      return stmts.allHospitals.all().map(rowToHospital);
    },

    insertIncident(inc) {
      stmts.insertIncident.run({
        id: inc.id,
        nodeId: inc.nodeId,
        severity: inc.severity,
        description: inc.description || "",
        ambulanceId: inc.ambulanceId || null,
        hospitalId: inc.hospitalId || null,
        etaToSceneMin: inc.etaToSceneMin ?? null,
        etaToHospitalMin: inc.etaToHospitalMin ?? null,
        totalResponseMin: inc.totalResponseMin ?? null,
        status: inc.status,
        reportedAt: inc.reportedAt,
        dispatchedAt: inc.dispatchedAt ?? null,
        routeToIncidentJson: JSON.stringify(inc.routeToIncident || []),
        routeToHospitalJson: JSON.stringify(inc.routeToHospital || []),
      });
    },
    resolveIncident(id, resolvedAt) {
      stmts.resolveIncident.run({ id, resolvedAt });
    },
    updateIncidentStatus(id, status) {
      stmts.updateIncidentStatus.run({ id, status });
    },
    updateIncidentDispatch(inc) {
      stmts.updateIncidentDispatch.run({
        id: inc.id,
        ambulanceId: inc.ambulanceId,
        hospitalId: inc.hospitalId,
        etaToSceneMin: inc.etaToSceneMin,
        etaToHospitalMin: inc.etaToHospitalMin,
        totalResponseMin: inc.totalResponseMin,
        dispatchedAt: inc.dispatchedAt,
        routeToIncidentJson: JSON.stringify(inc.routeToIncident || []),
        routeToHospitalJson: JSON.stringify(inc.routeToHospital || []),
      });
    },
    loadIncidents(limit = 500) {
      return stmts.allIncidents.all({ limit }).map(rowToIncident);
    },
    getIncident(id) {
      const row = stmts.incidentById.get({ id });
      return row ? rowToIncident(row) : null;
    },
  };
}

module.exports = { createRepository };
