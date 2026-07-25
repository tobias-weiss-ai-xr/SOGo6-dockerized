# Development Dockerfile for SOGo 6 UI
# Single stage for development (source will be mounted by compose)

FROM node:20-alpine AS development

WORKDIR /app

# Install git for potential npm installs
RUN apk add --no-cache git

# Copy package files first for better caching
COPY package*.json . 2>/dev/null || echo "No package files found"

# Install dependencies if package.json exists
RUN if [ -f package.json ]; then npm ci; else echo "No package.json - skipping npm ci"; fi

# Copy source code (will be mounted by compose in dev)
COPY . . 2>/dev/null || echo "No source code to copy"

# Expose dev server port and WebSocket port
EXPOSE 3000 24678

# Start dev server with hot reload (or next dev if next.config exists)
CMD if [ -f next.config.js ]; then npm run dev; else if [ -f .next ]; then npm run start; else npm run dev || echo "UI source missing - run make setup first"; fi; fi
