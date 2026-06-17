import { Node } from '@/lib/api';

export const PROTOCOLS = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TUIC'] as const;
export const TRANSPORTS = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'h2', 'kcp'] as const;
export const SECURITIES = ['none', 'tls', 'reality'] as const;
export const FINGERPRINTS = ['chrome', 'firefox', 'safari', 'edge', 'random', 'randomized'] as const;
export const FLOWS = ['', 'xtls-rprx-vision', 'xtls-rprx-direct'] as const;

export interface NodeComponentProps {
  onClose: () => void;
}

export interface NodeEditProps extends NodeComponentProps {
  node: Node;
}

export interface NodeDetailProps extends NodeComponentProps {
  node: Node;
}

export interface InboundForm {
  protocol: string;
  tag: string;
  port: number;
  security: string;
  sni: string;
  fingerprint: string;
  flow: string;
  transport: string;
  realityPublicKey: string;
  realityShortId: string;
  realitySpiderX: string;
  realityDest: string;
}
