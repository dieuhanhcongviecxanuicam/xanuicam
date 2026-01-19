FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY scripts/ scripts/
# Use `npm install` in the builder to avoid failing when local package-lock.json
# is out of sync with package.json. This keeps the build resilient when we add
# a dependency during quick deployments. For reproducible builds, restore
# `npm ci` and update the lockfile instead.
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

# Expose port used by backend (default 5000)
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
