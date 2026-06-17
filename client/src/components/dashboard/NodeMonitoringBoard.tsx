import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesApi, Node } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Server, Wifi, Terminal,
  Loader2, X, Clock,
  RotateCcw, Radio
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area
} from 'recharts';

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

interface PingPoint { time: string; ms: number }
interface LogEntry { time: string; stream: 'stdout' | 'stderr'; line: string }

// ══════════════════════════════════════════════
// Ping Simulator (replace with real WebSocket)
// ══════════════════════════════════════════════

function usePingHistory(nodeId: string): PingPoint[] {
  const [points, setPoints] = useState<PingPoint[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints(prev => {
        const now = new Date();
        const time = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const ms = Math.floor(Math.random() * 30 + 5);
        const next = [...prev, { time, ms }].slice(-30);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [nodeId]);

  return points;
}

// ══════════════════════════════════════════════
// Node Monitoring Card
// ══════════════════════════════════════════════

function NodeMonitorCard({ node, onOpenLogs }: { node: Node; onOpenLogs: () => void }) {
  const pingHistory = usePingHistory(node.id);
  const qc = useQueryClient();

  const isOnline = node.status === 'ONLINE';
  const isError = node.status === 'ERROR';
  const lastPing = pingHistory.length > 0 ? pingHistory[pingHistory.length - 1].ms : null;

  const restartMut = useMutation({
    mutationFn: () => nodesApi.restart(node.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });
  const checkMut = useMutation({
    mutationFn: () => nodesApi.check(node.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });

  return (
    <div className={cn(
      "relative bg-surface border rounded-xl overflow-hidden transition-all duration-200",
      "hover:border-fg-subtle hover:shadow-lg hover:shadow-black/30",
      isOnline ? "border-emerald-500/20" : isError ? "border-red-500/20" : "border-border"
    )}>
      {/* Top accent */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5",
        isOnline ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" :
        isError ? "bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" :
        "bg-bg-sunken"
      )} />

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className={cn("p-2 rounded-lg",
              isOnline ? "bg-emerald-500/10" : isError ? "bg-red-500/10" : "bg-bg-raised"
            )}>
              <Server size={16} className={isOnline ? "text-emerald-400" : isError ? "text-red-400" : "text-fg-subtle"} />
            </div>
            <div className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900",
              isOnline ? "bg-emerald-400 animate-pulse" : isError ? "bg-red-400" : "bg-fg-subtle"
            )} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{node.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-fg-subtle font-mono">{node.host}:{node.port}</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                isOnline ? "bg-emerald-500/10 text-emerald-400" : isError ? "bg-red-500/10 text-red-400" : "bg-bg-raised text-fg-subtle"
              )}>
                {node.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onOpenLogs}
            className="p-1.5 rounded-md bg-bg-raised hover:bg-bg-sunken text-fg-muted hover:text-cyan-400 transition-colors" title="View Logs">
            <Terminal size={13} />
          </button>
          <button onClick={() => checkMut.mutate()} disabled={checkMut.isPending}
            className="p-1.5 rounded-md bg-bg-raised hover:bg-bg-sunken text-fg-muted hover:text-[hsl(var(--accent))] transition-colors disabled:opacity-50" title="Check Status">
            {checkMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
          </button>
          <button onClick={() => restartMut.mutate()} disabled={restartMut.isPending}
            className="p-1.5 rounded-md bg-bg-raised hover:bg-bg-sunken text-fg-muted hover:text-amber-400 transition-colors disabled:opacity-50" title="Restart">
            {restartMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-4 gap-1.5">
          <MetricMini label="CPU" value={node.cpuUsage} suffix="%" warn={node.cpuUsage != null && node.cpuUsage > 80} />
          <MetricMini label="MEM" value={node.memUsage} suffix="%" warn={node.memUsage != null && node.memUsage > 80} />
          <MetricMini label="PING" value={lastPing} suffix="ms" />
          <MetricMini label="CONN" value={null} suffix="" />
        </div>
      </div>

      {/* Ping Chart */}
      <div className="px-4 pb-3">
        <div className="bg-bg-raised rounded-lg p-2 border border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] text-fg-muted uppercase tracking-wider">Latency (ms)</span>
            <span className={cn("text-[9px] font-medium",
              lastPing != null && lastPing < 20 ? "text-emerald-400" :
              lastPing != null && lastPing < 50 ? "text-amber-400" : "text-red-400"
            )}>
              {lastPing != null ? `${lastPing}ms` : '—'}
            </span>
          </div>
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pingHistory}>
                <defs>
                  <linearGradient id={`pingGrad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isOnline ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={isOnline ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="ms" stroke={isOnline ? "#10b981" : "#ef4444"}
                  fill={`url(#pingGrad-${node.id})`} strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Xray Process Status */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1.5">
            <Radio size={10} className={isOnline ? "text-emerald-400" : "text-fg-muted"} />
            <span className="text-fg-muted">Xray:</span>
            <span className={cn("font-medium", isOnline ? "text-emerald-400" : "text-red-400")}>
              {isOnline ? "Active" : "Failed"}
            </span>
          </div>
          <span className="text-fg">·</span>
          <div className="flex items-center gap-1.5">
            <Clock size={10} className="text-fg-muted" />
            <span className="text-fg-subtle">
              {node.lastCheckAt ? new Date(node.lastCheckAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricMini({ label, value, suffix, warn }: { label: string; value?: number | null; suffix: string; warn?: boolean }) {
  return (
    <div className="bg-bg-raised rounded-md px-1.5 py-1 text-center">
      <div className="text-[7px] text-fg-muted uppercase tracking-wider">{label}</div>
      <div className={cn("text-[10px] font-semibold tabular-nums", warn ? "text-amber-400" : "text-fg-muted")}>
        {value != null ? `${value.toFixed(suffix === 'ms' ? 0 : 1)}${suffix}` : '—'}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Logs Modal
// ══════════════════════════════════════════════

function LogsModal({ node, onClose }: { node: Node; onClose: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  // Simulate live logs (replace with WebSocket)
  useEffect(() => {
    const mockLines = [
      '[Info] core: Xray 1.8.24 started',
      `[Info] transport/internet/tcp: listening TCP on 0.0.0.0:${node.port}`,
      '[Info] transport/internet/reality: REALITY accepted',
      '[Info] proxy/vless/inbound: firstLen = 135, payload = vless',
      '[Info] transport/internet/grpc: gRPC accepted',
      '[Warning] transport/internet/http: TLS handshake timeout',
      '[Info] proxy/vless/inbound: connection from 192.168.1.100',
      `[Info] stats: traffic received: ${Math.floor(Math.random() * 1000)} bytes`,
    ];

    const interval = setInterval(() => {
      const line = mockLines[Math.floor(Math.random() * mockLines.length)];
      const time = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const stream = line.includes('Warning') || line.includes('Error') ? 'stderr' as const : 'stdout' as const;
      setLogs(prev => [...prev.slice(-200), { time, stream, line }]);
    }, 2000);

    return () => clearInterval(interval);
  }, [node]);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-cyan-500/10">
              <Terminal size={16} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Live Logs — {node.name}</h2>
              <p className="text-[10px] text-fg-subtle">stdout/stderr stream from Xray-core</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}
                className="w-3 h-3 rounded border-border bg-bg-raised text-[hsl(var(--accent))] focus:ring-[hsl(var(--accent))]" />
              <span className="text-[10px] text-fg-muted">Auto-scroll</span>
            </label>
            <button onClick={() => setLogs([])} className="px-2 py-1 rounded bg-bg-raised text-fg-muted text-[10px] hover:text-fg">Clear</button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-raised text-fg-muted"><X size={16} /></button>
          </div>
        </div>

        {/* Log stream */}
        <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11px] bg-bg-raised">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-fg-muted">
              <div className="text-center">
                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[hsl(var(--accent))]" />
                <p>Waiting for log output...</p>
              </div>
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={cn("py-0.5 flex gap-3", log.stream === 'stderr' && "text-red-400")}>
                <span className="text-fg-muted shrink-0 w-16">{log.time}</span>
                <span className={cn("shrink-0 w-6 text-center",
                  log.stream === 'stderr' ? "text-red-500" : "text-fg"
                )}>{log.stream === 'stderr' ? 'E' : 'O'}</span>
                <span className={cn(log.stream === 'stderr' ? "text-red-400" : "text-fg-muted")}>{log.line}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-border text-[10px] text-fg-subtle shrink-0">
          <span>{logs.length} lines</span>
          <span>Live stream · updates every 2s</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Board Component
// ══════════════════════════════════════════════

export function NodeMonitoringBoard() {
  const [logsNode, setLogsNode] = useState<Node | null>(null);

  const { data: nodes, isLoading } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => nodesApi.getAll().then(r => r.data),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4 h-64 animate-pulse" />
        ))}
      </div>
    );
  }

  const online = nodes?.filter(n => n.status === 'ONLINE') || [];
  const offline = nodes?.filter(n => n.status !== 'ONLINE') || [];

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-medium">{online.length}</span>
          <span className="text-fg-muted">online</span>
        </div>
        {offline.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-red-400 font-medium">{offline.length}</span>
            <span className="text-fg-muted">offline</span>
          </div>
        )}
        <span className="text-xs text-fg-muted">· {nodes?.length || 0} total nodes</span>
      </div>

      {/* Node Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {nodes?.map(node => (
          <NodeMonitorCard key={node.id} node={node} onOpenLogs={() => setLogsNode(node)} />
        ))}
      </div>

      {(!nodes || nodes.length === 0) && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Server size={32} className="mx-auto text-fg mb-3" />
          <p className="text-sm text-fg-subtle">No nodes configured</p>
          <p className="text-xs text-fg-muted mt-1">Add your first node to start monitoring</p>
        </div>
      )}

      {/* Logs Modal */}
      {logsNode && <LogsModal node={logsNode} onClose={() => setLogsNode(null)} />}
    </div>
  );
}
