#!/usr/bin/env bash
set -euo pipefail

OUTDIR="/tmp/xanuicam-github-ops"
mkdir -p "$OUTDIR"

if command -v gitleaks >/dev/null 2>&1; then
  echo "Running gitleaks on repo root..."
  gitleaks detect --source . --report-path "$OUTDIR/gitleaks-report.json" --report-format json || true
  echo "Report written to $OUTDIR/gitleaks-report.json"
  jq . "$OUTDIR/gitleaks-report.json" || true
else
  echo "gitleaks not found. To run locally, install gitleaks (https://github.com/gitleaks/gitleaks) or run via Docker:" 
  echo "  docker run --rm -v \$(pwd):/repo zricethezav/gitleaks:latest detect --source /repo --report-path /repo/$OUTDIR/gitleaks-report.json --report-format json"
  exit 4
fi
