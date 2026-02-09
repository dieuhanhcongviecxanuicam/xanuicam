#!/usr/bin/env bash
set -euo pipefail

OUTDIR="/tmp/xanuicam-github-ops"
mkdir -p "$OUTDIR"

echo "=== Complete Remediation Orchestrator ==="

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN is required in environment. Export it before running this script." >&2
  echo "Example: export GITHUB_TOKEN=ghp_..." >&2
  exit 2
fi

# Infer REPO if not provided
if [ -z "${REPO:-}" ]; then
  if git -C "$(pwd)" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    origin_url=$(git -C "$(pwd)" remote get-url origin 2>/dev/null || true)
    if [[ "$origin_url" =~ github.com[:/](.+)/(.+)(\.git)?$ ]]; then
      REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    fi
  fi
fi
REPO="${REPO:-dieuhanhcongviecxanuicam/xanuicam}"
GITHUB_API_URL="${GITHUB_API_URL:-https://api.github.com}"

echo "Using REPO=$REPO and API=$GITHUB_API_URL"

echo "1) Revoking matched deploy keys (best-effort)"
echo "-> Running scripts/revoke_deploy_keys.sh"
REPO="$REPO" GITHUB_API_URL="$GITHUB_API_URL" GITHUB_TOKEN="$GITHUB_TOKEN" bash scripts/revoke_deploy_keys.sh || echo "revoke script completed with non-zero exit"

echo "2) Attempting to restart backend with debug logging"
# Find node server process (server.js)
pid=""
pid=$(pgrep -f "node server.js" | head -n1 || true)
if [ -n "$pid" ]; then
  owner=$(ps -o uid= -p "$pid" | tr -d ' ' || echo "")
  echo "Found backend PID=$pid (uid=$owner)"
  if [ "$owner" -ne 0 ]; then
    echo "Stopping backend (owned by current user)..."
    kill -15 "$pid" || true
  else
    echo "Backend process is root-owned; attempting sudo stop..."
    if sudo -n true 2>/dev/null; then
      sudo kill -15 "$pid" || true
    else
      echo "Cannot sudo without password. Please run this script with sudo or stop PID $pid manually." >&2
      echo "Exiting before restart to avoid downtime." >&2
      exit 3
    fi
  fi
  sleep 1
else
  echo "No running backend process found by 'node server.js' pattern; continuing to start one." 
fi

echo "Starting backend with DEBUG_LOGS and REQUEST_LOGGING"
cd /home/nttsu/xanuicam/backend || true
if sudo -n true 2>/dev/null; then
  sudo -E env DEBUG_LOGS=true REQUEST_LOGGING=true ALLOW_LOCALHOST=true node server.js > /tmp/backend_start.log 2>&1 &
  echo $! > /tmp/backend_pid
else
  echo "Cannot run backend as root without sudo. Attempting to start as current user. If the original process required root, this may fail." 
  env DEBUG_LOGS=true REQUEST_LOGGING=true ALLOW_LOCALHOST=true node server.js > /tmp/backend_start.log 2>&1 &
  echo $! > /tmp/backend_pid
fi
sleep 2
echo "Backend log tail (/tmp/backend_start.log):"
tail -n 200 /tmp/backend_start.log || true

echo "3) Reproduce /api/auth/login to capture stack trace (test credentials)"
curl -s -D - -X POST http://localhost:5000/api/auth/login -H 'Content-Type: application/json' -d '{"identifier":"admin","password":"password"}' -o "$OUTDIR/login_response.json" || true
echo "Saved response to $OUTDIR/login_response.json"

echo "4) Optional: push rewritten history bundle to origin (DESTRUCTIVE)"
echo "To enable destructive force-push, set REWRITE_ALLOW_PUSH=1 and REWRITE_BUNDLE_PATH to the bundle path."
if [ "${REWRITE_ALLOW_PUSH:-0}" = "1" ]; then
  BUNDLE_PATH="${REWRITE_BUNDLE_PATH:-/home/nttsu/xanuicam-backups/xanuicam-rewritten.bundle}"
  echo "Pushing rewritten bundle from $BUNDLE_PATH"
  if [ ! -f "$BUNDLE_PATH" ]; then
    echo "Bundle not found: $BUNDLE_PATH" >&2
  else
    tmpdir=$(mktemp -d)
    git clone "$BUNDLE_PATH" "$tmpdir" || true
    cd "$tmpdir" || true
    git remote remove origin || true
    git remote add origin "git@github.com:dieuhanhcongviecxanuicam/xanuicam.git"
    echo "About to force-push all branches and tags to origin. This is destructive."
    echo "If you are sure, set REWRITE_ALLOW_PUSH=1 and run again."
    if [ "${REWRITE_FORCE_CONFIRM:-0}" = "1" ]; then
      git push --force origin --all
      git push --force origin --tags
    else
      echo "REWRITE_FORCE_CONFIRM not set to 1; skip actual push." 
    fi
    rm -rf "$tmpdir" || true
  fi
fi

echo "5) Re-run gitleaks on rewritten-inspect (if present)"
if [ -d "/home/nttsu/xanuicam-backups/rewrite-work/rewritten-repo" ]; then
  if command -v docker >/dev/null 2>&1; then
    docker run --rm -v /home/nttsu/xanuicam-backups/rewrite-work/rewritten-repo:/repo zricethezav/gitleaks:latest detect --source /repo --report-path /repo/gitleaks-rewritten.json --report-format json || true
    echo "Gitleaks report written to /home/nttsu/xanuicam-backups/rewrite-work/rewritten-repo/gitleaks-rewritten.json"
  else
    echo "Docker not available; skipping gitleaks on rewritten repo." 
  fi
fi

echo "Remediation orchestration complete. Artifacts placed in $OUTDIR. Review logs and reports before performing any destructive pushes." 
