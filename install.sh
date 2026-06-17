#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# KEEPER Installer v3.0
# Enterprise-grade proxy management panel
#
# One-liner install:
#   bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh) -d panel.example.com -e admin@example.com
#
# Interactive:
#   bash install.sh
# ══════════════════════════════════════════════════════════════

VERSION="3.0.0"
REPO="Velio322/proxy-panel-v3"
BRANCH="main"
INSTALL_DIR="/opt/keeper"
CLONE_DIR="/tmp/proxpanel-install"

# ──── Colors ────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
error() { echo -e "${RED}  ✗${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}  i${NC} $1"; }
header(){ echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════╗${NC}"; \
          echo -e "${CYAN}${BOLD}║${NC} ${BOLD}$1${NC}"; \
          echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════╝${NC}"; }

generate_secret() { openssl rand -hex 32; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "Run as root: sudo bash $0"
    fi
    log "Running as root"
}

check_docker() {
    if ! command -v docker &>/dev/null; then
        info "Installing Docker..."
        if ! curl -fsSL https://get.docker.com | sh; then
            error "Failed to install Docker. Install manually: https://docs.docker.com/engine/install/"
        fi
        systemctl enable docker && systemctl start docker
        log "Docker installed"
    else
        log "Docker found: $(docker --version)"
    fi
    if ! docker compose version &>/dev/null; then
        error "Docker Compose plugin missing. Install: apt install docker-compose-plugin"
    fi
    log "Docker Compose found"
}

check_git() {
    if ! command -v git &>/dev/null; then
        info "Installing git..."
        apt-get update -qq || warn "apt-get update failed, trying anyway..."
        apt-get install -y -qq git || error "Failed to install git"
        log "Git installed"
    else
        log "Git found: $(git --version)"
    fi
}

fetch_source() {
    info "Fetching source code from GitHub..."
    rm -rf "$CLONE_DIR"
    if ! git clone --depth 1 -b "$BRANCH" "https://github.com/${REPO}.git" "$CLONE_DIR"; then
        error "Failed to clone repository. Check network connection."
    fi
    log "Source downloaded"
}

setup_firewall() {
    if command -v ufw &>/dev/null; then
        info "Configuring UFW firewall..."
        ufw allow 80/tcp >/dev/null 2>&1
        ufw allow 443/tcp >/dev/null 2>&1
        ufw allow 443/udp >/dev/null 2>&1
        ufw allow 22/tcp >/dev/null 2>&1
        echo "y" | ufw enable >/dev/null 2>&1
        log "UFW configured"
    fi
}

main() {
    local PANEL_DOMAIN=""
    local ADMIN_EMAIL=""

    while getopts "d:e:h" opt; do
        case $opt in
            d) PANEL_DOMAIN="$OPTARG" ;;
            e) ADMIN_EMAIL="$OPTARG" ;;
            h) echo "Usage: $0 [-d DOMAIN] [-e EMAIL]"; exit 0 ;;
            *) echo "Usage: $0 [-d DOMAIN] [-e EMAIL]"; exit 1 ;;
        esac
    done

    header "Keeper v${VERSION} Installation"

    check_root
    check_git
    check_docker

    if [[ -z "$PANEL_DOMAIN" ]]; then
        read -rp "  Enter Panel Domain (e.g. keeper.example.com): " PANEL_DOMAIN
    fi
    if [[ -z "$ADMIN_EMAIL" ]]; then
        read -rp "  Enter Admin Email (for SSL): " ADMIN_EMAIL
    fi

    [[ -z "$PANEL_DOMAIN" ]] && error "Domain is required (-d)"
    [[ -z "$ADMIN_EMAIL" ]] && error "Email is required (-e)"

    fetch_source

    mkdir -p "$INSTALL_DIR"
    cp -r "$CLONE_DIR"/* "$INSTALL_DIR/"

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

    info "Starting Docker containers..."
    cd "$INSTALL_DIR"
    docker compose up -d

    rm -rf "$CLONE_DIR"

    setup_firewall

    header "Installation Complete!"
    info "URL: https://${PANEL_DOMAIN}"
    info "Node Secret: ${RPC_SECRET}"
    warn "All secrets saved in ${INSTALL_DIR}/.env"
}

main "$@"
