import { InboundConfig } from './types';
import https from 'https';
import http from 'http';

interface MasterClientConfig {
  masterUrl: string;
  nodeSecret: string;
  pollInterval: number;
  onConfigUpdate: (inbounds: InboundConfig[]) => void;
  onStatusReport: (status: any) => void;
}

/**
 * Communicates with the Master server.
 * - Polls for config updates
 * - Reports node status and traffic stats
 */
export class MasterClient {
  private config: MasterClientConfig;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastConfigHash: string = '';
  private nodeId: string = '';

  constructor(config: MasterClientConfig) {
    this.config = config;
  }

  /**
   * Start polling master for config updates.
   */
  start(): void {
    console.log(`[MasterClient] Connecting to ${this.config.masterUrl}`);

    // Initial fetch
    this.poll();

    // Set up recurring poll
    this.pollTimer = setInterval(() => {
      this.poll();
    }, this.config.pollInterval);

    console.log(`[MasterClient] Polling every ${this.config.pollInterval / 1000}s`);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll master for latest config.
   */
  private async poll(): Promise<void> {
    try {
      // Get config from master
      const config = await this.request<any>('GET', '/api/v1/nodes/self/config');

      if (config && config.inbounds) {
        const hash = this.hashConfig(config.inbounds);

        if (hash !== this.lastConfigHash) {
          console.log('[MasterClient] Config changed, updating...');
          this.lastConfigHash = hash;
          this.config.onConfigUpdate(config.inbounds);
        }
      }

      // Report status
      const status = await this.request<any>('GET', '/api/v1/nodes/self/status');
      if (status) {
        this.nodeId = status.nodeId;
        this.config.onStatusReport(status);
      }
    } catch (error: any) {
      // Silently retry on next poll — master might be temporarily unreachable
      if (error.code !== 'ECONNREFUSED') {
        console.error(`[MasterClient] Poll error: ${error.message}`);
      }
    }
  }

  /**
   * Report traffic stats to master.
   */
  async reportTraffic(stats: Record<string, { upload: number; download: number }>): Promise<void> {
    try {
      await this.request('POST', '/api/v1/nodes/self/traffic', { stats });
    } catch (error: any) {
      console.error(`[MasterClient] Traffic report error: ${error.message}`);
    }
  }

  /**
   * Report status to master.
   */
  async reportStatus(status: any): Promise<void> {
    try {
      await this.request('POST', '/api/v1/nodes/self/status', status);
    } catch (error: any) {
      console.error(`[MasterClient] Status report error: ${error.message}`);
    }
  }

  /**
   * Request config update from master for specific node.
   */
  async fetchConfig(): Promise<InboundConfig[]> {
    const response = await this.request<any>('GET', '/api/v1/nodes/self/config');
    return response?.inbounds || [];
  }

  private request<T>(method: string, path: string, body?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.masterUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const postData = body ? JSON.stringify(body) : undefined;

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Bearer ${this.config.nodeSecret}`,
          'Content-Type': 'application/json',
          'X-Node-Secret': this.config.nodeSecret,
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
        timeout: 10000,
        rejectUnauthorized: false,
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON response from ${url.pathname}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout: ${method} ${path}`));
      });

      if (postData) req.write(postData);
      req.end();
    });
  }

  private hashConfig(inbounds: InboundConfig[]): string {
    const str = JSON.stringify(inbounds);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}
