#!/usr/bin/env bash
set -euo pipefail

# Usage: set GITHUB_TOKEN and optionally REPO=owner/repo, then run this script.
# Example: GITHUB_TOKEN=xxx REPO=dieuhanhcongviecxanuicam/xanuicam ./scripts/revoke_deploy_keys.sh

REPO="${REPO:-dieuhanhcongviecxanuicam/xanuicam}"
OUTDIR="/tmp/xanuicam-github-ops"
mkdir -p "$OUTDIR"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN not set. Provide an admin-scoped PAT in GITHUB_TOKEN." >&2
  exit 2
fi

echo "Listing deploy keys for $REPO..."
curl -sS -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/keys" -o "$OUTDIR/deploy_keys_list.json"

if jq -e 'has("message")' "$OUTDIR/deploy_keys_list.json" >/dev/null 2>&1; then
  jq . "$OUTDIR/deploy_keys_list.json"
  echo "API returned an error; aborting." >&2
  exit 3
fi

echo "Processing remote keys..."
jq -c '.[]' "$OUTDIR/deploy_keys_list.json" | while read -r obj; do
  id=$(jq -r '.id' <<<"$obj")
  key=$(jq -r '.key' <<<"$obj")
  file="$OUTDIR/remote_key_${id}.pub"
  echo "$key" > "$file"
  fp=$(ssh-keygen -lf "$file" 2>/dev/null | awk '{print $2}') || fp=""
  echo "REMOTE id=$id fp=$fp" >> "$OUTDIR/remote_key_fingerprints.txt"
done

echo "Computing local fingerprints from /home/nttsu/.local/xanuicam-secrets-2026-02-03/ ..."
LOCAL_DIR="/home/nttsu/.local/xanuicam-secrets-2026-02-03"
for f in "$LOCAL_DIR"/*; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  case "$f" in
    *.pub)
      fp=$(ssh-keygen -lf "$f" 2>/dev/null | awk '{print $2}') || fp=""
      ;;
    *)
      # try to derive public key from private key
      tmppub=$(mktemp)
      if ssh-keygen -y -f "$f" > "$tmppub" 2>/dev/null; then
        fp=$(ssh-keygen -lf "$tmppub" 2>/dev/null | awk '{print $2}') || fp=""
      else
        fp=""
      fi
      rm -f "$tmppub"
      ;;
  esac
  echo "LOCAL name=$name fp=$fp" >> "$OUTDIR/local_key_fingerprints.txt"
done

echo "Matching remote against local..."
touch "$OUTDIR/delete_candidates.txt"
while read -r line; do
  id=$(awk -F'[= ]' '/REMOTE id/ {print $3}' <<<"$line")
  fp=$(awk -F'[= ]' '/REMOTE id/ {print $5}' <<<"$line")
  if [ -z "$fp" ] || [ "$fp" = "" ]; then
    continue
  fi
  if grep -Fq "$fp" "$OUTDIR/local_key_fingerprints.txt" 2>/dev/null; then
    echo "$id" >> "$OUTDIR/delete_candidates.txt"
    echo "MATCH: remote id=$id fp=$fp" >> "$OUTDIR/matches.txt"
  fi
done < <(sed -n '1,200p' "$OUTDIR/remote_key_fingerprints.txt")

if [ ! -s "$OUTDIR/delete_candidates.txt" ]; then
  echo "No matching remote deploy keys found to delete. See $OUTDIR for artifacts." 
  exit 0
fi

echo "Deleting matched deploy keys..."
while read -r id; do
  echo -n "Deleting key id=$id... "
  curl -sS -X DELETE -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/$REPO/keys/$id" -o "$OUTDIR/delete_$id.json" || true
  jq -C . "$OUTDIR/delete_$id.json" || true
done < "$OUTDIR/delete_candidates.txt"

echo "Done. Logs and artifacts in $OUTDIR. Update Issue #113 with results." 
