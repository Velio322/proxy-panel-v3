#!/bin/sh
set -e

echo "[Entrypoint] Waiting for PostgreSQL to be ready..."

# Simple TCP-based wait — no external tools needed
RETRIES=30
until node -e "
const net = require('net');
const url = process.env.DATABASE_URL || '';
const match = url.match(/\@([^:\/]+):(\d+)/);
if (!match) { console.error('Cannot parse DATABASE_URL'); process.exit(1); }
const [, host, port] = match;
const s = net.createConnection(parseInt(port), host);
s.on('connect', () => { s.destroy(); process.exit(0); });
s.on('error', () => { s.destroy(); process.exit(1); });
s.setTimeout(2000, () => { s.destroy(); process.exit(1); });
" 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "[Entrypoint] ERROR: Database did not become available in time"
        exit 1
    fi
    echo "[Entrypoint] Database not ready yet, retrying... ($RETRIES left)"
    sleep 2
done

echo "[Entrypoint] Database is ready"

echo "[Entrypoint] Running database schema sync (db push)..."
# Use db push — project has no migrations folder, only schema.prisma
npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
    echo "[Entrypoint] WARNING: db push failed, will try again after 5s..."
    sleep 5
    npx prisma db push --skip-generate --accept-data-loss 2>&1 || \
        echo "[Entrypoint] WARNING: db push still failed, server may have issues"
}

echo "[Entrypoint] Starting server..."
exec "$@"
