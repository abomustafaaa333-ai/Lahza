#!/bin/bash
# Installs Lahza (app + MariaDB + HTTPS) on an Ubuntu VM that already runs the
# WAHA container named "waha". Safe to run again: it keeps the database,
# secrets and the WhatsApp session, and only rebuilds the app.
#
# Usage: sudo bash install.sh <domain> [git-branch]
set -euo pipefail

DOMAIN="${1:?usage: install.sh <domain> [git-branch]}"
BRANCH="${2:-main}"
REPO="https://github.com/abomustafaaa333-ai/Lahza.git"
BASE=/opt/lahza
ENV_FILE="$BASE/app.env"

log() { echo "[$(date +%H:%M:%S)] $*"; }
waha_env() { docker inspect waha --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n "s/^$1=//p"; }

mkdir -p "$BASE/certs" "$BASE/db"

log "Swap: building the app needs more memory than this VM has"
if [ "$(free -m | awk '/^Swap/{print $2}')" -lt 3500 ] && [ ! -f /swapfile2 ]; then
  fallocate -l 3G /swapfile2 && chmod 600 /swapfile2 && mkswap /swapfile2
  echo '/swapfile2 none swap sw 0 0' >> /etc/fstab
fi
swapon /swapfile2 2>/dev/null || true

log "Firewall: open 80 and 443 before the image's REJECT rule"
for port in 80 443; do
  if ! iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    reject_line=$(iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')
    iptables -I INPUT "${reject_line:-1}" -p tcp --dport "$port" -j ACCEPT
  fi
done
netfilter-persistent save >/dev/null 2>&1 || true
command -v git >/dev/null || apt-get install -y git

docker network inspect lahza >/dev/null 2>&1 || docker network create lahza >/dev/null

log "Secrets: reuse the WAHA key and webhook secret, generate the rest once"
WAHA_KEY=$(waha_env WAHA_API_KEY)
WAHA_PASSWORD=$(waha_env WAHA_DASHBOARD_PASSWORD)
WAHA_HOOK=$(waha_env WHATSAPP_HOOK_URL)
WEBHOOK_SECRET="${WAHA_HOOK##*token=}"
if [ ! -f "$ENV_FILE" ]; then
  DB_PASSWORD=$(openssl rand -hex 16)
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://lahza:$DB_PASSWORD@lahza-db:3306/lahza
JWT_SECRET=$(openssl rand -hex 32)
WAHA_URL=http://waha:3000
WAHA_API_KEY=$WAHA_KEY
WAHA_SESSION=default
WAHA_WEBHOOK_SECRET=$WEBHOOK_SECRET
NODE_EXTRA_CA_CERTS=/certs/ca.pem
EOF
fi
chmod 600 "$ENV_FILE"
DB_PASSWORD=$(sed -n 's#^DATABASE_URL=mysql://lahza:\([^@]*\)@.*#\1#p' "$ENV_FILE")

log "Database TLS: the app only connects to MySQL over verified TLS"
if [ ! -f "$BASE/certs/ca.pem" ]; then
  (
    cd "$BASE/certs"
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=lahza-db-ca" -keyout ca-key.pem -out ca.pem
    openssl req -newkey rsa:2048 -nodes -subj "/CN=lahza-db" -keyout server-key.pem -out server.csr
    echo "subjectAltName=DNS:lahza-db" > san.ext
    openssl x509 -req -in server.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -days 3650 -extfile san.ext -out server-cert.pem
    chown 999:999 server-key.pem && chmod 600 server-key.pem ca-key.pem && chmod 644 ca.pem server-cert.pem
  ) >/dev/null 2>&1
fi

if ! docker inspect lahza-db >/dev/null 2>&1; then
  log "Database: starting MariaDB"
  docker run -d --name lahza-db --restart always --network lahza \
    -e MARIADB_ROOT_PASSWORD="$(openssl rand -hex 16)" -e MARIADB_DATABASE=lahza \
    -e MARIADB_USER=lahza -e MARIADB_PASSWORD="$DB_PASSWORD" \
    -v "$BASE/db:/var/lib/mysql" -v "$BASE/certs:/certs:ro" \
    mariadb:11.4 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
    --innodb-buffer-pool-size=64M --performance-schema=OFF \
    --ssl-ca=/certs/ca.pem --ssl-cert=/certs/server-cert.pem --ssl-key=/certs/server-key.pem >/dev/null
fi
for _ in $(seq 1 60); do
  docker exec lahza-db mariadb-admin ping -ulahza -p"$DB_PASSWORD" --silent >/dev/null 2>&1 && break
  sleep 2
done

log "App: downloading branch $BRANCH and building (this takes 15-40 minutes on a small VM)"
rm -rf "$BASE/src"
git clone --quiet --depth 1 -b "$BRANCH" "$REPO" "$BASE/src"
docker build -t lahza-app "$BASE/src"
docker rm -f lahza-app >/dev/null 2>&1 || true
docker run -d --name lahza-app --restart always --network lahza --env-file "$ENV_FILE" \
  -v "$BASE/certs/ca.pem:/certs/ca.pem:ro" lahza-app >/dev/null

log "WAHA: send webhooks straight to the app over the private network"
INTERNAL_HOOK="http://lahza-app:3000/api/waha/webhook?token=$WEBHOOK_SECRET"
if [ "$WAHA_HOOK" != "$INTERNAL_HOOK" ]; then
  WAHA_IMAGE=$(docker inspect waha --format '{{.Config.Image}}')
  docker rm -f waha >/dev/null
  docker run -d --name waha --restart always --network lahza -p 3000:3000 \
    -v /opt/waha/sessions:/app/.sessions \
    -e WHATSAPP_DEFAULT_ENGINE=NOWEB -e WHATSAPP_RESTART_ALL_SESSIONS=True \
    -e WAHA_API_KEY="$WAHA_KEY" -e WAHA_DASHBOARD_USERNAME=admin -e WAHA_DASHBOARD_PASSWORD="$WAHA_PASSWORD" \
    -e WHATSAPP_HOOK_URL="$INTERNAL_HOOK" -e WHATSAPP_HOOK_EVENTS=message \
    "$WAHA_IMAGE" >/dev/null
else
  docker network connect lahza waha 2>/dev/null || true
fi

log "HTTPS: Caddy gets a free certificate for $DOMAIN"
docker rm -f caddy >/dev/null 2>&1 || true
docker run -d --name caddy --restart always --network lahza -p 80:80 -p 443:443 \
  -v caddy_data:/data -v caddy_config:/config \
  caddy:2 caddy reverse-proxy --from "$DOMAIN" --to lahza-app:3000 >/dev/null

docker image prune -f >/dev/null 2>&1 || true
sleep 20
log "Status:"
docker ps --format '  {{.Names}}\t{{.Status}}'
if curl -sf -o /dev/null --max-time 30 "https://$DOMAIN/"; then
  log "DONE: https://$DOMAIN is online"
else
  log "Containers started; https://$DOMAIN may need a minute for its certificate. Logs: docker logs lahza-app / docker logs caddy"
fi
