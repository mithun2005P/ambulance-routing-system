const logger = require("../logger");

/** Thrown deliberately by services for expected failure conditions (e.g. "no ambulance available"). */
class AppError extends Error {
  constructor(message, statusCode = 400, code = "APP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** 404 fallback for unmatched routes. */
function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

/**
 * errorHandler.js
 * Last middleware in the chain. Known AppErrors return their intended
 * status/message; anything unexpected is logged with full context and
 * returned as a generic 500 - callers never see a raw stack trace, but
 * operators get full detail in the logs.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  logger.error({ err, path: req.originalUrl, method: req.method }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}

module.exports = { AppError, notFoundHandler, errorHandler };
