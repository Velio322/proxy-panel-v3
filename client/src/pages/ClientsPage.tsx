import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, Client } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/utils';
import { Users, Plus, Search, Ban, RotateCcw, Trash2, Eye, Copy, ExternalLink, Loader2, X } from 'lucide-react';

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, page],
    queryFn: () => clientsApi.getAll({ search, page, limit: 20 }).then((r) => r.data),
  });

  const banMutation = useMutation({
    mutationFn: (id: string) => clientsApi.toggleBan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-sm text-gray-400 mt-1">{data?.total || 0} total clients</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium">
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="text" placeholder="Search clients..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-purple-500" /></div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Traffic</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expires</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-200">{c.username}</div>
                    <div className="text-xs text-gray-500 font-mono">{c.uuid.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-300">{formatBytes(c.usedTraffic)} / {c.trafficLimit > 0 ? formatBytes(c.trafficLimit) : '∞'}</div>
                    <div className="w-24 h-1.5 bg-gray-800 rounded-full mt-1">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${c.trafficLimit > 0 ? Math.min((c.usedTraffic / c.trafficLimit) * 100, 100) : 0}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{c.expireAt ? formatDate(c.expireAt) : 'Never'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${c.banned ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {c.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => banMutation.mutate(c.id)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-amber-400" title={c.banned ? 'Unban' : 'Ban'}>
                        <Ban size={14} />
                      </button>
                      <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(c.id); }} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-red-400" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <span className="text-xs text-gray-500">Page {data.page} of {data.pages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 disabled:opacity-50">Prev</button>
                <button onClick={() => setPage(Math.min(data.pages, page + 1))} disabled={page >= data.pages} className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddClientModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ username: '', email: '', trafficLimit: 0, note: '' });
  const [created, setCreated] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: () => clientsApi.create(form),
    onSuccess: (r) => { setCreated(r.data); queryClient.invalidateQueries({ queryKey: ['clients'] }); },
  });

  const inputClass = "w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20";

  if (created) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md mx-4 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Client Created</h3>
          <div className="space-y-3 bg-gray-800/50 rounded-lg p-4">
            <div><span className="text-xs text-gray-500">Username:</span> <span className="text-sm text-gray-200">{created.username}</span></div>
            <div><span className="text-xs text-gray-500">Password:</span> <span className="text-sm text-gray-200 font-mono">{created.password}</span></div>
            <div><span className="text-xs text-gray-500">Sub URL:</span> <span className="text-sm text-purple-400 break-all">{`${window.location.origin}/api/v1/client/${created.subToken}/sub`}</span></div>
          </div>
          <button onClick={onClose} className="mt-4 w-full px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Client</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-800 text-gray-400"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-gray-400 mb-1.5">Username *</label><input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label><input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-400 mb-1.5">Traffic Limit (bytes, 0 = unlimited)</label><input className={inputClass} type="number" value={form.trafficLimit} onChange={(e) => setForm({ ...form, trafficLimit: +e.target.value })} /></div>
          <div><label className="block text-xs font-medium text-gray-400 mb-1.5">Note</label><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 text-gray-300 text-sm">Cancel</button>
            <button onClick={() => mutation.mutate()} disabled={!form.username || mutation.isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
