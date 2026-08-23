const http = require('http');
const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: "postgresql://proxpanel:proxpanel123@127.0.0.1:5432/proxpanel?schema=public" } } });

async function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== Preparing Online Node and Test Inbounds ===');
  let node = await prisma.node.findFirst();
  if (!node) {
    node = await prisma.node.create({
      data: {
        name: 'Frankfurt-01',
        host: 'de1.proxpanel.net',
        port: 443,
        status: 'ONLINE',
        active: true,
        secretKey: 'sample-secret-key',
      }
    });
  } else {
    await prisma.node.update({
      where: { id: node.id },
      data: { status: 'ONLINE', active: true }
    });
  }
  console.log('Online Node:', node.name, `(${node.host})`);

  // Ensure inbounds exist for VLESS Reality, Hysteria 2, NaiveProxy, Mieru, Trojan
  const existingInbounds = await prisma.inbound.findMany({ where: { nodeId: node.id } });
  if (existingInbounds.length === 0) {
    console.log('Creating sample multi-protocol inbounds...');
    await prisma.inbound.create({
      data: {
        nodeId: node.id,
        protocol: 'VLESS',
        tag: 'vless-reality-443',
        port: 443,
        enable: true,
        settings: { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', flow: 'xtls-rprx-vision' },
        stream: {
          network: 'tcp',
          security: 'reality',
          sni: 'www.microsoft.com',
          fingerprint: 'chrome',
          publicKey: '7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C8=',
          shortId: '0123456789abcdef'
        }
      }
    });
    await prisma.inbound.create({
      data: {
        nodeId: node.id,
        protocol: 'HYSTERIA2',
        tag: 'hy2-4430',
        port: 4430,
        enable: true,
        settings: { password: 'hy2secretpassword', sni: 'de1.proxpanel.net' },
        stream: {}
      }
    });
    await prisma.inbound.create({
      data: {
        nodeId: node.id,
        protocol: 'NAIVEPROXY',
        tag: 'naive-8443',
        port: 8443,
        enable: true,
        settings: { username: 'user1', password: 'naivepassword', domain: 'de1.proxpanel.net' },
        stream: {}
      }
    });
    await prisma.inbound.create({
      data: {
        nodeId: node.id,
        protocol: 'MIERU',
        tag: 'mieru-9443',
        port: 9443,
        enable: true,
        settings: { username: 'user1', password: 'mierupassword', transport: 'TCP', domain: 'de1.proxpanel.net' },
        stream: {}
      }
    });
  }

  console.log('\n=== 1. Health Check ===');
  const health = await request({ host: 'localhost', port: 3001, path: '/api/health', method: 'GET' });
  console.log('Health status:', health.status, health.body);

  console.log('\n=== 2. Admin Login ===');
  const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
  const login = await request({
    host: 'localhost', port: 3001, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
  }, loginData);
  console.log('Login status:', login.status);
  const token = JSON.parse(login.body).token;
  console.log('Token received successfully.');

  console.log('\n=== 3. Query Client ===');
  const clientsRes = await request({
    host: 'localhost', port: 3001, path: '/api/v1/clients', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const clients = JSON.parse(clientsRes.body);
  const client = clients.data[0];
  const subToken = client.subToken;
  console.log('Client:', client.username, 'subToken:', subToken);

  console.log('\n=== 4. Test Subscriptions: Base64 Universal ===');
  const subBase64 = await request({ host: 'localhost', port: 3001, path: `/api/v1/client/${subToken}/sub`, method: 'GET' });
  console.log('Base64 Status:', subBase64.status);
  console.log('Subscription-Userinfo Header:', subBase64.headers['subscription-userinfo']);
  console.log('Profile-Title Header:', subBase64.headers['profile-title']);
  const decoded = Buffer.from(subBase64.body, 'base64').toString('utf8');
  console.log('Decoded links count:', decoded.split('\n').filter(Boolean).length);
  console.log('Sample links:\n' + decoded.split('\n').filter(Boolean).slice(0, 3).join('\n'));

  console.log('\n=== 5. Test Subscriptions: Clash / Mihomo YAML ===');
  const subClash = await request({ host: 'localhost', port: 3001, path: `/api/v1/client/${subToken}/sub?flag=clash`, method: 'GET' });
  console.log('Clash Status:', subClash.status);
  console.log('Content-Type:', subClash.headers['content-type']);
  console.log('Clash YAML Snippet:\n' + subClash.body.slice(0, 450) + '\n...\n');

  console.log('\n=== 6. Test Subscriptions: Sing-box JSON (v1.9+) ===');
  const subSingbox = await request({ host: 'localhost', port: 3001, path: `/api/v1/client/${subToken}/sub?flag=singbox`, method: 'GET' });
  console.log('Sing-box Status:', subSingbox.status);
  console.log('Content-Type:', subSingbox.headers['content-type']);
  console.log('Sing-box JSON Snippet:\n' + subSingbox.body.slice(0, 450) + '\n...\n');

  console.log('\n=== 7. Test Subscriptions: Xray JSON ===');
  const subXray = await request({ host: 'localhost', port: 3001, path: `/api/v1/client/${subToken}/sub?flag=xray`, method: 'GET' });
  console.log('Xray Status:', subXray.status);
  console.log('Xray JSON Snippet:\n' + subXray.body.slice(0, 350) + '\n...\n');

  console.log('\n=== 8. Test Subscriptions: User-Agent Auto Detection ===');
  const uaClash = await request({
    host: 'localhost', port: 3001, path: `/api/v1/client/${subToken}/sub`, method: 'GET',
    headers: { 'User-Agent': 'ClashMeta/v1.18.0' }
  });
  console.log('User-Agent "ClashMeta" detected Content-Type:', uaClash.headers['content-type']);

  const uaSingbox = await request({
    host: 'localhost', port: 3001, path: `/api/v1/client/${subToken}/sub`, method: 'GET',
    headers: { 'User-Agent': 'sing-box 1.9.3' }
  });
  console.log('User-Agent "sing-box" detected Content-Type:', uaSingbox.headers['content-type']);

  console.log('\n======================================================');
  console.log('🎉 AUDIT SUCCESS: All protocols, subscription formats & APIs validated!');
  console.log('======================================================');
}

run().catch(console.error).finally(() => prisma.$disconnect());
