const { createDatabase } = require("../db/database");
const { createRepository } = require("../db/repository");
const { buildCityNetwork } = require("../data/cityNetwork");
const AmbulanceService = require("../services/ambulanceService");
const HospitalService = require("../services/hospitalService");
const DispatchService = require("../services/dispatchService");

function setup() {
  const db = createDatabase(":memory:");
  const repository = createRepository(db);
  const { graph, hospitals, stations } = buildCityNetwork();
  const ambulanceService = new AmbulanceService(graph, stations, repository);
  const hospitalService = new HospitalService(graph, hospitals, repository);
  const dispatchService = new DispatchService(graph, ambulanceService, hospitalService, repository, null);
  return { db, repository, graph, ambulanceService, hospitalService, dispatchService };
}

describe("Dispatch flow (integration)", () => {
  let ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it("dispatches an ambulance and reserves a hospital bed for a normal incident", () => {
    const anyJunction = [...ctx.graph.nodes.values()].find((n) => n.type === "junction");
    const result = ctx.dispatchService.dispatch({ nodeId: anyJunction.id, severity: "critical" });

    expect(result.success).toBe(true);
    expect(result.incident.status).toBe("dispatched");
    expect(result.incident.ambulanceId).toBeTruthy();
    expect(result.incident.hospitalId).toBeTruthy();

    const amb = ctx.ambulanceService.get(result.incident.ambulanceId);
    expect(amb.status).toBe("dispatched");

    const hospital = ctx.hospitalService.list().find((h) => h.id === result.incident.hospitalId);
    expect(hospital.occupied).toBe(1);
  });

  it("frees the ambulance and hospital bed on resolve", () => {
    const anyJunction = [...ctx.graph.nodes.values()].find((n) => n.type === "junction");
    const result = ctx.dispatchService.dispatch({ nodeId: anyJunction.id, severity: "moderate" });
    const resolved = ctx.dispatchService.resolve(result.incident.id);

    expect(resolved.status).toBe("resolved");
    const amb = ctx.ambulanceService.get(result.incident.ambulanceId);
    expect(amb.status).toBe("available");

    const hospital = ctx.hospitalService.list().find((h) => h.id === result.incident.hospitalId);
    expect(hospital.occupied).toBe(0);
  });

  it("queues an incident instead of failing when every ambulance is busy", () => {
    const anyJunction = [...ctx.graph.nodes.values()].find((n) => n.type === "junction");
    const fleetSize = ctx.ambulanceService.list().length;

    // exhaust every ambulance
    for (let i = 0; i < fleetSize; i++) {
      ctx.dispatchService.dispatch({ nodeId: anyJunction.id, severity: "minor" });
    }

    const overflow = ctx.dispatchService.dispatch({ nodeId: anyJunction.id, severity: "critical" });
    expect(overflow.success).toBe(true);
    expect(overflow.queued).toBe(true);
    expect(overflow.incident.status).toBe("queued");
    expect(ctx.dispatchService.queueDepth()).toBe(1);
  });

  it("persists fleet state across a service restart (simulated)", () => {
    const anyJunction = [...ctx.graph.nodes.values()].find((n) => n.type === "junction");
    const result = ctx.dispatchService.dispatch({ nodeId: anyJunction.id, severity: "critical" });
    const dispatchedAmbId = result.incident.ambulanceId;

    // Simulate a restart: rebuild AmbulanceService from the same repository/db
    const reloadedAmbulanceService = new AmbulanceService(ctx.graph, [], ctx.repository);
    const amb = reloadedAmbulanceService.get(dispatchedAmbId);
    expect(amb.status).toBe("dispatched");
  });
});
