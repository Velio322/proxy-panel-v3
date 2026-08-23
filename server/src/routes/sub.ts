import { Router, Request, Response } from 'express';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../lib/redis';

const router = Router();

// ──────────────────────────────────────────────
// User-Agent format auto-detection
// ──────────────────────────────────────────────
function detectFormat(userAgent: string, explicitFlag?: string): string {
  if (explicitFlag) return explicitFlag.toLowerCase();
  const ua = (userAgent || '').toLowerCase();

  if (ua.includes('clash') || ua.includes('mihomo') || ua.includes('stash') || ua.includes('flclash')) {
    return 'clash';
  }
  if (ua.includes('sing-box') || ua.includes('sfa') || ua.includes('sfi') || ua.includes('karing') || ua.includes('nekoray') || ua.includes('nekobox')) {
    return 'singbox';
  }
  if (ua.includes('xray') || ua.includes('v2rayn') || ua.includes('v2rayng')) {
    return 'base64';
  }
  return 'base64';
}

// ──────────────────────────────────────────────
// Subscription endpoint (public — auth via subToken)
// GET /api/v1/client/:subToken/sub
// ──────────────────────────────────────────────

router.get('/:subToken/sub', async (req: Request, res: Response) => {
  try {
    const subToken = req.params.subToken as string;
    const explicitFlag = req.query.flag as string | undefined;
    const userAgent = req.headers['user-agent'] || '';
    const format = detectFormat(userAgent, explicitFlag);

    const prisma = getPrisma();

    // Find client by subToken
    const client = await prisma.client.findUnique({
      where: { subToken },
      include: { settings: true },
    });

    if (!client) {
      return res.status(404).send('Client not found');
    }

    if (client.banned) {
      return res.status(403).send('Client is banned');
    }

    if (client.expireAt && client.expireAt < new Date()) {
      return res.status(403).send('Subscription expired');
    }

    if (client.trafficLimit > 0n && client.usedTraffic >= client.trafficLimit) {
      return res.status(403).send('Traffic limit exceeded');
    }

    // Check cache for generated output
    const cacheKey = `sub:${subToken}:${format}`;
    const cached = await cacheGet<string>(cacheKey);
    if (cached) {
      setSubscriptionHeaders(res, client, format);
      return res.send(cached);
    }

    // Get allowed protocols
    const allowedProtocols = (client.protocols as string[]) || ['VLESS', 'HYSTERIA2', 'TROJAN', 'SHADOWSOCKS', 'NAIVEPROXY', 'MIERU'];

    // Get all enabled inbounds matching client's protocols from ONLINE nodes
    const inbounds = await prisma.inbound.findMany({
      where: {
        enable: true,
        protocol: { in: allowedProtocols as any[] },
        node: { status: 'ONLINE', active: true },
      },
      include: {
        node: {
          select: { id: true, name: true, host: true, port: true, status: true },
        },
        portShares: {
          where: { enable: true },
        },
      },
    });

    if (inbounds.length === 0) {
      return res.status(503).send('No online nodes available');
    }

    // Build subscription entries
    const entries: SubscriptionEntry[] = [];

    for (const inbound of inbounds) {
      const entry = buildSubscriptionEntry(inbound, client);
      if (entry) entries.push(entry);

      // Also add port-share entries (different SNI/host on same port)
      for (const ps of inbound.portShares) {
        const psEntry = buildPortShareEntry(inbound, ps, client);
        if (psEntry) entries.push(psEntry);
      }
    }

    // Generate output in requested format
    let output: string;
    switch (format) {
      case 'json':
        output = JSON.stringify({
          client: {
            username: client.username,
            uuid: client.uuid,
            upload: Number(client.uploadTraffic),
            download: Number(client.downloadTraffic),
            total: Number(client.trafficLimit),
            expire: client.expireAt ? Math.floor(client.expireAt.getTime() / 1000) : 0,
          },
          proxies: entries.map((e) => e.raw),
        }, null, 2);
        break;

      case 'clash':
        output = generateClashYaml(entries, client.username);
        break;

      case 'singbox':
        output = generateSingboxJson(entries, client.username);
        break;

      case 'xray':
      case 'v2ray':
        output = generateXrayClientJson(entries, client);
        break;

      case 'raw':
        output = entries.map((e) => e.raw).join('\n');
        break;

      case 'base64':
      default:
        output = generateBase64(entries);
        break;
    }

    // Cache for 5 minutes
    await cacheSet(cacheKey, output, 300);

    // Update last active
    await prisma.client.update({
      where: { id: client.id },
      data: { lastActiveAt: new Date() },
    });

    setSubscriptionHeaders(res, client, format);
    res.send(output);
  } catch (error: any) {
    console.error('[Sub] Error:', error);
    res.status(500).send('Internal server error');
  }
});

function setSubscriptionHeaders(res: Response, client: any, format: string) {
  const upload = client.uploadTraffic !== undefined && client.uploadTraffic !== null ? Number(client.uploadTraffic) : 0;
  const download = client.downloadTraffic !== undefined && client.downloadTraffic !== null ? Number(client.downloadTraffic) : 0;
  const total = client.trafficLimit !== undefined && client.trafficLimit !== null ? Number(client.trafficLimit) : 0;
  const expire = client.expireAt ? Math.floor(new Date(client.expireAt).getTime() / 1000) : 0;

  if (format === 'clash') {
    res.set('Content-Type', 'application/x-yaml; charset=utf-8');
  } else if (format === 'singbox' || format === 'xray' || format === 'json') {
    res.set('Content-Type', 'application/json; charset=utf-8');
  } else {
    res.set('Content-Type', 'text/plain; charset=utf-8');
  }

  res.set('Profile-Update-Interval', '12');
  res.set('Profile-Title', `ProxPanel - ${client.username}`);
  res.set('Subscription-Userinfo', `upload=${upload}; download=${download}; total=${total}; expire=${expire}`);
  res.set('Content-Disposition', `attachment; filename="${client.username}"`);
}

// ──────────────────────────────────────────────
// Client info via sub token
// GET /api/v1/client/:subToken/info
// ──────────────────────────────────────────────

router.get('/:subToken/info', async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const client = await prisma.client.findUnique({
      where: { subToken: req.params.subToken as string },
      select: {
        username: true, uuid: true, trafficLimit: true, usedTraffic: true,
        uploadTraffic: true, downloadTraffic: true, expireAt: true,
        banned: true, lastActiveAt: true, createdAt: true,
        protocols: true, subToken: true,
      },
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });

    const onlineNodes = await prisma.node.count({
      where: { status: 'ONLINE', active: true },
    });

    res.json({
      ...serializeBigInt(client),
      onlineNodes,
      trafficPercent: client.trafficLimit > 0n
        ? Math.round((Number(client.usedTraffic) / Number(client.trafficLimit)) * 10000) / 100
        : 0,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// Regenerate sub token
// POST /api/v1/client/:subToken/regenerate
// ──────────────────────────────────────────────

router.post('/:subToken/regenerate', async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const { v4: uuidv4 } = require('uuid');

    const client = await prisma.client.findUnique({
      where: { subToken: req.params.subToken as string },
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });

    const newToken = uuidv4();

    await prisma.client.update({
      where: { id: client.id },
      data: { subToken: newToken },
    });

    await cacheInvalidatePattern(`sub:${req.params.subToken}*`);

    res.json({ subToken: newToken });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// Subscription entry types
// ──────────────────────────────────────────────

interface SubscriptionEntry {
  protocol: string;
  tag: string;
  host: string;
  port: number;
  raw: string; // URI string
  inbound: any;
  client: any;
}

// ──────────────────────────────────────────────
// Build subscription entry from inbound
// ──────────────────────────────────────────────

function buildSubscriptionEntry(inbound: any, client: any): SubscriptionEntry | null {
  const settings = (inbound.settings as Record<string, any>) || {};
  const stream = (inbound.stream as Record<string, any>) || {};
  const node = inbound.node;
  const addr = node.host;
  const port = inbound.port;
  const tag = `${node.name || 'Node'} - ${inbound.tag}`;

  const userId = client.uuid || settings.id;
  const password = client.password || settings.password || client.uuid;

  let raw = '';
  switch (inbound.protocol) {
    case 'VLESS':
      raw = buildVlessUri(userId, addr, port, stream, tag);
      break;
    case 'VMESS':
      raw = buildVmessUri(userId, addr, port, stream, tag);
      break;
    case 'TROJAN':
      raw = buildTrojanUri(password, addr, port, stream, tag);
      break;
    case 'SHADOWSOCKS':
      raw = buildShadowsocksUri(settings, addr, port, tag);
      break;
    case 'HYSTERIA2':
      raw = buildHysteria2Uri(password, addr, port, settings, tag);
      break;
    case 'NAIVEPROXY':
      raw = buildNaiveUri(settings, client, addr, port, tag);
      break;
    case 'MIERU':
      raw = buildMieruUri(settings, client, addr, port, tag);
      break;
    case 'TUIC':
      raw = buildTuicUri(userId, password, addr, port, settings, tag);
      break;
    default:
      return null;
  }

  return {
    protocol: inbound.protocol,
    tag,
    host: addr,
    port,
    raw,
    inbound,
    client,
  };
}

function buildPortShareEntry(inbound: any, ps: any, client: any): SubscriptionEntry | null {
  const settings = { ...(inbound.settings || {}), ...(ps.settings || {}) };
  const stream = { ...(inbound.stream || {}), ...(ps.stream || {}) };
  const node = inbound.node;
  const addr = node.host;
  const port = inbound.port;
  const tag = `${node.name || 'Node'} - ${ps.tag}`;

  const userId = client.uuid || settings.id;
  const password = client.password || settings.password || client.uuid;

  if (ps.host) stream.sni = ps.host;
  if (ps.path) {
    if (stream.network === 'grpc') {
      stream.grpcSettings = { ...(stream.grpcSettings || {}), serviceName: ps.path };
    } else {
      stream.wsSettings = { ...(stream.wsSettings || {}), path: ps.path };
      stream.path = ps.path;
    }
  }

  let raw = '';
  switch (ps.protocol) {
    case 'VLESS':
      raw = buildVlessUri(userId, addr, port, stream, tag);
      break;
    case 'VMESS':
      raw = buildVmessUri(userId, addr, port, stream, tag);
      break;
    case 'TROJAN':
      raw = buildTrojanUri(password, addr, port, stream, tag);
      break;
    case 'SHADOWSOCKS':
      raw = buildShadowsocksUri(settings, addr, port, tag);
      break;
    case 'HYSTERIA2':
      raw = buildHysteria2Uri(password, addr, port, settings, tag);
      break;
    case 'NAIVEPROXY':
      raw = buildNaiveUri(settings, client, addr, port, tag);
      break;
    default:
      return null;
  }

  return {
    protocol: ps.protocol,
    tag,
    host: addr,
    port,
    raw,
    inbound,
    client,
  };
}

// ──────────────────────────────────────────────
// URI Generators
// ──────────────────────────────────────────────

function buildVlessUri(uuid: string, host: string, port: number, stream: any, tag: string): string {
  const params = new URLSearchParams();
  const network = stream.network || 'tcp';
  params.set('type', network);

  const security = stream.security || 'none';
  params.set('security', security);

  if (security === 'tls') {
    if (stream.sni) params.set('sni', stream.sni);
    if (stream.fingerprint) params.set('fp', stream.fingerprint);
    if (stream.alpn) params.set('alpn', Array.isArray(stream.alpn) ? stream.alpn.join(',') : stream.alpn);
    if (stream.allowInsecure) params.set('allowInsecure', '1');
  }

  if (security === 'reality') {
    if (stream.sni) params.set('sni', stream.sni);
    if (stream.fingerprint) params.set('fp', stream.fingerprint);
    if (stream.publicKey) params.set('pbk', stream.publicKey);
    if (stream.shortId) params.set('sid', stream.shortId);
    if (stream.spiderX) params.set('spx', stream.spiderX);
  }

  if (stream.flow) params.set('flow', stream.flow);

  if (network === 'ws') {
    params.set('path', stream.wsSettings?.path || stream.path || '/');
    if (stream.wsSettings?.host) params.set('host', stream.wsSettings.host);
  }

  if (network === 'grpc') {
    params.set('serviceName', stream.grpcSettings?.serviceName || stream.serviceName || '');
  }

  if (network === 'h2') {
    params.set('path', stream.httpSettings?.path || stream.path || '/');
    if (stream.httpSettings?.host) params.set('host', Array.isArray(stream.httpSettings.host) ? stream.httpSettings.host[0] : stream.httpSettings.host);
  }

  if (network === 'httpupgrade') {
    params.set('path', stream.httpupgradeSettings?.path || stream.path || '/');
    if (stream.httpupgradeSettings?.host) params.set('host', stream.httpupgradeSettings.host);
  }

  if (network === 'xhttp') {
    params.set('path', stream.xhttpSettings?.path || stream.path || '');
    if (stream.xhttpSettings?.mode) params.set('mode', stream.xhttpSettings.mode);
  }

  const query = params.toString();
  return `vless://${uuid}@${host}:${port}?${query}#${encodeURIComponent(tag)}`;
}

function buildVmessUri(uuid: string, host: string, port: number, stream: any, tag: string): string {
  const vmessObj = {
    v: '2',
    ps: tag,
    add: host,
    port: String(port),
    id: uuid,
    aid: String(stream.alterId || 0),
    scy: stream.security || 'auto',
    net: stream.network || 'tcp',
    type: stream.kcpSettings?.headerType || 'none',
    host: stream.wsSettings?.host || stream.httpSettings?.host || '',
    path: stream.wsSettings?.path || stream.grpcSettings?.serviceName || stream.path || '',
    tls: stream.security === 'tls' || stream.security === 'reality' ? 'tls' : '',
    sni: stream.sni || '',
    fp: stream.fingerprint || '',
    alpn: stream.alpn ? (Array.isArray(stream.alpn) ? stream.alpn.join(',') : stream.alpn) : '',
    ver: stream.security === 'reality' ? 'pbk' : '',
  };

  return 'vmess://' + Buffer.from(JSON.stringify(vmessObj)).toString('base64');
}

function buildTrojanUri(password: string, host: string, port: number, stream: any, tag: string): string {
  const params = new URLSearchParams();
  params.set('type', stream.network || 'tcp');
  params.set('security', stream.security || 'tls');

  if (stream.sni) params.set('sni', stream.sni);
  if (stream.fingerprint) params.set('fp', stream.fingerprint);
  if (stream.alpn) params.set('alpn', Array.isArray(stream.alpn) ? stream.alpn.join(',') : stream.alpn);

  if (stream.network === 'ws') {
    params.set('path', stream.wsSettings?.path || '/');
  }
  if (stream.network === 'grpc') {
    params.set('serviceName', stream.grpcSettings?.serviceName || '');
  }

  const query = params.toString();
  return `trojan://${password}@${host}:${port}?${query}#${encodeURIComponent(tag)}`;
}

function buildShadowsocksUri(settings: any, host: string, port: number, tag: string): string {
  const method = settings.method || 'aes-256-gcm';
  const password = settings.password || '';
  const userinfo = Buffer.from(`${method}:${password}`).toString('base64');
  return `ss://${userinfo}@${host}:${port}#${encodeURIComponent(tag)}`;
}

function buildHysteria2Uri(password: string, host: string, port: number, settings: any, tag: string): string {
  const params = new URLSearchParams();
  if (settings.sni) params.set('sni', settings.sni);
  if (settings.allowInsecure) params.set('insecure', '1');
  if (settings.obfs?.type && settings.obfs.type !== 'none') {
    params.set('obfs', settings.obfs.type);
    if (settings.obfs.password) params.set('obfs-password', settings.obfs.password);
  }

  const query = params.toString();
  return `hy2://${password}@${host}:${port}${query ? '?' + query : ''}#${encodeURIComponent(tag)}`;
}

function buildNaiveUri(settings: any, client: any, host: string, port: number, tag: string): string {
  const username = client.username || settings.username || 'user';
  const password = client.password || settings.password || 'password';
  const domain = settings.domain || settings.sni || host;

  const params = new URLSearchParams();
  if (domain && domain !== host) params.set('sni', domain);
  const query = params.toString();

  return `naive+https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}${query ? '?' + query : ''}#${encodeURIComponent(tag)}`;
}

function buildMieruUri(settings: any, client: any, host: string, port: number, tag: string): string {
  const username = client.username || settings.username || 'user';
  const password = client.password || settings.password || 'password';
  const transport = (settings.transport || 'tcp').toLowerCase();
  const domain = settings.domain || host;

  return `mieru://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${domain}:${port}?transport=${transport}#${encodeURIComponent(tag)}`;
}

function buildTuicUri(uuid: string, pass: string, host: string, port: number, settings: any, tag: string): string {
  const params = new URLSearchParams();
  if (settings.sni) params.set('sni', settings.sni);
  params.set('congestion_control', settings.congestion_control || 'bbr');
  if (settings.alpn) params.set('alpn', 'h3');
  return `tuic://${uuid}:${pass}@${host}:${port}?${params.toString()}#${encodeURIComponent(tag)}`;
}

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────

function generateBase64(entries: SubscriptionEntry[]): string {
  const lines = entries.map((e) => e.raw).filter(Boolean);
  return Buffer.from(lines.join('\n')).toString('base64');
}

// ── Clash / Mihomo YAML Generator ──
function generateClashYaml(entries: SubscriptionEntry[], username: string): string {
  const proxies: any[] = [];

  for (const entry of entries) {
    const raw = entry.raw;
    const { protocol, host, port, tag, inbound } = entry;
    const settings = inbound.settings || {};
    const stream = inbound.stream || {};

    if (protocol === 'VLESS') {
      const params = extractParams(raw);
      const uuid = extractUserFromUri(raw);
      const proxy: any = {
        name: tag,
        type: 'vless',
        server: host,
        port,
        uuid,
        network: params.type || 'tcp',
      };

      if (params.flow) proxy.flow = params.flow;

      if (params.security === 'reality') {
        proxy.tls = true;
        proxy.servername = params.sni || host;
        proxy['client-fingerprint'] = params.fp || 'chrome';
        proxy['reality-opts'] = {
          'public-key': params.pbk || '',
          'short-id': params.sid || '',
        };
      } else if (params.security === 'tls') {
        proxy.tls = true;
        proxy.servername = params.sni || host;
        proxy['client-fingerprint'] = params.fp || 'chrome';
        if (params.allowInsecure === '1') proxy['skip-cert-verify'] = true;
      }

      if (params.type === 'ws') {
        proxy['ws-opts'] = {
          path: params.path || '/',
          headers: params.host ? { Host: params.host } : {},
        };
      } else if (params.type === 'grpc') {
        proxy['grpc-opts'] = {
          'grpc-service-name': params.serviceName || '',
        };
      } else if (params.type === 'h2') {
        proxy['h2-opts'] = {
          path: params.path || '/',
          host: params.host ? [params.host] : [host],
        };
      } else if (params.type === 'httpupgrade') {
        proxy['httpupgrade-opts'] = {
          path: params.path || '/',
          host: params.host || host,
        };
      }

      proxies.push(proxy);
    } else if (protocol === 'HYSTERIA2') {
      const params = extractParams(raw);
      const pass = extractPassFromUri(raw);
      const proxy: any = {
        name: tag,
        type: 'hysteria2',
        server: host,
        port,
        password: pass,
        sni: params.sni || host,
        'skip-cert-verify': params.insecure === '1',
      };
      if (params.obfs) {
        proxy.obfs = params.obfs;
        proxy['obfs-password'] = params['obfs-password'] || '';
      }
      proxies.push(proxy);
    } else if (protocol === 'TROJAN') {
      const params = extractParams(raw);
      const pass = extractPassFromUri(raw);
      const proxy: any = {
        name: tag,
        type: 'trojan',
        server: host,
        port,
        password: pass,
        sni: params.sni || host,
        network: params.type || 'tcp',
      };
      if (params.type === 'ws') {
        proxy['ws-opts'] = { path: params.path || '/' };
      } else if (params.type === 'grpc') {
        proxy['grpc-opts'] = { 'grpc-service-name': params.serviceName || '' };
      }
      proxies.push(proxy);
    } else if (protocol === 'SHADOWSOCKS') {
      const proxy = {
        name: tag,
        type: 'ss',
        server: host,
        port,
        cipher: extractSsMethod(raw),
        password: extractSsPassword(raw),
      };
      proxies.push(proxy);
    } else if (protocol === 'TUIC') {
      const pass = extractPassFromUri(raw);
      const uuid = extractUserFromUri(raw);
      const proxy = {
        name: tag,
        type: 'tuic',
        server: host,
        port,
        uuid: uuid || settings.id,
        password: pass || settings.password,
        'congestion-controller': settings.congestion_control || 'bbr',
        sni: settings.sni || host,
      };
      proxies.push(proxy);
    }
  }

  const proxyNames = proxies.map((p) => p.name);

  // Manual YAML string generation ensuring full compatibility
  let yaml = '';
  yaml += `# ProxPanel Clash.Meta / Mihomo Configuration for ${username}\n`;
  yaml += `port: 7890\n`;
  yaml += `socks-port: 7891\n`;
  yaml += `mixed-port: 7890\n`;
  yaml += `allow-lan: false\n`;
  yaml += `mode: rule\n`;
  yaml += `log-level: info\n`;
  yaml += `ipv6: false\n`;
  yaml += `external-controller: 127.0.0.1:9090\n\n`;

  yaml += `dns:\n`;
  yaml += `  enable: true\n`;
  yaml += `  ipv6: false\n`;
  yaml += `  enhanced-mode: fake-ip\n`;
  yaml += `  nameserver:\n`;
  yaml += `    - 8.8.8.8\n`;
  yaml += `    - 1.1.1.1\n`;
  yaml += `  fallback:\n`;
  yaml += `    - https://dns.cloudflare.com/dns-query\n`;
  yaml += `    - https://dns.google/dns-query\n\n`;

  yaml += `proxies:\n`;
  for (const p of proxies) {
    yaml += `  - name: "${p.name}"\n`;
    yaml += `    type: ${p.type}\n`;
    yaml += `    server: "${p.server}"\n`;
    yaml += `    port: ${p.port}\n`;

    if (p.uuid) yaml += `    uuid: "${p.uuid}"\n`;
    if (p.password) yaml += `    password: "${p.password}"\n`;
    if (p.cipher) yaml += `    cipher: "${p.cipher}"\n`;
    if (p.network) yaml += `    network: ${p.network}\n`;
    if (p.tls) yaml += `    tls: true\n`;
    if (p.flow) yaml += `    flow: ${p.flow}\n`;
    if (p.servername) yaml += `    servername: "${p.servername}"\n`;
    if (p.sni) yaml += `    sni: "${p.sni}"\n`;
    if (p['client-fingerprint']) yaml += `    client-fingerprint: ${p['client-fingerprint']}\n`;
    if (p['skip-cert-verify']) yaml += `    skip-cert-verify: true\n`;
    if (p.obfs) yaml += `    obfs: ${p.obfs}\n`;
    if (p['obfs-password']) yaml += `    obfs-password: "${p['obfs-password']}"\n`;
    if (p['congestion-controller']) yaml += `    congestion-controller: ${p['congestion-controller']}\n`;

    if (p['reality-opts']) {
      yaml += `    reality-opts:\n`;
      yaml += `      public-key: "${p['reality-opts']['public-key']}"\n`;
      yaml += `      short-id: "${p['reality-opts']['short-id']}"\n`;
    }
    if (p['ws-opts']) {
      yaml += `    ws-opts:\n`;
      yaml += `      path: "${p['ws-opts'].path}"\n`;
      if (p['ws-opts'].headers?.Host) {
        yaml += `      headers:\n`;
        yaml += `        Host: "${p['ws-opts'].headers.Host}"\n`;
      }
    }
    if (p['grpc-opts']) {
      yaml += `    grpc-opts:\n`;
      yaml += `      grpc-service-name: "${p['grpc-opts']['grpc-service-name']}"\n`;
    }
    yaml += `\n`;
  }

  yaml += `proxy-groups:\n`;
  yaml += `  - name: PROXY\n`;
  yaml += `    type: select\n`;
  yaml += `    proxies:\n`;
  yaml += `      - AUTO\n`;
  for (const name of proxyNames) {
    yaml += `      - "${name}"\n`;
  }
  yaml += `      - DIRECT\n\n`;

  yaml += `  - name: AUTO\n`;
  yaml += `    type: url-test\n`;
  yaml += `    url: http://www.gstatic.com/generate_204\n`;
  yaml += `    interval: 300\n`;
  yaml += `    tolerance: 50\n`;
  yaml += `    proxies:\n`;
  for (const name of proxyNames) {
    yaml += `      - "${name}"\n`;
  }
  yaml += `\n`;

  yaml += `rules:\n`;
  yaml += `  - GEOIP,private,DIRECT,no-resolve\n`;
  yaml += `  - GEOSITE,category-ads-all,REJECT\n`;
  yaml += `  - MATCH,PROXY\n`;

  return yaml;
}

// ── Sing-box JSON Generator (v1.9+) ──
function generateSingboxJson(entries: SubscriptionEntry[], username: string): string {
  const outbounds: any[] = [];
  const proxyTags: string[] = [];

  for (const entry of entries) {
    const raw = entry.raw;
    const { protocol, host, port, tag, inbound } = entry;
    const settings = inbound.settings || {};

    if (protocol === 'VLESS') {
      const params = extractParams(raw);
      const uuid = extractUserFromUri(raw);
      const ob: any = {
        type: 'vless',
        tag,
        server: host,
        server_port: port,
        uuid,
        flow: params.flow || undefined,
      };

      if (params.security === 'reality') {
        ob.tls = {
          enabled: true,
          server_name: params.sni || host,
          utls: { enabled: true, fingerprint: params.fp || 'chrome' },
          reality: {
            enabled: true,
            public_key: params.pbk || '',
            short_id: params.sid || '',
          },
        };
      } else if (params.security === 'tls') {
        ob.tls = {
          enabled: true,
          server_name: params.sni || host,
          utls: { enabled: true, fingerprint: params.fp || 'chrome' },
          insecure: params.allowInsecure === '1',
        };
      }

      if (params.type === 'ws') {
        ob.transport = {
          type: 'ws',
          path: params.path || '/',
          headers: params.host ? { Host: params.host } : undefined,
        };
      } else if (params.type === 'grpc') {
        ob.transport = { type: 'grpc', service_name: params.serviceName || '' };
      } else if (params.type === 'httpupgrade') {
        ob.transport = { type: 'httpupgrade', path: params.path || '/', host: params.host || host };
      }

      outbounds.push(ob);
      proxyTags.push(tag);
    } else if (protocol === 'HYSTERIA2') {
      const params = extractParams(raw);
      const pass = extractPassFromUri(raw);
      const ob: any = {
        type: 'hysteria2',
        tag,
        server: host,
        server_port: port,
        password: pass,
        tls: {
          enabled: true,
          server_name: params.sni || host,
          insecure: params.insecure === '1',
        },
      };
      if (params.obfs) {
        ob.obfs = { type: params.obfs, password: params['obfs-password'] || '' };
      }
      outbounds.push(ob);
      proxyTags.push(tag);
    } else if (protocol === 'TROJAN') {
      const params = extractParams(raw);
      const pass = extractPassFromUri(raw);
      const ob: any = {
        type: 'trojan',
        tag,
        server: host,
        server_port: port,
        password: pass,
        tls: { enabled: true, server_name: params.sni || host },
      };
      outbounds.push(ob);
      proxyTags.push(tag);
    } else if (protocol === 'SHADOWSOCKS') {
      outbounds.push({
        type: 'shadowsocks',
        tag,
        server: host,
        server_port: port,
        method: extractSsMethod(raw),
        password: extractSsPassword(raw),
      });
      proxyTags.push(tag);
    } else if (protocol === 'NAIVEPROXY') {
      const naive = extractNaiveSettings(entry);
      outbounds.push({
        type: 'naive',
        tag,
        server: host,
        server_port: port,
        username: naive.username || 'user',
        password: naive.password || 'password',
        tls: { server_name: naive.domain || host },
      });
      proxyTags.push(tag);
    } else if (protocol === 'MIERU') {
      const mieru = extractMieruSettings(entry);
      outbounds.push({
        type: 'mieru',
        tag,
        server: host,
        server_port: port,
        transport: mieru.transport || 'tcp',
        username: mieru.username || 'user',
        password: mieru.password || '',
      });
      proxyTags.push(tag);
    }
  }

  // Prepend Selector and URLTest groups
  const selectorGroup = {
    type: 'selector',
    tag: 'PROXY',
    outbounds: ['AUTO', ...proxyTags, 'direct'],
    default: 'AUTO',
  };

  const autoGroup = {
    type: 'urltest',
    tag: 'AUTO',
    outbounds: proxyTags,
    url: 'http://www.gstatic.com/generate_204',
    interval: '5m',
    tolerance: 50,
  };

  const directOutbound = { type: 'direct', tag: 'direct' };
  const blockOutbound = { type: 'block', tag: 'block' };
  const dnsOutbound = { type: 'dns', tag: 'dns-out' };

  const singboxConfig = {
    log: { level: 'info', timestamp: true },
    dns: {
      servers: [
        { tag: 'google', address: 'tls://8.8.8.8' },
        { tag: 'cloudflare', address: 'tls://1.1.1.1' },
        { tag: 'local', address: 'local', detour: 'direct' },
      ],
      rules: [
        { outbound: 'any', server: 'local' },
        { clash_mode: 'direct', server: 'local' },
      ],
    },
    inbounds: [
      { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 },
      { type: 'tun', tag: 'tun-in', interface_name: 'tun0', inet4_address: '172.19.0.1/30', auto_route: true, strict_route: true, stack: 'mixed' },
    ],
    outbounds: [selectorGroup, autoGroup, ...outbounds, directOutbound, blockOutbound, dnsOutbound],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { ip_is_private: true, outbound: 'direct' },
        { geosite: 'category-ads-all', outbound: 'block' },
        { outbound: 'PROXY' },
      ],
      auto_detect_interface: true,
    },
  };

  return JSON.stringify(singboxConfig, null, 2);
}

// ── Xray Full Client Config Generator ──
function generateXrayClientJson(entries: SubscriptionEntry[], client: any): string {
  const xrayOutbounds: any[] = [];

  for (const entry of entries) {
    const raw = entry.raw;
    const { protocol, host, port, tag, inbound } = entry;
    const stream = inbound.stream || {};

    if (protocol === 'VLESS') {
      const params = extractParams(raw);
      const uuid = extractUserFromUri(raw);
      const ob: any = {
        tag,
        protocol: 'vless',
        settings: {
          vnext: [{
            address: host,
            port,
            users: [{ id: uuid, encryption: 'none', flow: params.flow || undefined }],
          }],
        },
        streamSettings: {
          network: params.type || 'tcp',
          security: params.security || 'none',
        },
      };

      if (params.security === 'reality') {
        ob.streamSettings.realitySettings = {
          serverName: params.sni || host,
          fingerprint: params.fp || 'chrome',
          publicKey: params.pbk || '',
          shortId: params.sid || '',
          spiderX: params.spx || '',
        };
      } else if (params.security === 'tls') {
        ob.streamSettings.tlsSettings = {
          serverName: params.sni || host,
          fingerprint: params.fp || 'chrome',
          allowInsecure: params.allowInsecure === '1',
        };
      }

      if (params.type === 'ws') {
        ob.streamSettings.wsSettings = { path: params.path || '/', headers: params.host ? { Host: params.host } : {} };
      } else if (params.type === 'grpc') {
        ob.streamSettings.grpcSettings = { serviceName: params.serviceName || '' };
      }

      xrayOutbounds.push(ob);
    } else if (protocol === 'TROJAN') {
      const params = extractParams(raw);
      const pass = extractPassFromUri(raw);
      xrayOutbounds.push({
        tag,
        protocol: 'trojan',
        settings: {
          servers: [{ address: host, port, password: pass }],
        },
        streamSettings: {
          network: params.type || 'tcp',
          security: 'tls',
          tlsSettings: { serverName: params.sni || host },
        },
      });
    } else if (protocol === 'SHADOWSOCKS') {
      xrayOutbounds.push({
        tag,
        protocol: 'shadowsocks',
        settings: {
          servers: [{
            address: host,
            port,
            method: extractSsMethod(raw),
            password: extractSsPassword(raw),
          }],
        },
      });
    }
  }

  xrayOutbounds.push({ protocol: 'freedom', tag: 'direct' });
  xrayOutbounds.push({ protocol: 'blackhole', tag: 'block' });

  const clientConfig = {
    log: { loglevel: 'warning' },
    inbounds: [
      { tag: 'socks-in', port: 10808, listen: '127.0.0.1', protocol: 'socks', settings: { auth: 'noauth', udp: true } },
      { tag: 'http-in', port: 10809, listen: '127.0.0.1', protocol: 'http', settings: {} },
    ],
    outbounds: xrayOutbounds,
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        { type: 'field', ip: ['geoip:private'], outboundTag: 'direct' },
        { type: 'field', domain: ['geosite:category-ads-all'], outboundTag: 'block' },
      ],
    },
  };

  return JSON.stringify(clientConfig, null, 2);
}

// ──────────────────────────────────────────────
// URI parsing helpers
// ──────────────────────────────────────────────

function extractParams(uri: string): Record<string, string> {
  const params: Record<string, string> = {};
  const qIdx = uri.indexOf('?');
  const hashIdx = uri.indexOf('#');

  if (qIdx === -1) return params;

  const queryStr = hashIdx > qIdx ? uri.substring(qIdx + 1, hashIdx) : uri.substring(qIdx + 1);
  const searchParams = new URLSearchParams(queryStr);

  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }

  return params;
}

function extractUserFromUri(uri: string): string {
  const match = uri.match(/^[a-z0-9+-]+:\/\/([^@:]+)@/i);
  return match ? decodeURIComponent(match[1]) : '';
}

function extractPassFromUri(uri: string): string {
  const match = uri.match(/^[a-z0-9+-]+:\/\/([^@]+)@/i);
  if (!match) return '';
  const userinfo = match[1];
  const colonIdx = userinfo.indexOf(':');
  if (colonIdx >= 0) {
    return decodeURIComponent(userinfo.substring(colonIdx + 1));
  }
  return decodeURIComponent(userinfo);
}

function extractSsMethod(uri: string): string {
  const match = uri.match(/^ss:\/\/([^@]+)@/);
  if (!match) return 'aes-256-gcm';
  try {
    const decoded = Buffer.from(match[1], 'base64').toString();
    return decoded.split(':')[0] || 'aes-256-gcm';
  } catch {
    return 'aes-256-gcm';
  }
}

function extractSsPassword(uri: string): string {
  const match = uri.match(/^ss:\/\/([^@]+)@/);
  if (!match) return '';
  try {
    const decoded = Buffer.from(match[1], 'base64').toString();
    return decoded.split(':').slice(1).join(':');
  } catch {
    return '';
  }
}

function extractNaiveSettings(entry: SubscriptionEntry): Record<string, any> {
  try {
    const raw = entry.raw;
    const match = raw.match(/^naive\+https:\/\/(?:([^@]+)@)?([^:?#]+)(?::(\d+))?/);
    if (!match) return {};
    const userPass = match[1] || '';
    const colonIdx = userPass.indexOf(':');
    return {
      username: colonIdx >= 0 ? decodeURIComponent(userPass.substring(0, colonIdx)) : userPass,
      password: colonIdx >= 0 ? decodeURIComponent(userPass.substring(colonIdx + 1)) : '',
      domain: match[2] || '',
    };
  } catch {
    return {};
  }
}

function extractMieruSettings(entry: SubscriptionEntry): Record<string, any> {
  try {
    const raw = entry.raw;
    const match = raw.match(/^mieru:\/\/(?:([^@]+)@)?([^:?#]+)(?::(\d+))?/);
    if (!match) return {};
    const userPass = match[1] || '';
    const colonIdx = userPass.indexOf(':');
    const params = extractParams(raw);
    return {
      username: colonIdx >= 0 ? decodeURIComponent(userPass.substring(0, colonIdx)) : userPass,
      password: colonIdx >= 0 ? decodeURIComponent(userPass.substring(colonIdx + 1)) : '',
      domain: match[2] || '',
      transport: params.transport || 'tcp',
    };
  } catch {
    return {};
  }
}

export default router;
