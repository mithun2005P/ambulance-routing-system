# 🚑 SENTINEL v2 — Smart Emergency Response & Ambulance Routing System

A full-stack, DSA-driven emergency dispatch simulator: report an incident and
the system spatially pre-filters candidates, runs exact shortest-path search
to find the nearest available ambulance and nearest hospital with free
capacity, routes through live simulated traffic, and — if the fleet is
saturated — queues the incident with an aging priority score instead of just
failing. Includes a real algorithm visualizer, persistent storage, and a
Docker deployment path.

This is v2 of the original simulator: rebuilt for **optimization**
(spatial-index dispatch, cached analytics), **reliability** (SQLite
persistence, validation, structured logging, graceful shutdown, automated
tests), **scalability** (stateless-friendly service layer, rate limiting,
diff-only traffic broadcasts, Docker/Compose), and a few genuinely
**distinctive** features you won't find in the typical version of this project.

---

## What's new in v2

| Area | v1 | v2 |
|---|---|---|
| Storage | In-memory, resets on restart | SQLite (WAL mode), survives restarts — verified with an actual kill+restart test |
| Dispatch algorithm | Dijkstra from *every* available ambulance | **Spatial grid** pre-filters to K nearest candidates first, exact Dijkstra only on those — O(K) instead of O(fleet size) |
| Input handling | Manual checks | Zod schema validation on every mutating endpoint, structured 400s |
| Errors/logging | console.log, unhandled crashes | Centralized error middleware + pino structured JSON logging |
| Ops readiness | None | `/health`, `/ready`, graceful SIGTERM shutdown, rate limiting, gzip compression |
| Analytics | Recomputed Floyd-Warshall on every request | TTL-cached (10s default) |
| Traffic broadcast | Full edge list every tick | Diff-only — only changed edges are sent |
| Mass-casualty handling | Dispatch fails outright if fleet is busy | Incidents **queue** with an aging priority score (severity + wait time), auto-drained as units free up |
| Unique features | — | **Algorithm Visualizer** (animated Dijkstra vs A* node-expansion), **Predictive Repositioning** (greedy k-center hot-zone clustering + greedy matching) |
| Testing | None | 23 automated tests (Vitest) covering every DSA module + a full dispatch integration test |
| Deployment | `npm start` only | Dockerfiles (multi-stage) for both services + `docker-compose.yml`, one-command local dev via root `npm run dev` |
| Bundle size | 798 KB single chunk | Code-split — main bundle ~397 KB, Analytics/Visualizer/Repositioning load on demand |

---

## Quickstart (pick one)

### Option A — One command, local dev
```bash
npm run setup   # installs backend + frontend deps
npm run dev     # runs both with live reload
```
Open **http://localhost:5173**.

### Option B — Docker Compose (closest to a real deployment)
```bash
docker compose up --build
```
Backend on `:4000`, frontend on `:8080`. Fleet/hospital/incident state
persists in a named Docker volume (`sentinel-db`) across container restarts.

### Option C — Manual, two terminals (original approach, still works)
```bash
cd backend && npm install && npm start
cd frontend && npm install && npm run dev
```

---

## Running the tests

```bash
cd backend
npm test
```
23 tests: MinHeap ordering, Dijkstra/A* correctness against a known graph,
Bellman-Ford alternate-route behavior, Trie prefix search, Kruskal's MST
correctness, SpatialGrid k-nearest + filtering, and a full dispatch →
resolve → mass-casualty-queue integration test against a real (in-memory)
SQLite database.

---

## Architecture

```
ambulance-routing-system/
├── docker-compose.yml
├── package.json                    # root convenience scripts (npm run dev)
├── backend/
│   ├── Dockerfile                  # multi-stage (compiles better-sqlite3, slim runtime)
│   ├── server.js                   # wiring: middleware, graceful shutdown
│   ├── src/
│   │   ├── config.js               # env-driven config, single source of truth
│   │   ├── logger.js               # structured pino logging
│   │   ├── schemas.js              # Zod input validation schemas
│   │   ├── middleware/             # validate.js, errorHandler.js
│   │   ├── db/                     # database.js (SQLite+WAL), repository.js (all SQL lives here)
│   │   ├── dsa/                    # Graph, MinHeap, Dijkstra, A*, Bellman-Ford,
│   │   │                           # Floyd-Warshall, Union-Find/Kruskal, Trie, SpatialGrid
│   │   ├── data/cityNetwork.js     # synthetic city graph generator
│   │   ├── services/               # business logic - see table below
│   │   ├── routes/                 # api.js, health.js
│   │   └── __tests__/              # Vitest unit + integration tests
│   └── package.json
├── frontend/
│   ├── Dockerfile                  # multi-stage, served via nginx
│   ├── nginx.conf
│   └── src/
│       ├── App.jsx                 # layout, live state, code-split routing
│       ├── api.js / socket.js
│       └── components/
│           ├── MapView.jsx              # live Leaflet map
│           ├── DispatchPanel.jsx        # report incident, handles queued state
│           ├── FleetPanel.jsx           # ambulances / hospitals / incidents (incl. queue)
│           ├── SearchBar.jsx            # Trie-backed autocomplete
│           ├── AlgorithmVisualizerPanel.jsx  # Dijkstra vs A* animated trace
│           ├── RepositioningPanel.jsx        # hot-zone suggestions + one-click move
│           └── AnalyticsPanel.jsx            # Floyd-Warshall coverage + charts
└── README.md
```

### Services

| Service | Responsibility |
|---|---|
| `ambulanceService` | Fleet state (write-through cache to SQLite). Optimized `findNearestAvailable()` via SpatialGrid prefilter + MinHeap. |
| `hospitalService` | Bed capacity (write-through cache). Same optimized nearest-with-capacity pattern. |
| `routeService` | Wraps Dijkstra/A*/Bellman-Ford, shapes polylines + ETAs, exposes `traceRoute()` for the visualizer. |
| `trafficService` | Simulates live congestion, broadcasts **diffs only** over Socket.IO. |
| `dispatchService` | Orchestrates incident → ambulance → hospital. Runs the **mass-casualty priority queue** with aging when resources are exhausted. |
| `analyticsService` | Fleet/hospital stats + **TTL-cached** Floyd-Warshall coverage matrix + Kruskal's MST resilience score. |
| `locationService` | Trie-backed autocomplete over every node name. |
| `repositioningService` | Greedy k-center hot-zone clustering + greedy nearest-match idle-ambulance suggestions. |

---

## DSA Concepts → Where They Live

| Concept | File | What it powers |
|---|---|---|
| Graph (adjacency list) | `dsa/Graph.js` | The whole road network |
| BFS / DFS | `Graph.js` | Connectivity checks |
| MinHeap / Priority Queue | `dsa/MinHeap.js` | Dijkstra, A*, dispatch candidate selection, repositioning matching |
| Dijkstra | `dsa/Dijkstra.js` | Guaranteed-shortest routing, now with optional trace recording |
| A* Search | `dsa/AStar.js` | Faster routing via haversine heuristic, same trace support |
| Bellman-Ford | `dsa/BellmanFord.js` | Alternate-route recompute around blocked roads |
| Floyd-Warshall | `dsa/FloydWarshall.js` | All-pairs distances, TTL-cached for the coverage chart |
| Union-Find + Kruskal's MST | `dsa/UnionFind.js` | "Critical roads" network-resilience analytics |
| Trie | `dsa/Trie.js` | Search bar autocomplete |
| **Spatial grid indexing** | `dsa/SpatialGrid.js` | **v2**: O(K) candidate pre-filter instead of O(fleet size) brute force |
| **Greedy algorithms** | `services/repositioningService.js` | **v2**: farthest-point k-center clustering + greedy bipartite matching |
| **Priority queue with aging** | `services/dispatchService.js` | **v2**: mass-casualty queue, starvation-free via recompute-not-decrease-key |

---

## The two genuinely distinctive features

### 1. Algorithm Visualizer
Pick a start and destination, hit **Run Trace**, and watch Dijkstra (teal)
and A* (amber) expand node-by-node on the map in real time. Dijkstra spreads
in a rough circle; A* visibly narrows toward the destination and stops
early. The panel reports exactly how many fewer nodes A* explored for the
identical shortest distance — turns an abstract algorithms-class claim into
something you can point at.

### 2. Predictive Standby Repositioning
Uses greedy farthest-point k-center clustering over incident history to find
"hot zones," then greedily matches the nearest idle ambulance to each zone.
One click moves a unit ahead of demand rather than only ever reacting to it,
using a documented approximation technique for the underlying
facility-location problem.

---

## Talking points for your report / viva

- **Why a spatial grid before Dijkstra, not just Dijkstra?** Naive dispatch
  is O(A × graph search) for A available ambulances — fine for a demo fleet
  of 10, but doesn't scale to a real city's fleet of hundreds. The grid
  narrows the field to a constant K (default 4) geographically-closest
  candidates via cheap straight-line distance first, so exact routing cost
  stays roughly constant as the fleet grows. The API returns
  `candidatesEvaluated` on every dispatch so you can show this isn't just
  a claim.
- **Why recompute the mass-casualty queue's priority every cycle instead of
  a persistent priority queue with decrease-key?** Decrease-key on a binary
  heap is non-trivial to implement correctly. With a small pending queue
  (realistically a handful of incidents even under surge), a full resort
  every 2 seconds is cheap and trivially correct — a deliberate, explainable
  trade-off, not an oversight.
- **Why SQLite over Postgres?** Zero extra moving parts for local dev or a
  single container; WAL mode gives solid concurrent-read throughput for a
  single-writer service like this one. The repository layer
  (`db/repository.js`) is the *only* file that touches SQL — swapping to
  Postgres for multi-instance horizontal scaling later means rewriting that
  one file, not the services built on top of it.
- **Why cache Floyd-Warshall instead of just running it once at boot?**
  Traffic weights change continuously, so the coverage matrix does need to
  refresh — but not on every single dashboard poll from every connected
  client. A short TTL cache bounds the expensive O(V³) recomputation to at
  most once per window regardless of how many clients are watching.
- **Why greedy k-center instead of real k-means for hot-zone clustering?**
  k-means needs iterative convergence and a good initial seed to avoid local
  minima. Greedy farthest-point selection is a well-known deterministic
  approximation for k-center, runs in one pass, and is far easier to
  explain and defend in a viva than "it converged."

---

## Configuration

Copy `backend/.env.example` to `backend/.env` to override defaults:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 4000 | Backend HTTP port |
| `DB_PATH` | `./data/ambulance.db` | SQLite file location |
| `CORS_ORIGIN` | `*` | Restrict in production |
| `TRAFFIC_INTERVAL_MS` | 4000 | How often traffic is perturbed |
| `DISPATCH_QUEUE_INTERVAL_MS` | 2000 | How often the mass-casualty queue is re-evaluated |
| `ANALYTICS_CACHE_TTL_MS` | 10000 | Floyd-Warshall cache lifetime |
| `SPATIAL_PREFILTER_K` | 4 | Candidates evaluated per dispatch |
| `RATE_LIMIT_MAX` | 120 | Max `/api/dispatch` calls per window per IP |

For the frontend, `VITE_API_URL` / `VITE_SOCKET_URL` control which backend
it talks to (baked in at build time — set them as Docker build args or a
`.env` file before `npm run build`/`docker build` for a non-localhost deploy).

---

## Notes / honest limitations

- This is a simulator: the road network is synthetically generated, not
  real OSM data. `data/cityNetwork.js` is the one file you'd swap for a real
  GeoJSON import — nothing else needs to change.
- SQLite is a great fit for a single-instance deployment (which is what
  Docker Compose here gives you). If you actually need multiple backend
  instances behind a load balancer, that's the point at which to swap the
  repository layer for Postgres — the architecture is set up for that
  swap to be contained, not a rewrite.
- The `VITE_API_URL` baked into the frontend build means the container image
  is tied to a specific backend URL at build time (standard for a static
  SPA). For a real multi-environment deploy, rebuild the frontend image per
  environment or serve it behind the same reverse proxy as the backend.
