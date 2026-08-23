import { InboundConfig } from './types';
import WebSocket from 'ws';

interface MasterClientConfig {
  masterUrl: string;
  nodeSecret: string;
  pollInterval: number; // Kept for compatibility but not used for polling configs
  onConfigUpdate: (inbounds: InboundConfig[]) => void;
  onStatusReport: (status: any) => void;
}

/**
 * Communicates with the Master server via WebSockets.
 * - Receives config updates in real-time
 * - Reports node status and traffic stats
 */
export class MasterClient {
  private config: MasterClientConfig;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statusTimer: NodeJS.Timeout | null = null;
  private lastConfigHash: string = '';
  private isConnected: boolean = false;
  private isStopped: boolean = false;

  constructor(config: MasterClientConfig) {
    this.config = config;
  }

  /**
   * Connect to master via WebSocket.
   */
  start(): void {
    this.isStopped = false;
    this.connect();
  }

  private connect(): void {
    if (this.isStopped) return;

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }

    // Convert http/https to ws/wss
    const wsUrl = this.config.masterUrl.replace(/^http/, 'ws') + '/ws/worker';

    console.log(`[MasterClient] Connecting to Master WebSocket: ${wsUrl}`);

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.nodeSecret}`,
        'X-Node-Secret': this.config.nodeSecret,
      },
      rejectUnauthorized: false,
    });

    this.ws.on('open', () => {
      if (this.isStopped) {
        this.ws?.terminate();
        return;
      }
      console.log('[MasterClient] WebSocket connected');
      this.isConnected = true;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Request initial config
      this.sendEvent('config_request', {});

      // Start periodic status report (e.g. every 30s)
      if (this.statusTimer) clearInterval(this.statusTimer);
      this.statusTimer = setInterval(() => {
        this.config.onStatusReport({});
      }, this.config.pollInterval);
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (error) {
        console.error('[MasterClient] Failed to parse message:', error);
      }
    });

    this.ws.on('close', () => {
      console.log('[MasterClient] WebSocket disconnected');
      this.handleDisconnect();
    });

    this.ws.on('error', (error) => {
      console.error(`[MasterClient] WebSocket error: ${error.message}`);
    });
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.isStopped) return;

    // Reconnect with backoff
    this.reconnectTimer = setTimeout(() => {
      if (!this.isStopped) {
        console.log('[MasterClient] Reconnecting...');
        this.connect();
      }
    }, 5000);
  }

  private handleMessage(msg: { event: string; payload: any }): void {
    switch (msg.event) {
      case 'config_update':
        if (msg.payload && msg.payload.inbounds) {
          const hash = this.hashConfig(msg.payload.inbounds);
          if (hash !== this.lastConfigHash) {
            console.log('[MasterClient] Real-time config update received');
            this.lastConfigHash = hash;
            this.config.onConfigUpdate(msg.payload.inbounds);
          }
        }
        break;
      default:
        console.log(`[MasterClient] Unknown event received: ${msg.event}`);
    }
  }

  private sendEvent(event: string, payload: any): void {
    if (this.ws && this.isConnected && !this.isStopped) {
      this.ws.send(JSON.stringify({ event, payload }));
    }
  }

  stop(): void {
    this.isStopped = true;
    this.isConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }
    console.log('[MasterClient] Stopped');
  }

  /**
   * Report traffic stats to master via WS.
   */
  async reportTraffic(stats: Record<string, { upload: number; download: number }>): Promise<void> {
    this.sendEvent('traffic_report', { stats });
  }

  /**
   * Report status to master via WS.
   */
  async reportStatus(status: any): Promise<void> {
    this.sendEvent('status_report', status);
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
