#!/usr/bin/env bash
set -euo pipefail

# Usage: ./generate_deploy_key.sh ./deploy_key
# Generates an ed25519 keypair suitable for a GitHub deploy key and prints next steps.
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <output-path-prefix>"
  exit 2
fi
OUT="$1"
PRIV="$OUT"
PUB="$OUT.pub"

ssh-keygen -t ed25519 -a 100 -C "deploy@xanuicam" -f "$PRIV" -N ""
echo
echo "Private key: $PRIV"
echo "Public key: $PUB"
echo
cat <<'EOF'
Next steps:
1) Add the generated PUBLIC key ($PUB) as a repository Deploy key in GitHub (Settings -> Deploy keys). Grant 'Allow write' if you want the workflow to push.
2) Add the PRIVATE key content as a repository secret named 'PROD_SSH_KEY' (or 'DEPLOY_SSH_KEY') in Settings -> Secrets and variables -> Actions.
3) Also add secrets: PROD_HOST, PROD_USER, PROD_SSH_PORT (optional), PROD_DEPLOY_PATH.
4) Test the workflow by pushing to 'main' branch.
EOF

exit 0
