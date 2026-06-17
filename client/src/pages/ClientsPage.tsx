import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, nodesApi, inboundsApi, Client } from '@/lib/api';
import { useI18n } from '@/i18n';
import { ClientsHeader } from './clients/components/ClientsHeader';
import { ClientsFilters } from './clients/components/ClientsFilters';
import { ClientsTable } from './clients/components/ClientsTable';
import { CreateClientModal } from './clients/components/CreateClientModal';
import { EditClientModal } from './clients/components/EditClientModal';
import { SubscriptionModal } from './clients/components/SubscriptionModal';

export function ClientsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  
  // State
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [protocolFilter, setProtocolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [subClient, setSubClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);

  // Queries
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['clients', search, page, protocolFilter, statusFilter],
    queryFn: () => clientsApi.getAll({
      search, page, limit: 20,
      banned: statusFilter === 'banned' ? 'true' : statusFilter === 'active' ? 'false' : undefined,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes-list'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
  });

  const { data: allInbounds } = useQuery({
    queryKey: ['inbounds-all'],
    queryFn: () => inboundsApi.getAll().then((r) => r.data),
  });

  // Mutations
  const banMut = useMutation({
    mutationFn: (id: string) => clientsApi.toggleBan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const resetMut = useMutation({
    mutationFn: (id: string) => clientsApi.resetTraffic(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const clients = data?.data || [];
  const total = data?.total || 0;
  const activeCount = clients.filter((c) => !c.banned).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <ClientsHeader 
        total={total} 
        activeCount={activeCount} 
        isFetching={isFetching} 
        onAdd={() => setShowCreate(true)} 
      />

      <ClientsFilters 
        search={search}
        setSearch={(s) => { setSearch(s); setPage(1); }}
        protocolFilter={protocolFilter}
        setProtocolFilter={setProtocolFilter}
        statusFilter={statusFilter}
        setStatusFilter={(s) => { setStatusFilter(s); setPage(1); }}
      />

      <ClientsTable 
        clients={clients}
        page={page}
        setPage={setPage}
        totalPages={data?.pages || 0}
        total={total}
        onSub={setSubClient}
        onEdit={setEditClient}
        onBan={(id) => banMut.mutate(id)}
        onDelete={(c) => {
          if (confirm(t('clients.deleteConfirm', { name: c.username }))) {
            delMut.mutate(c.id);
          }
        }}
        onResetTraffic={(id) => resetMut.mutate(id)}
        onAdd={() => setShowCreate(true)}
        isLoading={isLoading}
      />

      {/* Modals */}
      {showCreate && (
        <CreateClientModal 
          onClose={() => setShowCreate(false)} 
          inbounds={allInbounds || []} 
          nodes={nodes || []} 
        />
      )}
      
      {subClient && (
        <SubscriptionModal 
          client={subClient} 
          onClose={() => setSubClient(null)} 
        />
      )}
      
      {editClient && (
        <EditClientModal 
          client={editClient} 
          onClose={() => setEditClient(null)} 
          inbounds={allInbounds || []} 
        />
      )}
    </div>
  );
}
