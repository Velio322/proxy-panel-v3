export function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function buildSubUrl(subToken: string): string {
  return `${window.location.origin}/api/v1/client/${subToken}/sub`;
}

export function protocolColor(p: string): string {
  switch (p) {
    case 'VLESS': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    case 'HYSTERIA2': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'NAIVEPROXY': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'MIERU': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    case 'TROJAN': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'SHADOWSOCKS': return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    case 'VMESS': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'TUIC': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    default: return 'bg-surface border-border text-fg-muted';
  }
}
