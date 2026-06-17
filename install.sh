#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 Installer
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh)
# ══════════════════════════════════════════════════════════════

set -euo pipefail

REPO="Velio322/proxy-panel-v3"
BRANCH="main"
PANEL_DIR="/opt/proxpanel"
NODE_DIR="/opt/proxpanel-node"
CLONE_DIR="/tmp/proxpanel-src"
NODE_SERVICE="proxpanel-node"

# FIX #1: RPC_SECRET must be declared at global scope so 'both' mode can pass it to install_node
RPC_SECRET=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}[$1]${NC} ${BOLD}$2${NC}"; }

generate_secret() { openssl rand -hex 32; }

# ──── Root check ────

[[ $EUID -ne 0 ]] && fail "Run as root: sudo bash <(curl -Ls URL)"

# ──── OS check ────

# FIX #2: Verify supported OS before proceeding
if ! command -v apt-get &>/dev/null; then
    fail "This installer requires a Debian/Ubuntu-based system (apt-get not found)"
fi

# ──── Banner ────

echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║           ProxPanel v3 Installer               ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════╝${NC}\n"

# ──── Mode selection ────

echo -e "  ${BOLD}Select installation mode:${NC}\n"
echo -e "    ${CYAN}1${NC}) Panel only  — web dashboard + database (Docker)"
echo -e "    ${CYAN}2${NC}) Node only   — proxy worker on this server (systemd)"
echo -e "    ${CYAN}3${NC}) Panel + Node — all-in-one server\n"

# FIX #3: Loop until valid input instead of single read
while true; do
    read -rp "  Enter choice [1-3]: " MODE
    case "$MODE" in
        1) INSTALL_MODE="panel"; break ;;
        2) INSTALL_MODE="node";  break ;;
        3) INSTALL_MODE="both";  break ;;
        *) echo -e "  ${RED}Invalid choice. Please enter 1, 2, or 3.${NC}" ;;
    esac
done

# ══════════════════════════════════════════════════════════════
# PANEL INSTALL
# ══════════════════════════════════════════════════════════════

install_panel() {
    # ──── Dependencies ────

    # FIX #4: Install required packages before Docker, not skipping apt update
    apt-get update -qq
    apt-get install -y -qq curl wget jq unzip openssl ca-certificates gnupg lsb-release >/dev/null

    if ! command -v docker &>/dev/null; then
        echo -e "${CYAN}Installing Docker...${NC}"
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker &>/dev/null && systemctl start docker
        log "Docker installed"
    else
        log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    fi

    # FIX #5: Check docker compose v2 plugin properly
    if ! docker compose version &>/dev/null; then
        fail "docker compose plugin missing. Install it: apt-get install docker-compose-plugin"
    fi
    log "Docker Compose $(docker compose version --short)"

    # ──── Collect info ────

    echo -e "\n  ${BOLD}Panel configuration:${NC}\n"
    read -rp "  Panel domain (e.g. panel.yourdomain.com): " PANEL_DOMAIN
    read -rp "  Admin email (for SSL certificate):        " ADMIN_EMAIL
    read -rp "  Admin username [admin]:                   " ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"

    # FIX #6: Hide password input
    read -rsp "  Admin password:                           " ADMIN_PASS
    echo ""

    [[ -z "$PANEL_DOMAIN" ]] && fail "Domain required"
    [[ -z "$ADMIN_EMAIL"  ]] && fail "Email required"
    [[ -z "$ADMIN_PASS"   ]] && fail "Password required"
    [[ ${#ADMIN_PASS} -lt 8 ]] && fail "Password must be at least 8 characters"

    # Validate email format using pure bash (locale-safe, works with any charset)
    local EMAIL_LOCAL="${ADMIN_EMAIL%%@*}"
    local EMAIL_DOMAIN="${ADMIN_EMAIL#*@}"
    if [[ "$ADMIN_EMAIL" != *"@"* ]] || \
       [[ -z "$EMAIL_LOCAL" ]] || \
       [[ -z "$EMAIL_DOMAIN" ]] || \
       [[ "$EMAIL_DOMAIN" != *"."* ]] || \
       [[ "${EMAIL_DOMAIN##*.}" == "" ]]; then
        fail "Invalid email format: $ADMIN_EMAIL"
    fi

    # ──── Download source ────

    step "PANEL 1/6" "Downloading source..."
    rm -rf "$CLONE_DIR"
    mkdir -p "$CLONE_DIR"
    if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | \
         tar xz -C "$CLONE_DIR" --strip-components=1; then
        fail "Download failed. Check your internet connection."
    fi
    log "Source downloaded"

    # ──── Setup ────

    step "PANEL 2/6" "Setting up configuration..."
    mkdir -p "$PANEL_DIR"
    cp -r "$CLONE_DIR"/. "$PANEL_DIR/"
    rm -rf "$CLONE_DIR"

    local DB_PASS; DB_PASS=$(openssl rand -hex 16)
    local JWT_SECRET; JWT_SECRET=$(generate_secret)
    # FIX #8: Set RPC_SECRET at global scope so 'both' mode can use it
    RPC_SECRET=$(generate_secret)
    local ENC_KEY; ENC_KEY=$(openssl rand -hex 16)

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

    # FIX #9: Generate proper Caddyfile (no variable substitution issues at runtime)
    cat > "$PANEL_DIR/Caddyfile" <<EOF
${PANEL_DOMAIN} {
    handle /api/* {
        reverse_proxy server:3000
    }
    handle /health {
        reverse_proxy server:3000
    }
    handle /sub/* {
        reverse_proxy server:3000
    }
    handle {
        reverse_proxy client:80
    }
}
EOF

    log "Configuration ready"

    # ──── Build ────

    step "PANEL 3/6" "Building containers (this may take a few minutes)..."
    cd "$PANEL_DIR"
    if ! docker compose build --parallel 2>&1; then
        fail "Docker build failed. Check the output above for details."
    fi
    log "Containers built"

    # ──── Start ────

    step "PANEL 4/6" "Starting all services..."
    docker compose up -d
    log "Services started"

    # ──── Wait for server ────

    step "PANEL 5/6" "Waiting for server to become healthy..."
    local MAX_WAIT=120
    local WAITED=0
    while [[ $WAITED -lt $MAX_WAIT ]]; do
        # FIX #10: Use curl (available in container) instead of wget for health check
        if docker compose exec -T server curl -sf http://localhost:3000/api/health &>/dev/null; then
            break
        fi
        sleep 3
        WAITED=$((WAITED + 3))
        echo -ne "\r  Waiting... ${WAITED}s / ${MAX_WAIT}s"
    done
    echo ""

    if ! docker compose exec -T server curl -sf http://localhost:3000/api/health &>/dev/null; then
        echo -e "\n${YELLOW}  ! Server health check failed. Showing logs:${NC}"
        docker compose logs --tail=30 server
        fail "Server failed to start within ${MAX_WAIT}s"
    fi
    log "Server is healthy"

    # ──── Seed ────

    step "PANEL 6/6" "Creating admin user..."
    # FIX #11: seed.ts uses --username/--password/--email args — verify they are parsed correctly
    docker compose exec -T server npx tsx prisma/seed.ts \
        --username "$ADMIN_USER" \
        --password "$ADMIN_PASS" \
        --email "$ADMIN_EMAIL" 2>&1 | tail -5
    log "Admin user created"

    # ──── Firewall ────

    if command -v ufw &>/dev/null; then
        ufw allow 80/tcp   >/dev/null 2>&1
        ufw allow 443/tcp  >/dev/null 2>&1
        ufw allow 443/udp  >/dev/null 2>&1
        ufw allow 22/tcp   >/dev/null 2>&1
        echo "y" | ufw enable >/dev/null 2>&1
        log "Firewall configured"
    fi

    echo -e "\n  ${GREEN}${BOLD}╔═══════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}${BOLD}║       Panel installed successfully!   ║${NC}"
    echo -e "  ${GREEN}${BOLD}╚═══════════════════════════════════════╝${NC}"
    echo -e ""
    echo -e "  URL:         ${BOLD}https://${PANEL_DOMAIN}${NC}"
    echo -e "  Login:       ${BOLD}${ADMIN_USER}${NC}"
    echo -e "  Password:    ${BOLD}${ADMIN_PASS}${NC}"
    echo -e "  Node secret: ${BOLD}${RPC_SECRET}${NC}"
    echo -e ""
    echo -e "  ${YELLOW}Save the node secret — you will need it when adding nodes!${NC}\n"
}

# ══════════════════════════════════════════════════════════════
# NODE INSTALL
# ══════════════════════════════════════════════════════════════

install_node() {
    local MASTER_URL="$1"
    local NODE_SECRET="$2"

    # ──── Dependencies ────

    apt-get update -qq
    apt-get install -y -qq curl wget jq unzip openssl build-essential >/dev/null
    log "System packages ready"

    # FIX #12: Install Node.js 20 LTS properly with nodesource
    if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 18 ]]; then
        echo -e "${CYAN}Installing Node.js 20 LTS...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y -qq nodejs >/dev/null
        log "Node.js $(node -v)"
    else
        log "Node.js $(node -v) already installed"
    fi

    # ──── Download source ────

    step "NODE 1/5" "Downloading source..."
    rm -rf "$CLONE_DIR"
    mkdir -p "$CLONE_DIR"
    if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | \
         tar xz -C "$CLONE_DIR" --strip-components=1; then
        fail "Download failed. Check your internet connection."
    fi
    mkdir -p "$NODE_DIR"
    # FIX #13: Copy only server directory, not entire repo
    cp -r "$CLONE_DIR/server" "$NODE_DIR/"
    rm -rf "$CLONE_DIR"
    log "Source ready"

    # ──── Install dependencies ────

    step "NODE 2/5" "Installing Node.js dependencies..."
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
NODE_ENV=production
EOF

    log "Node .env created"

    # ──── Download proxy binaries ────

    step "NODE 3/5" "Downloading proxy binaries..."
    mkdir -p /usr/local/bin /etc/proxpanel

    local ARCH; ARCH=$(uname -m)
    local ARCH_X64="64"
    local ARCH_ARM="arm64-v8a"
    if [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        ARCH_X64="arm64-v8a"
        ARCH_ARM="arm64-v8a"
    fi

    # ── Xray ──
    if [[ ! -f /usr/local/bin/xray ]]; then
        local XRAY_VER; XRAY_VER=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest | jq -r '.tag_name')
        if [[ -n "$XRAY_VER" && "$XRAY_VER" != "null" ]]; then
            local XRAY_URL="https://github.com/XTLS/Xray-core/releases/download/${XRAY_VER}/Xray-linux-${ARCH_X64}.zip"
            if wget -qO /tmp/xray.zip "$XRAY_URL"; then
                unzip -qo /tmp/xray.zip xray -d /usr/local/bin/ && chmod +x /usr/local/bin/xray
                rm -f /tmp/xray.zip
                log "Xray ${XRAY_VER} installed"
            else
                warn "Failed to download Xray — skipping"
            fi
        else
            warn "Could not fetch latest Xray version"
        fi
    else
        log "Xray already installed: $(/usr/local/bin/xray version 2>&1 | head -1)"
    fi

    # ── sing-box ──
    if [[ ! -f /usr/local/bin/sing-box ]]; then
        local SING_VER; SING_VER=$(curl -s https://api.github.com/repos/SagerNet/sing-box/releases/latest | jq -r '.tag_name')
        if [[ -n "$SING_VER" && "$SING_VER" != "null" ]]; then
            local SING_TAG="${SING_VER#v}"
            local SING_ARCH="amd64"
            [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]] && SING_ARCH="arm64"
            local SING_URL="https://github.com/SagerNet/sing-box/releases/download/${SING_VER}/sing-box-${SING_TAG}-linux-${SING_ARCH}.tar.gz"
            if wget -qO /tmp/sing.tar.gz "$SING_URL"; then
                # FIX #14: Extract the correct binary name from the archive
                tar -xzf /tmp/sing.tar.gz -C /tmp/
                local SING_BIN; SING_BIN=$(find /tmp -maxdepth 2 -name 'sing-box' -type f 2>/dev/null | head -1)
                if [[ -n "$SING_BIN" ]]; then
                    mv "$SING_BIN" /usr/local/bin/sing-box && chmod +x /usr/local/bin/sing-box
                    log "sing-box ${SING_VER} installed"
                else
                    warn "sing-box binary not found in archive"
                fi
                rm -f /tmp/sing.tar.gz
            else
                warn "Failed to download sing-box — skipping"
            fi
        else
            warn "Could not fetch latest sing-box version"
        fi
    else
        log "sing-box already installed"
    fi

    # ── Mieru (optional) ──
    if [[ ! -f /usr/local/bin/mieru ]]; then
        local MIERU_ARCH="amd64"
        [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]] && MIERU_ARCH="arm64"
        local MIERU_VER; MIERU_VER=$(curl -s https://api.github.com/repos/enfein/mieru/releases/latest | jq -r '.tag_name')
        if [[ -n "$MIERU_VER" && "$MIERU_VER" != "null" ]]; then
            local MIERU_TAG="${MIERU_VER#v}"
            local MIERU_URL="https://github.com/enfein/mieru/releases/download/${MIERU_VER}/mita-${MIERU_TAG}-linux-${MIERU_ARCH}.tar.gz"
            if wget -qO /tmp/mieru.tar.gz "$MIERU_URL" 2>/dev/null; then
                tar -xzf /tmp/mieru.tar.gz -C /usr/local/bin/ --wildcards '*/mita' --strip-components=1 2>/dev/null || \
                tar -xzf /tmp/mieru.tar.gz -C /usr/local/bin/ 2>/dev/null || true
                [[ -f /usr/local/bin/mita ]] && mv /usr/local/bin/mita /usr/local/bin/mieru
                [[ -f /usr/local/bin/mieru ]] && chmod +x /usr/local/bin/mieru && log "Mieru ${MIERU_VER} installed"
                rm -f /tmp/mieru.tar.gz
            else
                warn "Mieru not available for this architecture — skipping"
            fi
        fi
    else
        log "Mieru already installed"
    fi

    # ──── Build TypeScript ────

    step "NODE 4/5" "Building worker..."
    cd "$NODE_DIR/server"
    if ! npm run build 2>&1 | tail -5; then
        fail "TypeScript build failed. Check the output above."
    fi
    log "Worker built"

    # ──── Systemd service ────

    step "NODE 5/5" "Creating systemd service..."

    local NODE_BIN; NODE_BIN=$(which node)

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

# Security hardening
PrivateTmp=true
NoNewPrivileges=false

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxpanel-node

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${NODE_SERVICE}
    systemctl start  ${NODE_SERVICE}

    # FIX: Verify service actually started
    sleep 3
    if systemctl is-active --quiet ${NODE_SERVICE}; then
        log "Node worker service started and running"
    else
        echo -e "\n${YELLOW}  ! Service failed to start. Showing journal:${NC}"
        journalctl -u ${NODE_SERVICE} --no-pager -n 20
        fail "Node worker failed to start. Check the logs above."
    fi

    # ──── Firewall ────

    if command -v ufw &>/dev/null; then
        ufw allow 2087/tcp >/dev/null 2>&1  # Worker API port
        ufw allow 443/tcp  >/dev/null 2>&1
        ufw allow 443/udp  >/dev/null 2>&1
        ufw allow 22/tcp   >/dev/null 2>&1
        echo "y" | ufw enable >/dev/null 2>&1
        log "Firewall configured"
    fi

    echo -e "\n  ${GREEN}${BOLD}╔═══════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}${BOLD}║       Node installed successfully!    ║${NC}"
    echo -e "  ${GREEN}${BOLD}╚═══════════════════════════════════════╝${NC}"
    echo -e ""
    echo -e "  Service: ${BOLD}${NODE_SERVICE}${NC}"
    echo -e "  Master:  ${BOLD}${MASTER_URL}${NC}"
    echo -e "  Port:    ${BOLD}2087${NC}"
    echo -e "  Config:  ${BOLD}${NODE_DIR}/server/.env${NC}"
    echo -e ""
    echo -e "  Manage:  ${CYAN}systemctl status ${NODE_SERVICE}${NC}"
    echo -e "  Logs:    ${CYAN}journalctl -u ${NODE_SERVICE} -f${NC}\n"
}

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

case "$INSTALL_MODE" in
    panel)
        install_panel
        ;;
    node)
        echo -e "\n  ${BOLD}Node configuration:${NC}\n"
        read -rp "  Panel URL (e.g. https://panel.yourdomain.com): " MASTER_URL
        read -rp "  Node secret (from panel Settings page):        " NODE_SECRET
        [[ -z "$MASTER_URL"   ]] && fail "Panel URL is required"
        [[ -z "$NODE_SECRET"  ]] && fail "Node secret is required"
        # FIX: Normalize URL — strip trailing slash
        MASTER_URL="${MASTER_URL%/}"
        install_node "$MASTER_URL" "$NODE_SECRET"
        ;;
    both)
        install_panel
        echo ""
        step "COMBINED" "Installing node worker on same server..."
        # FIX #8 (cont): RPC_SECRET is now a global var set by install_panel
        [[ -z "$RPC_SECRET" ]] && fail "Internal error: RPC_SECRET not set after panel install"
        install_node "http://127.0.0.1:3000" "$RPC_SECRET"
        ;;
esac

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Installation complete!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}\n"
