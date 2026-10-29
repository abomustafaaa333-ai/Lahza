#!/bin/bash
# Moves Lahza from the current VM to a new Always Free VM.Standard.A1.Flex VM.
# Run it in OCI Cloud Shell, which holds the SSH key (~/ssh-key-*.key) and the
# OCI CLI login. Each step is short; the long build runs detached on the new VM.
#
#   bash migrate-to-a1.sh create <old-ip> [ocpus] [memory-gb]   new VM + start the build there
#   bash migrate-to-a1.sh status                                  progress of that build
#   bash migrate-to-a1.sh move <domain>                           stop old app, copy data, start new
#   bash migrate-to-a1.sh dns <duckdns-subdomain>                 point DuckDNS at the new VM (asks for the token)
#   bash migrate-to-a1.sh check <domain>                          is the domain served by the new VM?
#   bash migrate-to-a1.sh rollback                                restart the app on the old VM
#   bash migrate-to-a1.sh retire                                  delete the old VM once the new one is fine
set -euo pipefail
trap 'echo "ERROR: stopped at line $LINENO: $BASH_COMMAND" >&2' ERR

STATE_DIR="$HOME/lahza-migrate"
STATE="$STATE_DIR/state"
REPO="https://github.com/abomustafaaa333-ai/Lahza.git"
mkdir -p "$STATE_DIR"
log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
save() { grep -v "^$1=" "$STATE" > "$STATE.tmp" 2>/dev/null || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; }
[ -f "$STATE" ] && . "$STATE"

KEY=$(ls "$HOME"/ssh-key-*.key 2>/dev/null | head -1)
[ -n "$KEY" ] || die "no ~/ssh-key-*.key in Cloud Shell"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ConnectTimeout=15)
on() { local ip=$1; shift; ssh "${SSH_OPTS[@]}" "ubuntu@$ip" "$@"; }

create() {
  local old_ip=${1:?usage: create <old-ip> [ocpus] [memory-gb]} ocpus=${2:-4} mem=${3:-24}
  local c=$OCI_TENANCY id ip=""
  save OLD_IP "$old_ip"

  if [ -n "${NEW_ID:-}" ] && [ "$(oci compute instance get --instance-id "$NEW_ID" --query 'data."lifecycle-state"' --raw-output 2>/dev/null)" = RUNNING ]; then
    log "The A1 VM already exists"
  else
    log "Finding the old VM ($old_ip) to reuse its network"
    local subnet="" ad="" comp=""
    for id in $(oci compute instance list -c "$c" --all --lifecycle-state RUNNING --query 'data[].id' --raw-output | tr -d '[],"'); do
      ip=$(oci compute instance list-vnics --instance-id "$id" --query 'data[0]."public-ip"' --raw-output 2>/dev/null || true)
      if [ "$ip" = "$old_ip" ]; then
        subnet=$(oci compute instance list-vnics --instance-id "$id" --query 'data[0]."subnet-id"' --raw-output)
        ad=$(oci compute instance get --instance-id "$id" --query 'data."availability-domain"' --raw-output)
        comp=$(oci compute instance get --instance-id "$id" --query 'data."compartment-id"' --raw-output)
        save OLD_ID "$id"
        break
      fi
    done
    [ -n "$subnet" ] || die "no running VM has the public IP $old_ip"

    local image
    image=$(oci compute image list -c "$c" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
      --shape VM.Standard.A1.Flex --sort-by TIMECREATED --sort-order DESC --all \
      --query "data[?!contains(\"display-name\", 'Minimal')] | [0].id" --raw-output)
    [ -n "$image" ] && [ "$image" != null ] || die "no Ubuntu 24.04 ARM image found"
    ssh-keygen -y -f "$KEY" > "$STATE_DIR/key.pub"

    # A run that was interrupted may already have created the VM; never make a second one.
    id=$(oci compute instance list -c "$comp" --display-name lahza-a1 --all \
      --query 'data[?"lifecycle-state"!=`TERMINATED` && "lifecycle-state"!=`TERMINATING`] | [0].id' --raw-output 2>/dev/null || true)
    if [ -n "$id" ] && [ "$id" != null ]; then
      log "Found the A1 VM from an earlier run; waiting until it is running"
      oci compute instance get --instance-id "$id" --wait-for-state RUNNING >/dev/null
      save NEW_ID "$id"; NEW_ID=$id
    fi
    [ -n "${NEW_ID:-}" ] || log "Creating VM.Standard.A1.Flex ($ocpus OCPU, $mem GB). This takes 2-5 minutes; keep this window open. If Oracle has no free A1 capacity right now, it retries every minute"
    for attempt in $(seq 1 60); do
      [ -z "${NEW_ID:-}" ] || break
      if id=$(oci compute instance launch -c "$comp" --availability-domain "$ad" --subnet-id "$subnet" \
          --shape VM.Standard.A1.Flex --shape-config "{\"ocpus\":$ocpus,\"memoryInGBs\":$mem}" \
          --image-id "$image" --assign-public-ip true --display-name lahza-a1 --boot-volume-size-in-gbs 50 \
          --ssh-authorized-keys-file "$STATE_DIR/key.pub" --wait-for-state RUNNING \
          --query 'data.id' --raw-output 2>"$STATE_DIR/launch.err"); then
        save NEW_ID "$id"; NEW_ID=$id; break
      fi
      if grep -qi "capacity" "$STATE_DIR/launch.err"; then
        log "Attempt $attempt: no A1 capacity yet, retrying in 60s"; sleep 60
      else
        cat "$STATE_DIR/launch.err" >&2; die "could not create the VM"
      fi
    done
    [ -n "${NEW_ID:-}" ] || die "still no A1 capacity after an hour; run create again later"
  fi

  NEW_IP=$(oci compute instance list-vnics --instance-id "$NEW_ID" --query 'data[0]."public-ip"' --raw-output)
  save NEW_IP "$NEW_IP"
  log "New VM IP: $NEW_IP; waiting for SSH"
  for _ in $(seq 1 40); do on "$NEW_IP" true 2>/dev/null && break; sleep 10; done
  on "$NEW_IP" true || die "SSH to $NEW_IP does not answer yet; run create again in a few minutes"

  log "Starting the build on the new VM (runs on its own; check with: bash $0 status)"
  on "$NEW_IP" "cat > /tmp/prep.sh" <<EOF
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -q && apt-get install -y -q git curl netfilter-persistent iptables-persistent
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
mkdir -p /opt/lahza && rm -rf /opt/lahza/src
git clone --quiet --depth 1 $REPO /opt/lahza/src
docker build -t lahza-app /opt/lahza/src
docker pull -q mariadb:11.4 && docker pull -q caddy:2
echo PREP_DONE
EOF
  on "$NEW_IP" "sudo setsid nohup bash /tmp/prep.sh > /tmp/prep.log 2>&1 < /dev/null &"
  log "Done. Wait for PREP_DONE: bash $0 status"
}

status() {
  [ -n "${NEW_IP:-}" ] || die "run create first"
  on "$NEW_IP" "tail -n 6 /tmp/prep.log"
}

move() {
  local domain=${1:?usage: move <domain>}
  [ -n "${NEW_IP:-}" ] && [ -n "${OLD_IP:-}" ] || die "run create first"
  on "$NEW_IP" "grep -q PREP_DONE /tmp/prep.log" || die "the new VM is still building; check: bash $0 status"

  log "Old VM: stopping the app and WhatsApp so nothing changes during the copy"
  on "$OLD_IP" 'sudo bash -s' <<'EOF'
set -e
mkdir -p /opt/lahza/migrate && chmod 700 /opt/lahza/migrate
docker inspect waha --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(WAHA_API_KEY|WAHA_DASHBOARD_PASSWORD|WHATSAPP_HOOK_URL)=' > /opt/lahza/migrate/waha.env
echo "WAHA_IMAGE=$(docker inspect waha --format '{{.Config.Image}}')" >> /opt/lahza/migrate/waha.env
docker stop lahza-app waha >/dev/null
PW=$(sed -n 's#^DATABASE_URL=mysql://lahza:\([^@]*\)@.*#\1#p' /opt/lahza/app.env)
docker exec lahza-db mariadb-dump -ulahza -p"$PW" --single-transaction --no-tablespaces lahza | gzip > /opt/lahza/migrate/db.sql.gz
tar -czf /tmp/lahza-bundle.tar.gz -C / opt/lahza/app.env opt/lahza/certs opt/lahza/migrate opt/waha/sessions
chmod 644 /tmp/lahza-bundle.tar.gz
EOF
  log "Copying the data through Cloud Shell"
  scp "${SSH_OPTS[@]}" "ubuntu@$OLD_IP:/tmp/lahza-bundle.tar.gz" "$STATE_DIR/bundle.tar.gz"
  scp "${SSH_OPTS[@]}" "$STATE_DIR/bundle.tar.gz" "ubuntu@$NEW_IP:/tmp/lahza-bundle.tar.gz"
  on "$OLD_IP" "sudo rm -f /tmp/lahza-bundle.tar.gz"
  rm -f "$STATE_DIR/bundle.tar.gz"

  log "New VM: restoring the database and WhatsApp, then starting everything"
  on "$NEW_IP" 'sudo bash -s' <<'EOF'
set -e
tar -xzf /tmp/lahza-bundle.tar.gz -C / && rm -f /tmp/lahza-bundle.tar.gz
. /opt/lahza/migrate/waha.env
# WAHA publishes ARM images under separate tags.
repo=${WAHA_IMAGE%%:*}; tag=latest; [ "$repo" != "$WAHA_IMAGE" ] && tag=${WAHA_IMAGE##*:}
case "$tag" in latest) tag=arm ;; arm|*-arm) ;; *) tag="$tag-arm" ;; esac
docker pull -q "$repo:$tag" >/dev/null 2>&1 || tag=arm
docker network inspect lahza >/dev/null 2>&1 || docker network create lahza >/dev/null
docker rm -f waha lahza-db >/dev/null 2>&1 || true
docker run -d --name waha --restart always --network lahza -p 3000:3000 \
  -v /opt/waha/sessions:/app/.sessions \
  -e WHATSAPP_DEFAULT_ENGINE=NOWEB -e WHATSAPP_RESTART_ALL_SESSIONS=True \
  -e WAHA_API_KEY="$WAHA_API_KEY" -e WAHA_DASHBOARD_USERNAME=admin -e WAHA_DASHBOARD_PASSWORD="$WAHA_DASHBOARD_PASSWORD" \
  -e WHATSAPP_HOOK_URL="$WHATSAPP_HOOK_URL" -e WHATSAPP_HOOK_EVENTS=message \
  "$repo:$tag" >/dev/null
PW=$(sed -n 's#^DATABASE_URL=mysql://lahza:\([^@]*\)@.*#\1#p' /opt/lahza/app.env)
rm -rf /opt/lahza/db && mkdir -p /opt/lahza/db
docker run -d --name lahza-db --restart always --network lahza \
  -e MARIADB_ROOT_PASSWORD="$(openssl rand -hex 16)" -e MARIADB_DATABASE=lahza \
  -e MARIADB_USER=lahza -e MARIADB_PASSWORD="$PW" \
  -v /opt/lahza/db:/var/lib/mysql -v /opt/lahza/certs:/certs:ro \
  mariadb:11.4 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci \
  --innodb-buffer-pool-size=256M --performance-schema=OFF \
  --ssl-ca=/certs/ca.pem --ssl-cert=/certs/server-cert.pem --ssl-key=/certs/server-key.pem >/dev/null
for _ in $(seq 1 60); do docker exec lahza-db mariadb-admin ping -ulahza -p"$PW" --silent >/dev/null 2>&1 && break; sleep 2; done
gunzip -c /opt/lahza/migrate/db.sql.gz | docker exec -i lahza-db mariadb -ulahza -p"$PW" lahza
echo "orders restored: $(docker exec lahza-db mariadb -N -ulahza -p"$PW" lahza -e 'SELECT COUNT(*) FROM orders')"
EOF
  on "$NEW_IP" "curl -fsSL https://raw.githubusercontent.com/abomustafaaa333-ai/Lahza/main/scripts/oracle/install.sh -o /tmp/i.sh && sudo LAHZA_SKIP_BUILD=1 bash /tmp/i.sh $domain main" || true
  log "The new VM is running. Now point the domain at $NEW_IP:"
  log "  bash $0 dns <your duckdns subdomain>   (or set the IP yourself on duckdns.org)"
  log "If anything is wrong, the old VM still has everything: bash $0 rollback"
}

dns() {
  local sub=${1:?usage: dns <duckdns-subdomain, e.g. lahza-app>} token
  [ -n "${NEW_IP:-}" ] || die "run create first"
  read -rsp "DuckDNS token (from duckdns.org, not shown): " token; echo
  [ "$(curl -s "https://www.duckdns.org/update?domains=${sub%%.*}&token=$token&ip=$NEW_IP")" = OK ] || die "DuckDNS did not accept the update"
  log "DuckDNS now points ${sub%%.*}.duckdns.org at $NEW_IP; HTTPS works after a minute or two: bash $0 check ${sub%%.*}.duckdns.org"
}

check() {
  local domain=${1:?usage: check <domain>}
  log "DNS: $(getent hosts "$domain" | awk '{print $1}') (new VM: ${NEW_IP:-?})"
  on "$NEW_IP" "sudo docker ps --format '  {{.Names}}\t{{.Status}}'"
  on "$NEW_IP" 'sudo bash -c ". /opt/lahza/migrate/waha.env; curl -s -H \"X-Api-Key: \$WAHA_API_KEY\" http://localhost:3000/api/sessions" | grep -o "\"status\":\"[A-Z_]*\"" | sed "s/^/  WhatsApp /"' || true
  if curl -sf -o /dev/null --max-time 20 "https://$domain/"; then log "https://$domain answers"; else log "https://$domain not answering yet; wait a minute and check again"; fi
}

rollback() {
  [ -n "${OLD_IP:-}" ] || die "nothing to roll back"
  on "$OLD_IP" "sudo docker start waha lahza-app >/dev/null && sudo docker ps --format '  {{.Names}}\t{{.Status}}'"
  log "The old VM serves again. If DuckDNS already points at the new VM, set it back to $OLD_IP"
}

retire() {
  [ -n "${OLD_ID:-}" ] || die "run create first"
  log "This deletes the old VM ($OLD_IP) and its disk for good."
  read -rp "Type DELETE to continue: " answer
  [ "$answer" = DELETE ] || die "cancelled"
  oci compute instance terminate --instance-id "$OLD_ID" --preserve-boot-volume false --force
  log "The old VM is being deleted"
}

cmd=${1:-}; shift || true
case "$cmd" in
  create|status|move|dns|check|rollback|retire) "$cmd" "$@" ;;
  *) sed -n '2,13p' "$0"; exit 1 ;;
esac
