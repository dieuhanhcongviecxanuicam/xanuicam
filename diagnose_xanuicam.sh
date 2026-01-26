#!/usr/bin/env bash
# diagnose_xanuicam.sh
# Run on the server as root or a user with sudo privileges.

set -euo pipefail
OUT=/tmp/xanuicam_diagnostics_$(date +%s)
mkdir -p "$OUT"
echo "Output dir: $OUT"

echo; echo "=== PM2 status ==="
pm2 status ubnd-backend > "$OUT/pm2_status.txt" 2>&1 || pm2 status > "$OUT/pm2_status.txt" 2>&1 || true
cat "$OUT/pm2_status.txt"

echo; echo "=== Last 800 lines of pm2 logs (ubnd-backend) ==="
pm2 logs ubnd-backend --lines 800 --nostream > "$OUT/pm2_logs.txt" 2>&1 || true
tail -n 200 "$OUT/pm2_logs.txt" || true

echo; echo "=== Grep for login 500s and stack traces ==="
grep -inE "POST /api/auth/login|\\b500\\b|Unhandled Rejection|Uncaught Exception" "$OUT/pm2_logs.txt" > "$OUT/login_issues.txt" || true
cat "$OUT/login_issues.txt" || echo "(no matches)"

echo; echo "=== Backend health endpoint ==="
# Try local host first
curl -sS -D "$OUT/health_headers.txt" -o "$OUT/health_body.txt" "http://127.0.0.1:5000/health" || curl -sS -D "$OUT/health_headers.txt" -o "$OUT/health_body.txt" "http://localhost:5000/health" || true

echo "Health headers:"
cat "$OUT/health_headers.txt" || true
echo "Health body:"
cat "$OUT/health_body.txt" || true

echo; echo "=== Public checks for key assets (via origin) ==="
HOST="https://xanuicam.vn"
curl -I "$HOST/" -o "$OUT/root_headers.txt" -s || true
curl -I "$HOST/logo.png" -o "$OUT/logo_headers.txt" -s || true

echo "root headers:"
cat "$OUT/root_headers.txt" || true
echo "logo headers:"
cat "$OUT/logo_headers.txt" || true

echo; echo "=== Disk, memory, node processes ==="
df -h > "$OUT/df.txt"
free -m > "$OUT/free.txt"
ps aux | egrep 'node|pm2' | head -n 40 > "$OUT/processes.txt"
cat "$OUT/df.txt" || true
cat "$OUT/free.txt" || true

echo "node/pm2 procs:"
cat "$OUT/processes.txt" || true

echo; echo "=== Capture recent backend pm2 error logs (if separate) ==="
ls -lah ~/.pm2/logs > "$OUT/pm2_logs_dir.txt" 2>/dev/null || true
# Tail any logs that match ubnd-backend
if ls ~/.pm2/logs/*ubnd-backend* 1> /dev/null 2>&1; then
  tail -n 300 ~/.pm2/logs/*ubnd-backend* 2>/dev/null > "$OUT/pm2_recent_logs.txt" || true
fi

echo "Saved pm2 recent logs if present."

echo; echo "=== Bundle diagnostics into tar.gz ==="
tar czf "/tmp/xanuicam_diag_$(date +%s).tar.gz" -C /tmp "$(basename "$OUT")" || true

echo "Diagnostics saved to /tmp/xanuicam_diag_*.tar.gz and directory $OUT"
echo "Please upload or paste key files: $OUT/pm2_status.txt, $OUT/pm2_logs.txt, $OUT/login_issues.txt, $OUT/health_headers.txt, $OUT/logo_headers.txt"
