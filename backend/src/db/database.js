const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const logger = require("../logger");

/**
 * database.js
 * Opens (and creates on first run) a SQLite database file. This is what
 * turns the simulator from "resets every restart" into something that
 * survives a server crash/redeploy - fleet status, hospital capacity, and
 * the full incident history persist across restarts.
 *
 * SQLite (not Postgres) is the default here deliberately: zero extra moving
 * parts to run locally or in a single container, WAL mode gives solid
 * concurrent read throughput, and the repository layer below is the only
 * place that touches SQL - swapping to Postgres later for multi-instance
 * horizontal scaling means rewriting this one file, not the services.
 */
function createDatabase(dbPath = config.dbPath) {
  const dir = path.dirname(dbPath);
  if (dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ambulances (
      id TEXT PRIMARY KEY,
      home_station TEXT NOT NULL,
      current_node TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      incident_id TEXT
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      beds INTEGER NOT NULL,
      free_beds INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      ambulance_id TEXT,
      hospital_id TEXT,
      eta_to_scene_min REAL,
      eta_to_hospital_min REAL,
      total_response_min REAL,
      status TEXT NOT NULL DEFAULT 'queued',
      reported_at INTEGER NOT NULL,
      dispatched_at INTEGER,
      resolved_at INTEGER,
      route_to_incident_json TEXT,
      route_to_hospital_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_reported_at ON incidents(reported_at);

    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  logger.info({ dbPath }, "Database ready (WAL mode)");
  return db;
}

module.exports = { createDatabase };
