import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesApi, Node } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/utils';
import {
  Server, Plus, RefreshCw, Power, PowerOff, Trash2, Settings,
  Search, Globe, Cpu, HardDrive, ArrowUpDown, ChevronDown,
  ExternalLink, Copy, Check, X, Loader2
} from 'lucide-react';

export function NodesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: nodes, isLoading, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
    refetchInterval: 30000,
  });

  const checkMutation = useMutation({
    mutationFn: (id: string) => nodesApi.check(id).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  });

  const pushConfigMutation = useMutation({
    mutationFn: (id: string) => nodesApi.pushConfig(id).then((r) => r.data),
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => nodesApi.restart(id).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => nodesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  });

  const filtered = nodes?.filter((n) =>
    !search || n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.host.toLowerCase().includes(search.toLowerCase()) ||
    n.country?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = nodes?.filter((n) => n.status === 'ONLINE').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Nodes</h1>
          <p className="text-sm text-gray-400 mt-1">
            {onlineCount} online · {nodes?.length || 0} total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Node
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
        />
      </div>

      {/* Nodes Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-purple-500" />
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onCheck={() => checkMutation.mutate(node.id)}
              onPushConfig={() => pushConfigMutation.mutate(node.id)}
              onRestart={() => restartMutation.mutate(node.id)}
              onDelete={() => {
                if (confirm(`Delete node "${node.name}"?`)) {
                  deleteMutation.mutate(node.id);
                }
              }}
              onViewDetail={() => { setSelectedNode(node); setShowDetail(true); }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Server size={48} className="mx-auto text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-gray-400">No nodes found</h3>
          <p className="text-sm text-gray-600 mt-1">Add your first node to get started</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
          >
            Add Node
          </button>
        </div>
      )}

      {/* Add Node Modal */}
      {showAdd && (
        <AddNodeModal onClose={() => setShowAdd(false)} />
      )}

      {/* Node Detail Modal */}
      {showDetail && selectedNode && (
        <NodeDetailModal node={selectedNode} onClose={() => { setShowDetail(false); setSelectedNode(null); }} />
      )}
    </div>
  );
}

// ──── Node Card ────

function NodeCard({ node, onCheck, onPushConfig, onRestart, onDelete, onViewDetail }: {
  node: Node;
  onCheck: () => void;
  onPushConfig: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyHost = () => {
    navigator.clipboard.writeText(node.host);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`relative p-2 rounded-lg ${
            node.status === 'ONLINE' ? 'bg-green-500/10' :
            node.status === 'ERROR' ? 'bg-red-500/10' : 'bg-gray-800'
          }`}>
            <Server size={18} className={
              node.status === 'ONLINE' ? 'text-green-400' :
              node.status === 'ERROR' ? 'text-red-400' : 'text-gray-500'
            } />
            <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
              node.status === 'ONLINE' ? 'bg-green-400' :
              node.status === 'ERROR' ? 'bg-red-400' : 'bg-gray-600'
            }`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{node.name}</h3>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-gray-500 font-mono">{node.host}</span>
              <button onClick={copyHost} className="text-gray-600 hover:text-gray-400">
                {copied ? <Check size={10} /> : <Copy size={10} />}
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300"
          >
            <Settings size={16} />
          </button>
          {showActions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                <button onClick={() => { onViewDetail(); setShowActions(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                  <ExternalLink size={14} /> Details
                </button>
                <button onClick={() => { onCheck(); setShowActions(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                  <RefreshCw size={14} /> Check Status
                </button>
                <button onClick={() => { onPushConfig(); setShowActions(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                  <ArrowUpDown size={14} /> Push Config
                </button>
                <button onClick={() => { onRestart(); setShowActions(false); }} className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                  <Power size={14} /> Restart
                </button>
                <div className="border-t border-gray-700 my-1" />
                <button onClick={() => { onDelete(); setShowActions(false); }} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">CPU</div>
          <div className="text-sm font-medium text-gray-200 mt-0.5">
            {node.cpuUsage != null ? `${node.cpuUsage.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Memory</div>
          <div className="text-sm font-medium text-gray-200 mt-0.5">
            {node.memUsage != null ? `${node.memUsage.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Inbounds</div>
          <div className="text-sm font-medium text-gray-200 mt-0.5">
            {node._count?.inbounds || node.inbounds?.length || 0}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Location</span>
          <span className="text-gray-300">{[node.country, node.city].filter(Boolean).join(', ') || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Version</span>
          <span className="text-gray-300">{node.version || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Last check</span>
          <span className="text-gray-300">{node.lastCheckAt ? formatDate(node.lastCheckAt) : '—'}</span>
        </div>
      </div>

      {/* Tags */}
      {node.tags && node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-800">
          {node.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-md bg-gray-800 text-[11px] text-gray-400">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ──── Add Node Modal ────

function AddNodeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '', host: '', port: 443, apiPort: 2087, secret: '',
    country: '', city: '', isp: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => nodesApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      onClose();
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to create node'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.host || !form.secret) {
      setError('Name, Host, and Secret are required');
      return;
    }
    setError('');
    mutation.mutate();
  };

  const inputClass = "w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Add Node</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="US-East-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Host / IP *</label>
              <input className={inputClass} value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="1.2.3.4" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Port (443)</label>
              <input className={inputClass} type="number" value={form.port} onChange={(e) => setForm({ ...form, port: +e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">API Port (2087)</label>
              <input className={inputClass} type="number" value={form.apiPort} onChange={(e) => setForm({ ...form, apiPort: +e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Node Secret *</label>
            <input className={inputClass} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="Generated on worker node" />
            <p className="text-[11px] text-gray-600 mt-1">From worker's .env → NODE_RPC_SECRET</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Country</label>
              <input className={inputClass} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="US" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">City</label>
              <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="New York" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">ISP</label>
              <input className={inputClass} value={form.isp} onChange={(e) => setForm({ ...form, isp: e.target.value })} placeholder="AWS" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Add Node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──── Node Detail Modal ────

function NodeDetailModal({ node, onClose }: { node: Node; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'inbounds' | 'metrics'>('inbounds');

  const { data: inbounds } = useQuery({
    queryKey: ['node-inbounds', node.id],
    queryFn: () => nodesApi.getInbounds(node.id).then((r) => r.data),
  });

  const pushMutation = useMutation({
    mutationFn: () => nodesApi.pushConfig(node.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${node.status === 'ONLINE' ? 'bg-green-400' : 'bg-gray-600'}`} />
            <div>
              <h2 className="text-lg font-semibold text-white">{node.name}</h2>
              <p className="text-xs text-gray-500 font-mono">{node.host}:{node.port}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-800 text-gray-400"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-5">
          {(['inbounds', 'metrics'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'inbounds' ? 'Inbounds' : 'Metrics'}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => pushMutation.mutate()}
            disabled={pushMutation.isPending}
            className="my-2 px-3 py-1.5 rounded-lg bg-purple-600/10 text-purple-400 text-xs font-medium hover:bg-purple-600/20 disabled:opacity-50"
          >
            {pushMutation.isPending ? 'Pushing...' : 'Push Config'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'inbounds' && (
            <div className="space-y-2">
              {inbounds && inbounds.length > 0 ? inbounds.map((inb) => (
                <div key={inb.id} className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${inb.enable ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-200">{inb.tag}</div>
                    <div className="text-xs text-gray-500">{inb.protocol} · port {inb.port}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-gray-800 text-[11px] text-gray-400 font-mono">
                    {inb.protocol}
                  </span>
                </div>
              )) : (
                <div className="text-sm text-gray-500 text-center py-8">No inbounds configured</div>
              )}
            </div>
          )}
          {tab === 'metrics' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'CPU', value: node.cpuUsage != null ? `${node.cpuUsage.toFixed(1)}%` : '—' },
                { label: 'Memory', value: node.memUsage != null ? `${node.memUsage.toFixed(1)}%` : '—' },
                { label: 'Uptime', value: node.lastPingMs ? `${node.lastPingMs}ms` : '—' },
                { label: 'Version', value: node.version || '—' },
              ].map((m) => (
                <div key={m.label} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">{m.label}</div>
                  <div className="text-lg font-semibold text-gray-200 mt-1">{m.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
