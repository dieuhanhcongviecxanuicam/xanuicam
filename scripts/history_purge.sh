#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
WARNING: This script PREPARES a history rewrite to REMOVE sensitive files/blobs from git history.

It does NOT force-push automatically. Review the changes locally, coordinate with collaborators,
and only force-push after team approval.
EOF

FILES_TO_REMOVE=(
  "backend/scripts/run_export_bulk_test.js"
  "backend/scripts/run_tasks_export_test.js"
  "backend/scripts/test_export_decrypted.js"
  "backend/scripts/test_login_admin.js"
  "backend/test_login_admin.out"
  "e2e/run_upload_smoke_test.js"
  "e2e/run_upload_test.ps1"
  "id_rsa_github"
  "id_rsa_github.pub"
)

echo "Creating local backup refs..."
git branch -f backup-main-before-history-purge "$(git rev-parse --abbrev-ref HEAD)" || true
git tag -f backup-before-history-purge-$(date +%s)

if command -v git-filter-repo >/dev/null 2>&1; then
  echo "git-filter-repo found — performing invert-paths removal of listed files..."
  ARGS=(--invert-paths)
  for p in "${FILES_TO_REMOVE[@]}"; do
    ARGS+=(--paths "$p")
  done
  echo "Running: git filter-repo ${ARGS[*]}"
  # shellcheck disable=SC2068
  git filter-repo ${ARGS[@]}

  echo
  echo "History rewrite completed locally. Inspect and test the repository now."
  echo "If everything looks good, push with:" 
  echo "  git push --force origin --all"
  echo "  git push --force origin --tags"
else
  echo "git-filter-repo not found. Install it: https://github.com/newren/git-filter-repo#install"
  echo "Or run the BFG tool as an alternative: https://rtyley.github.io/bfg-repo-cleaner/"
  exit 2
fi

exit 0
