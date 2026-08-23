#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 — Fast, Resilient & Fail-Safe Installer
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls "https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh?v=$(date +%s)")
#
# Non-interactive usage:
#   Domain mode:
#     sudo bash install.sh -m both -a domain -d panel.example.com -e admin@example.com -u admin -p Pass12345 -y
#   Direct Server IP mode (like 3X-UI):
#     sudo bash install.sh -m both -a ip -u admin -p Pass12345 -y
#   Plain HTTP mode:
#     sudo bash install.sh -m both -a http -u admin -p Pass12345 -y
# ══════════════════════════════════════════════════════════════

set -euo pipefail

# ──── Ensure stdin is connected to terminal when running via curl | bash ────
if [[ -c /dev/tty ]]; then
    exec < /dev/tty
fi

REPO="Velio322/proxy-panel-v3"
BRANCH="main"
PANEL_DIR="/opt/proxpanel"
NODE_DIR="/opt/proxpanel-node"
CONFIG_DIR="/etc/proxpanel"
CLONE_DIR="/tmp/proxpanel-src-$$"
NODE_SERVICE="proxpanel-node"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
fail() { echo -e "\n${RED}  ✗ FATAL: $1${NC}\n"; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}[$1]${NC} ${BOLD}$2${NC}"; }

# ──── Robust Error Trap Handler ────
on_error() {
    local exit_code=$1
    local line_no=$2
    local last_cmd=$3
    if [[ "$exit_code" -ne 0 ]]; then
        echo -e "\n${RED}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}${BOLD}║              INSTALLATION ENCOUNTERED AN ERROR             ║${NC}"
        echo -e "${RED}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
        echo -e "  ${RED}✗ Failed at line ${line_no} with exit code ${exit_code}${NC}"
        echo -e "  ${YELLOW}Command: ${last_cmd}${NC}\n"
        echo -e "  ${BOLD}Troubleshooting steps:${NC}"
        echo -e "    1. Inspect Docker logs:  ${CYAN}docker compose -f /opt/proxpanel/docker-compose.yml logs${NC}"
        echo -e "    2. Inspect Worker logs:  ${CYAN}journalctl -u proxpanel-node -n 50 --no-pager${NC}"
        echo -e "    3. Run diagnostics:      ${CYAN}vpnpanel doctor${NC} or ${CYAN}bash /opt/proxpanel/scripts/check.sh${NC}"
        echo -e "    4. Re-run installer:     ${CYAN}sudo bash install.sh${NC}\n"
        rm -rf "$CLONE_DIR" 2>/dev/null || true
    fi
}
trap 'on_error $? $LINENO "$BASH_COMMAND"' ERR

generate_secret() {
    local sec
    sec=$(openssl rand -hex 32 2>/dev/null || true)
    if [[ -z "$sec" ]]; then
        sec=$(tr -dc 'a-f0-9' < /dev/urandom | head -c 64 || true)
    fi
    echo "$sec"
}

detect_server_ip() {
    local ip=""
    ip=$(curl -4s --max-time 3 https://api.ipify.org 2>/dev/null || true)
    if [[ -z "$ip" ]]; then
        ip=$(curl -4s --max-time 3 https://ifconfig.me 2>/dev/null || true)
    fi
    if [[ -z "$ip" ]]; then
        ip=$(curl -4s --max-time 3 https://icanhazip.com 2>/dev/null || true)
    fi
    if [[ -z "$ip" ]]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    fi
    if [[ -z "$ip" ]]; then
        ip="127.0.0.1"
    fi
    echo "$ip"
}

safe_read() {
    local prompt="$1"
    local var_name="$2"
    local is_secret="${3:-false}"
    local val=""

    if [[ "$is_secret" == "true" ]]; then
        if [[ -c /dev/tty ]]; then
            read -rsp "$prompt" val < /dev/tty || true
        else
            read -rsp "$prompt" val || true
        fi
        echo ""
    else
        if [[ -c /dev/tty ]]; then
            read -rp "$prompt" val < /dev/tty || true
        else
            read -rp "$prompt" val || true
        fi
    fi
    eval "$var_name=\"\$val\""
    return 0
}

# ──── CLI Argument Parsing ────
CLI_MODE=""
CLI_ACCESS_TYPE=""
CLI_DOMAIN=""
CLI_EMAIL=""
CLI_USER=""
CLI_PASS=""
CLI_SECRET=""
CLI_MASTER_URL=""
CLI_NON_INTERACTIVE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -m|--mode)       CLI_MODE="$2"; shift 2 ;;
        -a|--access)     CLI_ACCESS_TYPE="$2"; shift 2 ;;
        -d|--domain)     CLI_DOMAIN="$2"; shift 2 ;;
        -e|--email)      CLI_EMAIL="$2"; shift 2 ;;
        -u|--user)       CLI_USER="$2"; shift 2 ;;
        -p|--pass)       CLI_PASS="$2"; shift 2 ;;
        -s|--secret)     CLI_SECRET="$2"; shift 2 ;;
        --master-url)    CLI_MASTER_URL="$2"; shift 2 ;;
        -y|--yes)        CLI_NON_INTERACTIVE=true; shift ;;
        *) shift ;;
    esac
done

# ──── Root check ────
if [[ $EUID -ne 0 ]]; then
    fail "Please run this installer as root: sudo bash install.sh"
fi

# ──── OS check ────
if ! command -v apt-get &>/dev/null; then
    fail "This installer requires a Debian/Ubuntu-based system (apt-get not found)"
fi

# ──── Architecture Mapping ────
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)
        ARCH_XRAY="64"
        ARCH_SING="amd64"
        ARCH_MIERU="amd64"
        ARCH_DEB="amd64"
        ;;
    aarch64|arm64)
        ARCH_XRAY="arm64-v8a"
        ARCH_SING="arm64"
        ARCH_MIERU="arm64"
        ARCH_DEB="arm64"
        ;;
    *)
        fail "Unsupported CPU architecture: $ARCH (ProxPanel requires amd64 or arm64)"
        ;;
esac

# ──── Banner ────
echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║           ProxPanel v3 Fast & Resilient Installer          ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}\n"
echo -e "  Detected Arch:  ${BOLD}${ARCH} (${ARCH_DEB})${NC}"
echo -e "  Target OS:      ${BOLD}Ubuntu 20.04+ / Debian 11+${NC}\n"

# ──── Mode selection ────
INSTALL_MODE="$CLI_MODE"
if [[ -z "$INSTALL_MODE" ]]; then
    echo -e "  ${BOLD}Select installation mode:${NC}\n"
    echo -e "    ${CYAN}1${NC}) Panel only    — Web Dashboard + PostgreSQL + Redis + Caddy (Docker)"
    echo -e "    ${CYAN}2${NC}) Node only     — Proxy Worker daemon for remote VPS (systemd)"
    echo -e "    ${CYAN}3${NC}) Panel + Node  — All-in-one Master Panel & Local Proxy Node (Recommended)\n"

    while true; do
        safe_read "  Enter choice [1-3]: " MODE_CHOICE
        case "$MODE_CHOICE" in
            1) INSTALL_MODE="panel"; break ;;
            2) INSTALL_MODE="node";  break ;;
            3) INSTALL_MODE="both";  break ;;
            *) echo -e "  ${RED}Invalid choice. Please enter 1, 2, or 3.${NC}" ;;
        esac
    done
fi

RPC_SECRET="$CLI_SECRET"

# ══════════════════════════════════════════════════════════════
# SYSTEM OPTIMIZATION (SYSCTL & BBR & LIMITS & FIREWALL)
# ══════════════════════════════════════════════════════════════

apply_system_tuning() {
    step "SYS 1/2" "Applying Linux kernel BBR and 64MB TCP buffer optimization..."

    # Enable BBR kernel module
    modprobe tcp_bbr 2>/dev/null || true
    echo "tcp_bbr" > /etc/modules-load.d/bbr.conf 2>/dev/null || true

    # Sysctl optimization
    cat > /etc/sysctl.d/99-proxpanel.conf <<'EOF'
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.ip_forward = 1
net.ipv4.conf.all.forwarding = 1
net.ipv6.conf.all.forwarding = 1
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 100000
net.ipv4.tcp_max_syn_backlog = 65535
fs.file-max = 2097152
net.core.rmem_max = 67108864
net.core.wmem_max = 67108864
net.core.rmem_default = 1048576
net.core.wmem_default = 1048576
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_max_tw_buckets = 1440000
vm.swappiness = 10
EOF

    sysctl -p /etc/sysctl.d/99-proxpanel.conf >/dev/null 2>&1 || sysctl --system >/dev/null 2>&1 || true
    log "Kernel parameters and BBR applied"

    # Security limits
    cat > /etc/security/limits.d/99-proxpanel.conf <<'EOF'
*          soft    nofile          1048576
*          hard    nofile          1048576
*          soft    nproc           524288
*          hard    nproc           524288
root       soft    nofile          1048576
root       hard    nofile          1048576
root       soft    nproc           524288
root       hard    nproc           524288
EOF
    log "Security limits (nofile = 1048576) configured"
    return 0
}

configure_firewall() {
    step "SYS 2/2" "Configuring firewall rules safely..."
    if command -v ufw &>/dev/null; then
        # Detect active SSH port to avoid lockout
        local SSH_PORT="22"
        if [[ -f /etc/ssh/sshd_config ]]; then
            local CONF_PORT
            CONF_PORT=$(grep -E "^Port\s+[0-9]+" /etc/ssh/sshd_config | awk '{print $2}' | head -1 || true)
            if [[ -n "$CONF_PORT" ]]; then
                SSH_PORT="$CONF_PORT"
            fi
        fi

        ufw allow "${SSH_PORT}/tcp" >/dev/null 2>&1 || true
        ufw allow 80/tcp   >/dev/null 2>&1 || true
        ufw allow 443/tcp  >/dev/null 2>&1 || true
        ufw allow 443/udp  >/dev/null 2>&1 || true
        ufw allow 2087/tcp >/dev/null 2>&1 || true
        echo "y" | ufw enable >/dev/null 2>&1 || true
        log "UFW Firewall configured (SSH: ${SSH_PORT}, 80, 443 TCP/UDP, 2087)"
    fi
    return 0
}

# ══════════════════════════════════════════════════════════════
# PARALLEL CORE BINARY FETCHER
# ══════════════════════════════════════════════════════════════

download_proxy_cores() {
    step "CORES" "Downloading proxy core binaries in parallel..."
    mkdir -p /usr/local/bin "$CONFIG_DIR"
    local TMP_DIR="/tmp/proxpanel-bins-$$"
    mkdir -p "$TMP_DIR"

    # 1. Download Xray (background)
    (
        local XRAY_TAG
        XRAY_TAG=$(curl -s https://api.github.com/repos/XTLS/Xray-core/releases/latest 2>/dev/null | jq -r '.tag_name // empty' || true)
        if [[ -z "$XRAY_TAG" || "$XRAY_TAG" == "null" ]]; then
            XRAY_TAG="v25.1.30"
        fi
        local XRAY_URL="https://github.com/XTLS/Xray-core/releases/download/${XRAY_TAG}/Xray-linux-${ARCH_XRAY}.zip"
        if wget -qO "${TMP_DIR}/xray.zip" "$XRAY_URL"; then
            unzip -qo "${TMP_DIR}/xray.zip" xray -d "${TMP_DIR}/" && \
            mv "${TMP_DIR}/xray" /usr/local/bin/xray && \
            chmod +x /usr/local/bin/xray
            echo "[DONE] Xray"
        else
            echo "[FAIL] Xray download"
        fi
    ) &
    local PID_XRAY=$!

    # 2. Download sing-box (background)
    (
        local SING_TAG
        SING_TAG=$(curl -s https://api.github.com/repos/SagerNet/sing-box/releases/latest 2>/dev/null | jq -r '.tag_name // empty' || true)
        if [[ -z "$SING_TAG" || "$SING_TAG" == "null" ]]; then
            SING_TAG="v1.11.0"
        fi
        local SING_CLEAN="${SING_TAG#v}"
        local SING_URL="https://github.com/SagerNet/sing-box/releases/download/${SING_TAG}/sing-box-${SING_CLEAN}-linux-${ARCH_SING}.tar.gz"
        if wget -qO "${TMP_DIR}/sing.tar.gz" "$SING_URL"; then
            tar -xzf "${TMP_DIR}/sing.tar.gz" -C "${TMP_DIR}/"
            local SB_PATH
            SB_PATH=$(find "${TMP_DIR}" -maxdepth 2 -name 'sing-box' -type f 2>/dev/null | head -1)
            if [[ -n "$SB_PATH" ]]; then
                mv "$SB_PATH" /usr/local/bin/sing-box && chmod +x /usr/local/bin/sing-box
                echo "[DONE] sing-box"
            else
                echo "[FAIL] sing-box extraction"
            fi
        else
            echo "[FAIL] sing-box download"
        fi
    ) &
    local PID_SING=$!

    # 3. Download Mieru (background)
    (
        local MIERU_TAG
        MIERU_TAG=$(curl -s https://api.github.com/repos/enfein/mieru/releases/latest 2>/dev/null | jq -r '.tag_name // empty' || true)
        if [[ -z "$MIERU_TAG" || "$MIERU_TAG" == "null" ]]; then
            MIERU_TAG="v3.12.0"
        fi
        local MIERU_CLEAN="${MIERU_TAG#v}"
        local MIERU_URL="https://github.com/enfein/mieru/releases/download/${MIERU_TAG}/mieru_v${MIERU_CLEAN}_linux_${ARCH_MIERU}.tar.gz"
        if wget -qO "${TMP_DIR}/mieru.tar.gz" "$MIERU_URL" 2>/dev/null; then
            tar -xzf "${TMP_DIR}/mieru.tar.gz" -C "${TMP_DIR}/" 2>/dev/null || true
            local M_PATH
            M_PATH=$(find "${TMP_DIR}" -maxdepth 2 -name 'mieru' -type f 2>/dev/null | head -1)
            if [[ -n "$M_PATH" ]]; then
                mv "$M_PATH" /usr/local/bin/mieru && chmod +x /usr/local/bin/mieru
                echo "[DONE] Mieru"
            fi
        fi
    ) &
    local PID_MIERU=$!

    # Wait for parallel downloads
    wait "$PID_XRAY" || true
    wait "$PID_SING" || true
    wait "$PID_MIERU" || true
    rm -rf "$TMP_DIR"

    # Set capabilities if setcap exists
    if command -v setcap &>/dev/null; then
        setcap 'cap_net_bind_service=+ep' /usr/local/bin/xray 2>/dev/null || true
        setcap 'cap_net_bind_service=+ep' /usr/local/bin/sing-box 2>/dev/null || true
    fi

    if [[ -x /usr/local/bin/xray ]]; then
        log "Xray-core ready: $(/usr/local/bin/xray version 2>&1 | head -1)"
    fi
    if [[ -x /usr/local/bin/sing-box ]]; then
        log "sing-box ready: $(/usr/local/bin/sing-box version 2>&1 | head -1)"
    fi
    if [[ -x /usr/local/bin/mieru ]]; then
        log "Mieru ready: $(/usr/local/bin/mieru version 2>&1 | head -1 || echo 'mieru')"
    else
        log "Mieru protocol handled via sing-box"
    fi
    return 0
}

# ══════════════════════════════════════════════════════════════
# INSTALL MANAGEMENT CLI
# ══════════════════════════════════════════════════════════════

install_cli_tools() {
    step "CLI" "Installing unified management tool (vpnpanel)..."
    mkdir -p /usr/local/bin

    if [[ -f "${PANEL_DIR}/scripts/vpnpanel" ]]; then
        cp "${PANEL_DIR}/scripts/vpnpanel" /usr/local/bin/vpnpanel
    elif [[ -f "${CLONE_DIR}/scripts/vpnpanel" ]]; then
        cp "${CLONE_DIR}/scripts/vpnpanel" /usr/local/bin/vpnpanel
    fi

    if [[ -f "${PANEL_DIR}/scripts/check.sh" ]]; then
        cp "${PANEL_DIR}/scripts/check.sh" /usr/local/bin/proxpanel-check
    elif [[ -f "${CLONE_DIR}/scripts/check.sh" ]]; then
        cp "${CLONE_DIR}/scripts/check.sh" /usr/local/bin/proxpanel-check
    fi

    chmod +x /usr/local/bin/vpnpanel 2>/dev/null || true
    chmod +x /usr/local/bin/proxpanel-check 2>/dev/null || true
    ln -sf /usr/local/bin/vpnpanel /usr/local/bin/proxpanel 2>/dev/null || true
    log "CLI 'vpnpanel' and 'proxpanel' installed to /usr/local/bin"
    return 0
}

# ══════════════════════════════════════════════════════════════
# PANEL INSTALLATION
# ══════════════════════════════════════════════════════════════

install_panel() {
    local ACCESS_TYPE="$CLI_ACCESS_TYPE"
    local PANEL_DOMAIN="$CLI_DOMAIN"
    local ADMIN_EMAIL="$CLI_EMAIL"
    local ADMIN_USER="$CLI_USER"
    local ADMIN_PASS="$CLI_PASS"
    local SERVER_IP; SERVER_IP=$(detect_server_ip)
    local PANEL_URL=""

    # ──── 1. Access Method Selection (Domain vs Direct IP vs Plain HTTP) ────
    if [[ -z "$ACCESS_TYPE" ]]; then
        if [[ -n "$PANEL_DOMAIN" ]]; then
            ACCESS_TYPE="domain"
        else
            echo -e "\n  ${BOLD}Select panel access method:${NC}\n"
            echo -e "    ${CYAN}1${NC}) Domain name       — Automatic Let's Encrypt SSL via ACME"
            echo -e "    ${CYAN}2${NC}) Server IP address — Self-signed SSL / Direct IP access (like 3X-UI)"
            echo -e "    ${CYAN}3${NC}) Plain HTTP        — No SSL (for custom reverse proxy / Cloudflare Flexible)\n"

            while true; do
                safe_read "  Enter choice [1-3]: " ACCESS_CHOICE
                case "$ACCESS_CHOICE" in
                    1) ACCESS_TYPE="domain"; break ;;
                    2) ACCESS_TYPE="ip";     break ;;
                    3) ACCESS_TYPE="http";   break ;;
                    *) echo -e "  ${RED}Invalid choice. Please enter 1, 2, or 3.${NC}" ;;
                esac
            done
        fi
    fi

    # ──── 2. Collect Parameters Based on Access Type ────
    case "$ACCESS_TYPE" in
        1|domain)
            ACCESS_TYPE="domain"
            if [[ -z "$PANEL_DOMAIN" ]]; then
                echo -e "\n  ${BOLD}Domain configuration:${NC}"
                safe_read "  Panel domain (e.g. panel.yourdomain.com): " PANEL_DOMAIN
            fi
            if [[ -z "$ADMIN_EMAIL" ]]; then
                safe_read "  Admin email (for TLS certificate):        " ADMIN_EMAIL
            fi
            if [[ -z "$PANEL_DOMAIN" ]]; then
                fail "Domain is required for domain access mode"
            fi
            if [[ -z "$ADMIN_EMAIL" ]]; then
                fail "Email is required for Let's Encrypt TLS certificate"
            fi
            PANEL_URL="https://${PANEL_DOMAIN}"
            ;;
        2|ip)
            ACCESS_TYPE="ip"
            PANEL_DOMAIN="$SERVER_IP"
            PANEL_URL="https://${SERVER_IP}"
            if [[ -z "$ADMIN_EMAIL" ]]; then
                ADMIN_EMAIL="admin@proxpanel.local"
            fi
            echo -e "  Using Server Public IP: ${BOLD}${SERVER_IP}${NC} (Direct HTTPS)"
            ;;
        3|http)
            ACCESS_TYPE="http"
            PANEL_DOMAIN="$SERVER_IP"
            PANEL_URL="http://${SERVER_IP}"
            if [[ -z "$ADMIN_EMAIL" ]]; then
                ADMIN_EMAIL="admin@proxpanel.local"
            fi
            echo -e "  Using Server Public IP: ${BOLD}${SERVER_IP}${NC} (Plain HTTP)"
            ;;
        *)
            fail "Invalid access method: $ACCESS_TYPE"
            ;;
    esac

    # ──── 3. Admin Credentials ────
    if [[ -z "$ADMIN_USER" ]]; then
        safe_read "  Admin username [admin]:                   " ADMIN_USER
        if [[ -z "$ADMIN_USER" ]]; then
            ADMIN_USER="admin"
        fi
    fi
    if [[ -z "$ADMIN_PASS" ]]; then
        safe_read "  Admin password (min 8 chars):             " ADMIN_PASS true
    fi

    if [[ -z "$ADMIN_PASS" ]]; then
        fail "Admin password is required"
    fi
    if [[ ${#ADMIN_PASS} -lt 8 ]]; then
        fail "Password must be at least 8 characters long"
    fi

    # ──── System Dependencies ────
    step "PANEL 1/7" "Installing system dependencies and Docker Engine..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl wget jq unzip tar openssl ca-certificates gnupg lsb-release socat ufw >/dev/null
    log "System dependencies installed"

    if ! command -v docker &>/dev/null; then
        echo -e "${CYAN}Installing Docker Engine...${NC}"
        curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
        systemctl enable docker &>/dev/null && systemctl start docker
        log "Docker installed"
    else
        log "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    fi

    if ! docker compose version &>/dev/null; then
        apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || fail "docker-compose-plugin installation failed"
    fi
    log "Docker Compose $(docker compose version --short)"

    # ──── Download Source ────
    step "PANEL 2/7" "Downloading ProxPanel source repository..."
    rm -rf "$CLONE_DIR"
    mkdir -p "$CLONE_DIR"
    if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | \
         tar xz -C "$CLONE_DIR" --strip-components=1; then
        fail "Failed to download repository source archive"
    fi
    log "Source code downloaded"

    # ──── Setup Directory ────
    step "PANEL 3/7" "Configuring environment and Caddyfile for ${ACCESS_TYPE} mode..."
    mkdir -p "$PANEL_DIR"
    cp -r "$CLONE_DIR"/. "$PANEL_DIR/"

    local DB_PASS; DB_PASS=$(openssl rand -hex 16 2>/dev/null || tr -dc 'a-f0-9' < /dev/urandom | head -c 32)
    local JWT_SECRET; JWT_SECRET=$(generate_secret)
    RPC_SECRET=$(generate_secret)
    local ENC_KEY; ENC_KEY=$(openssl rand -hex 16 2>/dev/null || tr -dc 'a-f0-9' < /dev/urandom | head -c 32)

    cat > "$PANEL_DIR/.env" <<EOF
POSTGRES_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
NODE_RPC_SECRET=${RPC_SECRET}
ENCRYPTION_KEY=${ENC_KEY}
API_URL=${PANEL_URL}
FRONTEND_URL=${PANEL_URL}
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_IDS=
CRYPTOPAY_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
BACKUP_ENABLED=false
EOF

    # Generate Caddyfile according to selected access type
    if [[ "$ACCESS_TYPE" == "domain" ]]; then
        cat > "$PANEL_DIR/Caddyfile" <<EOF
${PANEL_DOMAIN} {
    tls ${ADMIN_EMAIL}

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
    elif [[ "$ACCESS_TYPE" == "ip" ]]; then
        cat > "$PANEL_DIR/Caddyfile" <<EOF
:443 {
    tls internal

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
    else # http
        cat > "$PANEL_DIR/Caddyfile" <<EOF
:80 {
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
    fi

    log "Configuration files ready at ${PANEL_DIR}"

    # ──── System Tuning & Cores ────
    apply_system_tuning
    download_proxy_cores
    configure_firewall
    install_cli_tools

    # ──── Build & Start Containers ────
    step "PANEL 4/7" "Building and launching Docker microservices..."
    cd "$PANEL_DIR"
    docker compose build --parallel
    docker compose up -d
    log "Containers started"

    # ──── Wait for API Health ────
    step "PANEL 5/7" "Waiting for PostgreSQL and API healthcheck..."
    local MAX_WAIT=90
    local WAITED=0
    while [[ $WAITED -lt $MAX_WAIT ]]; do
        if docker compose exec -T server curl -sf http://localhost:3000/api/health &>/dev/null; then
            break
        fi
        sleep 3
        WAITED=$((WAITED + 3))
        echo -ne "\r  Waiting for server readiness... ${WAITED}s / ${MAX_WAIT}s"
    done
    echo ""

    if ! docker compose exec -T server curl -sf http://localhost:3000/api/health &>/dev/null; then
        echo -e "${YELLOW}Server logs on timeout:${NC}"
        docker compose logs --tail=30 server
        fail "Server failed to respond to /api/health within ${MAX_WAIT}s"
    fi
    log "Server API is healthy (200 OK)"

    # ──── Seed SuperAdmin User ────
    step "PANEL 6/7" "Creating super admin user in database..."
    docker compose exec -T server npx tsx prisma/seed.ts \
        --username "$ADMIN_USER" \
        --password "$ADMIN_PASS" \
        --email "$ADMIN_EMAIL" 2>&1 | tail -5
    log "Super admin user created"

    # ──── Run Health Check ────
    step "PANEL 7/7" "Running diagnostic health check..."
    bash "${PANEL_DIR}/scripts/check.sh" || true

    echo -e "\n  ${GREEN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}${BOLD}║           ProxPanel v3 Successfully Installed!             ║${NC}"
    echo -e "  ${GREEN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo -e ""
    echo -e "  Web Dashboard:   ${BOLD}${PANEL_URL}${NC}"
    echo -e "  Access Mode:     ${BOLD}${ACCESS_TYPE}${NC}"
    echo -e "  Admin Login:     ${BOLD}${ADMIN_USER}${NC}"
    echo -e "  Admin Password:  ${BOLD}${ADMIN_PASS}${NC}"
    echo -e "  Node RPC Secret: ${BOLD}${RPC_SECRET}${NC}"
    echo -e ""
    if [[ "$ACCESS_TYPE" == "ip" ]]; then
        echo -e "  ${YELLOW}Note on Self-Signed SSL:${NC}"
        echo -e "  When opening ${BOLD}${PANEL_URL}${NC} in browser, click ${CYAN}'Advanced' -> 'Proceed to site'${NC}."
        echo -e ""
    fi
    echo -e "  Management CLI:  ${CYAN}vpnpanel status | logs | doctor | help${NC}\n"
    return 0
}

# ══════════════════════════════════════════════════════════════
# NODE / WORKER INSTALLATION
# ══════════════════════════════════════════════════════════════

install_node() {
    local MASTER_URL="$1"
    local NODE_SECRET="$2"

    step "NODE 1/6" "Installing Node.js 20 LTS runtime..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl wget jq unzip tar openssl build-essential socat ufw >/dev/null

    if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 20 ]]; then
        echo -e "${CYAN}Installing Node.js 20 LTS via nodesource...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y -qq nodejs >/dev/null
    fi
    log "Node.js $(node -v) ready"

    # ──── Download and Build Worker ────
    step "NODE 2/6" "Preparing worker source code..."
    rm -rf "$CLONE_DIR"
    mkdir -p "$CLONE_DIR"
    if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | \
         tar xz -C "$CLONE_DIR" --strip-components=1; then
        fail "Failed to download source archive"
    fi

    mkdir -p "$NODE_DIR"
    cp -r "$CLONE_DIR/server" "$NODE_DIR/"
    rm -rf "$CLONE_DIR"

    step "NODE 3/6" "Installing dependencies and compiling TypeScript worker..."
    cd "$NODE_DIR/server"
    npm install --no-workspaces 2>&1 | tail -3
    npx prisma generate 2>&1 | tail -1
    npm run build 2>&1 | tail -3
    log "Worker compiled"

    # ──── Create Environment File ────
    cat > "$NODE_DIR/server/.env" <<EOF
MASTER_URL=${MASTER_URL}
NODE_RPC_SECRET=${NODE_SECRET}
WORKER_PORT=2087
CONFIG_DIR=/etc/proxpanel
XRAY_BIN=/usr/local/bin/xray
SINGBOX_BIN=/usr/local/bin/sing-box
MIERU_BIN=/usr/local/bin/mieru
NAIVE_BIN=/usr/local/bin/caddy
NODE_ENV=production
EOF

    # ──── System Tuning, Cores & Firewall ────
    apply_system_tuning
    download_proxy_cores
    configure_firewall
    install_cli_tools

    # ──── Systemd Service ────
    step "NODE 4/6" "Configuring systemd unit (${NODE_SERVICE})..."
    local NODE_BIN; NODE_BIN=$(command -v node)

    cat > /etc/systemd/system/${NODE_SERVICE}.service <<EOF
[Unit]
Description=ProxPanel Node Proxy Worker
Documentation=https://github.com/Velio322/proxy-panel-v3
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${NODE_DIR}/server
ExecStart=${NODE_BIN} dist/worker/index.js
Restart=always
RestartSec=3s
StartLimitIntervalSec=60s
StartLimitBurst=5
EnvironmentFile=${NODE_DIR}/server/.env
Environment=NODE_ENV=production
LimitNOFILE=1048576
LimitNPROC=524288
AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_ADMIN
PrivateTmp=true
StandardOutput=journal
StandardError=journal
SyslogIdentifier=proxpanel-node

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${NODE_SERVICE}
    systemctl restart ${NODE_SERVICE}

    sleep 3
    if systemctl is-active --quiet ${NODE_SERVICE}; then
        log "ProxPanel Node worker is running (systemd active)"
    else
        echo -e "${YELLOW}Service failed to start. Logs:${NC}"
        journalctl -u ${NODE_SERVICE} --no-pager -n 20
        fail "Node worker failed to start"
    fi

    step "NODE 5/6" "Checking worker API endpoint..."
    if curl -sf http://127.0.0.1:2087/health &>/dev/null; then
        log "Worker healthcheck on port 2087: 200 OK"
    fi

    step "NODE 6/6" "Running diagnostic health check..."
    bash /usr/local/bin/proxpanel-check || true

    echo -e "\n  ${GREEN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}${BOLD}║           ProxPanel Node Successfully Installed!           ║${NC}"
    echo -e "  ${GREEN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo -e ""
    echo -e "  Service:      ${BOLD}${NODE_SERVICE}${NC}"
    echo -e "  Master URL:   ${BOLD}${MASTER_URL}${NC}"
    echo -e "  Worker Port:  ${BOLD}2087${NC}"
    echo -e "  CLI Tool:     ${CYAN}vpnpanel status | logs node | doctor${NC}\n"
    return 0
}

# ══════════════════════════════════════════════════════════════
# MAIN DISPATCHER
# ══════════════════════════════════════════════════════════════

case "$INSTALL_MODE" in
    panel)
        install_panel
        ;;
    node)
        MASTER_URL="$CLI_MASTER_URL"
        NODE_SECRET="$CLI_SECRET"
        if [[ -z "$MASTER_URL" ]]; then
            echo -e "\n  ${BOLD}Node configuration:${NC}\n"
            safe_read "  Master Panel URL (e.g. https://panel.yourdomain.com): " MASTER_URL
        fi
        if [[ -z "$NODE_SECRET" ]]; then
            safe_read "  Node RPC Secret (from Panel Settings / Installation): " NODE_SECRET
        fi
        if [[ -z "$MASTER_URL" ]]; then
            fail "Master URL is required"
        fi
        if [[ -z "$NODE_SECRET" ]]; then
            fail "Node secret is required"
        fi
        MASTER_URL="${MASTER_URL%/}"
        install_node "$MASTER_URL" "$NODE_SECRET"
        ;;
    both)
        echo -e "${CYAN}${BOLD}▶ Starting All-In-One Installation (Panel + Node)...${NC}"
        install_panel
        echo ""
        step "ALL-IN-ONE" "Setting up local Node Worker on Master server..."
        if [[ -z "$RPC_SECRET" ]]; then
            fail "Internal error: RPC_SECRET not generated during Panel install"
        fi
        install_node "http://127.0.0.1:3000" "$RPC_SECRET"

        step "NODE REG" "Registering local Node Worker in Master Database..."
        for i in $(seq 1 15); do
            RESP=$(curl -sf -X POST "http://127.0.0.1:3000/api/v1/nodes/self/register" \
                -H 'Content-Type: application/json' \
                -d "{\"token\":\"${RPC_SECRET}\",\"name\":\"master-node-01\",\"host\":\"127.0.0.1\",\"port\":443,\"apiPort\":2087}" 2>/dev/null || echo "")
            if echo "$RESP" | grep -q '"nodeId"'; then
                log "Local node successfully registered with Master Panel!"
                break
            fi
            sleep 2
        done
        ;;
    *)
        fail "Invalid mode: $INSTALL_MODE"
        ;;
esac

rm -rf "$CLONE_DIR" 2>/dev/null || true

echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Installation Complete! Type 'vpnpanel' to manage your server.${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════${NC}\n"
