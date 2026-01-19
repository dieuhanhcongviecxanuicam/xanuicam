#!/bin/sh
set -e
echo '---LS_ETC_CLOUDFLARED---'
ls -la /etc/cloudflared || true
echo '---CONFIG---'
sed -n '1,240p' /etc/cloudflared/config.yml || true
echo '---DOCKER_PS---'
docker ps --format 'table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}' || true
echo '---DOCKER_COMPOSE_PS---'
docker compose ps --all || true
echo '---SEARCH_COMPOSE---'
for d in /root /opt /srv /home /home/ubuntu /home/deploy /var/www; do
  if [ -f "$d/docker-compose.yml" ]; then
    echo "FOUND_COMPOSE $d"
    sed -n '1,200p' "$d/docker-compose.yml" || true
  fi
done
echo '---DOCKER_NETWORKS---'
docker network ls || true
echo '---NETWORK_INSPECT---'
for nid in $(docker network ls -q 2>/dev/null); do
  echo NETWORK_ID:$nid
  docker network inspect $nid || true
done
echo '---CLOUDF_CONTAINER---'
docker ps --filter 'name=cloudflared' --format '{{.ID}} {{.Names}} {{.Image}}' || true
echo '---BACKEND_CONTAINER---'
docker ps --filter 'name=backend' --format '{{.ID}} {{.Names}} {{.Image}}' || true
echo '---RESOLVE_TEST---'
cid=$(docker ps --filter 'name=cloudflared' -q | head -n1 || true)
if [ -n "$cid" ]; then
  docker exec "$cid" sh -c 'which nslookup >/dev/null 2>&1 || apk add --no-cache bind-tools >/dev/null 2>&1 || true; echo "nslookup backend:"; nslookup backend || true; echo "getent hosts backend:"; getent hosts backend || true; echo "/etc/hosts:"; cat /etc/hosts || true'
else
  echo 'NO_CLOUD_CONTAINER'
fi
echo '---END---'
