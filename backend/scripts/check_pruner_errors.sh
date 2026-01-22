#!/usr/bin/env bash
# Check pm2 logs for pruner-related missing-column errors
LOG_DIR="/root/.pm2/logs"
PATTERN="avatar|latitude|longitude"
echo "Searching $LOG_DIR for pattern: $PATTERN"
grep -iE "$PATTERN" $LOG_DIR/ubnd-backend-* || echo "No matches found in pm2 logs."
