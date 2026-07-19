const pino = require("pino");
const config = require("./config");

/**
 * logger.js
 * Structured JSON logging (one log line per event, machine-parseable) -
 * what you want once this runs behind a log aggregator in the cloud instead
 * of scrolling a terminal. Falls back to pretty console output only in dev.
 */
const logger = pino({
  level: config.logLevel,
  base: { service: "ambulance-routing-backend" },
});

module.exports = logger;
