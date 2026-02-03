#!/usr/bin/env bash
set -euo pipefail
# Usage: sudo ./ssh_ca_setup.sh /path/to/ca.pub

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/ca.pub"
  exit 2
fi

CA_PUB_SRC="$1"
CA_PUB_DST="/etc/ssh/ca.pub"

echo "Copying CA public key to ${CA_PUB_DST}"
cp "$CA_PUB_SRC" "$CA_PUB_DST"
chmod 644 "$CA_PUB_DST"

echo "Updating /etc/ssh/sshd_config to trust the CA for user keys"
if ! grep -q "TrustedUserCAKeys" /etc/ssh/sshd_config; then
  echo "TrustedUserCAKeys ${CA_PUB_DST}" >> /etc/ssh/sshd_config
fi

echo "Reloading sshd"
systemctl reload sshd || service ssh reload || true

echo "Done. Ensure clients' user keys are signed by the CA and accepted."
