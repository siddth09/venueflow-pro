# VenueFlow Pro — Cloud Run Dockerfile
# Optimised for fast builds and minimal image size

FROM node:20-slim

# Allow statements and log messages to immediately appear in Knative logs
ENV PYTHONUNBUFFERED=True
ENV NODE_ENV=production

# Working directory
WORKDIR /app

# Install dependencies first (layer-cached)
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy all source files
COPY . .

# Expose Port (Cloud Run injects PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:${PORT:-8080}/healthz || exit 1

# Start server
CMD ["node", "app.js"]
