#!/bin/sh
set -e

echo "[Entrypoint] Running migrations..."
npx prisma db push --skip-generate 2>&1 || echo "[Entrypoint] Migration failed, continuing..."

echo "[Entrypoint] Starting server..."
exec "$@"
