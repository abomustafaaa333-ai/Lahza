#!/bin/bash
# Adds or replaces settings in /opt/lahza/app.env and restarts the app so it
# reads them (an env file is only read when the container is created).
#
# Usage: sudo bash set-env.sh NAME=value [NAME=value ...]
set -euo pipefail

BASE=/opt/lahza
ENV_FILE="$BASE/app.env"
[ $# -gt 0 ] || { echo "usage: set-env.sh NAME=value [NAME=value ...]" >&2; exit 1; }

for pair in "$@"; do
  name="${pair%%=*}"
  if ! [[ "$name" =~ ^[A-Z][A-Z0-9_]*$ ]] || [ "$name" = "$pair" ]; then
    echo "skipped '$name': expected NAME=value" >&2
    continue
  fi
  grep -v "^$name=" "$ENV_FILE" > "$ENV_FILE.tmp" || true
  printf '%s\n' "$pair" >> "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  echo "set $name"
done
chmod 600 "$ENV_FILE"

docker rm -f lahza-app >/dev/null
docker run -d --name lahza-app --restart always --network lahza --env-file "$ENV_FILE" \
  -v "$BASE/certs/ca.pem:/certs/ca.pem:ro" lahza-app node dist/index.js >/dev/null
sleep 15
docker ps --filter name=lahza-app --format '{{.Names}}: {{.Status}}'
