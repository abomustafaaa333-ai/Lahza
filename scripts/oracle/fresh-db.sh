#!/bin/bash
# Recreates an empty Lahza database and restarts the app so it builds the
# schema from scratch. For a fresh install whose first start failed part-way.
# Refuses to run once the database holds any orders.
#
# Usage: sudo bash fresh-db.sh
set -euo pipefail

BASE=/opt/lahza
DB_PASSWORD=$(sed -n 's#^DATABASE_URL=mysql://lahza:\([^@]*\)@.*#\1#p' "$BASE/app.env")
sql() { docker exec lahza-db mariadb -ulahza -p"$DB_PASSWORD" -N -e "$1"; }

orders=$(sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='lahza' AND table_name='orders'")
if [ "$orders" = "1" ] && [ "$(sql 'SELECT COUNT(*) FROM lahza.orders')" != "0" ]; then
  echo "The database already has orders; not deleting it." >&2
  exit 1
fi

docker rm -f lahza-app >/dev/null 2>&1 || true
sql "DROP DATABASE IF EXISTS lahza; CREATE DATABASE lahza CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
docker run -d --name lahza-app --restart always --network lahza --env-file "$BASE/app.env" \
  -v "$BASE/certs/ca.pem:/certs/ca.pem:ro" lahza-app node dist/index.js >/dev/null
sleep 25
docker logs lahza-app 2>&1 | grep -E "Migrations (completed|repair)" | tail -n 1
echo "Tables: $(sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='lahza'")"
