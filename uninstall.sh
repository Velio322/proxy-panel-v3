#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 Uninstaller
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/uninstall.sh)
# ══════════════════════════════════════════════════════════════

set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }

[[ $EUID -ne 0 ]] && { echo -e "${RED}  Run as root: sudo bash uninstall.sh${NC}"; exit 1; }

echo -e "\n${RED}${BOLD}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║        ProxPanel v3 Uninstaller                ║${NC}"
echo -e "${RED}${BOLD}╚════════════════════════════════════════════════╝${NC}\n"

echo -e "  ${YELLOW}This will remove:${NC}"
echo -e "    - Docker containers and volumes (proxpanel-*)"
echo -e "    - Docker images (proxpanel-server, proxpanel-client)"
echo -e "    - Panel files (/opt/proxpanel)"
echo -e "    - Node files (/opt/proxpanel-node)"
echo -e "    - Systemd service (proxpanel-node)"
echo -e "    - Config files (/etc/proxpanel)"
echo -e "    - Firewall rules (80, 443, 2087)\n"

read -rp "  Are you sure? Type 'yes' to confirm: " CONFIRM
[[ "$CONFIRM" != "yes" ]] && { echo "  Aborted."; exit 0; }

echo ""

# ──── 1. Stop and remove Docker containers + volumes ────

echo -e "${CYAN}[1/6]${NC} Stopping Docker services..."
if [[ -f /opt/proxpanel/docker-compose.yml ]]; then
    cd /opt/proxpanel && docker compose down -v --remove-orphans 2>/dev/null || true
    log "Docker services and volumes stopped"
else
    warn "No docker-compose.yml found at /opt/proxpanel — skipping"
fi

# ──── 2. Stop and remove systemd node service ────

echo -e "${CYAN}[2/6]${NC} Removing node service..."
if systemctl list-unit-files proxpanel-node.service &>/dev/null 2>&1; then
    systemctl stop    proxpanel-node 2>/dev/null || true
    systemctl disable proxpanel-node 2>/dev/null || true
    rm -f /etc/systemd/system/proxpanel-node.service
    systemctl daemon-reload
    log "Node service removed"
else
    warn "No proxpanel-node service found — skipping"
fi

# ──── 3. Remove application files ────

echo -e "${CYAN}[3/6]${NC} Removing application files..."
rm -rf /opt/proxpanel
rm -rf /opt/proxpanel-node
rm -rf /etc/proxpanel
log "Files removed"

# ──── 4. Remove Docker images ────

echo -e "${CYAN}[4/6]${NC} Cleaning Docker images..."
docker rmi proxpanel-server proxpanel-client 2>/dev/null || true
# Also remove images built from compose (tagged differently)
docker images --format '{{.Repository}}:{{.Tag}}' | \
    grep -E '^proxpanel' | xargs docker rmi 2>/dev/null || true
log "Docker images cleaned"

# ──── 5. Remove proxy binaries (optional) ────

echo -e "${CYAN}[5/6]${NC} Proxy binaries..."
read -rp "  Remove proxy binaries (xray, sing-box, mieru)? (y/N): " REMOVE_BINS
if [[ "$REMOVE_BINS" == "y" || "$REMOVE_BINS" == "Y" ]]; then
    rm -f /usr/local/bin/xray
    rm -f /usr/local/bin/sing-box
    rm -f /usr/local/bin/naive
    rm -f /usr/local/bin/mieru
    log "Proxy binaries removed"
else
    warn "Proxy binaries kept"
fi

# ──── 6. Remove firewall rules ────

echo -e "${CYAN}[6/6]${NC} Cleaning firewall..."
if command -v ufw &>/dev/null; then
    ufw delete allow 80/tcp   2>/dev/null || true
    ufw delete allow 443/tcp  2>/dev/null || true
    ufw delete allow 443/udp  2>/dev/null || true
    ufw delete allow 2087/tcp 2>/dev/null || true
    log "Firewall rules removed"
else
    warn "UFW not found — skipping firewall cleanup"
fi

# ──── Done ────

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ProxPanel v3 fully removed!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}\n"
