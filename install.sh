#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# KEEPER Installer v3.0
# Enterprise-grade proxy management panel
#
# One-liner install:
#   bash <(curl -sSL https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh) -d panel.example.com -e admin@example.com
#
# Interactive:
#   bash install.sh
# ══════════════════════════════════════════════════════════════

VERSION="3.0.0"
INSTALL_DIR="/opt/keeper"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ──── Colors ────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'
DIM='\033[2m'; NC='\033[0m'

log()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
error() { echo -e "${RED}  ✗${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}  i${NC} $1"; }
header(){ echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════╗${NC}"; \
          echo -e "${CYAN}${BOLD}║${NC} ${BOLD}$1${NC}"; \
          echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════╝${NC}"; }

generate_secret() { openssl rand -hex 32; }

usage() {
    echo "Usage: $0 [-d DOMAIN] [-e EMAIL]"
    echo "  -d  Panel domain (e.g. panel.example.com)"
    echo "  -e  Admin email for SSL (e.g. admin@example.com)"
    echo ""
    echo "Examples:"
    echo "  bash install.sh -d panel.example.com -e admin@example.com"
    echo "  bash <(curl -sSL URL) -d panel.example.com -e admin@example.com"
    exit 0
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Run as root: sudo bash $0"
    fi
}

check_docker() {
    if ! command -v docker &>/dev/null; then
        info "Installing Docker..."
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker && systemctl start docker
    fi
    if ! docker compose version &>/dev/null; then
        error "Docker Compose plugin missing. Install: apt install docker-compose-plugin"
    fi
}

setup_firewall() {
    info "Configuring UFW..."
    if command -v ufw &>/dev/null; then
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 443/udp
        ufw allow 22/tcp
        echo "y" | ufw enable
        log "UFW configured"
    fi
}

main() {
    local PANEL_DOMAIN=""
    local ADMIN_EMAIL=""

    # Parse args
    while getopts "d:e:h" opt; do
        case $opt in
            d) PANEL_DOMAIN="$OPTARG" ;;
            e) ADMIN_EMAIL="$OPTARG" ;;
            h) usage ;;
            *) usage ;;
        esac
    done

    header "Keeper v${VERSION} Installation"
    check_root
    check_docker

    # Interactive fallback
    if [[ -z "$PANEL_DOMAIN" ]]; then
        read -rp "  Enter Panel Domain (e.g. keeper.example.com): " PANEL_DOMAIN
    fi
    if [[ -z "$ADMIN_EMAIL" ]]; then
        read -rp "  Enter Admin Email (for SSL): " ADMIN_EMAIL
    fi

    [[ -z "$PANEL_DOMAIN" ]] && error "Domain is required (-d)"
    [[ -z "$ADMIN_EMAIL" ]] && error "Email is required (-e)"

    mkdir -p "$INSTALL_DIR"
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"

    DB_PASS=$(generate_secret | head -c 16)
    JWT_SECRET=$(generate_secret)
    RPC_SECRET=$(generate_secret)
    ENC_KEY=$(generate_secret | head -c 32)

    cat > "${INSTALL_DIR}/.env" <<EOF
PANEL_DOMAIN=${PANEL_DOMAIN}
LETSENCRYPT_EMAIL=${ADMIN_EMAIL}
POSTGRES_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
NODE_RPC_SECRET=${RPC_SECRET}
ENCRYPTION_KEY=${ENC_KEY}
API_URL=https://${PANEL_DOMAIN}
FRONTEND_URL=https://${PANEL_DOMAIN}
EOF

    cd "$INSTALL_DIR"
    docker compose up -d

    setup_firewall

    header "Installation Complete!"
    info "URL: https://${PANEL_DOMAIN}"
    info "Node Secret: ${RPC_SECRET}"
    warn "All secrets saved in ${INSTALL_DIR}/.env"
}

main "$@"
