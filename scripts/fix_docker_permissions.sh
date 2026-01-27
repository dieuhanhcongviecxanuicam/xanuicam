#!/bin/bash
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Run: sudo bash $0" >&2
  exit 1
fi

TARGET_USER=nttsu
# Add user to docker group
if id -nG "$TARGET_USER" | grep -qw docker; then
  echo "$TARGET_USER is already in the 'docker' group"
else
  usermod -aG docker "$TARGET_USER"
  echo "Added $TARGET_USER to docker group"
fi

# Restart Docker to ensure group changes and daemon state apply
if systemctl is-enabled --quiet docker; then
  systemctl restart docker
  echo "Docker restarted"
else
  echo "Docker systemd unit not enabled/available; please restart docker manually if required"
fi

echo "Note: the user must log out and log back in for group changes to take effect."
exit 0
