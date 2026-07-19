const { z } = require("zod");

const dispatchSchema = z.object({
  nodeId: z.string().min(1, "nodeId is required"),
  severity: z.enum(["critical", "moderate", "minor"]).default("moderate"),
  description: z.string().max(500).optional().default(""),
});

const routeQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  algorithm: z.enum(["dijkstra", "astar", "bellman-ford"]).optional().default("dijkstra"),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(80),
});

const relocateSchema = z.object({
  nodeId: z.string().min(1, "nodeId is required"),
});

module.exports = { dispatchSchema, routeQuerySchema, searchQuerySchema, relocateSchema };
