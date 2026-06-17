export function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function buildSubUrl(subToken: string): string {
  return `${window.location.origin}/api/v1/client/${subToken}/sub`;
}

export function protocolColor(p: string): string {
  switch (p) {
    case 'VLESS': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'HYSTERIA2': return 'bg-orange-50 text-orange-600 border-orange-100';
    case 'NAIVEPROXY': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'MIERU': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    case 'TROJAN': return 'bg-rose-50 text-rose-600 border-rose-100';
    case 'SHADOWSOCKS': return 'bg-zinc-50 text-zinc-600 border-zinc-100';
    default: return 'bg-zinc-50 text-zinc-600 border-zinc-100';
  }
}
