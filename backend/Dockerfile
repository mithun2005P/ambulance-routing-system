# --- Build stage: compile better-sqlite3's native binding ---
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# --- Runtime stage: slim image, no build toolchain ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -r appuser && useradd -r -g appuser appuser
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode===200?0:1)).on('error', ()=>process.exit(1))"

CMD ["node", "server.js"]
