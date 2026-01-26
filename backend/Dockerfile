FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies from backend package.json
# copy only necessary files from the backend folder to keep builds fast
COPY backend/package*.json ./
COPY backend/scripts/ scripts/
# Use `npm install` in the builder to avoid failing when local package-lock.json
# is out of sync with package.json. This keeps the build resilient when we add
# a dependency during quick deployments. For reproducible builds, restore
# `npm ci` and update the lockfile instead.
RUN npm install --no-audit --no-fund

# Copy backend source into container root
COPY backend/ .

# Expose port used by backend (default 5000)
EXPOSE 5000

# Add entrypoint that waits for DB, then execs the original CMD
COPY backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh", "node"]
CMD ["server.js"]
