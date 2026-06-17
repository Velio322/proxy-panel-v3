import { Client, Inbound } from '@/lib/api';

export const PROTOCOLS = ['VLESS', 'HYSTERIA2', 'NAIVEPROXY', 'MIERU', 'TROJAN', 'SHADOWSOCKS'] as const;
export const FLOWS = ['', 'xtls-rprx-vision', 'xtls-rprx-direct'] as const;

export interface CreateForm {
  username: string;
  email: string;
  password: string;
  protocols: string[];
  expireDays: number;
  trafficLimitGB: number;
  speedLimitMbps: number;
  note: string;
  inboundId: string;
  flow: string;
}

export interface ClientComponentProps {
  onClose: () => void;
}

export interface ClientEditProps extends ClientComponentProps {
  client: Client;
  inbounds: Inbound[];
}

export interface ClientCreateProps extends ClientComponentProps {
  inbounds: Inbound[];
  nodes: any[];
}
