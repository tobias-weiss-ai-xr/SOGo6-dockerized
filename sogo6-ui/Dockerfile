# Development Dockerfile for SOGo 6 UI
# Multi-stage build with development target

FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Build production bundle
COPY . .
RUN npm run build

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Install dev dependencies
COPY package*.json ./
RUN npm ci && npm install -g serve

# Copy source code (for hot reload)
COPY . .

# Expose dev server port
EXPOSE 3000 24678

# Start dev server with hot reload
CMD ["npm", "run", "dev"]

# Production stage
FROM nginx:alpine AS production

# Copy built assets from builder
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
