const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const http = require("http");
const { Server } = require("socket.io");

const config = require("./src/config");
const logger = require("./src/logger");
const { createDatabase } = require("./src/db/database");
const { createRepository } = require("./src/db/repository");
const { buildCityNetwork } = require("./src/data/cityNetwork");

const AmbulanceService = require("./src/services/ambulanceService");
const HospitalService = require("./src/services/hospitalService");
const RouteService = require("./src/services/routeService");
const TrafficService = require("./src/services/trafficService");
const DispatchService = require("./src/services/dispatchService");
const AnalyticsService = require("./src/services/analyticsService");
const LocationService = require("./src/services/locationService");
const RepositioningService = require("./src/services/repositioningService");

const buildApiRouter = require("./src/routes/api");
const buildHealthRouter = require("./src/routes/health");
const { notFoundHandler, errorHandler } = require("./src/middleware/errorHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigin } });

// ---- Core middleware ----
app.use(compression());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

// Rate limit the write-heavy dispatch endpoint specifically - protects the
// simulator (and a real system) from a runaway client hammering /dispatch.
const dispatchLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many dispatch requests - slow down." },
});

// ---- Persistence ----
const db = createDatabase(config.dbPath);
const repository = createRepository(db);

// ---- Build the world ----
const { graph, hospitals, stations } = buildCityNetwork();
const ambulanceService = new AmbulanceService(graph, stations, repository);
const hospitalService = new HospitalService(graph, hospitals, repository);
const routeService = new RouteService(graph);
const trafficService = new TrafficService(graph, io);
const dispatchService = new DispatchService(graph, ambulanceService, hospitalService, repository, io);
const analyticsService = new AnalyticsService(graph, ambulanceService, hospitalService, dispatchService);
const locationService = new LocationService(graph);
const repositioningService = new RepositioningService(graph, ambulanceService, dispatchService);

const services = {
  graph,
  ambulanceService,
  hospitalService,
  routeService,
  trafficService,
  dispatchService,
  analyticsService,
  locationService,
  repositioningService,
  io,
};

app.use("/", buildHealthRouter(db));
app.use("/api/dispatch", dispatchLimiter);
app.use("/api", buildApiRouter(services));

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Smart Emergency Response & Ambulance Routing System API", version: "2.0.0" });
});

app.use(notFoundHandler);
app.use(errorHandler);

io.on("connection", (socket) => {
  socket.emit("traffic:update", trafficService.snapshot());
  socket.on("disconnect", () => {});
});

trafficService.start(config.trafficIntervalMs);
dispatchService.startQueueProcessor(config.dispatchQueueIntervalMs);

server.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, "🚑 Ambulance Routing backend started");
});

// ---- Graceful shutdown ----
function shutdown(signal) {
  logger.info({ signal }, "Shutting down gracefully");
  trafficService.stop();
  dispatchService.stopQueueProcessor();
  server.close(() => {
    db.close();
    logger.info("Shutdown complete");
    process.exit(0);
  });
  // Force-exit if something hangs
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "Unhandled promise rejection"));

module.exports = { app, server };
