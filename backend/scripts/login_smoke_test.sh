#!/usr/bin/env bash
# Simple login loop to reproduce intermittent errors. Usage:
# ./login_smoke_test.sh <username> <password> <count>
USER=${1:-smoke1}
PASS=${2:-S3cureP@ssw0rd!}
COUNT=${3:-20}
URL=${4:-http://127.0.0.1:5000/api/auth/login}
echo "Running login smoke test: user=$USER count=$COUNT url=$URL"
for i in $(seq 1 $COUNT); do
  now=$(date -Is)
  echo "[$now] Attempt $i"
  curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST "$URL" -H 'Content-Type: application/json' -d "{\"identifier\":\"$USER\",\"password\":\"$PASS\"}" | sed -n '1,200p'
  sleep 0.5
done
