import { useState } from 'react';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/lib/store';
import {
  Palette, MessageCircle, Database,
  Save, Loader2, Check,
  Eye, EyeOff, Server, Download, Sun, Moon, Zap
} from 'lucide-react';
import { WhiteLabelSettings } from '@/components/WhiteLabelSettings';

interface SettingsData { [key: string]: any; }

const defaultSettings: SettingsData = {
  site_name: 'Keeper', site_url: 'https://panel.example.com',
  language: 'en', timezone: 'UTC',
  registration_enabled: true, default_protocol: 'VLESS',
  max_connections_per_client: 5, traffic_reset_day: 1,
  white_label_enabled: false, company_name: '', logo_url: '',
  primary_color: '#6366f1', secondary_color: '#8b5cf6',
  favicon_url: '', footer_text: '',
  telegram_bot_token: '', telegram_admin_ids: '',
  telegram_shop_enabled: false, telegram_notifications: true,
  backup_enabled: false, backup_interval: '0 3 * * *',
  backup_destination: 'telegram',
  backup_telegram_token: '', backup_telegram_chat_id: '',
  backup_s3_bucket: '', backup_s3_region: '',
  backup_s3_access_key: '', backup_s3_secret_key: '',
};

const TABS = [
  { key: 'system',     label: 'System',     icon: Server },
  { key: 'appearance', label: 'Appearance',  icon: Palette },
  { key: 'branding',   label: 'White-label', icon: Zap },
  { key: 'telegram',   label: 'Telegram',    icon: MessageCircle },
  { key: 'backups',    label: 'Backups',     icon: Database },
];

const LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'ru', label: 'Русский',  flag: '🇷🇺' },
  { code: 'zh', label: '中文',      flag: '🇨🇳' },
  { code: 'fa', label: 'فارسی',    flag: '🇮🇷' },
];

export function SettingsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState('system');
  const [settings, setSettings] = useState<SettingsData>({ ...defaultSettings });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: any) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real implementation: await settingsApi.saveAll(settings);
      await new Promise((r) => setTimeout(r, 600));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--fg)' }}>{t('settings.title')}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>{t('settings.subtitle')}</p>
        </div>
        <button
          id="settings-save-btn"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
          style={{
            background: saved
              ? 'var(--success-muted)'
              : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            color: saved ? 'var(--success)' : '#fff',
            border: saved ? '1px solid var(--success-border)' : 'none',
            boxShadow: saved ? 'none' : '0 2px 8px var(--accent-glow)',
          }}>
          {saving
            ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
            : saved
              ? <><Check size={13} /> Saved!</>
              : <><Save size={13} /> {t('settings.saveChanges')}</>}
        </button>
      </div>

      <div className="flex gap-5">
        {/* Tab nav */}
        <div className="w-44 shrink-0">
          <div className="space-y-0.5">
            {TABS.map((tabItem) => {
              const active = tab === tabItem.key;
              return (
                <button
                  key={tabItem.key}
                  onClick={() => setTab(tabItem.key)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-left"
                  style={{
                    background: active ? 'var(--accent-muted)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--fg-muted)',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                  }}>
                  <tabItem.icon size={14} style={{ opacity: active ? 1 : 0.6 }} />
                  {tabItem.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 card p-5 space-y-6 animate-fade-in">
          {tab === 'system'     && <SystemSettings settings={settings} update={update} />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'branding'   && <WhiteLabelSettings settings={settings} update={update} />}
          {tab === 'telegram'   && <TelegramSettings settings={settings} update={update} />}
          {tab === 'backups'    && <BackupSettings settings={settings} update={update} />}
        </div>
      </div>
    </div>
  );
}

// ── System ──

function SystemSettings({ settings, update }: { settings: SettingsData; update: (k: string, v: any) => void }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="space-y-6">
      <Section title={t('settings.general')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('settings.siteName')} value={settings.site_name} onChange={(v) => update('site_name', v)} />
          <Field label={t('settings.siteUrl')} value={settings.site_url} onChange={(v) => update('site_url', v)} />
        </div>
      </Section>

      <Section title={t('settings.localization')}>
        <div>
          <label className={labelCls}>{t('settings.defaultLanguage')}</label>
          <div className="grid grid-cols-4 gap-2 mt-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { update('language', lang.code); setLocale(lang.code as any); }}
                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-[11px] font-medium"
                style={{
                  border: `1px solid ${locale === lang.code ? 'var(--accent)' : 'var(--border)'}`,
                  background: locale === lang.code ? 'var(--accent-muted)' : 'var(--bg-raised)',
                  color: locale === lang.code ? 'var(--accent)' : 'var(--fg-muted)',
                }}>
                <span className="text-xl">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Appearance ──

function AppearanceSettings() {
  const { theme, toggleTheme } = useAppStore();
  return (
    <div className="space-y-4">
      <Section title="Theme">
        <div className="grid grid-cols-2 gap-3">
          {(['light', 'dark'] as const).map((t) => {
            const active = theme === t;
            return (
              <button
                key={t}
                onClick={() => { if (theme !== t) toggleTheme(); }}
                className="flex items-center gap-3 p-4 rounded-xl text-left"
                style={{
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-muted)' : 'var(--bg-raised)',
                  boxShadow: active ? '0 0 0 1px var(--accent)' : 'none',
                }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--bg-sunken)',
                    color: active ? '#fff' : 'var(--fg-muted)',
                  }}>
                  {t === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                </div>
                <div>
                  <div className="text-[13px] font-semibold capitalize" style={{ color: 'var(--fg)' }}>{t}</div>
                  <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                    {t === 'light' ? 'Bright and clean' : 'Easy on the eyes'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ── Telegram ──

function TelegramSettings({ settings, update }: { settings: SettingsData; update: (k: string, v: any) => void }) {
  const { t } = useI18n();
  const [showToken, setShowToken] = useState(false);
  return (
    <div className="space-y-6">
      <Section title={t('settings.botConfiguration')}>
        <div>
          <label className={labelCls}>{t('settings.botToken')}</label>
          <div className="relative mt-1">
            <input
              className="input-base pr-10"
              type={showToken ? 'text' : 'password'}
              value={settings.telegram_bot_token}
              onChange={(e) => update('telegram_bot_token', e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--fg-subtle)' }}>
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <Field
          label={t('settings.adminChatIds')}
          value={settings.telegram_admin_ids}
          onChange={(v) => update('telegram_admin_ids', v)}
          placeholder="123456789, 987654321"
        />
        <Toggle
          label="Enable Telegram Notifications"
          value={settings.telegram_notifications}
          onChange={(v) => update('telegram_notifications', v)}
        />
        <Toggle
          label="Enable Telegram Shop Bot"
          value={settings.telegram_shop_enabled}
          onChange={(v) => update('telegram_shop_enabled', v)}
        />
      </Section>
    </div>
  );
}

// ── Backups ──

function BackupSettings({ settings, update }: { settings: SettingsData; update: (k: string, v: any) => void }) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);

  const destinations = [
    { key: 'telegram', label: 'Telegram' },
    { key: 's3',       label: 'S3 / R2' },
    { key: 'local',    label: 'Local' },
  ];

  return (
    <div className="space-y-6">
      <Section title={t('settings.backupSchedule')}>
        <Toggle
          label={t('settings.enableBackups')}
          value={settings.backup_enabled}
          onChange={(v) => update('backup_enabled', v)}
        />
        {settings.backup_enabled && (
          <Field
            label="Cron Schedule"
            value={settings.backup_interval}
            onChange={(v) => update('backup_interval', v)}
            placeholder="0 3 * * *"
          />
        )}

        {/* Destination selector */}
        <div>
          <label className={labelCls}>Backup Destination</label>
          <div className="flex gap-2 mt-1">
            {destinations.map((d) => (
              <button
                key={d.key}
                onClick={() => update('backup_destination', d.key)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                style={{
                  border: `1px solid ${settings.backup_destination === d.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: settings.backup_destination === d.key ? 'var(--accent-muted)' : 'var(--bg-raised)',
                  color: settings.backup_destination === d.key ? 'var(--accent)' : 'var(--fg-muted)',
                }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('settings.manualBackup')}>
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: 'var(--fg)' }}>
              {t('settings.runBackupNow')}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>
              Snapshot the database and configs immediately
            </div>
          </div>
          <button
            id="backup-now-btn"
            onClick={() => { setRunning(true); setTimeout(() => setRunning(false), 3000); }}
            disabled={running}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold"
            style={{
              background: 'var(--fg)',
              color: 'var(--bg)',
              opacity: running ? 0.7 : 1,
            }}>
            {running
              ? <><Loader2 size={13} className="animate-spin" /> {t('settings.running')}</>
              : <><Download size={13} /> {t('settings.backupNow')}</>}
          </button>
        </div>
      </Section>
    </div>
  );
}

// ── Helpers ──

const labelCls = "block text-[12px] font-medium" as const;

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--fg-subtle)' }}>
        {title}
      </h3>
      {children && <div className="space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className={`${labelCls} mb-1.5`} style={{ color: 'var(--fg-muted)' }}>{label}</label>
      <input
        className="input-base"
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? +e.target.value : e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{
        background: 'var(--bg-raised)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
      }}>
      <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 rounded-full transition-all"
        style={{
          width: '2.25rem',
          height: '1.25rem',
          background: value ? 'var(--accent)' : 'var(--bg-sunken)',
          boxShadow: value ? '0 2px 8px var(--accent-glow)' : 'none',
        }}>
        <span
          className="absolute top-0.5 rounded-full bg-white shadow-sm transition-transform"
          style={{
            width: '1rem',
            height: '1rem',
            transform: value ? 'translateX(1.125rem)' : 'translateX(0.125rem)',
          }}
        />
      </button>
    </div>
  );
}
