#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 Local Node Deployer
# ══════════════════════════════════════════════════════════════
# Called by Panel: ./deploy-local-node.sh <NODE_ID> <TOKEN> <API_PORT> <SFTP_PORT>
# ══════════════════════════════════════════════════════════════

set -euo pipefail

NODE_ID="${1:-}"
TOKEN="${2:-}"
API_PORT="${3:-2087}"
SFTP_PORT="${4:-2022}"

[[ -z "$NODE_ID" || -z "$TOKEN" ]] && { echo "Error: Node ID and Token are required"; exit 1; }

NODE_DIR="/opt/proxpanel-node"
NODE_SERVICE="proxpanel-node"

# 1. Create directories
mkdir -p "$NODE_DIR" /etc/proxpanel /usr/local/bin

# 2. Copy source code from panel or download from GitHub
if [[ -d "/opt/proxpanel/server" ]]; then
    rm -rf "$NODE_DIR/server"
    cp -r "/opt/proxpanel/server" "$NODE_DIR/"
else
    # Fallback to cloning the repository
    CLONE_DIR="/tmp/proxpanel-node-clone"
    rm -rf "$CLONE_DIR"
    git clone --depth 1 https://github.com/Velio322/proxy-panel-v3.git "$CLONE_DIR"
    rm -rf "$NODE_DIR/server"
    cp -r "$CLONE_DIR/server" "$NODE_DIR/"
    rm -rf "$CLONE_DIR"
fi

# 3. Create .env file for the local worker node
cat > "$NODE_DIR/server/.env" <<EOF
MASTER_URL=http://127.0.0.1:3000
NODE_RPC_SECRET=${TOKEN}
WORKER_PORT=${API_PORT}
CONFIG_DIR=/etc/proxpanel
XRAY_BIN=/usr/local/bin/xray
SINGBOX_BIN=/usr/local/bin/sing-box
NODE_ENV=production
EOF

# Store the nodeId locally in the cached file
echo "$NODE_ID" > /etc/proxpanel/node.id

# 4. Download proxy binaries if not present
ARCH=$(uname -m)
ARCH_X64="64"
if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    ARCH_X64="arm64-v8a"
fi

# Xray
if [[ ! -f /usr/local/bin/xray ]]; then
    XRAY_VER=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest | grep -oP '"tag_name": "\K[^"]+' || echo "v1.8.4")
    XRAY_URL="https://github.com/XTLS/Xray-core/releases/download/${XRAY_VER}/Xray-linux-${ARCH_X64}.zip"
    if wget -qO /tmp/xray.zip "$XRAY_URL"; then
        unzip -qo /tmp/xray.zip xray -d /usr/local/bin/ && chmod +x /usr/local/bin/xray
        rm -f /tmp/xray.zip
    fi
fi

# sing-box
if [[ ! -f /usr/local/bin/sing-box ]]; then
    SING_VER="v1.13.12"
    SING_TAG="1.13.12"
    SING_ARCH="amd64"
    [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]] && SING_ARCH="arm64"
    SING_URL="https://github.com/SagerNet/sing-box/releases/download/${SING_VER}/sing-box-${SING_TAG}-linux-${SING_ARCH}.tar.gz"
    if wget -qO /tmp/sing.tar.gz "$SING_URL"; then
        tar -xzf /tmp/sing.tar.gz -C /tmp/
        SING_BIN=$(find /tmp -maxdepth 2 -name 'sing-box' -type f 2>/dev/null | head -1)
        if [[ -n "$SING_BIN" ]]; then
            mv "$SING_BIN" /usr/local/bin/sing-box && chmod +x /usr/local/bin/sing-box
        fi
        rm -rf /tmp/sing.tar.gz /tmp/sing-box-*
    fi
fi

# 5. Install Node dependencies and build
cd "$NODE_DIR/server"
npm install --no-workspaces
npx prisma generate
npm run build

# 6. Setup and start systemd service
NODE_BIN=$(which node)

cat > /etc/systemd/system/${NODE_SERVICE}.service <<EOF
[Unit]
Description=ProxPanel Node Worker
Documentation=https://github.com/Velio322/proxy-panel-v3
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${NODE_DIR}/server
ExecStart=${NODE_BIN} dist/worker/index.js
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=3
EnvironmentFile=${NODE_DIR}/server/.env
Environment=NODE_ENV=production

PrivateTmp=true
NoNewPrivileges=false

StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxpanel-node

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${NODE_SERVICE}
systemctl restart ${NODE_SERVICE}

echo "Deployment finished successfully."
