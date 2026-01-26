#!/usr/bin/env sh
# Wait for the Postgres host in DATABASE_URL to become reachable
set -e
printf '%s\n' "[wait-for-db] parsing DATABASE_URL"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[wait-for-db] DATABASE_URL not set" >&2
  exit 1
fi
# extract host and port (supports postgres://user:pass@host:port/db)
HOST_PORT=$(echo "$DATABASE_URL" | sed -E 's#.*@([^:/]+)(:([0-9]+))?/.*#\1:\3#')
HOST=$(echo "$HOST_PORT" | cut -d: -f1)
PORT=$(echo "$HOST_PORT" | cut -d: -f2)
if [ -z "$HOST" ] || [ -z "$PORT" ] || [ "$PORT" = "" ]; then
  PORT=5432
fi
echo "[wait-for-db] waiting for $HOST:$PORT"
tries=0
while ! nc -z "$HOST" "$PORT" 2>/dev/null; do
  tries=$((tries+1))
  if [ "$tries" -ge 60 ]; then
    echo "[wait-for-db] timed out waiting for $HOST:$PORT" >&2
    exit 1
  fi
  sleep 1
done
echo "[wait-for-db] $HOST:$PORT is reachable"
