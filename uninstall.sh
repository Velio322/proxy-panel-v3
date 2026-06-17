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

log()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }

[[ $EUID -ne 0 ]] && { echo -e "${RED}  Run as root: sudo bash uninstall.sh${NC}"; exit 1; }

echo -e "\n${RED}${BOLD}╔════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║        ProxPanel v3 Uninstaller                ║${NC}"
echo -e "${RED}${BOLD}╚════════════════════════════════════════════════╝${NC}\n"

echo -e "  ${YELLOW}This will remove:${NC}"
echo -e "    - Docker containers (proxpanel-*)"
echo -e "    - Docker volumes and images"
echo -e "    - Panel files (/opt/proxpanel)"
echo -e "    - Node files (/opt/proxpanel-node)"
echo -e "    - Systemd service (proxpanel-node)"
echo -e "    - Firewall rules\n"

read -rp "  Are you sure? (y/N): " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { echo "  Aborted."; exit 0; }

echo ""

# ──── Stop and remove containers ────

if [[ -f /opt/proxpanel/docker-compose.yml ]]; then
    echo -e "${CYAN}[1/5]${NC} Stopping Docker services..."
    cd /opt/proxpanel && docker compose down -v --remove-orphans 2>/dev/null
    log "Docker services stopped"
else
    warn "No docker-compose.yml found, skipping container cleanup"
fi

# ──── Remove node service ────

if systemctl is-active --quiet proxpanel-node 2>/dev/null; then
    echo -e "${CYAN}[2/5]${NC} Stopping node service..."
    systemctl stop proxpanel-node
    systemctl disable proxpanel-node
    rm -f /etc/systemd/system/proxpanel-node.service
    systemctl daemon-reload
    log "Node service removed"
else
    echo -e "${CYAN}[2/5]${NC} No node service found, skipping"
fi

# ──── Remove files ────

echo -e "${CYAN}[3/5]${NC} Removing files..."
rm -rf /opt/proxpanel
rm -rf /opt/proxpanel-node
log "Files removed"

# ──── Remove Docker resources ────

echo -e "${CYAN}[4/5]${NC} Cleaning Docker images..."
docker rmi proxpanel-server proxpanel-client 2>/dev/null || true
log "Docker images cleaned"

# ──── Remove firewall rules ────

echo -e "${CYAN}[5/5]${NC} Cleaning firewall..."
if command -v ufw &>/dev/null; then
    ufw delete allow 80/tcp 2>/dev/null || true
    ufw delete allow 443/tcp 2>/dev/null || true
    ufw delete allow 443/udp 2>/dev/null || true
    log "Firewall rules removed"
else
    warn "No UFW found"
fi

# ──── Done ────

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ProxPanel removed!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}\n"
