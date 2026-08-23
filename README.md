# ProxPanel v3 ⚡

Commercial-grade, high-performance multi-protocol VPN & proxy management panel with native support for Xray-core, sing-box, Caddy and Mieru.

---

## 🚀 Быстрая установка (Fast One-Line Install)

Запустите команду на чистом сервере (Ubuntu 20.04+ / Debian 11+, архитектуры `amd64` / `arm64`):

```bash
bash <(curl -Ls "https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh?v=$(date +%s)")
```

### Режимы установки:
1. **Panel only** — Веб-панель + PostgreSQL + Redis + Caddy (Docker)
2. **Node only** — Демон ноды для удаленного VPS (systemd)
3. **Panel + Node (Рекомендуется)** — All-in-One: Мастер-панель и локальная нода на одном сервере

### Способы доступа к панели:
- **Direct Server IP (как в 3X-UI)** — вход напрямую по `https://<IP_СЕРВЕРА>` со встроенным самоподписанным SSL (`tls internal`). Не требует покупки домена!
- **Domain Name** — автоматический бесплатный Let's Encrypt SSL через ACME.
- **Plain HTTP** — порт 80 без SSL для работы за Cloudflare Flexible или кастомными обратными прокси.

---

## 🧹 Полное удаление всех следов (Purge Uninstaller)

Команда для **полного и бесследного удаления** ProxPanel, Docker-контейнеров, томов БД, ядер, конфигураций и служб с вашего VPS:

```bash
bash <(curl -Ls "https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/uninstall.sh?v=$(date +%s)")
```

> **Тихий режим (без подтверждения):**
> ```bash
> bash <(curl -Ls "https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/uninstall.sh?v=$(date +%s)") -y
> ```

---

## 🛠 Управление через CLI (`vpnpanel`)

После установки доступна глобальная консольная утилита `vpnpanel` (или `proxpanel`):

| Команда | Описание |
| :--- | :--- |
| `vpnpanel status` | Просмотр состояния служб, контейнеров, ОЗУ и активных подключений |
| `vpnpanel doctor` | Полная самодиагностика системы, портов, БД и dry-run тесты конфигов |
| `vpnpanel start` | Запуск всех компонентов панели и ноды |
| `vpnpanel stop` | Остановка всех компонентов |
| `vpnpanel restart` | Перезапуск сервисов панели |
| `vpnpanel logs` | Просмотр логов в реальном времени (`server`, `node`, `caddy`, `db`) |
| `vpnpanel reset-admin` | Сброс логина и пароля администратора |
| `vpnpanel backup` | Создание мгновенного резервного дампа PostgreSQL базы |
| `vpnpanel restore <file>` | Восстановление БД из дампа |
| `vpnpanel bbr` | Проверка и включение оптимизации BBR в ядре Linux |
| `vpnpanel info` | Вывод адреса панели, портов и секретных токенов подключения нод |

---

## 🛡 Поддерживаемые протоколы

- **VLESS** (Reality / XTLS-Vision / gRPC / WebSocket / TCP)
- **Hysteria 2** (высокоскоростной UDP-протокол с маскировкой)
- **TUIC v5** (QUIC-based)
- **Trojan** (gRPC / WebSocket)
- **VMess** (AEAD)
- **Shadowsocks** (2022-blake3, AEAD chacha20, aes-256-gcm)
- **NaïveProxy** (Caddy forwardproxy)
- **Mieru**
