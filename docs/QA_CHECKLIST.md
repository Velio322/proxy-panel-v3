# Manual QA Checklist — ProxPanel Production Readiness

## ✅ PHASE 1: Authentication & Authorization

### 1.1 Login Flow
- [ ] POST /api/v1/auth/login with valid credentials returns JWT token
- [ ] POST /api/v1/auth/login with wrong password returns 401
- [ ] POST /api/v1/auth/login with non-existent user returns 401
- [ ] GET /api/v1/auth/me with valid token returns user data
- [ ] GET /api/v1/auth/me with expired token returns 401
- [ ] GET /api/v1/auth/me with invalid token returns 401
- [ ] POST /api/v1/auth/logout invalidates session
- [ ] Rate limiting: 10 login attempts per 15 min → 429

### 1.2 RBAC Enforcement
- [ ] SUPER_ADMIN can access all endpoints
- [ ] ADMIN can access users/clients/nodes/plans but NOT settings/backups
- [ ] RESELLER can only see own clients/nodes (resellerId filter)
- [ ] RESELLER cannot access settings/audit/backups
- [ ] OPERATOR has read-only access
- [ ] Role hierarchy: SUPER_ADMIN > ADMIN > RESELLER > OPERATOR
- [ ] Cannot create user with role higher than own

### 1.3 JWT Security
- [ ] Token expires after configured TTL (default 7d)
- [ ] Token payload contains id, username, role
- [ ] Token is validated on every protected request
- [ ] Expired tokens return 401, not 403
- [ ] Token is not logged or stored in plaintext

## ✅ PHASE 2: Client Management

### 2.1 CRUD Operations
- [ ] Create client with username + auto-generated password
- [ ] Create client with custom password
- [ ] Create client with specific protocols (VLESS, Hy2, etc.)
- [ ] Read client with pagination and search
- [ ] Update client (email, note, traffic limit, protocols)
- [ ] Delete client (cascades to settings, traffic logs)
- [ ] Unique username per reseller (resellerId scope)

### 2.2 Traffic Management
- [ ] Traffic limit enforcement (auto-ban when exceeded)
- [ ] Reset traffic counters (usedTraffic, upload, download)
- [ ] Toggle ban/unban
- [ ] Traffic limit notification to Telegram

### 2.3 Subscription Links
- [ ] GET /api/v1/client/:subToken/sub returns Base64 config
- [ ] GET /api/v1/client/:subToken/sub?flag=clash returns Clash config
- [ ] GET /api/v1/client/:subToken/sub?flag=singbox returns Singbox config
- [ ] GET /api/v1/client/:subToken/info returns client info
- [ ] Subscription headers: Profile-Update-Interval, Subscription-Userinfo
- [ ] Expired clients return 403
- [ ] Banned clients return 403
- [ ] Traffic-limited clients return 403

## ✅ PHASE 3: Node Management

### 3.1 Node CRUD
- [ ] Create node with name, host, port, secret
- [ ] Read node with inbounds and status
- [ ] Update node settings
- [ ] Delete node (cascades to inbounds, traffic logs)
- [ ] Check node status (online/offline)

### 3.2 Node Communication
- [ ] Worker → Master: POST /api/v1/nodes/self/config (config sync)
- [ ] Worker → Master: POST /api/v1/nodes/self/status (health report)
- [ ] Worker → Master: POST /api/v1/nodes/self/traffic (traffic stats)
- [ ] Node authentication via X-Node-Secret header
- [ ] Reject requests with invalid secret

### 3.3 Config Push
- [ ] Push config to worker (inbounds + routing)
- [ ] Worker generates valid Xray config.json
- [ ] Worker generates valid sing-box config
- [ ] Worker generates HAProxy config for port-sharing
- [ ] Graceful restart (Xray SIGHUP, others process replacement)

## ✅ PHASE 4: Port-Sharing (SNI Routing)

### 4.1 Port-Sharing Detection
- [ ] Multiple protocols on same port detected automatically
- [ ] Internal ports assigned (127.0.0.1:10xxx)
- [ ] HAProxy config generated with SNI ACLs

### 4.2 HAProxy Config
- [ ] Valid HAProxy config syntax (haproxy -c validation)
- [ ] SNI-based routing rules for each protocol
- [ ] Backend health checks configured
- [ ] Stats endpoint accessible

### 4.3 End-to-End
- [ ] VLESS + Hysteria2 on port 443 → routing by SNI
- [ ] VLESS + Hy2 + NaiveProxy on port 443
- [ ] TLS handshake succeeds for each protocol
- [ ] Traffic routes correctly to internal ports

## ✅ PHASE 5: Routing Rules

### 5.1 Rule Management
- [ ] Create routing rule (domain, IP, protocol, outbound)
- [ ] Edit routing rule
- [ ] Delete routing rule
- [ ] Reorder rules (priority)
- [ ] Toggle rule enable/disable

### 5.2 Presets
- [ ] "Block BitTorrent" creates correct rule
- [ ] "Block Private IPs" creates correct rule
- [ ] "Block Ads" creates correct geosite rule
- [ ] "Direct Local Domains" creates correct rule

### 5.3 Xray Integration
- [ ] Generated rules match Xray routing format
- [ ] Domain matcher (linear/mph) works correctly
- [ ] Logical rules (AND/OR) work correctly

## ✅ PHASE 6: Monitoring & Analytics

### 6.1 Dashboard
- [ ] Overview stats (clients, nodes, traffic, subscriptions)
- [ ] Traffic chart (7/30/90 day)
- [ ] Top clients by traffic
- [ ] Recent audit activity
- [ ] Auto-refresh (30s)

### 6.2 Traffic Analytics
- [ ] Per-node traffic (upload/download)
- [ ] Per-client traffic (upload/download/total)
- [ ] Traffic percentage calculation
- [ ] Real-time chart updates

### 6.3 Node Metrics
- [ ] CPU usage display
- [ ] Memory usage display
- [ ] Connection count
- [ ] Uptime tracking
- [ ] Status indicators (green/amber/red)

## ✅ PHASE 7: Commercial Features

### 7.1 Billing
- [ ] Create plan with price, duration, traffic limit
- [ ] Create subscription for client
- [ ] Renew subscription (extends from current expiry)
- [ ] Cancel subscription
- [ ] Invoice management

### 7.2 White-label
- [ ] Upload logo (data URL)
- [ ] Upload favicon
- [ ] Change primary/secondary colors
- [ ] Custom footer text
- [ ] Live preview updates

### 7.3 i18n
- [ ] Switch to Russian → sidebar translates
- [ ] Switch to Chinese → dashboard translates
- [ ] Switch to Farsi → settings translates
- [ ] Language persists in localStorage

## ✅ PHASE 8: Telegram Bot

### 8.1 Commands
- [ ] /start registers user
- [ ] /link <username> links Telegram to panel account
- [ ] /status shows subscription status
- [ ] /sub shows subscription link
- [ ] /plans shows available plans
- [ ] /lang switches language

### 8.2 Notifications
- [ ] Traffic limit exceeded → user notification + admin alert
- [ ] Subscription expiring (24h) → user notification
- [ ] Subscription expiring (7d) → user notification
- [ ] Node offline → admin alert

## ✅ PHASE 9: Infrastructure

### 9.1 Docker
- [ ] docker compose up starts all services
- [ ] PostgreSQL healthcheck passes
- [ ] Redis healthcheck passes
- [ ] Server healthcheck passes (/api/health)
- [ ] Worker healthcheck passes (/health)

### 9.2 SSL/TLS
- [ ] Caddy obtains Let's Encrypt certificate
- [ ] HTTP → HTTPS redirect works
- [ ] TLS 1.2+ only (no older versions)
- [ ] HSTS header present

### 9.3 Monitoring
- [ ] Prometheus scrapes master metrics
- [ ] Prometheus scrapes node-exporter
- [ ] Grafana dashboard loads
- [ ] Grafana Prometheus datasource configured

### 9.4 Backup
- [ ] Manual backup trigger works
- [ ] Backup log created
- [ ] Cron job configured

## ✅ PHASE 10: Performance

### 10.1 Response Times
- [ ] Login: < 200ms
- [ ] Dashboard overview: < 500ms
- [ ] Client list (20 items): < 300ms
- [ ] Subscription generation: < 100ms
- [ ] Traffic report processing: < 500ms per batch

### 10.2 Concurrency
- [ ] 100 concurrent API requests → no 500 errors
- [ ] 50 concurrent traffic reports → no data loss
- [ ] Database connection pool not exhausted

### 10.3 Memory
- [ ] No memory leaks after 1 hour of operation
- [ ] Process memory stable (< 200MB)
- [ ] No unbounded log growth

## ✅ PHASE 11: Security

### 11.1 API Security
- [ ] Rate limiting active (100 req/15min)
- [ ] Auth rate limiting (10 req/15min)
- [ ] CORS configured correctly
- [ ] Helmet security headers present
- [ ] No sensitive data in logs
- [ ] No SQL injection possible (Prisma parameterized queries)

### 11.2 Data Security
- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] JWT secrets not in source code
- [ ] Database credentials not exposed
- [ ] Node secrets not in public
- [ ] Traffic data encrypted in transit (HTTPS)

### 11.3 Worker Security
- [ ] Node secret validated on every request
- [ ] HMAC token verification
- [ ] IP whitelist functional
- [ ] Request timestamp freshness check

## Sign-Off

| Phase | Status | Tester | Date |
|-------|--------|--------|------|
| Auth & RBAC | ☐ | | |
| Clients | ☐ | | |
| Nodes | ☐ | | |
| Port-Sharing | ☐ | | |
| Routing | ☐ | | |
| Monitoring | ☐ | | |
| Commercial | ☐ | | |
| Telegram | ☐ | | |
| Infrastructure | ☐ | | |
| Performance | ☐ | | |
| Security | ☐ | | |
