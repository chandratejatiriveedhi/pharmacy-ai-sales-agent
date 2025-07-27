#!/bin/sh
# wait-for-db.sh - Wait for database to be ready

set -e

host="$1"
port="$2"
shift 2
cmd="$@"

until nc -z "$host" "$port"; do
  echo "$(date) - waiting for $host:$port..."
  sleep 2
done

echo "$(date) - $host:$port is available"

# Additional check for PostgreSQL specifically
until PGPASSWORD=pharmacy_pass psql -h "$host" -p "$port" -U pharmacy_user -d pharmacy_db -c '\q'; do
  echo "$(date) - waiting for PostgreSQL to accept connections..."
  sleep 2
done

echo "$(date) - PostgreSQL is ready"

exec $cmd
