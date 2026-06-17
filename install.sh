#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 Installer
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh?t=$(date +%s))
# ══════════════════════════════════════════════════════════════

set -uo pipefail

REPO="Velio322/proxy-panel-v3"
BRANCH="main"
PANEL_DIR="/opt/proxpanel"
NODE_DIR="/opt/proxpanel-node"
CLONE_DIR="/tmp/proxpanel-src"
NODE_SERVICE="proxpanel-node"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
fail()  { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}[$1]${NC} ${BOLD}$2${NC}"; }

generate_secret() { openssl rand -hex 32; }

# ──── Root check ────

cd /tmp || true
[[ $EUID -ne 0 ]] && fail "Run as root: sudo bash <(curl -Ls URL)"

# ──── Banner ────

echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║           ProxPanel v3 Installer               ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════╝${NC}\n"

# ──── Mode selection ────

echo -e "  ${BOLD}Select installation mode:${NC}\n"
echo -e "    ${CYAN}1${NC}) Panel only (web dashboard + database)"
echo -e "    ${CYAN}2${NC}) Node only (proxy worker on this server)"
echo -e "    ${CYAN}3${NC}) Panel + Node (all-in-one server)\n"

read -rp "  Enter choice [1-3]: " MODE
case "$MODE" in
    1) INSTALL_MODE="panel" ;;
    2) INSTALL_MODE="node" ;;
    3) INSTALL_MODE="both" ;;
    *) fail "Invalid choice. Enter 1, 2, or 3." ;;
esac

# ══════════════════════════════════════════════
# PANEL INSTALL
# ══════════════════════════════════════════════

install_panel() {
    # ──── Dependencies ────

    if ! command -v docker &>/dev/null; then
        echo -e "${CYAN}Installing Docker...${NC}"
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker &>/dev/null && systemctl start docker
    fi
    docker compose version &>/dev/null || fail "docker compose plugin missing"

    # ──── Collect info ────

    echo -e "\n  ${BOLD}Panel configuration:${NC}\n"
    read -rp "  Panel domain (e.g. panel.yourdomain.com): " PANEL_DOMAIN
    read -rp "  Admin email (for SSL certificate): " ADMIN_EMAIL
    read -rp "  Admin username [admin]: " ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"
    read -rp "  Admin password: " ADMIN_PASS

    [[ -z "$PANEL_DOMAIN" ]] && fail "Domain required"
    [[ -z "$ADMIN_EMAIL" ]] && fail "Email required"
    [[ -z "$ADMIN_PASS" ]] && fail "Password required"

    # ──── Clone ────

    step "PANEL 1/6" "Downloading source..."
    rm -rf "$CLONE_DIR"
    mkdir -p "$CLONE_DIR"
    curl -sL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | tar xz -C "$CLONE_DIR" --strip-components=1 || fail "Download failed"
    log "Source downloaded"

    # ──── Setup ────

    step "PANEL 2/6" "Setting up..."
    mkdir -p "$PANEL_DIR"
    cp -r "$CLONE_DIR"/* "$PANEL_DIR/"
    rm -rf "$CLONE_DIR"

    DB_PASS=$(openssl rand -hex 16)
    JWT_SECRET=$(generate_secret)
    RPC_SECRET=$(generate_secret)
    ENC_KEY=$(openssl rand -hex 16)

    cat > "$PANEL_DIR/.env" <<EOF
POSTGRES_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
NODE_RPC_SECRET=${RPC_SECRET}
ENCRYPTION_KEY=${ENC_KEY}
API_URL=https://${PANEL_DOMAIN}
FRONTEND_URL=https://${PANEL_DOMAIN}
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_IDS=
CRYPTOPAY_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
BACKUP_ENABLED=false
EOF

    cat > "$PANEL_DIR/Caddyfile" <<EOF
${PANEL_DOMAIN} {
    handle /api/* {
        reverse_proxy server:3000
    }
    handle /health {
        reverse_proxy server:3000
    }
    handle {
        reverse_proxy client:80
    }
}
EOF

    log "Configuration ready"

    # ──── Build ────

    step "PANEL 3/6" "Building containers (this takes a few minutes)..."
    cd "$PANEL_DIR"
    if ! docker compose build --parallel 2>&1; then
        fail "Docker build failed. Check output above."
    fi
    log "Containers built"

    # ──── Start ────

    step "PANEL 4/6" "Starting services..."
    docker compose up -d
    log "Services started"

    # ──── Wait for server ────

    step "PANEL 5/6" "Waiting for server..."
    for i in $(seq 1 60); do
        if docker compose exec -T server wget -q --spider http://localhost:3000/api/health &>/dev/null; then
            break
        fi
        sleep 2
    done
    if ! docker compose exec -T server wget -q --spider http://localhost:3000/api/health &>/dev/null; then
        warn "Server not healthy, checking logs..."
        docker compose logs server --tail 20
        fail "Server failed to start"
    fi
    log "Server is healthy"

    # ──── Migrate & Seed ────

    step "PANEL 6/6" "Setting up database..."
    docker compose exec -T server npx prisma db push --skip-generate 2>&1 | tail -3
    docker compose exec -T server npx tsx prisma/seed.ts --username "$ADMIN_USER" --password "$ADMIN_PASS" --email "$ADMIN_EMAIL" 2>&1 | tail -3
    log "Database ready"

    # ──── Firewall ────

    if command -v ufw &>/dev/null; then
        ufw allow 80/tcp >/dev/null 2>&1
        ufw allow 443/tcp >/dev/null 2>&1
        ufw allow 443/udp >/dev/null 2>&1
        ufw allow 22/tcp >/dev/null 2>&1
        echo "y" | ufw enable >/dev/null 2>&1
    fi

    echo -e "\n  ${GREEN}${BOLD}Panel installed!${NC}"
    echo -e "  URL:      ${BOLD}https://${PANEL_DOMAIN}${NC}"
    echo -e "  Login:    ${BOLD}${ADMIN_USER}${NC}"
    echo -e "  Password: ${BOLD}${ADMIN_PASS}${NC}"
    echo -e "  Node secret: ${RPC_SECRET}"
}

# ══════════════════════════════════════════════
# NODE INSTALL
# ══════════════════════════════════════════════

install_node() {
    local MASTER_URL="$1"
    local NODE_SECRET="$2"

    # ──── Dependencies ────

    apt-get update -qq && apt-get install -y -qq curl wget jq unzip >/dev/null

    if ! command -v node &>/dev/null; then
        echo -e "${CYAN}Installing Node.js...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
        apt-get install -y -qq nodejs >/dev/null
    fi
    log "Node.js $(node -v)"

    # ──── Setup ────

    step "NODE 1/4" "Downloading source..."
    rm -rf "$CLONE_DIR"
    mkdir -p "$CLONE_DIR"
    curl -sL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | tar xz -C "$CLONE_DIR" --strip-components=1 || fail "Download failed"
    mkdir -p "$NODE_DIR"
    cp -r "$CLONE_DIR/server" "$NODE_DIR/"
    rm -rf "$CLONE_DIR"
    log "Source ready"

    # ──── Install deps ────

    step "NODE 2/4" "Installing dependencies..."
    cd "$NODE_DIR/server"
    npm install --no-workspaces 2>&1 | tail -3
    npx prisma generate 2>&1 | tail -1
    log "Dependencies installed"

    # ──── Create .env ────

    cat > "$NODE_DIR/server/.env" <<EOF
MASTER_URL=${MASTER_URL}
NODE_RPC_SECRET=${NODE_SECRET}
WORKER_PORT=2087
CONFIG_DIR=/etc/proxpanel
XRAY_BIN=/usr/local/bin/xray
SINGBOX_BIN=/usr/local/bin/sing-box
NAIVE_BIN=/usr/local/bin/naive
MIERU_BIN=/usr/local/bin/mieru
EOF

    # ──── Download binaries ────

    step "NODE 3/4" "Downloading proxy binaries..."
    mkdir -p /usr/local/bin /etc/proxpanel

    ARCH=$(uname -m)
    [[ "$ARCH" == "x86_64" ]] && ARCH_TAG="64" || ARCH_TAG="arm64"

    # Xray
    if [[ ! -f /usr/local/bin/xray ]]; then
        XRAY_URL=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest | jq -r ".assets[] | select(.name | test(\"linux-${ARCH_TAG}\")) | .browser_download_url" | head -1)
        if [[ -n "$XRAY_URL" ]]; then
            wget -qO /tmp/xray.zip "$XRAY_URL" && unzip -qo /tmp/xray.zip xray -d /usr/local/bin/ && chmod +x /usr/local/bin/xray && rm /tmp/xray.zip
            log "Xray installed"
        else
            warn "Xray binary not found for arch $ARCH"
        fi
    else
        log "Xray already installed"
    fi

    # sing-box
    if [[ ! -f /usr/local/bin/sing-box ]]; then
        SING_URL=$(curl -s https://api.github.com/repos/SagerNet/sing-box/releases/latest | jq -r ".assets[] | select(.name | test(\"linux-amd64\")) | .browser_download_url" | head -1)
        if [[ -n "$SING_URL" ]]; then
            wget -qO /tmp/sing.tar.gz "$SING_URL" && tar -xzf /tmp/sing.tar.gz -C /usr/local/bin/ --strip-components=1 && chmod +x /usr/local/bin/sing-box && rm /tmp/sing.tar.gz
            log "sing-box installed"
        else
            warn "sing-box binary not found"
        fi
    else
        log "sing-box already installed"
    fi

    # ──── Systemd service ────

    step "NODE 4/4" "Creating systemd service..."
    cat > /etc/systemd/system/${NODE_SERVICE}.service <<EOF
[Unit]
Description=ProxPanel Node Worker
After=network.target

[Service]
Type=simple
WorkingDirectory=${NODE_DIR}/server
ExecStart=$(which node) dist/worker/index.js
Restart=always
RestartSec=5
EnvironmentFile=${NODE_DIR}/server/.env
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # Build worker
    cd "$NODE_DIR/server"
    npm run build 2>&1 | tail -3

    systemctl daemon-reload
    systemctl enable ${NODE_SERVICE}
    systemctl start ${NODE_SERVICE}
    log "Node worker service started"

    # ──── Firewall ────

    if command -v ufw &>/dev/null; then
        ufw allow 443/tcp >/dev/null 2>&1
        ufw allow 443/udp >/dev/null 2>&1
    fi

    echo -e "\n  ${GREEN}${BOLD}Node installed!${NC}"
    echo -e "  Service: ${NODE_SERVICE}"
    echo -e "  Master:  ${MASTER_URL}"
    echo -e "  Config:  ${NODE_DIR}/server/.env"
}

# ══════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════

case "$INSTALL_MODE" in
    panel)
        install_panel
        ;;
    node)
        echo -e "\n  ${BOLD}Node configuration:${NC}\n"
        read -rp "  Panel URL (e.g. https://panel.yourdomain.com): " MASTER_URL
        read -rp "  Node secret (from panel): " NODE_SECRET
        [[ -z "$MASTER_URL" ]] && fail "Panel URL required"
        [[ -z "$NODE_SECRET" ]] && fail "Node secret required"
        install_node "$MASTER_URL" "$NODE_SECRET"
        ;;
    both)
        install_panel
        echo ""
        step "NODE" "Installing node worker on same server..."
        install_node "http://127.0.0.1:3000" "$RPC_SECRET"
        ;;
esac

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Done!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}\n"
