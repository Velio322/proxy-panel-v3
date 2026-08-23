import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { useI18n } from '@/i18n';
import { Eye, EyeOff, Loader2, Radio, ShieldCheck, Activity, Cpu, Lock, ArrowRight } from 'lucide-react';

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
    if (!username || !password) {
      setError(t('login.enterCredentials') || 'Please enter username and password');
      return;
    }
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.loginFailed') || 'Invalid username or password');
    }
  };

  const handleFillDemo = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen flex bg-bg text-fg relative overflow-hidden selection:bg-accent selection:text-white">
      {/* Background ambient glow orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Left panel — Hero showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-surface/50 border-r border-border/70 backdrop-blur-xl z-10">
        {/* Brand header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shadow-lg shadow-indigo-500/25">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="text-lg font-bold text-fg tracking-tight flex items-center gap-2">
              ProxPanel <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-accent-muted text-accent font-semibold border border-accent/20">v3.0</span>
            </div>
            <div className="text-xs text-fg-subtle">Next-Gen Proxy & VPN Management Core</div>
          </div>
        </div>

        {/* Core feature badges */}
        <div className="space-y-4 max-w-md my-auto py-8">
          <h2 className="text-2xl font-bold text-fg tracking-tight">
            High-Performance Proxy Core Orchestration
          </h2>
          <p className="text-sm text-fg-muted leading-relaxed">
            Enterprise multi-node administration for Xray, Sing-box, Hysteria 2, NaïveProxy and Mieru with real-time telemetry and dynamic subscription provisioning.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-4">
            {[
              { icon: ShieldCheck, title: 'Multi-Core Engine', desc: 'Xray Reality, Sing-box 1.9+, Hysteria 2, NaïveProxy & Mieru' },
              { icon: Activity, title: 'Zero-Copy Subscription Generator', desc: 'Clash.Meta YAML, Sing-box JSON, Xray JSON & Base64' },
              { icon: Cpu, title: 'Real-Time Telemetry', desc: 'High-frequency bandwidth monitoring, Redis batching & auto-ban' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5 p-3 rounded-xl bg-surface/80 border border-border/80 shadow-sm backdrop-blur-sm">
                <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
                  <Icon size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-fg">{title}</div>
                  <div className="text-[11px] text-fg-subtle mt-0.5 leading-snug">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-fg-subtle pt-4 border-t border-border/60">
          <span>Benchmarked against 3X-UI & Remnawave</span>
          <span className="font-mono text-[11px]">Build 2026.08</span>
        </div>
      </div>

      {/* Right panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 z-10">
        <div className="w-full max-w-md animate-fade-in space-y-6">

          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-indigo-600 to-sky-400 text-white shadow-md">
              <Radio size={20} />
            </div>
            <div>
              <span className="text-base font-bold text-fg">ProxPanel v3</span>
              <div className="text-xs text-fg-subtle">VPN Management Core</div>
            </div>
          </div>

          {/* Form Card */}
          <div className="p-8 rounded-2xl bg-surface/80 border border-border shadow-2xl backdrop-blur-xl space-y-6">
            <div>
              <h1 className="text-xl font-bold text-fg tracking-tight">Sign in to Control Panel</h1>
              <p className="text-xs text-fg-muted mt-1">Authenticate to manage your nodes, inbounds, and clients</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl text-xs font-medium bg-danger-muted text-danger border border-danger/20 animate-slide-up flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-xs font-semibold text-fg-muted mb-1.5">Username</label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-base"
                  placeholder="admin"
                  autoFocus
                  autoComplete="username"
                />
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-fg-muted">Password</label>
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-[11px] font-semibold text-accent hover:underline"
                  >
                    Use default (admin / admin123)
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg transition-colors"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Authenticating...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
            <Lock size={12} className="text-indigo-400" />
            <span>Secured with JWT HttpOnly & Argon2 / BCrypt Hashes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
