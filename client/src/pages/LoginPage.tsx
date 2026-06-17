import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Eye, EyeOff, Loader2, Key, Shield, Activity } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError(t('login.enterCredentials') || 'Enter credentials'); return; }
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.loginFailed') || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'var(--surface-hover)' }}>

        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(var(--border) 1px, transparent 1px),
              linear-gradient(90deg, var(--border) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}>
              <Key size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)', lineHeight: '1.2' }}>
                KEEPER
              </span>
              <div className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--accent)', lineHeight: '1' }}>
                CONTROL PANEL
              </div>
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-6">
            {[
              { icon: Shield, title: 'Enterprise Security', desc: 'RBAC with 4 roles, audit logs, httpOnly JWT cookies' },
              { icon: Activity, title: 'Real-time Monitoring', desc: 'Live node metrics, traffic charts, WebSocket updates' },
              { icon: Key, title: 'Multi-protocol Support', desc: 'VLESS, Hysteria2, TUIC, Trojan, Shadowsocks and more' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
                  <Icon size={16} style={{ color: 'var(--fg)' }} />
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase" style={{ color: 'var(--fg)' }}>{title}</div>
                  <div className="text-xs mt-0.5 normal-case" style={{ color: 'var(--fg-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs uppercase" style={{ color: 'var(--fg-subtle)' }}>
            Keeper v3.0 — Commercial-grade proxy management
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-8 h-8 flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Key size={16} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-widest" style={{ color: 'var(--fg)', lineHeight: '1.2' }}>
                KEEPER
              </span>
              <div className="text-[9px] font-bold tracking-widest" style={{ color: 'var(--accent)', lineHeight: '1' }}>
                CONTROL PANEL
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold uppercase" style={{ color: 'var(--fg)' }}>
              System Login
            </h1>
            <p className="text-sm mt-1 normal-case" style={{ color: 'var(--fg-muted)' }}>
              Authenticate to access the control panel
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3.5 py-2.5 text-[13px] flex items-center gap-2 animate-slide-up"
              style={{
                background: 'var(--danger)',
                border: '1px solid var(--danger)',
                color: 'var(--accent-fg)',
              }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[13px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--fg)' }}>
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-base"
                placeholder={t('login.enterUsername') || 'Admin'}
                autoFocus
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[13px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--fg)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pr-10"
                  placeholder={t('login.enterPassword') || 'Password'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: 'var(--fg-subtle)' }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 text-[13px] flex items-center justify-center gap-2 mt-4"
              style={{
                opacity: isLoading ? 0.8 : 1,
              }}>
              {isLoading
                ? <><Loader2 size={14} className="animate-spin" /> AUTHENTICATING...</>
                : (t('login.signIn') || 'SIGN IN').toUpperCase()}
            </button>
          </form>

          <p className="text-center text-[11px] mt-8 uppercase" style={{ color: 'var(--fg-subtle)' }}>
            Protected by enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
}
