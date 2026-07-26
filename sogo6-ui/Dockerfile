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

# Build then serve (more memory-efficient than next dev for this project)
# Uses standalone server because next.config.mjs has output: 'standalone'
CMD ["sh", "-c", "if [ -f next.config.mjs ] || [ -f next.config.js ]; then \
  echo '=== Building for production ===' && \
  npm run build 2>&1 && \
  echo '=== Starting standalone server ===' && \
  node .next/standalone/server.js; \
  else echo 'UI source missing - run make setup first'; fi"]
