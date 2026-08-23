#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════════
# ProxPanel v3 — Health Check & Self-Diagnostic Suite (Doctor)
# ══════════════════════════════════════════════════════════════

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASSED_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
    echo -e "  ${GREEN}[PASS]${NC} $1"
    PASSED_COUNT=$((PASSED_COUNT + 1))
}

warn() {
    echo -e "  ${YELLOW}[WARN]${NC} $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

fail() {
    echo -e "  ${RED}[FAIL]${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

header() {
    echo -e "\n${CYAN}${BOLD}▶ $1${NC}"
}

echo -e "\n${CYAN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║           ProxPanel v3 Health Check & Diagnostics          ║${NC}"
echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"

# ──────────────────────────────────────────────────────────────
# 1. OS & System Architecture
# ──────────────────────────────────────────────────────────────
header "1. System Environment & Kernel Optimizations"

ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64) pass "Architecture: $ARCH (64-bit AMD/Intel)" ;;
    aarch64|arm64) pass "Architecture: $ARCH (64-bit ARM)" ;;
    *) warn "Architecture: $ARCH (non-standard for pre-built binaries)" ;;
esac

if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    pass "Operating System: ${PRETTY_NAME:-$NAME $VERSION}"
else
    warn "Cannot detect OS release (/etc/os-release missing)"
fi

# RAM & Disk
TOTAL_MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
AVAIL_MEM_MB=$(free -m | awk '/^Mem:/{print $7}')
DISK_AVAIL_GB=$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')

if [[ "$TOTAL_MEM_MB" -ge 900 ]]; then
    pass "Memory: ${TOTAL_MEM_MB}MB total (${AVAIL_MEM_MB}MB available)"
else
    warn "Low Memory: ${TOTAL_MEM_MB}MB total. Native/swap mode recommended for <1GB VPS"
fi

if [[ "$DISK_AVAIL_GB" -ge 3 ]]; then
    pass "Disk Space: ${DISK_AVAIL_GB}GB free on root filesystem"
else
    warn "Low Disk Space: ${DISK_AVAIL_GB}GB free. Clean up Docker images or old logs"
fi

# BBR Congestion Control
TCP_CONG=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo "unknown")
if [[ "$TCP_CONG" == "bbr" ]]; then
    pass "BBR Congestion Control: ACTIVE (optimal WAN proxy throughput)"
else
    warn "BBR Congestion Control: INACTIVE (current: $TCP_CONG). Run 'vpnpanel bbr' to enable"
fi

# File Descriptors Limit
MAX_NOFILE=$(ulimit -n 2>/dev/null || echo "1024")
if [[ "$MAX_NOFILE" -ge 65535 ]]; then
    pass "File Descriptor Limit: $MAX_NOFILE (high-concurrency ready)"
else
    warn "File Descriptor Limit: $MAX_NOFILE (recommended: >= 65536)"
fi

# ──────────────────────────────────────────────────────────────
# 2. Proxy Core Binaries
# ──────────────────────────────────────────────────────────────
header "2. Proxy Core Binaries & Permissions"

# Xray
if [[ -x /usr/local/bin/xray ]]; then
    XRAY_V=$(/usr/local/bin/xray version 2>&1 | head -1 || echo "unknown")
    pass "Xray-core: INSTALLED ($XRAY_V)"
else
    warn "Xray-core: NOT FOUND at /usr/local/bin/xray"
fi

# sing-box
if [[ -x /usr/local/bin/sing-box ]]; then
    SING_V=$(/usr/local/bin/sing-box version 2>&1 | head -1 || echo "unknown")
    pass "sing-box: INSTALLED ($SING_V)"
else
    warn "sing-box: NOT FOUND at /usr/local/bin/sing-box"
fi

# Mieru
if [[ -x /usr/local/bin/mieru ]]; then
    MIERU_V=$(/usr/local/bin/mieru version 2>&1 | head -1 || echo "installed")
    pass "Mieru: INSTALLED ($MIERU_V)"
else
    warn "Mieru: Standalone binary not found (handled via sing-box or needs install)"
fi

# Caddy / NaïveProxy
if [[ -x /usr/local/bin/caddy ]]; then
    CADDY_V=$(/usr/local/bin/caddy version 2>&1 | head -1 || echo "installed")
    pass "Caddy (NaïveProxy): INSTALLED ($CADDY_V)"
elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q "proxpanel-caddy"; then
    pass "Caddy: RUNNING in Docker container (proxpanel-caddy)"
else
    warn "Caddy / NaïveProxy binary not found standalone"
fi

# ──────────────────────────────────────────────────────────────
# 3. Running Services & Health Checks
# ──────────────────────────────────────────────────────────────
header "3. System Services & Container Status"

PANEL_MODE="none"

if command -v docker &>/dev/null && [[ -f /opt/proxpanel/docker-compose.yml ]]; then
    PANEL_MODE="docker"
    pass "Deployment Type: Docker Compose (/opt/proxpanel)"

    for c in proxpanel-db proxpanel-redis proxpanel-server proxpanel-client proxpanel-caddy; do
        if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
            pass "Container [${c}]: RUNNING"
        else
            warn "Container [${c}]: NOT RUNNING"
        fi
    done
elif systemctl list-unit-files proxpanel-master.service &>/dev/null 2>&1; then
    PANEL_MODE="systemd"
    pass "Deployment Type: Native Systemd (/opt/proxpanel)"

    if systemctl is-active --quiet proxpanel-master; then
        pass "Service [proxpanel-master]: ACTIVE"
    else
        fail "Service [proxpanel-master]: INACTIVE"
    fi
fi

# Check Node Worker service
if systemctl list-unit-files proxpanel-node.service &>/dev/null 2>&1; then
    if systemctl is-active --quiet proxpanel-node; then
        pass "Service [proxpanel-node]: ACTIVE"
    else
        warn "Service [proxpanel-node]: INACTIVE"
    fi
fi

# ──────────────────────────────────────────────────────────────
# 4. Network Ports & Connectivity
# ──────────────────────────────────────────────────────────────
header "4. Network Ports & Listener Verification"

check_port() {
    local PORT=$1
    local DESC=$2
    if command -v ss &>/dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
            pass "Port ${PORT} (${DESC}): LISTENING"
            return 0
        fi
    elif command -v netstat &>/dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":${PORT} "; then
            pass "Port ${PORT} (${DESC}): LISTENING"
            return 0
        fi
    fi
    warn "Port ${PORT} (${DESC}): NOT LISTENING"
    return 1
}

check_port 80 "HTTP / ACME Challenge" || true
check_port 443 "HTTPS / Proxy & Web" || true
check_port 3000 "Panel Backend API" || true
check_port 2087 "Node Worker Daemon" || true

# ──────────────────────────────────────────────────────────────
# 5. Database Connection & Schema Health
# ──────────────────────────────────────────────────────────────
header "5. Database Connectivity & Data Health"

DB_CHECK_OK=0
if [[ "$PANEL_MODE" == "docker" ]]; then
    if docker compose -f /opt/proxpanel/docker-compose.yml exec -T postgres pg_isready -U proxpanel &>/dev/null; then
        pass "PostgreSQL: READY (Docker)"
        DB_CHECK_OK=1
    fi
elif command -v pg_isready &>/dev/null; then
    if pg_isready -h 127.0.0.1 -p 5432 &>/dev/null; then
        pass "PostgreSQL: READY (Local)"
        DB_CHECK_OK=1
    fi
fi

if [[ $DB_CHECK_OK -eq 0 ]]; then
    warn "PostgreSQL status check could not be verified directly"
fi

# HTTP Health endpoint check
if curl -sf http://127.0.0.1:3000/api/health &>/dev/null; then
    pass "Backend Health Endpoint (http://127.0.0.1:3000/api/health): 200 OK"
elif curl -sf http://localhost:3000/api/health &>/dev/null; then
    pass "Backend Health Endpoint (http://localhost:3000/api/health): 200 OK"
else
    warn "Backend Health Endpoint: Unreachable or not responding"
fi

# ──────────────────────────────────────────────────────────────
# 6. Core Config Dry-Run & Schema Validation
# ──────────────────────────────────────────────────────────────
header "6. Proxy Core Configuration Dry-Run Validation"

TEMP_DIR="/tmp/proxpanel-check-$$"
mkdir -p "$TEMP_DIR"

# ── Test Xray VLESS Reality Config ──
if [[ -x /usr/local/bin/xray ]]; then
    cat > "$TEMP_DIR/xray-test.json" <<'EOF'
{
  "log": { "loglevel": "none" },
  "inbounds": [
    {
      "port": 54321,
      "protocol": "vless",
      "settings": {
        "clients": [{ "id": "b831381d-6324-4d53-ad4f-8cda48b30811", "flow": "xtls-rprx-vision" }],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "www.microsoft.com:443",
          "xver": 0,
          "serverNames": ["www.microsoft.com"],
          "privateKey": "aGFzaGtleXRlc3Rmb3J2YWxpZGF0aW9ucHVycG9zZXM=",
          "shortIds": ["0123456789abcdef"]
        }
      }
    }
  ],
  "outbounds": [{ "protocol": "freedom", "tag": "direct" }]
}
EOF
    if /usr/local/bin/xray -test -config "$TEMP_DIR/xray-test.json" &>/dev/null; then
        pass "Xray Config Validation (VLESS Reality): VALID"
    else
        warn "Xray Config Validation: Parser returned warning/error"
    fi
fi

# ── Test sing-box Hysteria2 & TUIC Config ──
if [[ -x /usr/local/bin/sing-box ]]; then
    cat > "$TEMP_DIR/singbox-test.json" <<'EOF'
{
  "log": { "level": "panic" },
  "inbounds": [
    {
      "type": "hysteria2",
      "tag": "hy2-in",
      "listen": "::",
      "listen_port": 54322,
      "users": [{ "password": "testpassword123" }],
      "tls": {
        "enabled": true,
        "server_name": "example.com"
      }
    }
  ],
  "outbounds": [{ "type": "direct", "tag": "direct" }]
}
EOF
    if /usr/local/bin/sing-box check -c "$TEMP_DIR/singbox-test.json" &>/dev/null; then
        pass "sing-box Config Validation (Hysteria 2): VALID"
    else
        warn "sing-box Config Validation: Check reported issue"
    fi
fi

# ── Test Mieru JSON Config ──
if [[ -x /usr/local/bin/mieru ]]; then
    cat > "$TEMP_DIR/mieru-test.json" <<'EOF'
{
  "portBindings": [
    { "port": 54323, "protocol": "TCP" },
    { "port": 54323, "protocol": "UDP" }
  ],
  "users": [
    { "name": "testuser", "password": "testpassword" }
  ],
  "loggingLevel": "INFO"
}
EOF
    if /usr/local/bin/mieru check -c "$TEMP_DIR/mieru-test.json" &>/dev/null; then
        pass "Mieru Config Validation: VALID"
    else
        warn "Mieru Config Validation: Check failed"
    fi
fi

# Cleanup
rm -rf "$TEMP_DIR"

# ──────────────────────────────────────────────────────────────
# Scorecard Summary
# ──────────────────────────────────────────────────────────────
echo -e "\n${CYAN}${BOLD}════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Diagnostics Summary:${NC} ${GREEN}${PASSED_COUNT} Passed${NC}, ${YELLOW}${WARN_COUNT} Warnings${NC}, ${RED}${FAIL_COUNT} Failed${NC}"

if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}${BOLD}✓ System is healthy and operational!${NC}"
else
    echo -e "${RED}${BOLD}✗ System has issues requiring attention. Inspect the FAIL logs above.${NC}"
fi
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════${NC}\n"

exit "$FAIL_COUNT"
