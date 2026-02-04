#!/usr/bin/env bash
set -euo pipefail

# Watch frontend source files, rebuild on change, and serve the built site on localhost:3000
# Requires: npx, npm, chokidar-cli (installed as devDependency in frontend)

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
PORT=${PORT:-3000}

cd "$FRONTEND_DIR"

# build initially
echo "[watch-and-build] Initial build..."
npm run build

# serve in background
if command -v npx >/dev/null 2>&1; then
  echo "[watch-and-build] Serving build on http://localhost:$PORT"
  npx serve -s build -l "$PORT" &
else
  echo "[watch-and-build] npx not found; please install node/npm"
  exit 1
fi

# watch for changes and rebuild
echo "[watch-and-build] Watching frontend/src for changes..."
# Use chokidar-cli if available, else fallback to a simple polling loop
if npx -y --no-install chokidar "frontend/src/**/*" -v >/dev/null 2>&1; then
  # Use chokidar-cli to run build on changes
  npx chokidar "src/**/*" -c 'npm run build' --initial
else
  # Fallback: poll for changes every 2s
  echo "[watch-and-build] chokidar-cli not available; using polling fallback"
  LAST_SUM=""
  while true; do
    SUM=$(find src -type f -name '*.js' -o -name '*.css' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' | sort | xargs md5sum | md5sum | awk '{print $1}' || true)
    if [ "$SUM" != "$LAST_SUM" ]; then
      echo "[watch-and-build] Change detected; rebuilding..."
      npm run build
      LAST_SUM="$SUM"
    fi
    sleep 2
  done
fi
