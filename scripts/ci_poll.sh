#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd -W 2>/dev/null || cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/scripts/pr_logs"
mkdir -p "$LOG_DIR"
POLL_LOG="$LOG_DIR/ci_poll.log"

echo "Starting CI poll: $(date -u)" >> "$POLL_LOG"

REPO="dieuhanhcongviecxanuicam/xanuicam"
BRANCH="fix/ci-deploy-tests"

while true; do
  echo "--- $(date -u) ---" >> "$POLL_LOG"

  if command -v gh >/dev/null 2>&1; then
    ts=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
    gh run list --repo "$REPO" --branch "$BRANCH" --limit 5 > "$LOG_DIR/gh_runs_${ts}.txt" 2>>"$POLL_LOG" || echo "gh run list failed" >> "$POLL_LOG"

    latest_run_id=$(gh run list --repo "$REPO" --branch "$BRANCH" --limit 1 --json id 2>/dev/null | sed -n 's/.*"id": \([0-9]*\).*/\1/p' | head -n1 || true)
    if [ -n "$latest_run_id" ]; then
      outdir="$LOG_DIR/run_${latest_run_id}"
      mkdir -p "$outdir"
      gh run download "$latest_run_id" --repo "$REPO" --dir "$outdir" >> "$POLL_LOG" 2>&1 || echo "gh download failed for $latest_run_id" >> "$POLL_LOG"
      echo "downloaded $(date -u)" > "$outdir/.downloaded"
    else
      echo "No runs found by gh for branch $BRANCH" >> "$POLL_LOG"
    fi
  else
    echo "gh CLI not found; recording remote ref and listing logs" >> "$POLL_LOG"
    git ls-remote origin "refs/heads/$BRANCH" > "$LOG_DIR/lsremote_$(date -u +%s).log" 2>>"$POLL_LOG" || true
    ls -la "$LOG_DIR" >> "$POLL_LOG" 2>&1 || true
  fi

  sleep 60
done
