# -----------------------------------------------------------------------------
# ShopVerse API — production image
#
#   Build:  docker build -t shopverse-server .
#   Run:    docker run --rm -p 3001:3001 -v shopverse-data:/app/data shopverse-server
#
# The build context is this folder (ecom/server). Secrets (.env) and runtime
# state (orders.json) are excluded via .dockerignore and a volume respectively.
# -----------------------------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Production mode before installing so dev dependencies are skipped.
ENV NODE_ENV=production

# Install from the lockfile for reproducible builds (npm ci fails on drift
# between package.json and package-lock.json instead of silently resolving).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy app source in a second layer so dependency install is cached.
COPY src ./src
COPY .env.example ./

# Runtime data dir for the JSON order store (db/fileDb.js). Declared as a
# VOLUME so orders survive container restarts; kept out of the image itself.
RUN mkdir -p /app/data

# Run as the unprivileged `node` user shipped with the base image.
RUN chown -R node:node /app
USER node

ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1

# Run node directly (not via `npm start`) so SIGTERM/SIGINT reach the app
# process for clean shutdown by Docker / orchestrators.
CMD ["node", "src/index.js"]