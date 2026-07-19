require("dotenv").config();

/**
 * config.js
 * Single source of truth for environment configuration. Fail fast with clear
 * errors rather than limping along with undefined values scattered through
 * the codebase - this is what "reliable" means in practice.
 */
const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  logLevel: process.env.LOG_LEVEL || "info",
  dbPath: process.env.DB_PATH || "./data/ambulance.db",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  trafficIntervalMs: parseInt(process.env.TRAFFIC_INTERVAL_MS || "4000", 10),
  dispatchQueueIntervalMs: parseInt(process.env.DISPATCH_QUEUE_INTERVAL_MS || "2000", 10),
  analyticsCacheTtlMs: parseInt(process.env.ANALYTICS_CACHE_TTL_MS || "10000", 10),
  spatialPrefilterK: parseInt(process.env.SPATIAL_PREFILTER_K || "4", 10),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
  },
};

module.exports = config;
