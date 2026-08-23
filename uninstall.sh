#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 — Complete System Uninstaller & Purge Script
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls "https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/uninstall.sh?v=$(date +%s)")
#
# Non-interactive / Force uninstall:
#   bash <(curl -Ls "https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/uninstall.sh?v=$(date +%s)") -y
# ══════════════════════════════════════════════════════════════

set -uo pipefail

# Ensure stdin is attached to terminal
if [[ -c /dev/tty ]]; then
    exec < /dev/tty
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
fail() { echo -e "${RED}  ✗ $1${NC}"; exit 1; }

[[ $EUID -ne 0 ]] && fail "Please run as root: sudo bash uninstall.sh"

FORCE_YES=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -y|--yes|--force|-f) FORCE_YES=true; shift ;;
        *) shift ;;
    esac
done

echo -e "\n${RED}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}${BOLD}║           ProxPanel v3 System Cleanup & Purge              ║${NC}"
echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "  ${YELLOW}This script will permanently purge all components:${NC}"
echo -e "    • Docker containers, images and volumes (proxpanel-*)"
echo -e "    • Master Panel files (/opt/proxpanel)"
echo -e "    • Node Worker files (/opt/proxpanel-node)"
echo -e "    • Configuration directory (/etc/proxpanel)"
echo -e "    • Systemd services (proxpanel-master, proxpanel-node)"
echo -e "    • Proxy binaries (xray, sing-box, mieru)"
echo -e "    • Global CLI helpers (/usr/local/bin/vpnpanel, proxpanel, proxpanel-check)"
echo -e "    • Kernel sysctl and limits configs (/etc/sysctl.d/99-proxpanel.conf)\n"

if [[ "$FORCE_YES" != "true" ]]; then
    if [[ -c /dev/tty ]]; then
        read -rp "  Are you sure you want to remove everything? Type 'yes' to confirm: " CONFIRM < /dev/tty || CONFIRM="no"
    else
        read -rp "  Are you sure you want to remove everything? Type 'yes' to confirm: " CONFIRM || CONFIRM="no"
    fi

    if [[ "$CONFIRM" != "yes" && "$CONFIRM" != "y" ]]; then
        echo -e "\n  ${CYAN}Uninstallation aborted by user.${NC}\n"
        exit 0
    fi
fi

echo ""

# ──── 1. Stop and remove Docker containers, volumes, networks ────
echo -e "${CYAN}[1/7]${NC} Stopping and removing Docker containers & volumes..."
if [[ -f /opt/proxpanel/docker-compose.yml ]]; then
    cd /opt/proxpanel && docker compose down -v --remove-orphans 2>/dev/null || true
    log "Docker compose services and volumes removed"
fi

# Fallback: force remove any lingering proxpanel containers
docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E '^proxpanel-' | xargs -r docker rm -f 2>/dev/null || true
docker volume ls -q 2>/dev/null | grep -E '^proxpanel_' | xargs -r docker volume rm -f 2>/dev/null || true
docker network ls --format '{{.Name}}' 2>/dev/null | grep -E '^proxpanel' | xargs -r docker network rm 2>/dev/null || true
log "Docker containers & volumes purged"

# ──── 2. Stop and remove Systemd services ────
echo -e "${CYAN}[2/7]${NC} Removing Systemd services..."
for svc in proxpanel-node proxpanel-master; do
    if systemctl is-active --quiet "$svc" 2>/dev/null || systemctl list-unit-files "${svc}.service" &>/dev/null; then
        systemctl stop "$svc" 2>/dev/null || true
        systemctl disable "$svc" 2>/dev/null || true
        rm -f "/etc/systemd/system/${svc}.service"
        log "Service [${svc}] disabled and removed"
    fi
done
systemctl daemon-reload 2>/dev/null || true

# ──── 3. Remove application directories ────
echo -e "${CYAN}[3/7]${NC} Removing application directories..."
rm -rf /opt/proxpanel
rm -rf /opt/proxpanel-node
rm -rf /etc/proxpanel
rm -rf /tmp/proxpanel-*
log "Directories /opt/proxpanel, /opt/proxpanel-node, /etc/proxpanel deleted"

# ──── 4. Remove Docker images ────
echo -e "${CYAN}[4/7]${NC} Purging Docker images..."
docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | \
    grep -E 'proxpanel' | xargs -r docker rmi -f 2>/dev/null || true
log "Docker images removed"

# ──── 5. Remove proxy core binaries and CLI helpers ────
echo -e "${CYAN}[5/7]${NC} Removing core binaries and CLI helpers..."
rm -f /usr/local/bin/xray
rm -f /usr/local/bin/sing-box
rm -f /usr/local/bin/mieru
rm -f /usr/local/bin/vpnpanel
rm -f /usr/local/bin/proxpanel
rm -f /usr/local/bin/proxpanel-check
log "Binaries (xray, sing-box, mieru, vpnpanel) removed from /usr/local/bin"

# ──── 6. Remove System Tuning & Limits configs ────
echo -e "${CYAN}[6/7]${NC} Cleaning system configuration files..."
rm -f /etc/sysctl.d/99-proxpanel.conf
rm -f /etc/security/limits.d/99-proxpanel.conf
rm -f /etc/modules-load.d/bbr.conf
sysctl --system >/dev/null 2>&1 || true
log "Kernel sysctl and security limits configurations restored"

# ──── 7. Clean Firewall rules ────
echo -e "${CYAN}[7/7]${NC} Cleaning UFW firewall rules..."
if command -v ufw &>/dev/null; then
    ufw delete allow 80/tcp   2>/dev/null || true
    ufw delete allow 443/tcp  2>/dev/null || true
    ufw delete allow 443/udp  2>/dev/null || true
    ufw delete allow 2087/tcp 2>/dev/null || true
    log "Firewall ports (80, 443, 2087) cleaned"
fi

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ProxPanel v3 has been completely removed from this VPS!   ${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}\n"
