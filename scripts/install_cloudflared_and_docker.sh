#!/usr/bin/env bash
set -euo pipefail

# This script prepares an Ubuntu server for running the xanuicam stack with Docker
# It will:
# - install Docker & docker-compose plugin
# - create /etc/cloudflared and instruct where to place credentials
# - create a docker-compose override for local deployment

echo "==> Installing prerequisites"
apt-get update
apt-get install -y ca-certificates curl gnupg lsb-release

echo "==> Installing Docker"
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmour -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Preparing cloudflared directory"
mkdir -p /etc/cloudflared
chown root:root /etc/cloudflared
chmod 700 /etc/cloudflared

echo
echo "Place your cloudflared credentials (credentials.json or cert.pem) into /etc/cloudflared and create config.yml based on scripts/cloudflared/config.yml.template in the repo."
echo
echo "Example to install tunnel with token (if you have a token):"
echo "  cloudflared service install <TUNNEL_TOKEN>"

echo "Setup complete. Review /etc/cloudflared and then run:"
echo "  docker compose up -d --build"
