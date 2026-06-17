#!/bin/sh
set -e

echo "[Entrypoint] Waiting for database to be ready..."
# FIX: Wait for postgres to accept connections before running migrations
MAX_TRIES=30
TRIES=0
until npx prisma db execute --stdin <<'SQL' 2>/dev/null || [ $TRIES -ge $MAX_TRIES ]; do
SELECT 1;
SQL
    TRIES=$((TRIES + 1))
    echo "[Entrypoint] Database not ready yet, waiting... ($TRIES/$MAX_TRIES)"
    sleep 2
done

if [ $TRIES -ge $MAX_TRIES ]; then
    echo "[Entrypoint] ERROR: Database did not become ready in time"
    exit 1
fi

echo "[Entrypoint] Running database migrations..."
# Use migrate deploy in production (not db push which can cause data loss)
if ! npx prisma migrate deploy 2>&1; then
    echo "[Entrypoint] migrate deploy failed, falling back to db push..."
    npx prisma db push --skip-generate 2>&1 || echo "[Entrypoint] WARNING: DB push also failed, continuing..."
fi

echo "[Entrypoint] Starting server..."
exec "$@"
