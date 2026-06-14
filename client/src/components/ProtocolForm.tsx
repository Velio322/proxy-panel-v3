import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, Code } from 'lucide-react';

export interface ProtocolSettings {
  settings: Record<string, any>;
  stream: Record<string, any>;
}

interface ProtocolFormProps {
  protocol: string;
  value: ProtocolSettings;
  onChange: (value: ProtocolSettings) => void;
}

const vlessNetworks = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'];
const vlessSecurities = ['tls', 'reality', 'none'];
const vlessFingerprints = ['chrome', 'firefox', 'safari', 'edge', 'random', 'randomized'];
const shadowsocksMethods = [
  'aes-128-gcm', 'aes-256-gcm', 'chacha20-poly1305',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
];
const hysteria2ObfsTypes = ['salamander', 'none'];
const tuicCongestion = ['bbr', 'cubic', 'new_reno'];
const tuicUdpRelay = ['native', 'quic'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const inputClass = "h-9 bg-white/5 border-white/10 focus:border-astral-500 rounded-lg text-sm font-mono";
const selectClass = "h-9 bg-white/5 border-white/10 rounded-lg text-sm";

function VlessForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const st = value.stream;
  const security = st.security || 'tls';
  const network = st.network || 'tcp';

  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });
  const updateStream = (key: string, val: any) => onChange({ ...value, stream: { ...st, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="UUID (автоматически из клиента)">
          <Input value={s.id || ''} onChange={(e) => updateSettings('id', e.target.value)} placeholder="Генерируется из UUID клиента" className={inputClass} disabled />
        </Field>
        <Field label="Flow">
          <Select value={s.flow || 'xtls-rprx-vision'} onValueChange={(v) => updateSettings('flow', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="xtls-rprx-vision">xtls-rprx-vision (рекомендуется)</SelectItem>
              <SelectItem value="">Нет</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Безопасность">
        <Field label="Тип">
          <Select value={security} onValueChange={(v) => updateStream('security', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {vlessSecurities.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {security === 'tls' && (
          <>
            <Field label="SNI (Server Name)">
              <Input value={st.sni || ''} onChange={(e) => updateStream('sni', e.target.value)} placeholder="example.com" className={inputClass} />
            </Field>
            <Field label="Fingerprint">
              <Select value={st.fingerprint || 'chrome'} onValueChange={(v) => updateStream('fingerprint', v)}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vlessFingerprints.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ALPN">
              <Input value={st.alpn || ''} onChange={(e) => updateStream('alpn', e.target.value)} placeholder="h2,http/1.1" className={inputClass} />
            </Field>
          </>
        )}
        {security === 'reality' && (
          <>
            <Field label="SNI (Dest)">
              <Input value={st.sni || ''} onChange={(e) => updateStream('sni', e.target.value)} placeholder="www.google.com" className={inputClass} />
            </Field>
            <Field label="Fingerprint">
              <Select value={st.fingerprint || 'chrome'} onValueChange={(v) => updateStream('fingerprint', v)}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vlessFingerprints.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Public Key">
              <Input value={st.publicKey || ''} onChange={(e) => updateStream('publicKey', e.target.value)} placeholder="x25519 public key" className={inputClass} />
            </Field>
            <Field label="Short ID">
              <Input value={st.shortId || ''} onChange={(e) => updateStream('shortId', e.target.value)} placeholder="hex string" className={inputClass} />
            </Field>
            <Field label="SpiderX">
              <Input value={st.spiderX || ''} onChange={(e) => updateStream('spiderX', e.target.value)} placeholder="/" className={inputClass} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Транспорт">
        <Field label="Тип">
          <Select value={network} onValueChange={(v) => updateStream('network', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {vlessNetworks.map(n => <SelectItem key={n} value={n}>{n.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {network === 'ws' && (
          <>
            <Field label="Path">
              <Input value={st.wsSettings?.path || '/'} onChange={(e) => updateStream('wsSettings', { ...st.wsSettings, path: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Host (Headers)">
              <Input value={st.wsSettings?.headers?.Host || ''} onChange={(e) => updateStream('wsSettings', { ...st.wsSettings, headers: { ...st.wsSettings?.headers, Host: e.target.value } })} placeholder="example.com" className={inputClass} />
            </Field>
          </>
        )}
        {network === 'grpc' && (
          <Field label="Service Name">
            <Input value={st.grpcSettings?.serviceName || ''} onChange={(e) => updateStream('grpcSettings', { ...st.grpcSettings, serviceName: e.target.value })} className={inputClass} />
          </Field>
        )}
        {network === 'httpupgrade' && (
          <>
            <Field label="Path">
              <Input value={st.httpupgradeSettings?.path || '/'} onChange={(e) => updateStream('httpupgradeSettings', { ...st.httpupgradeSettings, path: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Host">
              <Input value={st.httpupgradeSettings?.host || ''} onChange={(e) => updateStream('httpupgradeSettings', { ...st.httpupgradeSettings, host: e.target.value })} className={inputClass} />
            </Field>
          </>
        )}
        {network === 'xhttp' && (
          <Field label="Mode">
            <Select value={st.xhttpSettings?.mode || 'auto'} onValueChange={(v) => updateStream('xhttpSettings', { ...st.xhttpSettings, mode: v })}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto</SelectItem>
                <SelectItem value="packet-up">packet-up</SelectItem>
                <SelectItem value="stream-up">stream-up</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </Section>
    </div>
  );
}

function VmessForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const st = value.stream;
  const network = st.network || 'ws';

  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });
  const updateStream = (key: string, val: any) => onChange({ ...value, stream: { ...st, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="UUID">
          <Input value={s.id || ''} onChange={(e) => updateSettings('id', e.target.value)} placeholder="Генерируется из UUID клиента" className={inputClass} disabled />
        </Field>
        <Field label="AlterID">
          <Input type="number" value={s.alterId ?? 0} onChange={(e) => updateSettings('alterId', parseInt(e.target.value) || 0)} className={inputClass} />
        </Field>
        <Field label="Безопасность">
          <Select value={s.security || 'auto'} onValueChange={(v) => updateSettings('security', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">auto</SelectItem>
              <SelectItem value="aes-128-gcm">AES-128-GCM</SelectItem>
              <SelectItem value="chacha20-poly1305">ChaCha20-Poly1305</SelectItem>
              <SelectItem value="none">Нет</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Транспорт">
        <Field label="Тип">
          <Select value={network} onValueChange={(v) => updateStream('network', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {vlessNetworks.map(n => <SelectItem key={n} value={n}>{n.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {network === 'ws' && (
          <>
            <Field label="Path">
              <Input value={st.wsSettings?.path || '/'} onChange={(e) => updateStream('wsSettings', { ...st.wsSettings, path: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Host">
              <Input value={st.wsSettings?.headers?.Host || ''} onChange={(e) => updateStream('wsSettings', { ...st.wsSettings, headers: { ...st.wsSettings?.headers, Host: e.target.value } })} className={inputClass} />
            </Field>
          </>
        )}
        {network === 'grpc' && (
          <Field label="Service Name">
            <Input value={st.grpcSettings?.serviceName || ''} onChange={(e) => updateStream('grpcSettings', { ...st.grpcSettings, serviceName: e.target.value })} className={inputClass} />
          </Field>
        )}
      </Section>

      <Section title="TLS">
        <Field label="Включить TLS">
          <Switch checked={st.security === 'tls'} onCheckedChange={(c) => updateStream('security', c ? 'tls' : 'none')} />
        </Field>
        {st.security === 'tls' && (
          <>
            <Field label="SNI">
              <Input value={st.tlsSettings?.serverName || ''} onChange={(e) => updateStream('tlsSettings', { ...st.tlsSettings, serverName: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Fingerprint">
              <Select value={st.tlsSettings?.fingerprint || 'chrome'} onValueChange={(v) => updateStream('tlsSettings', { ...st.tlsSettings, fingerprint: v })}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vlessFingerprints.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}

function TrojanForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const st = value.stream;
  const network = st.network || 'tcp';

  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });
  const updateStream = (key: string, val: any) => onChange({ ...value, stream: { ...st, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="Пароль">
          <Input value={s.password || ''} onChange={(e) => updateSettings('password', e.target.value)} placeholder="Пароль клиента" className={inputClass} />
        </Field>
      </Section>
      <Section title="TLS">
        <Field label="SNI">
          <Input value={st.tlsSettings?.serverName || ''} onChange={(e) => updateStream('tlsSettings', { ...st.tlsSettings, serverName: e.target.value })} placeholder="example.com" className={inputClass} />
        </Field>
        <Field label="Fingerprint">
          <Select value={st.tlsSettings?.fingerprint || 'chrome'} onValueChange={(v) => updateStream('tlsSettings', { ...st.tlsSettings, fingerprint: v })}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {vlessFingerprints.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </Section>
      <Section title="Транспорт">
        <Field label="Тип">
          <Select value={network} onValueChange={(v) => updateStream('network', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tcp">TCP</SelectItem>
              <SelectItem value="ws">WebSocket</SelectItem>
              <SelectItem value="grpc">gRPC</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {network === 'ws' && (
          <Field label="Path">
            <Input value={st.wsSettings?.path || '/'} onChange={(e) => updateStream('wsSettings', { ...st.wsSettings, path: e.target.value })} className={inputClass} />
          </Field>
        )}
        {network === 'grpc' && (
          <Field label="Service Name">
            <Input value={st.grpcSettings?.serviceName || ''} onChange={(e) => updateStream('grpcSettings', { ...st.grpcSettings, serviceName: e.target.value })} className={inputClass} />
          </Field>
        )}
      </Section>
    </div>
  );
}

function ShadowsocksForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="Метод шифрования">
          <Select value={s.method || 'aes-256-gcm'} onValueChange={(v) => updateSettings('method', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {shadowsocksMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Пароль">
          <Input value={s.password || ''} onChange={(e) => updateSettings('password', e.target.value)} placeholder="Пароль клиента" className={inputClass} />
        </Field>
      </Section>
    </div>
  );
}

function Hysteria2Form({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="Пароль">
          <Input value={s.password || ''} onChange={(e) => updateSettings('password', e.target.value)} placeholder="Пароль клиента" className={inputClass} />
        </Field>
        <Field label="SNI">
          <Input value={s.sni || ''} onChange={(e) => updateSettings('sni', e.target.value)} placeholder="example.com" className={inputClass} />
        </Field>
      </Section>
      <Section title="Обфускация">
        <Field label="Тип">
          <Select value={s.obfs?.type || 'salamander'} onValueChange={(v) => updateSettings('obfs', { ...s.obfs, type: v })}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {hysteria2ObfsTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {s.obfs?.type !== 'none' && (
          <Field label="Пароль обфускации">
            <Input value={s.obfs?.password || ''} onChange={(e) => updateSettings('obfs', { ...s.obfs, password: e.target.value })} className={inputClass} />
          </Field>
        )}
      </Section>
      <Section title="Пропускная способность">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Upload (Mbps)">
            <Input type="number" value={s.uploadMbps || ''} onChange={(e) => updateSettings('uploadMbps', parseInt(e.target.value) || undefined)} placeholder="∞" className={inputClass} />
          </Field>
          <Field label="Download (Mbps)">
            <Input type="number" value={s.downloadMbps || ''} onChange={(e) => updateSettings('downloadMbps', parseInt(e.target.value) || undefined)} placeholder="∞" className={inputClass} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function NaiveProxyForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="Паддинг заголовков">
          <Switch checked={s['pad-headers'] || false} onCheckedChange={(c) => updateSettings('pad-headers', c)} />
        </Field>
        <Field label="Статическая длина паддинга">
          <Input type="number" value={s['padding-static-length'] || 0} onChange={(e) => updateSettings('padding-static-length', parseInt(e.target.value) || 0)} className={inputClass} />
        </Field>
      </Section>
    </div>
  );
}

function MieruForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="Протокол">
          <Select value={s.protocol || 'TCP'} onValueChange={(v) => updateSettings('protocol', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TCP">TCP</SelectItem>
              <SelectItem value="UDP">UDP</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Шифрование">
          <Select value={s.encryption || 'AES_GCM'} onValueChange={(v) => updateSettings('encryption', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AES_GCM">AES-GCM</SelectItem>
              <SelectItem value="CHACHA20_POLY1305">ChaCha20-Poly1305</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Паддинг">
          <Switch checked={s.padding ?? true} onCheckedChange={(c) => updateSettings('padding', c)} />
        </Field>
      </Section>
    </div>
  );
}

function TuicForm({ value, onChange }: { value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }) {
  const s = value.settings;
  const updateSettings = (key: string, val: any) => onChange({ ...value, settings: { ...s, [key]: val } });

  return (
    <div className="space-y-5">
      <Section title="Основные">
        <Field label="Congestion Control">
          <Select value={s.congestion_control || 'bbr'} onValueChange={(v) => updateSettings('congestion_control', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {tuicCongestion.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="UDP Relay Mode">
          <Select value={s.udp_relay_mode || 'native'} onValueChange={(v) => updateSettings('udp_relay_mode', v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {tuicUdpRelay.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="SNI">
          <Input value={s.sni || ''} onChange={(e) => updateSettings('sni', e.target.value)} placeholder="example.com" className={inputClass} />
        </Field>
        <Field label="Allow Insecure">
          <Switch checked={s.allow_insecure || false} onCheckedChange={(c) => updateSettings('allow_insecure', c)} />
        </Field>
      </Section>
    </div>
  );
}

const protocolForms: Record<string, React.FC<{ value: ProtocolSettings; onChange: (v: ProtocolSettings) => void }>> = {
  VLESS: VlessForm,
  VMESS: VmessForm,
  TROJAN: TrojanForm,
  SHADOWSOCKS: ShadowsocksForm,
  HYSTERIA2: Hysteria2Form,
  NAIVEPROXY: NaiveProxyForm,
  MIERU: MieruForm,
  TUIC: TuicForm,
};

export function ProtocolForm({ protocol, value, onChange }: ProtocolFormProps) {
  const [showJson, setShowJson] = useState(false);
  const FormComponent = protocolForms[protocol];

  const handleJsonChange = (field: 'settings' | 'stream', json: string) => {
    try {
      const parsed = JSON.parse(json);
      onChange({ ...value, [field]: parsed });
    } catch {}
  };

  return (
    <div className="space-y-4">
      {FormComponent && <FormComponent value={value} onChange={onChange} />}

      <div className="border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-astral-400 transition-colors"
        >
          <Code className="h-3.5 w-3.5" />
          {showJson ? 'Скрыть JSON' : 'Показать JSON для ручного редактирования'}
          {showJson ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showJson && (
          <div className="mt-3 space-y-3 animate-fade-in">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Settings (JSON)</Label>
              <textarea
                className="w-full h-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono focus:border-astral-500 focus:ring-0 outline-none resize-none"
                value={JSON.stringify(value.settings, null, 2)}
                onChange={(e) => handleJsonChange('settings', e.target.value)}
              />
            </div>
            {(protocol === 'VLESS' || protocol === 'VMESS' || protocol === 'TROJAN') && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stream Settings (JSON)</Label>
                <textarea
                  className="w-full h-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono focus:border-astral-500 focus:ring-0 outline-none resize-none"
                  value={JSON.stringify(value.stream, null, 2)}
                  onChange={(e) => handleJsonChange('stream', e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function getDefaultProtocolSettings(protocol: string): ProtocolSettings {
  switch (protocol) {
    case 'VLESS':
      return {
        settings: { flow: 'xtls-rprx-vision', decryption: 'none' },
        stream: { network: 'tcp', security: 'tls', tlsSettings: { serverName: '', fingerprint: 'chrome' } },
      };
    case 'VMESS':
      return {
        settings: { alterId: 0, security: 'auto' },
        stream: { network: 'ws', security: 'tls', wsSettings: { path: '/' }, tlsSettings: { serverName: '', fingerprint: 'chrome' } },
      };
    case 'TROJAN':
      return {
        settings: { password: '' },
        stream: { network: 'tcp', security: 'tls', tlsSettings: { serverName: '', fingerprint: 'chrome' } },
      };
    case 'SHADOWSOCKS':
      return {
        settings: { method: 'aes-256-gcm', password: '' },
        stream: {},
      };
    case 'HYSTERIA2':
      return {
        settings: { password: '', sni: '', obfs: { type: 'salamander', password: '' } },
        stream: {},
      };
    case 'NAIVEPROXY':
      return {
        settings: { 'pad-headers': false, 'padding-static-length': 0 },
        stream: {},
      };
    case 'MIERU':
      return {
        settings: { protocol: 'TCP', encryption: 'AES_GCM', padding: true },
        stream: {},
      };
    case 'TUIC':
      return {
        settings: { congestion_control: 'bbr', udp_relay_mode: 'native', sni: '', allow_insecure: false },
        stream: {},
      };
    default:
      return { settings: {}, stream: {} };
  }
}
