# ProxPanel v3

Multi-protocol proxy management panel.

## Install

```bash
bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install.sh)
```

Script will ask for:
- Domain (e.g. `panel.yourdomain.com`)
- Admin email
- Admin username/password

Then it builds containers, starts services, creates database and admin user.

## Worker install

```bash
bash <(curl -Ls https://raw.githubusercontent.com/Velio322/proxy-panel-v3/main/install-worker.sh) -m https://panel.yourdomain.com -t YOUR_TOKEN
```

## Supported protocols

- VLESS (Reality/XTLS-Vision)
- VMess
- Trojan
- Shadowsocks
- Hysteria2
- NaiveProxy
- Mieru
- TUIC
