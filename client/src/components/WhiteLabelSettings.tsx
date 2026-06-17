import { useState } from 'react';
import { Upload, Eye, EyeOff, Palette, Image, Type, AlignLeft, Check } from 'lucide-react';

interface WhiteLabelSettingsProps {
  settings: Record<string, any>;
  update: (key: string, value: any) => void;
}

export function WhiteLabelSettings({ settings, update }: WhiteLabelSettingsProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      update('logo_url', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => update('favicon_url', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Apply white-label to CSS vars on change
  const applyColor = (key: string, value: string) => {
    update(key, value);
    if (key === 'primary_color' && settings.white_label_enabled) {
      document.documentElement.style.setProperty('--accent', value);
    }
  };

  return (
    <div className="space-y-7">

      {/* Enable Toggle */}
      <WLSection icon={<Palette size={14} />} title="White-label Branding">
        <WLToggle
          label="Enable White-label Mode"
          description="Override panel branding with your own identity"
          value={settings.white_label_enabled || false}
          onChange={(v) => {
            update('white_label_enabled', v);
            if (!v) {
              // Reset CSS vars
              document.documentElement.style.removeProperty('--accent');
            }
          }}
        />
        <WLField
          label="Company / Brand Name"
          value={settings.company_name || ''}
          onChange={(v) => update('company_name', v)}
          placeholder="Acme Proxy Services"
          icon={<Type size={12} />}
        />
      </WLSection>

      {/* Logo & Favicon */}
      <WLSection icon={<Image size={14} />} title="Logo & Favicon">
        <div className="grid grid-cols-1 gap-4">
          {/* Logo */}
          <div>
            <label className="block text-[12px] font-medium mb-2" style={{ color: 'var(--fg-muted)' }}>
              Logo URL or Upload
            </label>
            <div className="flex gap-2 mb-2">
              <input
                className="input-base flex-1"
                value={settings.logo_url || ''}
                onChange={(e) => { update('logo_url', e.target.value); setLogoPreview(null); }}
                placeholder="https://example.com/logo.svg"
              />
              <label
                className="px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer flex items-center gap-1.5"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-muted)',
                }}>
                <Upload size={12} />
                Upload
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
            {(logoPreview || settings.logo_url) && (
              <div
                className="p-4 rounded-lg flex items-center justify-center h-20"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                <img
                  src={logoPreview || settings.logo_url}
                  alt="Logo preview"
                  className="max-h-14 max-w-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* Favicon */}
          <div>
            <label className="block text-[12px] font-medium mb-2" style={{ color: 'var(--fg-muted)' }}>
              Favicon URL or Upload
            </label>
            <div className="flex gap-2">
              <input
                className="input-base flex-1"
                value={settings.favicon_url || ''}
                onChange={(e) => update('favicon_url', e.target.value)}
                placeholder="https://example.com/favicon.ico"
              />
              <label
                className="px-3 py-2 rounded-lg text-[12px] font-medium cursor-pointer flex items-center gap-1.5"
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-muted)',
                }}>
                <Upload size={12} />
                Upload
                <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </WLSection>

      {/* Colors */}
      <WLSection icon={<Palette size={14} />} title="Brand Colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorPicker
            label="Primary Accent Color"
            value={settings.primary_color || '#6366f1'}
            onChange={(v) => applyColor('primary_color', v)}
          />
          <ColorPicker
            label="Secondary Accent Color"
            value={settings.secondary_color || '#8b5cf6'}
            onChange={(v) => applyColor('secondary_color', v)}
          />
        </div>

        {/* Palette preview */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>Palette preview:</span>
          {[
            settings.primary_color   || '#6366f1',
            settings.secondary_color || '#8b5cf6',
            '#1f2937',
            '#111827',
          ].map((c, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-lg shadow-sm"
              style={{
                backgroundColor: c,
                border: '2px solid var(--border)',
              }}
              title={c}
            />
          ))}
        </div>
      </WLSection>

      {/* Footer */}
      <WLSection icon={<AlignLeft size={14} />} title="Footer">
        <WLField
          label="Custom Footer Text"
          value={settings.footer_text || ''}
          onChange={(v) => update('footer_text', v)}
          placeholder="Powered by Acme Proxy Services"
        />
      </WLSection>

      {/* Live Preview */}
      <WLSection icon={<Eye size={14} />} title="Live Preview">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium"
          style={{
            background: showPreview ? 'var(--accent-muted)' : 'var(--bg-raised)',
            border: `1px solid ${showPreview ? 'var(--accent)' : 'var(--border)'}`,
            color: showPreview ? 'var(--accent)' : 'var(--fg-muted)',
          }}>
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>

        {showPreview && (
          <div
            className="mt-3 rounded-xl p-5 animate-slide-up"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
            }}>
            {/* Preview header bar */}
            <div
              className="flex items-center gap-3 mb-4 pb-3"
              style={{ borderBottom: '1px solid var(--border)' }}>
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-7 object-contain" />
              ) : (
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: settings.primary_color || '#6366f1' }}>
                  {(settings.company_name || 'P')[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                {settings.company_name || 'ProxPanel'}
              </span>
            </div>

            {/* Preview buttons */}
            <div className="flex gap-2 mb-4">
              <button
                className="px-3 py-1.5 rounded-lg text-xs text-white font-semibold"
                style={{ background: settings.primary_color || '#6366f1' }}>
                Primary
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-xs text-white font-semibold"
                style={{ background: settings.secondary_color || '#8b5cf6' }}>
                Secondary
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>
                Neutral
              </button>
            </div>

            {/* Preview card */}
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-[10px] text-white font-bold"
                  style={{ background: settings.primary_color || '#6366f1' }}>
                  <Check size={12} />
                </div>
                <span className="text-xs font-medium" style={{ color: 'var(--fg)' }}>
                  Sample branded UI element
                </span>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                This is how branded elements will appear for your users.
              </div>
            </div>

            {/* Footer */}
            {settings.footer_text && (
              <div
                className="mt-4 pt-2 text-[10px] text-center"
                style={{ borderTop: '1px solid var(--border)', color: 'var(--fg-subtle)' }}>
                {settings.footer_text}
              </div>
            )}
          </div>
        )}
      </WLSection>
    </div>
  );
}

// ── Sub-components ──

function WLSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function WLField({ label, value, onChange, placeholder, icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--fg-muted)' }}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }}>
            {icon}
          </span>
        )}
        <input
          className="input-base"
          style={{ paddingLeft: icon ? '2rem' : undefined }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function WLToggle({ label, description, value, onChange }: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{
        background: 'var(--bg-raised)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
      }}>
      <div>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--fg)' }}>{label}</div>
        {description && (
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{description}</div>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-10 h-5.5 rounded-full transition-all"
        style={{
          background: value ? 'var(--accent)' : 'var(--bg-sunken)',
          width: '2.25rem',
          height: '1.25rem',
          boxShadow: value ? '0 2px 8px var(--accent-glow)' : 'none',
        }}>
        <span
          className="absolute top-0.5 rounded-full bg-white shadow transition-transform"
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

function ColorPicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium mb-2" style={{ color: 'var(--fg-muted)' }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="cursor-pointer rounded-lg"
            style={{
              width: '2.25rem',
              height: '2.25rem',
              padding: '0.125rem',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
            }}
          />
        </div>
        <input
          className="input-base font-mono text-[12px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          placeholder="#6366f1"
        />
      </div>
    </div>
  );
}
