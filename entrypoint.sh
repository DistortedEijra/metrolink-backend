#!/bin/sh
# On first start (no `users` table yet), load schema.sql + demo-seed.sql
# into the MySQL instance pointed to by MYSQLHOST/MYSQLPORT/MYSQLUSER/
# MYSQLPASSWORD (Railway's MySQL plugin) or DB_HOST/DB_PORT/DB_USERNAME/
# DB_PASSWORD. Then start Tomcat.
set -e

DB_HOST="${MYSQLHOST:-${DB_HOST:-localhost}}"
DB_PORT="${MYSQLPORT:-${DB_PORT:-3306}}"
DB_USER="${MYSQLUSER:-${DB_USERNAME:-root}}"
DB_PASS="${MYSQLPASSWORD:-${DB_PASSWORD:-}}"

echo "Waiting for MySQL at $DB_HOST:$DB_PORT..."
i=0
while [ "$i" -lt 60 ]; do
  if mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" --silent 2>/dev/null; then
    echo "MySQL is up."
    break
  fi
  i=$((i+1))
  sleep 2
done

TABLE_COUNT=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" -N -B \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='metrolink_db' AND table_name='users';" 2>/dev/null || echo 0)

if [ "$TABLE_COUNT" = "0" ]; then
  echo "Initializing database schema and demo data..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" < /db-init/schema.sql
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" < /db-init/demo-seed.sql
  echo "Database ready."
else
  echo "Database already initialized, skipping seed."
fi

exec catalina.sh run
