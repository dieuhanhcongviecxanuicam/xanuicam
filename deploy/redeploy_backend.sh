#!/usr/bin/env bash
# Lightweight redeploy helper to update backend with minimal downtime.
# Usage: sudo ./deploy/redeploy_backend.sh
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

echo "Fetching latest image build context and rebuilding backend..."
docker-compose -f "$COMPOSE_FILE" build --pull --no-cache backend

echo "Bringing up new backend container..."
# Start backend with no-deps so other services remain running. This may recreate container.
docker-compose -f "$COMPOSE_FILE" up -d --no-deps --build backend

echo "Waiting for backend to report healthy (listening on port 5000)..."
for i in {1..20}; do
  if docker exec xanuicam_backend_1 sh -c "ss -ltn '( sport = :5000 )' 2>/dev/null | grep -q LISTEN"; then
    echo "Backend is listening on port 5000" && break
  fi
  sleep 1
done

echo "Done. Tail backend logs with: docker logs -f xanuicam_backend_1"
