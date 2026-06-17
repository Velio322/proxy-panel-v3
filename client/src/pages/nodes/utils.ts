export function protocolColor(p: string): string {
  const map: Record<string, string> = {
    VLESS: 'bg-blue-50 text-blue-600 border-blue-100',
    VMESS: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    TROJAN: 'bg-rose-50 text-rose-600 border-rose-100',
    SHADOWSOCKS: 'bg-zinc-50 text-zinc-600 border-zinc-200',
    HYSTERIA2: 'bg-orange-50 text-orange-600 border-orange-100',
    NAIVEPROXY: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    MIERU: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    TUIC: 'bg-pink-50 text-pink-600 border-pink-100',
  };
  return map[p] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
}

export function statusColor(s: string): string {
  return s === 'ONLINE' ? 'text-emerald-600' : s === 'ERROR' ? 'text-rose-600' : 'text-zinc-400';
}

export function statusBg(s: string): string {
  return s === 'ONLINE' ? 'bg-emerald-50 border-emerald-100' : s === 'ERROR' ? 'bg-rose-50 border-rose-100' : 'bg-zinc-50 border-zinc-100';
}
