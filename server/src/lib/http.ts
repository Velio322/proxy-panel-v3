import https from 'https';
import http from 'http';

interface RequestOptions {
  host: string;
  port: number;
  path: string;
  method?: string;
  secret: string;
  body?: any;
  timeout?: number;
}

export async function nodeRequest<T = any>(options: RequestOptions): Promise<T> {
  const { host, port, path, method = 'GET', secret, body, timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const isHttps = port !== 80;
    const client = isHttps ? https : http;

    const reqOptions: https.RequestOptions = {
      hostname: host,
      port,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
      timeout,
      rejectUnauthorized: false,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${host}:${port}${path}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${host}:${port}${path}`));
    });

    if (postData) req.write(postData);
    req.end();
  });
}

export async function nodeGet<T = any>(host: string, port: number, path: string, secret: string): Promise<T> {
  return nodeRequest<T>({ host, port, path, method: 'GET', secret });
}

export async function nodePost<T = any>(host: string, port: number, path: string, secret: string, body: any): Promise<T> {
  return nodeRequest<T>({ host, port, path, method: 'POST', secret, body });
}
