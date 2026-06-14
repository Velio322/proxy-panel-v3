# ProxPanel v2.0

Commercial-grade multi-protocol proxy management panel with multi-tenancy, billing, and enterprise features.

## Features

### Core
- **Multi-Protocol**: VLESS (Reality/XTLS-Vision), Hysteria2, NaiveProxy, Mieru, TUIC
- **Master-Node Architecture**: Scalable from single server to hundreds of nodes
- **Port-Sharing (SNI Routing)**: Multiple protocols on single port (e.g., VLESS + Hy2 + Naive on 443)
- **Advanced Tuning**: uTLS fingerprints, SpiderX, ShortIds, custom routing rules

### Commercial
- **Multi-Tenancy**: Super Admin, Admin, Reseller, Operator roles
- **Billing**: CryptoPay, Stripe, Telegram Stars integration
- **Plans & Subscriptions**: Auto-expiry, traffic limits, protocol restrictions
- **White-Label**: Custom logos, colors, company names per reseller
- **i18n**: English, Russian, Chinese, Farsi out of the box

### Monitoring
- **Real-time Dashboard**: Traffic graphs, client stats, node health
- **Prometheus + Grafana**: Native metrics export and dashboards
- **Audit Logs**: Complete action history for all admin operations
- **Node Metrics**: CPU, memory, connections, uptime tracking

### Operations
- **Telegram Bot**: Subscription status, plans, client self-service
- **Backup System**: Auto-backup to Telegram/S3 with scheduling
- **Auto-Update**: Docker-based deployment with health checks
- **Interactive Installer**: One-command deployment for Master/Worker/All-in-One

## Quick Start

### Docker (Recommended)

```bash
git clone <repo-url>
cd proxpanel

cp .env.example .env
# Edit .env with your settings

docker compose up -d

# Run migrations
docker compose exec server npx prisma migrate deploy

# Seed admin user
docker compose exec server npx tsx prisma/seed.ts --username admin --password your_password
```

### Interactive Installer

```bash
sudo bash install.sh
```

The installer will guide you through:
1. Installation mode (All-in-One / Master / Worker)
2. Domain configuration
3. Admin account setup
4. Telegram bot (optional)
5. Payment gateway (optional)
6. SSL certificate setup
7. Docker deployment

## Architecture

```
                    ┌─────────────────┐
                    │   Panel Server   │
                    │    (Master)      │
                    │                  │
                    │  ┌────────────┐  │
                    │  │ PostgreSQL │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │   Redis    │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │  API/REST  │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │  Billing   │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │  Telegram  │  │
                    │  └────────────┘  │
                    └────────┬────────┘
                             │ mTLS / Token
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────┴──────┐ ┌────┴──────┐ ┌─────┴─────┐
       │  Worker #1  │ │ Worker #2 │ │ Worker #N │
       │             │ │           │ │           │
       │  Xray-core  │ │ Xray-core │ │ Xray-core │
       │  sing-box   │ │ sing-box  │ │ sing-box  │
       │  NaiveProxy │ │ Naive     │ │ Naive     │
       │  Mieru      │ │ Mieru     │ │ Mieru     │
       └─────────────┘ └───────────┘ └───────────┘
```

## Project Structure

```
proxpanel/
├── server/                 # Backend (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── master/         # Master server entry
│   │   ├── worker/         # Worker node entry
│   │   ├── config/         # Configuration
│   │   ├── middleware/      # Auth, audit, RBAC
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── lib/            # Redis, Prisma, HTTP utils
│   │   ├── metrics/        # Prometheus metrics
│   │   └── types/          # TypeScript types
│   └── prisma/             # Database schema & migrations
├── client/                 # Frontend (React + Vite + Tailwind + Shadcn)
│   └── src/
│       ├── components/     # UI components
│       ├── pages/          # Route pages
│       └── lib/            # API client, utils
├── config/                 # Prometheus, Grafana configs
├── install.sh              # Interactive installer
└── docker-compose.yml      # Production deployment
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Current user
- `POST /api/v1/auth/logout` - Logout

### Clients
- `GET /api/v1/clients` - List clients (paginated, filterable)
- `POST /api/v1/clients` - Create client
- `PUT /api/v1/clients/:id` - Update client
- `DELETE /api/v1/clients/:id` - Delete client
- `POST /api/v1/clients/:id/reset-traffic` - Reset traffic
- `POST /api/v1/clients/:id/toggle-ban` - Toggle ban
- `GET /api/v1/clients/:id/stats` - Client traffic stats
- `GET /api/v1/clients/:id/traffic-daily` - Daily traffic chart

### Nodes
- `GET /api/v1/nodes` - List nodes
- `POST /api/v1/nodes` - Add node
- `PUT /api/v1/nodes/:id` - Update node
- `DELETE /api/v1/nodes/:id` - Delete node
- `POST /api/v1/nodes/:id/check` - Check status
- `POST /api/v1/nodes/:id/push-config` - Push config
- `POST /api/v1/nodes/:id/restart` - Restart cores
- `POST /api/v1/nodes/:id/stop` - Stop cores
- `GET /api/v1/nodes/:id/metrics` - Node metrics

### Inbounds (Port-Sharing)
- `GET /api/v1/inbounds` - List inbounds
- `POST /api/v1/inbounds` - Create inbound
- `PUT /api/v1/inbounds/:id` - Update inbound
- `DELETE /api/v1/inbounds/:id` - Delete inbound
- `POST /api/v1/inbounds/:id/toggle` - Toggle enable
- `POST /api/v1/inbounds/:id/port-share` - Add port share
- `DELETE /api/v1/inbounds/:id/port-share/:psId` - Remove port share

### Subscription
- `GET /api/v1/client/:subToken/sub` - Get subscription config (Base64/JSON/Clash/Singbox)
- `GET /api/v1/client/:subToken/info` - Get client info

### Plans & Billing
- `GET /api/v1/plans` - List plans
- `POST /api/v1/plans` - Create plan
- `PUT /api/v1/plans/:id` - Update plan
- `DELETE /api/v1/plans/:id` - Delete plan
- `GET /api/v1/billing/invoices` - List invoices
- `POST /api/v1/billing/invoices` - Create invoice
- `POST /api/v1/billing/invoices/:id/pay` - Mark invoice paid
- `GET /api/v1/billing/revenue` - Revenue stats

### Resellers
- `GET /api/v1/resellers` - List resellers
- `POST /api/v1/resellers` - Create reseller
- `PUT /api/v1/resellers/:id` - Update reseller
- `GET /api/v1/resellers/:id/stats` - Reseller dashboard

### Audit & Settings
- `GET /api/v1/audit` - Audit logs (filterable)
- `GET /api/v1/settings` - System settings
- `PUT /api/v1/settings` - Update settings
- `POST /api/v1/backup/trigger` - Trigger backup
- `GET /api/v1/backup/logs` - Backup history

### Monitoring
- `GET /metrics` - Prometheus metrics
- `GET /api/health` - Health check

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + Prisma
- **Frontend**: React + Vite + TailwindCSS + Shadcn/UI
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Monitoring**: Prometheus + Grafana
- **Deployment**: Docker + Docker Compose
- **Proxy Cores**: Xray-core, sing-box, NaiveProxy, Mieru

## License

MIT
