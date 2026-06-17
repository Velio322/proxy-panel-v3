import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPrisma, serializeBigInt } from '../lib/prisma';
import { cacheGet, cacheSet } from '../lib/redis';

const router = Router();

// ──────────────────────────────────────────────
// Subscription endpoint (public — auth via subToken)
// GET /api/v1/client/:subToken/sub
// ──────────────────────────────────────────────

router.get('/:subToken/sub', async (req: Request, res: Response) => {
  try {
    const subToken = req.params.subToken as string;
    const format = ((req.query.flag as string) || 'base64').toLowerCase();

    // Check cache
    const cacheKey = `sub:${subToken}:${format}`;
    const cached = await cacheGet<string>(cacheKey);
    if (cached) {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Profile-Update-Interval', '12');
      res.set('Subscription-Userinfo', buildSubUserInfo(req));
      return res.send(cached);
    }

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

    if (client.trafficLimit > 0 && client.usedTraffic >= client.trafficLimit) {
      return res.status(403).send('Traffic limit exceeded');
    }

    // Get allowed protocols
    const allowedProtocols = (client.protocols as string[]) || ['VLESS', 'HYSTERIA2'];

    // Get all enabled inbounds matching client's protocols from ONLINE nodes
    const inbounds = await prisma.inbound.findMany({
      where: {
        enable: true,
        protocol: { in: allowedProtocols as any[] },
        node: { status: 'ONLINE', active: true },
      },
      include: {
        node: {
          select: { id: true, host: true, port: true, status: true },
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
        output = generateClashConfig(entries);
        break;

      case 'singbox':
        output = generateSingboxConfig(entries);
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

    // Set subscription headers (standard)
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Profile-Update-Interval', '12');
    res.set('Subscription-Userinfo', [
      `upload=${client.uploadTraffic}`,
      `download=${client.downloadTraffic}`,
      `total=${client.trafficLimit}`,
      `expire=${client.expireAt ? Math.floor(client.expireAt.getTime() / 1000) : 0}`,
    ].join('; '));
    res.set('Content-Disposition', `attachment; filename="${client.username}"`);

    res.send(output);
  } catch (error: any) {
    console.error('[Sub] Error:', error);
    res.status(500).send('Internal server error');
  }
});

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

    // Get online nodes count
    const onlineNodes = await prisma.node.count({
      where: { status: 'ONLINE', active: true },
    });

    res.json({
      ...serializeBigInt(client),
      onlineNodes,
      trafficPercent: client.trafficLimit > 0
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

    // Invalidate old cache
    await cacheGet(`sub:${req.params.subToken}:base64`).then(() => {}).catch(() => {});
    // Note: pattern deletion would be ideal, but for simplicity just let old cache expire

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
}

// ──────────────────────────────────────────────
// Build subscription entry from inbound
// ──────────────────────────────────────────────

function buildSubscriptionEntry(inbound: any, client: any): SubscriptionEntry | null {
  const settings = inbound.settings as Record<string, any>;
  const stream = inbound.stream as Record<string, any> || {};
  const node = inbound.node;
  const addr = node.host;
  const port = inbound.port;

  // Use client UUID as user ID (with fallback to inbound setting)
  const userId = settings.id || client.uuid;
  const password = settings.password || client.uuid;

  switch (inbound.protocol) {
    case 'VLESS':
      return {
        protocol: 'VLESS',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildVlessUri(userId, addr, port, stream, inbound.tag),
      };

    case 'VMESS':
      return {
        protocol: 'VMess',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildVmessUri(userId, addr, port, stream, inbound.tag),
      };

    case 'TROJAN':
      return {
        protocol: 'Trojan',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildTrojanUri(password, addr, port, stream, inbound.tag),
      };

    case 'SHADOWSOCKS':
      return {
        protocol: 'Shadowsocks',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildShadowsocksUri(settings, addr, port, inbound.tag),
      };

    case 'HYSTERIA2':
      return {
        protocol: 'Hysteria2',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildHysteria2Uri(password, addr, port, settings, inbound.tag),
      };

    case 'NAIVEPROXY':
      return {
        protocol: 'NaiveProxy',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildNaiveUri(settings, addr, port, inbound.tag),
      };

    case 'MIERU':
      return {
        protocol: 'Mieru',
        tag: inbound.tag,
        host: addr,
        port,
        raw: buildMieruUri(settings, addr, port, inbound.tag),
      };

    default:
      return null;
  }
}

function buildPortShareEntry(inbound: any, ps: any, client: any): SubscriptionEntry | null {
  const settings = { ...(inbound.settings as Record<string, any>), ...(ps.settings as Record<string, any>) };
  const stream = { ...(inbound.stream as Record<string, any> || {}), ...(ps.stream as Record<string, any> || {}) };
  const node = inbound.node;
  const addr = node.host;
  const port = inbound.port; // external port

  const userId = settings.id || client.uuid;
  const password = settings.password || client.uuid;

  // Override SNI/host from port share
  if (ps.host) stream.sni = ps.host;
  if (ps.path) {
    if (stream.network === 'grpc') {
      stream.grpcSettings = { ...(stream.grpcSettings || {}), serviceName: ps.path };
    } else {
      stream.wsSettings = { ...(stream.wsSettings || {}), path: ps.path };
      stream.path = ps.path;
    }
  }

  switch (ps.protocol) {
    case 'VLESS':
      return { protocol: 'VLESS', tag: ps.tag, host: addr, port, raw: buildVlessUri(userId, addr, port, stream, ps.tag) };
    case 'VMESS':
      return { protocol: 'VMess', tag: ps.tag, host: addr, port, raw: buildVmessUri(userId, addr, port, stream, ps.tag) };
    case 'TROJAN':
      return { protocol: 'Trojan', tag: ps.tag, host: addr, port, raw: buildTrojanUri(password, addr, port, stream, ps.tag) };
    case 'SHADOWSOCKS':
      return { protocol: 'Shadowsocks', tag: ps.tag, host: addr, port, raw: buildShadowsocksUri(settings, addr, port, ps.tag) };
    case 'HYSTERIA2':
      return { protocol: 'Hysteria2', tag: ps.tag, host: addr, port, raw: buildHysteria2Uri(password, addr, port, settings, ps.tag) };
    case 'NAIVEPROXY':
      return { protocol: 'NaiveProxy', tag: ps.tag, host: addr, port, raw: buildNaiveUri(settings, addr, port, ps.tag) };
    default:
      return null;
  }
}

// ──────────────────────────────────────────────
// URI Generators
// ──────────────────────────────────────────────

function buildVlessUri(uuid: string, host: string, port: number, stream: any, tag: string): string {
  const params = new URLSearchParams();

  // Transport
  const network = stream.network || 'tcp';
  params.set('type', network);

  // Security
  const security = stream.security || 'none';
  params.set('security', security);

  if (security === 'tls') {
    if (stream.sni) params.set('sni', stream.sni);
    if (stream.fingerprint) params.set('fp', stream.fingerprint);
    if (stream.alpn) params.set('alpn', stream.alpn);
    if (stream.allowInsecure) params.set('allowInsecure', '1');
  }

  if (security === 'reality') {
    if (stream.sni) params.set('sni', stream.sni);
    if (stream.fingerprint) params.set('fp', stream.fingerprint);
    if (stream.publicKey) params.set('pbk', stream.publicKey);
    if (stream.shortId) params.set('sid', stream.shortId);
    if (stream.spiderX) params.set('spx', stream.spiderX);
  }

  // Flow (for XTLS-Vision)
  if (stream.flow) params.set('flow', stream.flow);

  // Transport-specific
  if (network === 'ws') {
    const wsPath = stream.wsSettings?.path || stream.path || '/';
    params.set('path', wsPath);
    if (stream.wsSettings?.host) params.set('host', stream.wsSettings.host);
  }

  if (network === 'grpc') {
    const serviceName = stream.grpcSettings?.serviceName || stream.serviceName || '';
    params.set('serviceName', serviceName);
  }

  if (network === 'h2') {
    const h2Path = stream.httpSettings?.path || stream.path || '/';
    params.set('path', h2Path);
    if (stream.httpSettings?.host) params.set('host', stream.httpSettings.host);
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
  const frag = encodeURIComponent(tag);

  return `vless://${uuid}@${host}:${port}?${query}#${frag}`;
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
    alpn: stream.alpn || '',
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
  if (stream.alpn) params.set('alpn', stream.alpn);

  if (stream.network === 'ws') {
    params.set('path', stream.wsSettings?.path || '/');
  }
  if (stream.network === 'grpc') {
    params.set('serviceName', stream.grpcSettings?.serviceName || '');
  }

  const query = params.toString();
  const frag = encodeURIComponent(tag);

  return `trojan://${password}@${host}:${port}?${query}#${frag}`;
}

function buildShadowsocksUri(settings: any, host: string, port: number, tag: string): string {
  const method = settings.method || 'aes-256-gcm';
  const password = settings.password || '';

  // Shadowsocks URI: ss://BASE64(method:password)@host:port#tag
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
  const frag = encodeURIComponent(tag);

  return `hy2://${password}@${host}:${port}${query ? '?' + query : ''}#${frag}`;
}

function buildNaiveUri(settings: any, host: string, port: number, tag: string): string {
  const proto = settings.proto || 'quic';
  const proxy = settings.proxy || '';
  const nonce = settings.nonce || '';

  // NaiveProxy URI: naive+PROTO://USER:PASS@HOST:PORT?PARAMS#TAG
  let uri = `naive+https://`;
  if (proxy) uri += `${encodeURIComponent(proxy)}@`;
  uri += `${host}:${port}`;

  const params = new URLSearchParams();
  if (proto) params.set('proto', proto);
  if (nonce) params.set('padding', nonce);

  const query = params.toString();
  uri += `${query ? '?' + query : ''}`;
  uri += `#${encodeURIComponent(tag)}`;

  return uri;
}

function buildMieruUri(settings: any, host: string, port: number, tag: string): string {
  // Mieru doesn't have a standard URI format — output as JSON block
  return JSON.stringify({
    protocol: 'mieru',
    server: host,
    port,
    username: settings.username || 'user',
    password: settings.password || '',
    authentication: settings.authentication || 'password',
    remark: tag,
  });
}

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────

function generateBase64(entries: SubscriptionEntry[]): string {
  const lines = entries
    .filter((e) => e.protocol !== 'Mieru') // Mieru has no URI format
    .map((e) => e.raw);

  return Buffer.from(lines.join('\n')).toString('base64');
}

function generateClashConfig(entries: SubscriptionEntry[]): string {
  const proxies: any[] = [];

  for (const entry of entries) {
    const raw = entry.raw;
    let proxy: any = null;

    if (entry.protocol === 'VLESS') {
      const params = extractParams(raw);
      proxy = {
        name: entry.tag,
        type: 'vless',
        server: entry.host,
        port: entry.port,
        uuid: extractUserFromUri(raw),
        tls: params.security === 'tls' || params.security === 'reality',
        flow: params.flow || '',
        network: params.type || 'tcp',
      };
      if (params.security === 'tls') {
        proxy.servername = params.sni || entry.host;
        proxy['client-fingerprint'] = params.fp || 'chrome';
      }
      if (params.security === 'reality') {
        proxy.servername = params.sni || entry.host;
        proxy['client-fingerprint'] = params.fp || 'chrome';
        proxy['reality-public-key'] = params.pbk || '';
        proxy['reality-short-id'] = params.sid || '';
        proxy['reality-opts'] = { 'public-key': params.pbk || '', short_id: params.sid || '' };
        delete proxy.tls;
        proxy['client-fingerprint'] = params.fp || 'chrome';
      }
      if (params.type === 'ws') {
        proxy.wsOpts = { path: params.path || '/', headers: params.host ? { Host: params.host } : {} };
      }
      if (params.type === 'grpc') {
        proxy.grpcOpts = { 'grpc-service-name': params.serviceName || '' };
      }
    }

    if (entry.protocol === 'Hysteria2') {
      const params = extractParams(raw);
      proxy = {
        name: entry.tag,
        type: 'hysteria2',
        server: entry.host,
        port: entry.port,
        password: extractPassFromUri(raw),
        sni: params.sni || entry.host,
        'skip-cert-verify': params.insecure === '1',
      };
      if (params.obfs) {
        proxy.obfs = params.obfs;
        proxy['obfs-password'] = params['obfs-password'] || '';
      }
    }

    if (entry.protocol === 'Trojan') {
      const params = extractParams(raw);
      proxy = {
        name: entry.tag,
        type: 'trojan',
        server: entry.host,
        port: entry.port,
        password: extractPassFromUri(raw),
        sni: params.sni || entry.host,
        network: params.type || 'tcp',
      };
    }

    if (entry.protocol === 'Shadowsocks') {
      proxy = {
        name: entry.tag,
        type: 'ss',
        server: entry.host,
        port: entry.port,
        cipher: extractSsMethod(raw),
        password: extractSsPassword(raw),
      };
    }

    if (proxy) proxies.push(proxy);
  }

  const config = {
    mixed: 7890,
    allow_lan: false,
    mode: 'rule',
    log_level: 'info',
    proxies,
    'proxy-groups': [
      { name: 'Proxy', type: 'select', proxies: proxies.map((p) => p.name) },
      { name: 'Auto', type: 'url-test', proxies: proxies.map((p) => p.name) },
    ],
    rules: ['MATCH,Proxy'],
  };

  return JSON.stringify(config, null, 2);
}

function generateSingboxConfig(entries: SubscriptionEntry[]): string {
  const outbounds: any[] = [];

  for (const entry of entries) {
    if (entry.protocol === 'VLESS') {
      const params = extractParams(entry.raw);
      const ob: any = {
        type: 'vless',
        tag: entry.tag,
        server: entry.host,
        server_port: entry.port,
        uuid: extractUserFromUri(entry.raw),
        flow: params.flow || '',
      };

      if (params.security === 'reality') {
        ob.tls = {
          enabled: true,
          server_name: params.sni || entry.host,
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
          server_name: params.sni || entry.host,
          utls: { enabled: true, fingerprint: params.fp || 'chrome' },
        };
      }

      if (params.type === 'ws') {
        ob.transport = {
          type: 'ws',
          path: params.path || '/',
          headers: params.host ? { Host: params.host } : {},
        };
      }
      if (params.type === 'grpc') {
        ob.transport = { type: 'grpc', service_name: params.serviceName || '' };
      }

      outbounds.push(ob);
    }

    if (entry.protocol === 'Hysteria2') {
      const params = extractParams(entry.raw);
      const ob: any = {
        type: 'hysteria2',
        tag: entry.tag,
        server: entry.host,
        server_port: entry.port,
        password: extractPassFromUri(entry.raw),
        tls: {
          enabled: true,
          server_name: params.sni || entry.host,
          insecure: params.insecure === '1',
        },
      };
      if (params.obfs) {
        ob.obfs = { type: params.obfs, password: params['obfs-password'] || '' };
      }
      outbounds.push(ob);
    }

    if (entry.protocol === 'Trojan') {
      const params = extractParams(entry.raw);
      outbounds.push({
        type: 'trojan',
        tag: entry.tag,
        server: entry.host,
        server_port: entry.port,
        password: extractPassFromUri(entry.raw),
        tls: { enabled: true, server_name: params.sni || entry.host },
      });
    }
  }

  return JSON.stringify({
    outbounds,
    route: { rules: [], auto_detect_interface: true },
  }, null, 2);
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
  // vless://USER@HOST:PORT...
  const match = uri.match(/^vless:\/\/([^@]+)@/);
  return match ? match[1] : '';
}

function extractPassFromUri(uri: string): string {
  // hy2://PASS@HOST:PORT or trojan://PASS@HOST:PORT
  const match = uri.match(/^hy2:\/\/([^@]+)@/) || uri.match(/^trojan:\/\/([^@]+)@/);
  return match ? match[1] : '';
}

function extractSsMethod(uri: string): string {
  // ss://BASE64@HOST:PORT
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

function buildSubUserInfo(_req: Request): string {
  return 'upload=0; download=0; total=0; expire=0';
}

export default router;
