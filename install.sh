#!/usr/bin/env bash
set -euo pipefail

# ══════════════════════════════════════════════════════════════
# ProxPanel Installer v2.0
# Commercial-grade multi-protocol proxy management panel
#
# Supports: All-in-One | Master | Worker
# Includes: Docker, Nginx, SSL, Prometheus, Grafana
# ══════════════════════════════════════════════════════════════

# ──── Colors & Formatting ────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

VERSION="2.0.0"
INSTALL_DIR="/opt/proxpanel"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ──── Logging ────

log()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()   { echo -e "${YELLOW}  !${NC} $1"; }
error()  { echo -e "${RED}  ✗${NC} $1"; }
info()   { echo -e "${BLUE}  i${NC} $1"; }
step()   { echo -e "\n${CYAN}${BOLD}▸ $1${NC}"; }
header() { echo -e "\n${MAGENTA}${BOLD}╔════════════════════════════════════════════════╗${NC}"; \
           echo -e "${MAGENTA}${BOLD}║${NC} ${CYAN}${BOLD}$1${NC}"; \
           echo -e "${MAGENTA}${BOLD}╚════════════════════════════════════════════════╝${NC}"; }

divider() { echo -e "${DIM}──────────────────────────────────────────────────${NC}"; }

# ──── Utility ────

generate_password() {
    openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32
}

generate_secret() {
    openssl rand -hex 32
}

confirm() {
    local msg="${1:-Are you sure?}"
    local default="${2:-n}"
    local hint="Y/n"
    [[ "$default" == "y" ]] && hint="y/N"

    read -rp "  ${msg} [${hint}]: " answer
    answer="${answer:-$default}"
    [[ "${answer,,}" == "y" || "${answer,,}" == "yes" ]]
}

wait_for_port() {
    local port=$1
    local timeout=${2:-60}
    local elapsed=0
    while ! ss -tlnp | grep -q ":${port} " && [[ $elapsed -lt $timeout ]]; do
        sleep 1
        ((elapsed++))
    done
    [[ $elapsed -lt $timeout ]]
}

# ══════════════════════════════════════════════
# Phase 1: System Checks & Prerequisites
# ══════════════════════════════════════════════

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        echo -e "  Run: ${BOLD}sudo bash $0${NC}"
        exit 1
    fi
}

detect_os() {
    OS_ID="unknown"
    OS_VERSION=""

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS_ID="$ID"
        OS_VERSION="$VERSION_ID"
    elif [[ -f /etc/centos-release ]]; then
        OS_ID="centos"
    elif [[ -f /etc/debian_version ]]; then
        OS_ID="debian"
    fi

    info "Detected OS: ${OS_ID} ${OS_VERSION}"
}

check_system_resources() {
    local ram_mb
    ram_mb=$(free -m | awk '/^Mem:/{print $2}')
    local disk_gb
    disk_gb=$(df -BG / | awk 'NR==2{gsub("G",""); print $4}')

    if [[ $ram_mb -lt 1024 ]]; then
        warn "Low RAM: ${ram_mb}MB (recommended: 2048MB+)"
    else
        log "RAM: ${ram_mb}MB"
    fi

    if [[ $disk_gb -lt 10 ]]; then
        warn "Low disk space: ${disk_gb}GB free (recommended: 20GB+)"
    else
        log "Disk: ${disk_gb}GB free"
    fi

    local cpu_cores
    cpu_cores=$(nproc 2>/dev/null || echo 1)
    info "CPU cores: ${cpu_cores}"
}

install_docker() {
    step "Installing Docker"

    if command -v docker &>/dev/null; then
        log "Docker already installed: $(docker --version | awk '{print $3}' | tr -d ',')"
        return
    fi

    info "Installing Docker via official script..."

    # Install dependencies
    if command -v apt-get &>/dev/null; then
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null 2>&1
    elif command -v dnf &>/dev/null; then
        dnf install -y -q ca-certificates curl >/dev/null 2>&1
    elif command -v yum &>/dev/null; then
        yum install -y -q ca-certificates curl >/dev/null 2>&1
    fi

    # Docker official install script
    curl -fsSL https://get.docker.com | sh 2>/dev/null

    systemctl enable docker >/dev/null 2>&1
    systemctl start docker >/dev/null 2>&1

    # Add current user to docker group (if not root)
    if [[ $SUDO_USER ]]; then
        usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    fi

    log "Docker installed: $(docker --version | awk '{print $3}' | tr -d ',')"
}

check_docker_compose() {
    step "Checking Docker Compose"

    if docker compose version &>/dev/null 2>&1; then
        log "Docker Compose plugin found"
        return
    fi

    # Fallback: standalone binary
    if command -v docker-compose &>/dev/null; then
        log "docker-compose standalone found"
        return
    fi

    info "Docker Compose plugin not found. Installing..."
    # The official Docker install script (get.docker.com) should include compose plugin
    # If not, install manually
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest 2>/dev/null | grep -oP '"tag_name":\s*"\K[^"]+' || echo "v2.29.0")
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose 2>/dev/null
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose 2>/dev/null || true
    log "Docker Compose installed"
}

check_existing_install() {
    if [[ -d "${INSTALL_DIR}/.git" ]] || [[ -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
        warn "Existing installation found at ${INSTALL_DIR}"
        divider
        echo -e "  ${BOLD}1)${NC} Update existing installation"
        echo -e "  ${BOLD}2)${NC} Reinstall from scratch (data preserved in Docker volumes)"
        echo -e "  ${BOLD}3)${NC} Abort"
        divider
        read -rp "  Choose [1-3]: " upgrade_choice

        case $upgrade_choice in
            1)
                info "Updating existing installation..."
                cd "$INSTALL_DIR"
                git pull 2>/dev/null || cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
                docker compose pull
                docker compose up -d --build
                docker compose exec -T server npx prisma migrate deploy
                log "Update complete"
                exit 0
                ;;
            3)
                info "Aborted"
                exit 0
                ;;
            *)
                info "Reinstalling..."
                ;;
        esac
    fi
}

# ══════════════════════════════════════════════
# Phase 2: Interactive Configuration
# ══════════════════════════════════════════════

menu_install_mode() {
    header "Installation Mode"

    echo -e "  ${BOLD}1)${NC} All-in-One ${DIM}(Master + Worker on same server — recommended for small setups)${NC}"
    echo -e "  ${BOLD}2)${NC} Master Server ${DIM}(API + Dashboard + Billing — for multi-node setups)${NC}"
    echo -e "  ${BOLD}3)${NC} Worker Node ${DIM}(Proxy cores only — connects to remote Master)${NC}"
    divider

    while true; do
        read -rp "  Select mode [1-3]: " mode_choice
        case $mode_choice in
            1) INSTALL_MODE="all-in-one"; break ;;
            2) INSTALL_MODE="master"; break ;;
            3) INSTALL_MODE="worker"; break ;;
            *) error "Invalid selection. Enter 1, 2, or 3." ;;
        esac
    done

    log "Mode: ${BOLD}${INSTALL_MODE}${NC}"
}

menu_domain() {
    header "Domain Configuration"

    while true; do
        read -rp "  Panel domain (e.g., panel.example.com): " PANEL_DOMAIN
        if [[ -n "$PANEL_DOMAIN" && "$PANEL_DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ ]]; then
            break
        fi
        error "Invalid domain format"
    done

    API_URL="https://${PANEL_DOMAIN}"
    FRONTEND_URL="https://${PANEL_DOMAIN}"

    # Check if domain resolves
    info "Checking DNS resolution..."
    local resolved_ip
    resolved_ip=$(dig +short "$PANEL_DOMAIN" 2>/dev/null | head -1 || true)
    local server_ip
    server_ip=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "")

    if [[ -n "$resolved_ip" && -n "$server_ip" ]]; then
        if [[ "$resolved_ip" == "$server_ip" ]]; then
            log "DNS resolves to this server (${server_ip})"
        else
            warn "DNS resolves to ${resolved_ip}, server IP is ${server_ip}"
            warn "Make sure DNS points to this server before SSL setup"
        fi
    else
        info "Could not verify DNS (may be behind NAT)"
    fi

    log "Domain: ${BOLD}${PANEL_DOMAIN}${NC}"
}

menu_admin() {
    header "Admin Account"

    while true; do
        read -rp "  Admin username [admin]: " ADMIN_USER
        ADMIN_USER="${ADMIN_USER:-admin}"
        if [[ "$ADMIN_USER" =~ ^[a-zA-Z0-9_-]{3,50}$ ]]; then
            break
        fi
        error "Username: 3-50 chars, letters/numbers/-/_ only"
    done

    while true; do
        read -rsp "  Admin password: " ADMIN_PASS
        echo ""
        if [[ ${#ADMIN_PASS} -ge 8 ]]; then
            read -rsp "  Confirm password: " ADMIN_PASS_CONFIRM
            echo ""
            if [[ "$ADMIN_PASS" == "$ADMIN_PASS_CONFIRM" ]]; then
                break
            fi
            error "Passwords do not match"
        else
            error "Password must be at least 8 characters"
        fi
    done

    while true; do
        read -rp "  Admin email: " ADMIN_EMAIL
        if [[ -z "$ADMIN_EMAIL" || "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            break
        fi
        error "Invalid email format"
    done

    log "Admin: ${BOLD}${ADMIN_USER}${NC}"
}

menu_telegram() {
    header "Telegram Bot (optional)"

    read -rp "  Telegram bot token (Enter to skip): " TG_TOKEN

    if [[ -n "$TG_TOKEN" ]]; then
        while true; do
            read -rp "  Telegram admin IDs (comma-separated, e.g., 123456,789012): " TG_ADMINS
            if [[ -n "$TG_ADMINS" ]]; then
                break
            fi
            error "At least one admin ID is required"
        done

        # Validate bot token format
        if [[ ! "$TG_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
            warn "Token format looks unusual (expected: 123456:ABC-DEF...)"
            if ! confirm "Continue anyway?"; then
                TG_TOKEN=""
                TG_ADMINS=""
            fi
        fi

        if [[ -n "$TG_TOKEN" ]]; then
            info "Testing bot token..."
            local bot_test
            bot_test=$(curl -s "https://api.telegram.org/bot${TG_TOKEN}/getMe" 2>/dev/null || echo '{"ok":false}')
            if echo "$bot_test" | grep -q '"ok":true'; then
                local bot_name
                bot_name=$(echo "$bot_test" | grep -oP '"username":\s*"\K[^"]+' || echo "unknown")
                log "Bot verified: @${bot_name}"
            else
                warn "Bot token verification failed (may still work)"
            fi
        fi
    fi

    TG_TOKEN="${TG_TOKEN:-}"
    TG_ADMINS="${TG_ADMINS:-}"
}

menu_billing() {
    header "Payment Gateway (optional)"

    echo -e "  ${BOLD}1)${NC} CryptoPay"
    echo -e "  ${BOLD}2)${NC} Stripe"
    echo -e "  ${BOLD}3)${NC} Telegram Stars"
    echo -e "  ${BOLD}4)${NC} Skip"
    divider

    read -rp "  Select [1-4]: " billing_choice

    CRYPTOPAY_TOKEN=""
    STRIPE_KEY=""
    STRIPE_WEBHOOK=""

    case $billing_choice in
        1)
            read -rp "  CryptoPay token: " CRYPTOPAY_TOKEN
            info "Get token from @CryptoBot -> /mybots -> Bot Settings -> Payments"
            ;;
        2)
            read -rp "  Stripe secret key (sk_live_...): " STRIPE_KEY
            read -rp "  Stripe webhook secret (whsec_...): " STRIPE_WEBHOOK
            info "Configure webhook endpoint: https://${PANEL_DOMAIN}/api/v1/billing/stripe/webhook"
            ;;
        3)
            info "Telegram Stars configured via Telegram Bot settings"
            ;;
        *)
            info "Skipping payment gateway setup"
            ;;
    esac
}

menu_ssl() {
    header "SSL Certificate"

    if [[ "$INSTALL_MODE" == "worker" ]]; then
        SSL_SETUP=false
        return
    fi

    # Check if certbot is available
    if command -v certbot &>/dev/null; then
        if confirm "Install SSL via Let's Encrypt (certbot)?" "y"; then
            SSL_SETUP=true
            return
        fi
    else
        info "certbot not found"
        if confirm "Install certbot and obtain SSL certificate?" "y"; then
            SSL_SETUP=true
            return
        fi
    fi

    SSL_SETUP=false
    warn "SSL not configured. You will need to set up SSL manually."
}

# ══════════════════════════════════════════════
# Phase 3: Configuration Generation
# ══════════════════════════════════════════════

generate_env() {
    step "Generating .env configuration"

    POSTGRES_PASS=$(generate_password)
    JWT_SECRET=$(generate_secret)
    ENCRYPTION_KEY=$(generate_secret | head -c 32)
    NODE_SECRET=$(generate_secret)
    GRAFANA_PASS=$(generate_password | head -c 16)

    cat > "${INSTALL_DIR}/.env" << ENVEOF
# ════════════════════════════════════════════
# ProxPanel v${VERSION} Configuration
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ════════════════════════════════════════════

# ──── Database ────
POSTGRES_USER=proxpanel
POSTGRES_PASSWORD=${POSTGRES_PASS}

# ──── JWT Authentication ────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# ──── Server ────
API_PORT=3000
API_URL=${API_URL}
FRONTEND_URL=${FRONTEND_URL}

# ──── Node Communication ────
NODE_RPC_SECRET=${NODE_SECRET}

# ──── Encryption ────
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ──── Telegram Bot ────
TELEGRAM_BOT_TOKEN=${TG_TOKEN}
TELEGRAM_ADMIN_IDS=${TG_ADMINS}

# ──── Billing ────
CRYPTOPAY_TOKEN=${CRYPTOPAY_TOKEN}
STRIPE_SECRET_KEY=${STRIPE_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK}

# ──── Backup ────
BACKUP_ENABLED=false
BACKUP_TELEGRAM_TOKEN=
BACKUP_TELEGRAM_CHAT_ID=

# ──── Monitoring ────
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
PROMETHEUS_UI_PORT=9091

# ──── Grafana ────
GRAFANA_USER=admin
GRAFANA_PASSWORD=${GRAFANA_PASS}
GRAFANA_PORT=3001

# ──── Frontend ────
FRONTEND_PORT=5173

# ──── Worker (for worker mode) ────
WORKER_MODE=false
MASTER_URL=
ENVEOF

    chmod 600 "${INSTALL_DIR}/.env"
    log ".env created with generated secrets"
}

generate_nginx_config() {
    step "Generating Nginx configuration"

    cat > /etc/nginx/sites-available/proxpanel << 'NGINXEOF'
# ════════════════════════════════════════════
# ProxPanel Nginx Configuration
# Auto-generated by install.sh
# ════════════════════════════════════════════

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

NGINXEOF

    # HTTP → HTTPS redirect
    cat >> /etc/nginx/sites-available/proxpanel << NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name ${PANEL_DOMAIN};

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
NGINXEOF

    # Main HTTPS server
    cat >> /etc/nginx/sites-available/proxpanel << NGINXEOF

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${PANEL_DOMAIN};

    # ──── SSL ────
NGINXEOF

    if [[ "$SSL_SETUP" == "true" ]]; then
        cat >> /etc/nginx/sites-available/proxpanel << NGINXEOF
    ssl_certificate /etc/letsencrypt/live/${PANEL_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${PANEL_DOMAIN}/privkey.pem;
NGINXEOF
    else
        # Self-signed for initial setup
        cat >> /etc/nginx/sites-available/proxpanel << 'NGINXEOF'
    ssl_certificate /etc/nginx/ssl/self-signed.crt;
    ssl_certificate_key /etc/nginx/ssl/self-signed.key;
NGINXEOF
    fi

    cat >> /etc/nginx/sites-available/proxpanel << 'NGINXEOF'

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;

    # ──── Security Headers ────
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # ──── Gzip ────
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # ──── API Backend ────
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # ──── Login rate limit ────
    location /api/v1/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ──── Prometheus (local only) ────
    location /metrics {
        proxy_pass http://127.0.0.1:9090;
        allow 127.0.0.1;
        allow ::1;
        deny all;
    }

    # ──── Grafana ────
    location /grafana/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket for Grafana Live
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ──── Frontend (SPA) ────
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SPA: serve index.html for all non-file routes
        proxy_intercept_errors on;
        error_page 404 = /index.html;
    }

    # ──── Static assets caching ────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ──── Block dotfiles ────
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
NGINXEOF

    log "Nginx configuration written"
}

setup_ssl_cert() {
    step "Setting up SSL certificate"

    if [[ "$SSL_SETUP" != "true" ]]; then
        # Generate self-signed cert for initial setup
        mkdir -p /etc/nginx/ssl
        openssl req -x509 -nodes -days 365 \
            -subj "/C=US/ST=State/L=City/O=ProxPanel/CN=${PANEL_DOMAIN}" \
            -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/self-signed.key \
            -out /etc/nginx/ssl/self-signed.crt 2>/dev/null
        log "Self-signed certificate generated (replace with real SSL)"
        return
    fi

    # Install certbot if needed
    if ! command -v certbot &>/dev/null; then
        info "Installing certbot..."
        if command -v apt-get &>/dev/null; then
            apt-get install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1
        elif command -v dnf &>/dev/null; then
            dnf install -y -q certbot python3-certbot-nginx >/dev/null 2>&1
        elif command -v yum &>/dev/null; then
            yum install -y -q certbot python3-certbot-nginx >/dev/null 2>&1
        fi
    fi

    # Start nginx temporarily for challenge
    mkdir -p /var/www/certbot
    systemctl start nginx 2>/dev/null || nginx 2>/dev/null || true
    sleep 2

    # Obtain certificate
    info "Obtaining SSL certificate for ${PANEL_DOMAIN}..."
    if certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        -d "$PANEL_DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "admin@${PANEL_DOMAIN}" \
        --no-eff-email 2>/dev/null; then
        log "SSL certificate obtained successfully"

        # Auto-renewal cron
        echo "0 0,12 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'" \
            > /etc/cron.d/certbot-renew
        log "Auto-renewal cron installed"
    else
        warn "SSL certificate request failed"
        warn "Falling back to self-signed certificate"
        SSL_SETUP=false
        setup_ssl_cert
    fi
}

# ══════════════════════════════════════════════
# Phase 4: Deployment
# ══════════════════════════════════════════════

copy_project_files() {
    step "Copying project files"

    mkdir -p "$INSTALL_DIR"

    # Copy with rsync if available, fallback to cp
    if command -v rsync &>/dev/null; then
        rsync -a --exclude='.git' --exclude='node_modules' --exclude='dist' \
            "$SCRIPT_DIR/" "$INSTALL_DIR/"
    else
        cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/" 2>/dev/null || true
    fi

    chmod +x "${INSTALL_DIR}/install.sh" 2>/dev/null || true
    log "Project files copied to ${INSTALL_DIR}"
}

deploy_all_in_one() {
    step "Deploying All-in-One (Master + Worker)"

    cd "$INSTALL_DIR"

    # Build images
    info "Building Docker images (this may take a few minutes)..."
    docker compose build --no-cache 2>&1 | tail -5

    # Start services
    info "Starting services..."
    docker compose up -d postgres redis server client prometheus grafana

    # Wait for database
    info "Waiting for PostgreSQL to be ready..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if docker compose exec -T postgres pg_isready -U proxpanel -q 2>/dev/null; then
            break
        fi
        sleep 2
        ((retries--))
    done

    if [[ $retries -eq 0 ]]; then
        error "PostgreSQL failed to start"
        docker compose logs postgres
        exit 1
    fi
    log "PostgreSQL is ready"

    # Wait for Redis
    info "Waiting for Redis..."
    retries=15
    while [[ $retries -gt 0 ]]; do
        if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
            break
        fi
        sleep 1
        ((retries--))
    done
    log "Redis is ready"

    # Run migrations
    info "Running database migrations..."
    docker compose exec -T server npx prisma migrate deploy 2>&1 | tail -3
    log "Migrations applied"

    # Seed admin user
    info "Seeding admin user..."
    local email_flag=""
    [[ -n "$ADMIN_EMAIL" ]] && email_flag="--email $ADMIN_EMAIL"
    docker compose exec -T server npx tsx prisma/seed.ts \
        --username "$ADMIN_USER" \
        --password "$ADMIN_PASS" \
        $email_flag 2>&1 | tail -3
    log "Admin user created"

    # Generate Nginx config
    generate_nginx_config
    setup_ssl_cert

    # Apply Nginx config
    ln -sf /etc/nginx/sites-available/proxpanel /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    if nginx -t 2>/dev/null; then
        systemctl enable nginx 2>/dev/null || true
        systemctl restart nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
        log "Nginx configured and started"
    else
        warn "Nginx config test failed — check configuration"
    fi

    log "All-in-One deployment complete!"
}

deploy_master() {
    step "Deploying Master Server"

    cd "$INSTALL_DIR"

    info "Building Docker images..."
    docker compose build --no-cache 2>&1 | tail -5

    info "Starting services..."
    docker compose up -d postgres redis server client prometheus grafana

    info "Waiting for PostgreSQL..."
    local retries=30
    while [[ $retries -gt 0 ]]; do
        if docker compose exec -T postgres pg_isready -U proxpanel -q 2>/dev/null; then
            break
        fi
        sleep 2
        ((retries--))
    done
    log "PostgreSQL is ready"

    info "Running database migrations..."
    docker compose exec -T server npx prisma migrate deploy 2>&1 | tail -3

    local email_flag=""
    [[ -n "$ADMIN_EMAIL" ]] && email_flag="--email $ADMIN_EMAIL"
    info "Seeding admin user..."
    docker compose exec -T server npx tsx prisma/seed.ts \
        --username "$ADMIN_USER" \
        --password "$ADMIN_PASS" \
        $email_flag 2>&1 | tail -3

    generate_nginx_config
    setup_ssl_cert

    ln -sf /etc/nginx/sites-available/proxpanel /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    if nginx -t 2>/dev/null; then
        systemctl enable nginx 2>/dev/null || true
        systemctl restart nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
    fi

    log "Master server deployed!"
}

deploy_worker() {
    step "Deploying Worker Node"

    cd "$INSTALL_DIR"

    # Prompt for master connection
    header "Master Server Connection"
    read -rp "  Master API URL (e.g., https://panel.example.com): " MASTER_URL_INPUT
    read -rp "  Node secret (from Master panel -> Nodes -> Add): " NODE_SECRET_INPUT

    if [[ -z "$MASTER_URL_INPUT" || -z "$NODE_SECRET_INPUT" ]]; then
        error "Master URL and Node secret are required"
        exit 1
    fi

    # Update .env for worker mode
    cat >> "${INSTALL_DIR}/.env" << WEOF

# ──── Worker Configuration ────
WORKER_MODE=true
MASTER_URL=${MASTER_URL_INPUT}
NODE_RPC_SECRET=${NODE_SECRET_INPUT}
WEOF

    # Install proxy cores
    step "Installing proxy cores"

    info "Installing Xray-core..."
    if ! command -v xray &>/dev/null; then
        bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install 2>/dev/null || \
        curl -sL https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip -o /tmp/xray.zip && \
        unzip -o /tmp/xray.zip -d /usr/local/bin/ xray && chmod +x /usr/local/bin/xray && rm /tmp/xray.zip 2>/dev/null || \
        warn "Xray installation failed — install manually"
    fi

    info "Installing sing-box..."
    if ! command -v sing-box &>/dev/null; then
        curl -sL https://github.com/SagerNet/sing-box/releases/latest/download/sing-box-$(uname -m)-unknown-linux-gnu.tar.gz | \
        tar xz -C /tmp/ && mv /tmp/sing-box-*/sing-box /usr/local/bin/sing-box 2>/dev/null || \
        warn "sing-box installation failed — install manually"
    fi

    # Build and start worker
    info "Building Docker image..."
    docker compose build server 2>&1 | tail -3

    info "Starting worker..."
    docker compose up -d server

    log "Worker node deployed!"
    info "Register this node in the Master panel with:"
    echo -e "    API URL: ${BOLD}${MASTER_URL_INPUT}${NC}"
    echo -e "    Secret:  ${BOLD}${NODE_SECRET_INPUT}${NC}"
}

# ══════════════════════════════════════════════
# Phase 5: Post-Install & Summary
# ══════════════════════════════════════════════

setup_cron_jobs() {
    step "Setting up cron jobs"

    # Auto-start containers on boot
    cat > /etc/cron.d/proxpanel-autostart << 'CRONEOF'
# ProxPanel: auto-start containers on boot
@reboot sleep 30 && cd /opt/proxpanel && docker compose up -d >> /var/log/proxpanel-autostart.log 2>&1
CRONEOF

    # Cleanup old logs (keep 7 days)
    cat > /etc/cron.d/proxpanel-cleanup << 'CRONEOF'
# ProxPanel: weekly cleanup
0 4 * * 0 find /var/log/proxpanel* -mtime +7 -delete 2>/dev/null
CRONEOF

    chmod 644 /etc/cron.d/proxpanel-*
    log "Cron jobs configured"
}

setup_firewall() {
    step "Checking firewall"

    if command -v ufw &>/dev/null; then
        if ufw status | grep -q "active"; then
            ufw allow 80/tcp 2>/dev/null
            ufw allow 443/tcp 2>/dev/null
            ufw allow 22/tcp 2>/dev/null
            log "UFW: opened ports 80, 443, 22"
        else
            info "UFW is inactive"
        fi
    elif command -v firewall-cmd &>/dev/null; then
        if systemctl is-active firewalld &>/dev/null; then
            firewall-cmd --permanent --add-service=http 2>/dev/null
            firewall-cmd --permanent --add-service=https 2>/dev/null
            firewall-cmd --reload 2>/dev/null
            log "firewalld: opened HTTP/HTTPS"
        fi
    else
        info "No firewall detected (ensure ports 80/443 are open)"
    fi
}

print_summary() {
    clear
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║                                                      ║"
    echo "  ║          ██████╗ ██████╗ ███████╗███╗   ███╗        ║"
    echo "  ║          ██╔══██╗██╔══██╗██╔════╝████╗ ████║        ║"
    echo "  ║          ██████╔╝██████╔╝█████╗  ██╔████╔██║        ║"
    echo "  ║          ██╔═══╝ ██╔══██╗██╔══╝  ██║╚██╔╝██║        ║"
    echo "  ║          ██║     ██║  ██║███████╗██║ ╚═╝ ██║        ║"
    echo "  ║          ╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝        ║"
    echo "  ║          P A N E L   v${VERSION}                      ║"
    echo "  ║                                                      ║"
    echo "  ╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "  ${CYAN}${BOLD}Installation Summary${NC}"
    divider

    echo -e "  ${BOLD}Mode:${NC}         ${INSTALL_MODE}"
    echo -e "  ${BOLD}Panel URL:${NC}    ${GREEN}https://${PANEL_DOMAIN}${NC}"
    echo -e "  ${BOLD}Admin User:${NC}   ${ADMIN_USER}"
    echo -e "  ${BOLD}Grafana:${NC}      https://${PANEL_DOMAIN}/grafana/"
    echo -e "  ${BOLD}Install Dir:${NC}  ${INSTALL_DIR}"

    if [[ "$INSTALL_MODE" != "worker" ]]; then
        echo ""
        echo -e "  ${CYAN}${BOLD}Services${NC}"
        divider
        cd "$INSTALL_DIR"
        docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
        docker compose ps 2>/dev/null
    fi

    echo ""
    echo -e "  ${CYAN}${BOLD}Credentials${NC}"
    divider
    echo -e "  ${BOLD}Database Password:${NC}  ${POSTGRES_PASS}"
    echo -e "  ${BOLD}JWT Secret:${NC}         ${JWT_SECRET:0:16}..."
    echo -e "  ${BOLD}Node Secret:${NC}        ${NODE_SECRET:0:16}..."
    echo -e "  ${BOLD}Grafana Password:${NC}   ${GRAFANA_PASS}"
    echo ""
    warn "Save these credentials! They are also in ${INSTALL_DIR}/.env"

    echo ""
    echo -e "  ${CYAN}${BOLD}Quick Commands${NC}"
    divider
    echo -e "  ${DIM}# View logs${NC}"
    echo -e "  cd ${INSTALL_DIR} && docker compose logs -f"
    echo ""
    echo -e "  ${DIM}# Restart all services${NC}"
    echo -e "  cd ${INSTALL_DIR} && docker compose restart"
    echo ""
    echo -e "  ${DIM}# Update to latest version${NC}"
    echo -e "  cd ${INSTALL_DIR} && git pull && docker compose up -d --build"
    echo ""
    echo -e "  ${DIM}# Check service status${NC}"
    echo -e "  cd ${INSTALL_DIR} && docker compose ps"
    echo ""
    echo -e "  ${DIM}# Database backup${NC}"
    echo -e "  cd ${INSTALL_DIR} && docker compose exec -T postgres pg_dump -U proxpanel proxpanel > backup_\$(date +%Y%m%d).sql"
    echo ""
    echo -e "  ${DIM}# View worker token (for connecting new workers)${NC}"
    echo -e "  grep NODE_RPC_SECRET ${INSTALL_DIR}/.env"
    echo ""
}

# ══════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════

main() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo ""
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║                                                      ║"
    echo "  ║     ProxPanel Installer v${VERSION}                       ║"
    echo "  ║     Commercial Multi-Protocol Proxy Panel            ║"
    echo "  ║                                                      ║"
    echo "  ║     VLESS | Hysteria2 | NaiveProxy | Mieru          ║"
    echo "  ║                                                      ║"
    echo "  ╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # ── Phase 1: System ──
    check_root
    detect_os
    check_system_resources
    install_docker
    check_docker_compose
    check_existing_install

    # ── Phase 2: Configuration ──
    menu_install_mode
    menu_domain

    if [[ "$INSTALL_MODE" != "worker" ]]; then
        menu_admin
        menu_telegram
        menu_billing
        menu_ssl
    fi

    # ── Phase 3: Deploy ──
    generate_env
    copy_project_files

    case "$INSTALL_MODE" in
        all-in-one) deploy_all_in_one ;;
        master)     deploy_master ;;
        worker)     deploy_worker ;;
    esac

    # ── Phase 4: Post-install ──
    setup_cron_jobs
    setup_firewall

    # ── Phase 5: Summary ──
    print_summary
}

# ──── Handle arguments ────

case "${1:-}" in
    --help|-h)
        echo "Usage: sudo bash install.sh"
        echo ""
        echo "Interactive installer for ProxPanel v${VERSION}"
        echo ""
        echo "Modes:"
        echo "  All-in-One  Master + Worker on same server"
        echo "  Master      API + Dashboard + Billing"
        echo "  Worker      Proxy cores only"
        echo ""
        echo "Options:"
        echo "  --help      Show this help"
        echo "  --version   Show version"
        echo ""
        echo "Requirements:"
        echo "  - Root access (sudo)"
        echo "  - 2GB+ RAM recommended"
        echo "  - 20GB+ disk space"
        echo "  - Domain pointed to this server"
        ;;
    --version|-v)
        echo "ProxPanel Installer v${VERSION}"
        ;;
    *)
        main "$@"
        ;;
esac
