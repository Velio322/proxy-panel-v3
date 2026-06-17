#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 Installer
# ══════════════════════════════════════════════════════════════
# One-liner:
#   bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh)
# ══════════════════════════════════════════════════════════════

set -uo pipefail

REPO="Velio322/proxy-panel-v3"
BRANCH="main"
INSTALL_DIR="/opt/proxpanel"
CLONE_DIR="/tmp/proxpanel-src"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
fail()  { echo -e "${RED}✗ $1${NC}"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}[$1]${NC} ${BOLD}$2${NC}"; }

# ──── Checks ────

[[ $EUID -ne 0 ]] && fail "Run as root: sudo bash <(curl -Ls URL)"

command -v docker &>/dev/null || {
    echo -e "${CYAN}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker &>/dev/null && systemctl start docker
}
docker compose version &>/dev/null || fail "docker compose plugin missing"

command -v git &>/dev/null || {
    apt-get update -qq && apt-get install -y -qq git >/dev/null
}

# ──── Collect info ────

echo -e "\n${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       ProxPanel v3 Installer           ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════╝${NC}\n"

read -rp "  Panel domain (e.g. panel.yourdomain.com): " PANEL_DOMAIN
read -rp "  Admin email (for SSL certificate): " ADMIN_EMAIL
read -rp "  Admin username [admin]: " ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"
read -rp "  Admin password: " ADMIN_PASS

[[ -z "$PANEL_DOMAIN" ]] && fail "Domain required"
[[ -z "$ADMIN_EMAIL" ]] && fail "Email required"
[[ -z "$ADMIN_PASS" ]] && fail "Password required"

# ──── Clone ────

step 1/6 "Downloading source..."
rm -rf "$CLONE_DIR"
git clone --depth 1 -b "$BRANCH" "https://github.com/${REPO}.git" "$CLONE_DIR" || fail "Clone failed"
log "Source downloaded"

# ──── Setup ────

step 2/6 "Setting up..."
mkdir -p "$INSTALL_DIR"
cp -r "$CLONE_DIR"/* "$INSTALL_DIR/"
rm -rf "$CLONE_DIR"

DB_PASS=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
RPC_SECRET=$(openssl rand -hex 32)
ENC_KEY=$(openssl rand -hex 16)

cat > "$INSTALL_DIR/.env" <<EOF
POSTGRES_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT_SECRET}
NODE_RPC_SECRET=${RPC_SECRET}
ENCRYPTION_KEY=${ENC_KEY}
API_URL=https://${PANEL_DOMAIN}
FRONTEND_URL=https://${PANEL_DOMAIN}
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_IDS=
EOF

cat > "$INSTALL_DIR/Caddyfile" <<EOF
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

step 3/6 "Building containers (this takes a few minutes)..."
cd "$INSTALL_DIR"
docker compose build --parallel 2>&1 | tail -5
log "Containers built"

# ──── Start ────

step 4/6 "Starting services..."
docker compose up -d
log "Services started"

# ──── Wait for DB ────

step 5/6 "Waiting for database..."
for i in $(seq 1 30); do
    docker compose exec -T postgres pg_isready -U proxpanel &>/dev/null && break
    sleep 1
done
docker compose exec -T postgres pg_isready -U proxpanel &>/dev/null || fail "Database not ready"
log "Database ready"

# ──── Migrate & Seed ────

step 6/6 "Setting up database..."
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

# ──── Done ────

echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Installation complete!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "  URL:      ${BOLD}https://${PANEL_DOMAIN}${NC}"
echo -e "  Login:    ${BOLD}${ADMIN_USER}${NC}"
echo -e "  Password: ${BOLD}${ADMIN_PASS}${NC}"
echo -e "  Node secret: ${RPC_SECRET}"
echo -e "\n  Config: ${INSTALL_DIR}/.env"
echo ""
