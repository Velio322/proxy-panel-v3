export function protocolColor(p: string): string {
  const map: Record<string, string> = {
    VLESS: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    VMESS: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    TROJAN: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    SHADOWSOCKS: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    HYSTERIA2: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    NAIVEPROXY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    MIERU: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    TUIC: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  return map[p] || 'bg-surface border-border text-fg-muted';
}
