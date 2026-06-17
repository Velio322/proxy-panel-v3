#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# KEEPER Worker Installer v3.0
#
# One-liner install:
#   bash <(curl -sSL URL) -m https://panel.example.com -t YOUR_TOKEN
#
# Interactive:
#   bash install-worker.sh
# ══════════════════════════════════════════════════════════════

INSTALL_DIR="/opt/keeper-worker"
SERVICE_NAME="keeper-worker"

# ──── Colors ────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

usage() {
    echo "Usage: $0 [-m MASTER_URL] [-t AUTH_TOKEN]"
    echo "  -m  Master panel URL (e.g. https://panel.example.com)"
    echo "  -t  Node auth token"
    echo ""
    echo "Examples:"
    echo "  bash install-worker.sh -m https://panel.example.com -t YOUR_TOKEN"
    echo "  bash <(curl -sSL URL) -m https://panel.example.com -t YOUR_TOKEN"
    exit 0
}

check_root() { [[ $EUID -ne 0 ]] && error "Run as root: sudo bash $0"; }

install_deps() {
    apt-get update -qq && apt-get install -y -qq curl wget jq unzip >/dev/null
    if ! command -v node &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y -qq nodejs >/dev/null
    fi
}

setup_worker() {
    local MASTER_URL="$1"
    local AUTH_TOKEN="$2"

    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"

    cat > worker.mjs <<EOF
import { execSync } from 'child_process';
import os from 'os';

const MASTER = "${MASTER_URL}";
const TOKEN = "${AUTH_TOKEN}";

async function heartbeat() {
  const payload = {
    nodeId: os.hostname(),
    status: 'ONLINE',
    cpuUsage: os.loadavg()[0],
    memUsage: (os.totalmem() - os.freemem()) / os.totalmem() * 100,
  };
  try {
    await fetch(\`\${MASTER}/api/v1/nodes/self/heartbeat\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${TOKEN}\` },
      body: JSON.stringify(payload)
    });
  } catch (e) { console.error('Heartbeat failed'); }
}

setInterval(heartbeat, 30000);
heartbeat();
console.log('Keeper Worker started');
EOF

    cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Keeper Worker
After=network.target

[Service]
ExecStart=$(which node) ${INSTALL_DIR}/worker.mjs
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME
    systemctl start $SERVICE_NAME
    log "Worker installed and started!"
}

main() {
    local MASTER_URL=""
    local AUTH_TOKEN=""

    while getopts "m:t:h" opt; do
        case $opt in
            m) MASTER_URL="$OPTARG" ;;
            t) AUTH_TOKEN="$OPTARG" ;;
            h) usage ;;
            *) usage ;;
        esac
    done

    check_root

    if [[ -z "$MASTER_URL" ]]; then
        read -rp "  Master Panel URL: " MASTER_URL
    fi
    if [[ -z "$AUTH_TOKEN" ]]; then
        read -rp "  Node Auth Token: " AUTH_TOKEN
    fi

    [[ -z "$MASTER_URL" ]] && error "Master URL is required (-m)"
    [[ -z "$AUTH_TOKEN" ]] && error "Auth token is required (-t)"

    install_deps
    setup_worker "$MASTER_URL" "$AUTH_TOKEN"
}

main "$@"
