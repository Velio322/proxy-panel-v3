import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboundsApi, nodesApi, Inbound } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Network } from 'lucide-react';
import { useI18n } from '@/i18n';
import { InboundsHeader } from './inbounds/components/InboundsHeader';
import { InboundsFilters } from './inbounds/components/InboundsFilters';
import { InboundRow } from './inbounds/components/InboundRow';
import { InboundModal, InboundForm } from '@/components/InboundModal';

function formToPayload(form: InboundForm) {
  const isXray = ['VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS'].includes(form.protocol);

  let settings: Record<string, any> = {};
  if (['VLESS', 'VMESS'].includes(form.protocol)) {
    settings = { id: form.uuid || crypto.randomUUID(), flow: form.protocol === 'VLESS' ? form.flow || undefined : undefined };
    if (form.protocol === 'VMESS') settings.alterId = form.alterId;
  } else if (form.protocol === 'TROJAN') {
    settings = { password: form.password || crypto.randomUUID().replace(/-/g, '').substring(0, 16) };
  } else if (form.protocol === 'SHADOWSOCKS') {
    settings = { method: form.method, password: form.password || crypto.randomUUID().replace(/-/g, '').substring(0, 16) };
  } else if (form.protocol === 'HYSTERIA2') {
    settings = {
      password: form.password || crypto.randomUUID().replace(/-/g, '').substring(0, 16),
      obfs: form.hy2ObfsType !== 'none' ? { type: form.hy2ObfsType, password: form.hy2ObfsPassword } : undefined,
      bandwidth: { up: form.hy2BandwidthUp, down: form.hy2BandwidthDown },
      maxClient: form.hy2MaxClient || undefined,
      maxStream: form.hy2MaxStream || undefined,
    };
  } else if (form.protocol === 'NAIVEPROXY') {
    settings = { proxy: form.naiveProxy, proto: form.naiveProto };
  } else if (form.protocol === 'MIERU') {
    settings = { auth: form.mieruAuth, password: form.password || crypto.randomUUID().replace(/-/g, '').substring(0, 16) };
  }

  let stream: Record<string, any> = {};
  if (isXray) {
    stream = { security: form.security || 'none', network: form.transport };

    if (form.security === 'tls') {
      stream.tlsSettings = {
        sni: form.sni, fingerprint: form.fingerprint,
        alpn: form.alpn ? form.alpn.split(',').map((a) => a.trim()).filter(Boolean) : [],
        allowInsecure: form.allowInsecure,
      };
      if (form.minVersion) stream.tlsSettings.minVersion = form.minVersion;
      if (form.maxVersion) stream.tlsSettings.maxVersion = form.maxVersion;
      if (form.certificates) stream.tlsSettings.certificates = form.certificates;
    }

    if (form.security === 'reality') {
      stream.realitySettings = {
        show: false, dest: form.realityDest, serverNames: form.realityServerNames ? form.realityServerNames.split(',').map((s) => s.trim()) : [form.sni],
        privateKey: form.realityPrivateKey, shortIds: form.realityShortId ? [form.realityShortId] : [],
        fingerprint: form.fingerprint,
      };
      if (form.realityPublicKey) stream.realitySettings.publicKey = form.realityPublicKey;
      if (form.realitySpiderX) stream.realitySettings.spiderX = form.realitySpiderX;
    }

    const transportMap: Record<string, string> = { ws: 'wsSettings', grpc: 'grpcSettings', tcp: 'tcpSettings', httpupgrade: 'httpupgradeSettings', xhttp: 'xhttpSettings', h2: 'httpSettings', kcp: 'kcpSettings' };
    const transportKey = transportMap[form.transport];
    if (transportKey) {
      const ts: Record<string, any> = {};
      if (form.transport === 'ws') {
        ts.path = form.wsPath || '/';
        if (form.wsHost) ts.host = form.wsHost;
        if (form.wsMaxEarlyData > 0) ts.maxEarlyData = form.wsMaxEarlyData;
        if (form.wsUseBrowserAgent) ts.useBrowserForwarding = true;
      } else if (form.transport === 'grpc') {
        ts.serviceName = form.grpcServiceName;
        if (form.grpcMultiMode) ts.multiMode = true;
      } else if (form.transport === 'h2') {
        ts.path = form.h2Path || '/';
        ts.host = [form.h2Host || form.sni];
        if (form.h2Method) ts.method = form.h2Method;
      } else if (form.transport === 'httpupgrade') {
        ts.path = form.httpupgradePath || '/';
        if (form.httpupgradeHost) ts.host = form.httpupgradeHost;
      } else if (form.transport === 'xhttp') {
        ts.mode = form.xhttpMode || 'auto';
        if (form.xhttpPath) ts.path = form.xhttpPath;
      } else if (form.transport === 'kcp') {
        if (form.kcpHeaderType !== 'none') ts.header = { type: form.kcpHeaderType };
        if (form.kcpSeed) ts.seed = form.kcpSeed;
      }
      if (Object.keys(ts).length > 0) stream[transportKey] = ts;
    }
  }

  const sniffingConfig = isXray ? {
    enabled: form.sniffing,
    destOverride: form.sniffingDestOverride,
    metadataOnly: form.sniffingMetadataOnly || undefined,
    routeOnly: form.sniffingRouteOnly || undefined,
    domainsExcluded: form.sniffingExcludedDomains ? form.sniffingExcludedDomains.split(',').map((d) => d.trim()).filter(Boolean) : undefined,
  } : undefined;

  return { settings, stream, sniffing: sniffingConfig };
}

export function InboundsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [protoFilter, setProtoFilter] = useState('');
  const [nodeFilter, setNodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editInbound, setEditInbound] = useState<Inbound | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: inbounds, isLoading, isFetching } = useQuery({
    queryKey: ['inbounds', protoFilter, nodeFilter],
    queryFn: () => inboundsApi.getAll({ protocol: protoFilter || undefined, nodeId: nodeFilter || undefined }).then((r) => r.data),
  });

  const { data: nodes } = useQuery({
    queryKey: ['nodes-list'],
    queryFn: () => nodesApi.getAll().then((r) => r.data),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => inboundsApi.toggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbounds'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => inboundsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbounds'] }),
  });

  const createMut = useMutation({
    mutationFn: async (form: InboundForm) => {
      const { settings, stream, sniffing } = formToPayload(form);
      const result = await inboundsApi.create({
        nodeId: form.nodeId, protocol: form.protocol, tag: form.tag,
        port: form.port, listen: form.listen, settings, stream,
        sniffing: sniffing?.enabled ?? form.sniffing,
        remark: form.remark || undefined, enable: form.enable,
      });
      for (const ps of form.portShares || []) {
        await inboundsApi.addPortShare(result.data.id, {
          protocol: ps.protocol, tag: ps.tag, host: ps.host || undefined,
          path: ps.path || undefined, settings: {}, stream: {}, enable: ps.enable,
        });
      }
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbounds'] }); setShowCreate(false); },
  });

  const editMut = useMutation({
    mutationFn: async (form: InboundForm) => {
      if (!form.id) return;
      const { settings, stream, sniffing } = formToPayload(form);
      await inboundsApi.update(form.id, {
        protocol: form.protocol, tag: form.tag, port: form.port,
        listen: form.listen, settings, stream,
        sniffing: sniffing?.enabled ?? form.sniffing,
        remark: form.remark || undefined, enable: form.enable,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbounds'] }); setEditInbound(null); },
  });

  const filtered = (inbounds || []).filter((inb) => {
    if (search) {
      const s = search.toLowerCase();
      if (!inb.tag.toLowerCase().includes(s) && !inb.remark?.toLowerCase().includes(s) && !inb.node?.name?.toLowerCase().includes(s)) return false;
    }
    if (statusFilter === 'enabled' && !inb.enable) return false;
    if (statusFilter === 'disabled' && inb.enable) return false;
    return true;
  });

  // Group by node
  const grouped = new Map<string, Inbound[]>();
  for (const inb of filtered) {
    const key = inb.nodeId || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(inb);
  }

  const totalEnabled = (inbounds || []).filter((i) => i.enable).length;
  const protocolsCount = new Set((inbounds || []).map((i) => i.protocol)).size;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <InboundsHeader 
        totalEnabled={totalEnabled}
        totalCount={inbounds?.length || 0}
        protocolsCount={protocolsCount}
        isFetching={isFetching}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['inbounds'] })}
        onAdd={() => setShowCreate(true)}
      />

      <InboundsFilters 
        search={search}
        setSearch={setSearch}
        protoFilter={protoFilter}
        setProtoFilter={setProtoFilter}
        nodeFilter={nodeFilter}
        setNodeFilter={setNodeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        nodes={nodes || []}
      />

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center p-20 bg-surface border border-border rounded-xl shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-fg-subtle" />
            <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">Loading data...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-bg-raised border border-border-subtle flex items-center justify-center mb-6">
            <Network size={28} className="text-fg-subtle" />
          </div>
          <h3 className="text-sm font-bold text-fg">{t('inbounds.noInbounds')}</h3>
          <p className="text-xs text-fg-muted mt-1.5 mb-6 max-w-xs mx-auto leading-relaxed">{t('inbounds.noInboundsDesc')}</p>
          <button onClick={() => setShowCreate(true)} className="px-6 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-md active:scale-95">
            {t('inbounds.addInbound')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([nodeId, nodeInbounds]) => {
            const node = nodes?.find((n) => n.id === nodeId);
            return (
              <div key={nodeId} className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
                {/* Node header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-bg-raised/50">
                  <div className={cn("w-2 h-2 rounded-full", node?.status === 'ONLINE' ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-400")} />
                  <span className="text-sm font-bold text-fg">{node?.name || 'Unknown Node'}</span>
                  <span className="text-[11px] text-fg-muted font-mono font-medium">{node?.host}</span>
                  <div className="flex-1" />
                  <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{nodeInbounds.length} inbound{nodeInbounds.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Inbounds list */}
                <div className="divide-y divide-zinc-100">
                  {nodeInbounds.map((inb) => (
                    <InboundRow
                      key={inb.id} inbound={inb}
                      expanded={expandedId === inb.id}
                      onToggleExpand={() => setExpandedId(expandedId === inb.id ? null : inb.id)}
                      onToggle={() => toggleMut.mutate(inb.id)}
                      onEdit={() => setEditInbound(inb)}
                      onDelete={() => { if (confirm(`Delete inbound "${inb.tag}"?`)) deleteMut.mutate(inb.id); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <InboundModal
          nodes={(nodes || []).map((n) => ({ id: n.id, name: n.name, host: n.host, status: n.status }))}
          onClose={() => setShowCreate(false)}
          onSave={async (form) => { await createMut.mutateAsync(form); }}
        />
      )}

      {editInbound && (
        <InboundModal
          inbound={editInbound}
          nodes={(nodes || []).map((n) => ({ id: n.id, name: n.name, host: n.host, status: n.status }))}
          onClose={() => setEditInbound(null)}
          onSave={async (form) => { await editMut.mutateAsync(form); }}
        />
      )}
    </div>
  );
}
