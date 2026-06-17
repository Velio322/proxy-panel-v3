# ProxPanel v3.0

Multi-protocol proxy management panel with master-node architecture, billing, and enterprise features.

## Installation

### One-liner install (panel)

```bash
bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh) -d panel.example.com -e admin@example.com
```

### One-liner install (worker node)

```bash
bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install-worker.sh) -m https://panel.example.com -t YOUR_TOKEN
```

### Interactive install

```bash
bash install.sh
```

## Features

- **Protocols**: VLESS (Reality/XTLS-Vision), VMess, Trojan, Shadowsocks, Hysteria2, NaiveProxy, Mieru, TUIC
- **Architecture**: Master-Node with real-time WebSocket config sync
- **Port-Sharing**: Multiple protocols on single port via SNI routing
- **Multi-Tenancy**: Super Admin, Admin, Reseller, Operator roles
- **Billing**: CryptoPay, Stripe, Telegram Stars
- **Monitoring**: Prometheus + Grafana, real-time dashboard
- **Telegram Bot**: Client self-service, subscription status
- **i18n**: English, Russian, Chinese, Farsi

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + Prisma
- **Frontend**: React + Vite + TailwindCSS + Shadcn/UI
- **Database**: PostgreSQL 16 + Redis 7
- **Proxy Cores**: Xray-core, sing-box, NaiveProxy, Mieru
- **Deployment**: Docker + Docker Compose

## License

MIT
