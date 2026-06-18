#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 Updater
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/update.sh)
# ══════════════════════════════════════════════════════════════

set -euo pipefail

REPO="Velio322/proxy-panel-v3"
BRANCH="main"
PANEL_DIR="/opt/proxpanel"
NODE_DIR="/opt/proxpanel-node"
CLONE_DIR="/tmp/proxpanel-update-src"
NODE_SERVICE="proxpanel-node"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}[$1]${NC} ${BOLD}$2${NC}"; }

# ──── Root check ────
[[ $EUID -ne 0 ]] && fail "Run as root: sudo bash <(curl -Ls URL)"

echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║            ProxPanel v3 Updater                ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════╝${NC}\n"

# ──── Detect installation ────
HAS_PANEL=false
HAS_NODE=false

[[ -d "$PANEL_DIR" ]] && HAS_PANEL=true
[[ -d "$NODE_DIR" ]] && HAS_NODE=true

if [[ "$HAS_PANEL" == "false" && "$HAS_NODE" == "false" ]]; then
    fail "No ProxPanel installations detected in $PANEL_DIR or $NODE_DIR"
fi

if [[ "$HAS_PANEL" == "true" ]]; then
    log "Detected Panel installation in $PANEL_DIR"
fi
if [[ "$HAS_NODE" == "true" ]]; then
    log "Detected Node installation in $NODE_DIR"
fi

# ──── Download source ────
step "UPDATE 1/3" "Downloading latest source code..."
rm -rf "$CLONE_DIR"
mkdir -p "$CLONE_DIR"
if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | \
     tar xz -C "$CLONE_DIR" --strip-components=1; then
    fail "Download failed. Check your internet connection."
fi
log "Latest source downloaded to temporary directory"

# ──── Update Panel ────
if [[ "$HAS_PANEL" == "true" ]]; then
    step "UPDATE 2/3" "Updating Web Dashboard (Panel)..."
    
    # Backup existing config files
    log "Backing up configurations..."
    cp "$PANEL_DIR/.env" "/tmp/proxpanel_env_bak" 2>/dev/null || true
    cp "$PANEL_DIR/Caddyfile" "/tmp/proxpanel_caddy_bak" 2>/dev/null || true

    # Stop services
    log "Stopping containers..."
    cd "$PANEL_DIR"
    docker compose down || true

    # Overwrite source files
    log "Overwriting source files..."
    cp -r "$CLONE_DIR"/. "$PANEL_DIR/"

    # Restore config files
    log "Restoring configurations..."
    cp "/tmp/proxpanel_env_bak" "$PANEL_DIR/.env" 2>/dev/null || true
    cp "/tmp/proxpanel_caddy_bak" "$PANEL_DIR/Caddyfile" 2>/dev/null || true

    # Rebuild and restart
    log "Rebuilding containers (this might take a moment)..."
    docker compose build --parallel
    
    log "Starting services..."
    docker compose up -d
    log "Web Dashboard successfully updated and restarted"
fi

# ──── Update Node ────
if [[ "$HAS_NODE" == "true" ]]; then
    step "UPDATE 3/3" "Updating Node Worker..."

    # Stop service
    log "Stopping node service..."
    systemctl stop "$NODE_SERVICE" || true

    # Backup existing config
    log "Backing up node configuration..."
    cp "$NODE_DIR/server/.env" "/tmp/proxpanel_node_env_bak" 2>/dev/null || true

    # Clear and overwrite server files
    log "Updating node worker source files..."
    rm -rf "$NODE_DIR/server"
    mkdir -p "$NODE_DIR/server"
    cp -r "$CLONE_DIR/server"/. "$NODE_DIR/server/"

    # Restore config
    log "Restoring node configuration..."
    cp "/tmp/proxpanel_node_env_bak" "$NODE_DIR/server/.env" 2>/dev/null || true

    # Install dependencies and build
    log "Installing dependencies and compiling TypeScript (this may take 1-2 minutes)..."
    cd "$NODE_DIR/server"
    npm install --no-workspaces 2>&1 | tail -3
    npx prisma generate 2>&1 | tail -1
    npm run build 2>&1 | tail -5

    # Start service
    log "Starting node service..."
    systemctl start "$NODE_SERVICE"

    # Verify service actually started
    sleep 3
    if systemctl is-active --quiet "$NODE_SERVICE"; then
        log "Node worker updated and successfully running"
    else
        echo -e "\n${YELLOW}  ! Service failed to start. Showing journal:${NC}"
        journalctl -u "$NODE_SERVICE" --no-pager -n 20
        fail "Node worker failed to start after update"
    fi
fi

# Cleanup
rm -rf "$CLONE_DIR"
rm -f "/tmp/proxpanel_env_bak" "/tmp/proxpanel_caddy_bak" "/tmp/proxpanel_node_env_bak"

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Update complete! All services running.${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}\n"
