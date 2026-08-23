#!/bin/bash
set -e

echo "=== Ensuring services are running ==="
sudo service postgresql start
sudo service redis-server start

# Check PostgreSQL connection
export DATABASE_URL="postgresql://proxpanel:proxpanel123@127.0.0.1:5432/proxpanel?schema=public"
export REDIS_URL="redis://127.0.0.1:6379"
export API_PORT=3001
export JWT_SECRET="dev-jwt-secret-not-for-production"

cd /mnt/f/proxy-panel-v3/server
# Ensure Prisma schema is synchronized and admin user exists
node ./node_modules/prisma/build/index.js db push --skip-generate
node ./node_modules/tsx/dist/cli.mjs prisma/seed.ts --username admin --password admin123

echo "=== Starting ProxPanel Master Server on port 3001 ==="
node ./node_modules/tsx/dist/cli.mjs watch src/master/index.ts &
SERVER_PID=$!

echo "=== Starting ProxPanel Client on port 5173 ==="
cd /mnt/f/proxy-panel-v3/client
node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 &
CLIENT_PID=$!

echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"

# Wait for both processes
wait $SERVER_PID $CLIENT_PID
