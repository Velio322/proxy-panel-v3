import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AdvancedJSONTabProps {
  form: Record<string, any>;
  update: (key: string, value: any) => void;
}

/**
 * TabAdvancedJSON — Raw JSON editor with two-way binding.
 * Form state → JSON (read) and JSON → Form state (write).
 */
export function TabAdvancedJSON({ form, update }: AdvancedJSONTabProps) {
  const [jsonStr, setJsonStr] = useState('');
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState<'form' | 'json'>('form');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync from form on mount and when form changes
  useEffect(() => {
    if (lastSync === 'form') {
      setJsonStr(JSON.stringify(formToRawJson(form), null, 2));
    }
  }, [form, lastSync]);

  const handleJsonChange = useCallback((val: string) => {
    setJsonStr(val);
    setLastSync('json');

    try {
      const parsed = JSON.parse(val);
      // Two-way binding: update form from JSON
      if (parsed.settings && typeof parsed.settings === 'object') {
        for (const [k, v] of Object.entries(parsed.settings)) {
          update(k, v);
        }
      }
      if (parsed.stream && typeof parsed.stream === 'object') {
        for (const [k, v] of Object.entries(parsed.stream)) {
          update(`stream_${k}`, v);
        }
      }
      if (parsed.sniffing && typeof parsed.sniffing === 'object') {
        for (const [k, v] of Object.entries(parsed.sniffing)) {
          update(`sniffing_${k}`, v);
        }
      }
      if (parsed.protocol) update('protocol', parsed.protocol);
      if (parsed.tag) update('tag', parsed.tag);
      if (parsed.port) update('port', parsed.port);
      if (parsed.listen) update('listen', parsed.listen);

      setError('');
    } catch {
      setError('Invalid JSON — fix syntax errors below');
    }
  }, [update]);

  const syncFromForm = () => {
    setLastSync('form');
    setJsonStr(JSON.stringify(formToRawJson(form), null, 2));
    setError('');
  };

  const validateJson = () => {
    try {
      const parsed = JSON.parse(jsonStr);
      const issues: string[] = [];

      if (!parsed.protocol) issues.push('Missing "protocol"');
      if (!parsed.tag) issues.push('Missing "tag"');
      if (!parsed.port) issues.push('Missing "port"');
      if (!parsed.settings) issues.push('Missing "settings" object');
      if (!parsed.stream) issues.push('Missing "stream" object');
      if (parsed.port && (parsed.port < 1 || parsed.port > 65535)) issues.push('Port out of range (1-65535)');
      if (parsed.settings?.id && !isValidUuid(parsed.settings.id)) issues.push('UUID format invalid');

      if (issues.length > 0) {
        setError(`Validation: ${issues.join('; ')}`);
      } else {
        setError('');
        update('validationPassed', true);
      }
    } catch {
      setError('Invalid JSON');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonStr);
  };

  const downloadJson = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.tag || 'inbound'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = jsonStr.split('\n').length;

  return (
    <div className="space-y-3 h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-fg-muted font-medium">Raw Inbound Configuration</span>
          <span className="text-[10px] text-fg-muted">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={syncFromForm}
            className="px-2.5 py-1 rounded-lg bg-bg-raised border border-border text-[11px] text-fg-muted hover:text-fg transition-colors">
            ↻ Sync from Form
          </button>
          <button onClick={validateJson}
            className="px-2.5 py-1 rounded-lg bg-bg-raised border border-border text-[11px] text-fg-muted hover:text-fg transition-colors">
            ✓ Validate
          </button>
          <button onClick={copyToClipboard}
            className="px-2.5 py-1 rounded-lg bg-bg-raised border border-border text-[11px] text-fg-muted hover:text-fg transition-colors">
            Copy
          </button>
          <button onClick={downloadJson}
            className="px-2.5 py-1 rounded-lg bg-bg-raised border border-border text-[11px] text-fg-muted hover:text-fg transition-colors">
            Download
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 text-[11px] text-red-400 shrink-0">
          {error}
        </div>
      )}

      {/* JSON Editor */}
      <div className="flex-1 relative min-h-0">
        <textarea
          ref={textareaRef}
          value={jsonStr}
          onChange={(e) => handleJsonChange(e.target.value)}
          className={cn(
            "w-full h-full px-4 py-3 rounded-xl border font-mono text-[12px] leading-relaxed resize-none focus:outline-none",
            error
              ? "bg-red-500/5 border-red-500/30 text-red-300"
              : "bg-bg-raised/50 border-border text-fg-muted focus:border-[hsl(var(--accent/0.3))]"
          )}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        {/* Line numbers overlay */}
        <div className="absolute left-0 top-0 w-10 h-full bg-surface rounded-l-xl border-r border-border/50 pointer-events-none overflow-hidden">
          <div className="px-2 py-3 text-[10px] text-fg-muted font-mono leading-relaxed">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-[10px] text-fg-muted shrink-0 pt-1">
        <div className="flex items-center gap-3">
          <span>Protocol: <span className="text-fg-muted font-medium">{form.protocol}</span></span>
          <span>Port: <span className="text-fg-muted font-medium">{form.port}</span></span>
          <span>Tag: <span className="text-fg-muted font-medium">{form.tag}</span></span>
        </div>
        <span>Two-way sync active — edit JSON or use form tabs</span>
      </div>
    </div>
  );
}

// ──── Helpers ────

function formToRawJson(form: Record<string, any>): any {
  const result: any = {
    protocol: form.protocol,
    tag: form.tag,
    port: form.port,
    listen: form.listen || '0.0.0.0',
    enable: form.enable !== false,
    remark: form.remark || '',
  };

  // Settings
  const settings: any = {};
  if (form.uuid) settings.id = form.uuid;
  if (form.password) settings.password = form.password;
  if (form.flow) settings.flow = form.flow;
  if (form.method) settings.method = form.method;
  if (form.alterId !== undefined) settings.alterId = form.alterId;

  // Protocol-specific settings
  if (form.protocol === 'HYSTERIA2') {
    if (form.sni) settings.sni = form.sni;
    if (form.hy2ObfsType && form.hy2ObfsType !== 'none') {
      settings.obfs = { type: form.hy2ObfsType, password: form.hy2ObfsPassword || '' };
    }
    if (form.hy2BandwidthUp) settings.bandwidth = { up: form.hy2BandwidthUp, down: form.hy2BandwidthDown };
    if (form.hy2MaxClient) settings.maxClient = form.hy2MaxClient;
    if (form.hy2MaxStream) settings.maxStream = form.hy2MaxStream;
  }

  if (form.protocol === 'NAIVEPROXY') {
    settings.proxy = form.naiveProxy || '';
    settings.proto = form.naiveProto || 'quic';
    settings.nonce = form.naiveNonce || '';
    settings.padding = form.naivePadding;
    settings.paddingLength = form.naivePaddingLength;
  }

  if (form.protocol === 'MIERU') {
    settings.authentication = form.mieruAuth || 'password';
    settings.sessionPlacement = form.mieruSessionPlacement || 'random';
    settings.sequencePlacement = form.mieruSequencePlacement || 'random';
    settings.bufferReadSize = form.mieruBufferReadSize;
    settings.bufferWriteSize = form.mieruBufferWriteSize;
  }

  result.settings = settings;

  // Stream settings
  const stream: any = {
    security: form.security || 'none',
    network: form.transport || 'tcp',
    sni: form.sni || '',
    fingerprint: form.fingerprint || 'chrome',
  };

  if (form.security === 'reality') {
    stream.publicKey = form.realityPublicKey || '';
    stream.shortId = form.realityShortId || '';
    stream.spiderX = form.realitySpiderX || '';
    stream.dest = form.realityDest || '';
    stream.serverNames = form.realityServerNames ? form.realityServerNames.split(',').map((s: string) => s.trim()) : [];
  }

  if (form.security === 'tls') {
    stream.alpn = form.alpn || 'h2,http/1.1';
    stream.allowInsecure = form.allowInsecure || false;
    stream.minVersion = form.minVersion || '1.2';
    stream.maxVersion = form.maxVersion || '1.3';
  }

  // Transport-specific
  if (form.transport === 'ws') {
    stream.wsSettings = {
      path: form.wsPath || '/',
      headers: form.wsHost ? { Host: form.wsHost } : {},
      maxEarlyData: form.wsMaxEarlyData || 0,
    };
    if (form.wsCompression && form.wsCompression !== 'none') {
      stream.wsSettings.compress = true;
    }
  }

  if (form.transport === 'grpc') {
    stream.grpcSettings = {
      serviceName: form.grpcServiceName || '',
      multiMode: form.grpcMultiMode || false,
    };
  }

  if (form.transport === 'h2') {
    stream.httpSettings = {
      path: form.h2Path || '/',
      host: form.h2Host ? form.h2Host.split(',') : [''],
    };
  }

  if (form.transport === 'httpupgrade') {
    stream.httpupgradeSettings = {
      path: form.httpupgradePath || '/',
      host: form.httpupgradeHost || '',
    };
  }

  if (form.transport === 'xhttp') {
    stream.xhttpSettings = {
      path: form.xhttpPath || '',
      mode: form.xhttpMode || 'auto',
    };
  }

  if (form.transport === 'kcp') {
    stream.kcpSettings = {
      headerType: form.kcpHeaderType || 'none',
      seed: form.kcpSeed || '',
      congestion: form.kcpCongestion || false,
      uplinkCapacity: form.kcpUplinkCapacity || 100,
      downlinkCapacity: form.kcpDownlinkCapacity || 100,
    };
  }

  result.stream = stream;

  // Sniffing
  result.sniffing = {
    enabled: form.sniffing !== false,
    destOverride: form.sniffingDestOverride || ['http', 'tls'],
    metadataOnly: form.sniffingMetadataOnly || false,
    routeOnly: form.sniffingRouteOnly || false,
  };

  if (form.sniffingExcludedDomains) {
    result.sniffing.excludeDomains = form.sniffingExcludedDomains.split(',').map((s: string) => s.trim());
  }
  if (form.sniffingExcludedIPs) {
    result.sniffing.excludeIPs = form.sniffingExcludedIPs.split(',').map((s: string) => s.trim());
  }

  return result;
}

function isValidUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
