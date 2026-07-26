# Development Dockerfile for SOGo 6 UI
# Single stage for development (source will be mounted by compose)

FROM node:20-alpine AS development

WORKDIR /app

# Install git for potential npm installs
RUN apk add --no-cache git

# Copy package files (conditional - skip if missing)
COPY package.json package-lock.json* ./

# Install dependencies if package.json exists
RUN if [ -f package.json ]; then npm ci || npm install; else echo "No package.json - skipping npm install"; fi

# Copy source code (will be mounted by compose in dev)
COPY . ./

# Expose dev server port and WebSocket port
EXPOSE 3000 24678

# Use next dev for development (hot reload, stable for E2E tests).
# Note: In production, use Dockerfile.prod with multi-stage build.
# TODO: Production standalone build has issues with Next.js 16.2.10 RSC streaming
# (client-side hydration doesn't occur after build). Tracked as known issue.
CMD ["sh", "-c", "if [ -f next.config.mjs ] || [ -f next.config.js ]; then \
  echo '=== Starting dev server (next dev) ===' && \
  npx next dev --port 3000 --hostname 0.0.0.0; \
  else echo 'UI source missing - run make setup first'; fi"]
