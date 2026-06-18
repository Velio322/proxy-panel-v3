import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodesApi, Node } from '@/lib/api';
import { useI18n } from '@/i18n';
import { Wifi, ArrowUpDown, Trash2, X, Loader2 } from 'lucide-react';
import { NodesHeader } from './nodes/components/NodesHeader';
import { NodesFilters } from './nodes/components/NodesFilters';
import { NodeCard } from './nodes/components/NodeCard';
import { NodesTable } from './nodes/components/NodesTable';
import { CreateNodeModal } from './nodes/components/CreateNodeModal';
import { EditNodeModal } from './nodes/components/EditNodeModal';
import { DetailModal } from './nodes/components/DetailModal';

export function NodesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const [detailNode, setDetailNode] = useState<Node | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: nodes, isLoading, isFetching } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
    refetchInterval: 30000,
  });

  const checkMut = useMutation({
    mutationFn: (id: string) => nodesApi.check(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
    onError: (err: any) => alert(`Check failed: ${err?.response?.data?.error || err.message}`),
  });
  
  const pushMut = useMutation({
    mutationFn: (id: string) => nodesApi.pushConfig(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
    onError: (err: any) => alert(`Push failed: ${err?.response?.data?.error || err.message}`),
  });
  const restartMut = useMutation({
    mutationFn: (id: string) => nodesApi.restart(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
    onError: (err: any) => alert(`Restart failed: ${err?.response?.data?.error || err.message}`),
  });
  
  const deleteMut = useMutation({
    mutationFn: (id: string) => nodesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nodes'] }); setSelected(new Set()); },
    onError: (err: any) => alert(`Delete failed: ${err?.response?.data?.error || err.message}`),
  });

  const createLocalMut = useMutation({
    mutationFn: (data: { name: string }) => nodesApi.createLocal(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nodes'] });
      alert("Локальная нода успешно создается в фоновом режиме. Она появится в списке через минуту.");
    },
    onError: (err: any) => alert(`Ошибка установки локальной ноды: ${err?.response?.data?.error || err.message}`),
  });

  const handleAddLocalNode = () => {
    const name = prompt("Введите имя для локальной ноды:", "local-node");
    if (name) {
      createLocalMut.mutate({ name });
    }
  };

  const filtered = useMemo(() => nodes?.filter((n) => {
    if (search && !n.name.toLowerCase().includes(search.toLowerCase()) && !n.host.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && n.status !== statusFilter) return false;
    return true;
  }) || [], [nodes, search, statusFilter]);

  const onlineCount = nodes?.filter((n) => n.status === 'ONLINE').length || 0;
  const totalCount = nodes?.length || 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(n => n.id)));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <NodesHeader 
        onlineCount={onlineCount}
        totalCount={totalCount}
        isFetching={isFetching}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['nodes'] })}
        onAdd={() => setShowCreate(true)}
        onAddLocal={handleAddLocalNode}
      />

      <NodesFilters 
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 px-5 py-3 rounded-xl shadow-lg animate-slide-up"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <button onClick={selectAll} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--fg-subtle)' }}>
            {selected.size === filtered.length ? t('common.deselectAll') : t('common.selectAll')}
          </button>
          <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>{t('common.selected', { count: selected.size })}</span>
          <div className="flex-1" />
          <button onClick={() => { selected.forEach(id => checkMut.mutate(id)); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--bg-raised)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
            <Wifi size={14} /> {t('nodes.checkStatus')}
          </button>
          <button onClick={() => { selected.forEach(id => pushMut.mutate(id)); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--bg-raised)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
            <ArrowUpDown size={14} /> {t('nodes.pushConfig')}
          </button>
          <button onClick={() => { if (confirm(t('nodes.deleteCount', { count: selected.size }))) selected.forEach(id => deleteMut.mutate(id)); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
            <Trash2 size={14} /> {t('common.delete')}
          </button>
          <button onClick={() => setSelected(new Set())} className="p-1.5" style={{ color: 'var(--fg-muted)' }}><X size={16} /></button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="card flex items-center justify-center p-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--fg-subtle)' }}>Loading nodes...</span>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((node) => (
            <NodeCard
              key={node.id} 
              node={node}
              selected={selected.has(node.id)}
              onSelect={() => toggleSelect(node.id)}
              onCheck={() => checkMut.mutate(node.id)}
              onPush={() => pushMut.mutate(node.id)}
              onRestart={() => restartMut.mutate(node.id)}
              onDelete={() => { if (confirm(t('nodes.deleteConfirm', { name: node.name }))) deleteMut.mutate(node.id); }}
              onDetail={() => setDetailNode(node)}
              onEdit={() => setEditNode(node)}
            />
          ))}
        </div>
      ) : (
        <NodesTable
          nodes={filtered}
          selected={selected}
          onSelect={toggleSelect}
          onSelectAll={selectAll}
          allSelected={selected.size === filtered.length && filtered.length > 0}
          onCheck={(id) => checkMut.mutate(id)}
          onPush={(id) => pushMut.mutate(id)}
          onRestart={(id) => restartMut.mutate(id)}
          onDelete={(id) => { if (confirm(t('nodes.deleteNode'))) deleteMut.mutate(id); }}
          onDetail={setDetailNode}
          onEdit={setEditNode}
        />
      )}

      {/* Modals */}
      {showCreate && <CreateNodeModal onClose={() => setShowCreate(false)} />}
      {editNode && <EditNodeModal node={editNode} onClose={() => setEditNode(null)} />}
      {detailNode && <DetailModal node={detailNode} onClose={() => setDetailNode(null)} />}
    </div>
  );
}
