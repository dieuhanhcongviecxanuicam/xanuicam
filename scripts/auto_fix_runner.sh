#!/usr/bin/env bash
set -euo pipefail
LOG_DIR=/tmp/gha-autopoll-logs
BR=tmp/merge-develop-into-main
CHANGED=()
cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch origin "$BR" || true
git checkout -B "$BR" "origin/$BR" || true
[ -d "$LOG_DIR" ] || { echo "No logs at $LOG_DIR"; exit 0; }
for lf in "$LOG_DIR"/run-*.log; do
  [ -e "$lf" ] || continue
  echo "Processing $lf"
  # naive fixes: add missing deps, remove simple unused vars, escape backslashes
  while IFS= read -r line; do
    if [[ "$line" =~ src/.*\.(jsx|js|tsx|ts) ]]; then
      file=$(echo "$line" | sed -E 's/^[0-9]+://')
      dep=$(grep -A3 "$(basename "$file")" -n "$lf" | grep "missing dependency" | sed -E "s/.*missing dependency: '\\'?([^'\\]+)\\?'\\./\\1/" | head -n1 || true)
      if [ -n "$dep" ] && [ -f "$file" ]; then
        cp "$file" "$file.bak.auto_fix" || true
        awk -v dep="$dep" 'BEGIN{ins=0} /useEffect\(/ && !ins{print; ins=1; next} { if(ins && match($0,/] */)){ sub(/] */, ", \x27"dep"\x27] ") ; ins=2 } print }' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
        CHANGED+=("$file")
      fi
    fi
  done < <(grep -nE "src/.+\.(jsx|js|tsx|ts)|missing dependency:" "$lf" || true)
  grep -n "is assigned a value but never used" "$lf" | while IFS= read -r L; do
    var=$(echo "$L" | sed -E "s/.*'([^']+)' is assigned.*/\1/")
    file=$(sed -n "1,$(echo "$L" | cut -d: -f1)p" "$lf" | grep -oE "src/.+\.(jsx|js|tsx|ts)" | tail -n1 || true)
    if [ -n "$file" ] && [ -f "$file" ]; then
      cp "$file" "$file.bak.auto_fix" || true
      sed -i -E "/\b(const|let|var)\b[^\"]*\b$var\b.*/d" "$file" || true
      CHANGED+=("$file")
    fi
  done
  grep -n "Expecting Unicode escape sequence \\\\uXXXX" "$lf" | while IFS= read -r L; do
    file=$(sed -n "1,$(echo "$L" | cut -d: -f1)p" "$lf" | grep -oE "src/.+\.(jsx|js|tsx|ts)" | tail -n1 || true)
    if [ -n "$file" ] && [ -f "$file" ]; then
      cp "$file" "$file.bak.auto_fix" || true
      sed -i -E "s/([^\\\\])\\\\([^\\\\])/\1\\\\\\\\\2/g" "$file" || true
      CHANGED+=("$file")
    fi
  done
done
if [ ${#CHANGED[@]} -gt 0 ]; then
  mapfile -t uniq < <(printf "%s\n" "${CHANGED[@]}" | awk '!x[$0]++')
  git add "${uniq[@]}" || true
  git commit -m "fix(frontend): auto-apply simple ESLint/build fixes" || true
  git push origin "HEAD:$BR" || true
  echo "Pushed changes: ${uniq[*]}"
else
  echo "No changes detected by runner"
fi
