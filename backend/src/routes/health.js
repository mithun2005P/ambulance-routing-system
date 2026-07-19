const express = require("express");

/**
 * health.js
 * /health = liveness ("is the process up") - always 200 if Express is responding.
 * /ready  = readiness ("is it safe to send traffic") - checks the DB connection
 *           actually answers a query. Docker/Kubernetes/load balancers use
 *           these to know when to route traffic to a new container and when
 *           to restart a stuck one - this is the difference between "runs on
 *           my laptop" and "survives a real deployment".
 */
function buildHealthRouter(db) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({ status: "ok", uptimeSec: Math.round(process.uptime()) });
  });

  router.get("/ready", (req, res) => {
    try {
      db.prepare("SELECT 1").get();
      res.json({ status: "ready" });
    } catch (err) {
      res.status(503).json({ status: "not_ready", error: err.message });
    }
  });

  return router;
}

module.exports = buildHealthRouter;
