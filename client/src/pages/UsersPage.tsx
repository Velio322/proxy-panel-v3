import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import {
  Shield, Loader2, Plus, X, Trash2, Edit3, Search, Key,
  Ban, MoreVertical, Copy, Eye, EyeOff,
  RefreshCw, Users as UsersIcon
} from 'lucide-react';

const ROLES = [
  { value: 'SUPER_ADMIN', labelKey: 'users.superAdmin', color: 'bg-red-500/10 text-red-400', descKey: 'users.superAdminDesc' },
  { value: 'ADMIN', labelKey: 'users.admin', color: 'bg-amber-500/10 text-amber-400', descKey: 'users.adminDesc' },
  { value: 'RESELLER', labelKey: 'users.reseller', color: 'bg-blue-500/10 text-blue-400', descKey: 'users.resellerDesc' },
  { value: 'OPERATOR', labelKey: 'users.operator', color: 'bg-green-500/10 text-green-400', descKey: 'users.operatorDesc' },
];

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function UsersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => usersApi.getAll({ search: search || undefined, role: roleFilter || undefined }).then((r) => r.data),
  });

  const banMut = useMutation({
    mutationFn: (id: string) => usersApi.toggleBan(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPassMut = useMutation({
    mutationFn: (id: string) => usersApi.resetPassword(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const users = data?.data || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <UsersIcon size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-fg">{t('users.title')}</h1>
            <p className="text-xs text-fg-subtle">{t('users.count', { total, active: users.filter((u) => !u.banned).length })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <RefreshCw size={14} className="animate-spin text-fg-subtle" />}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors">
            <Plus size={14} /> {t('users.addUser')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input type="text" placeholder={t('users.searchPlaceholder')}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent/0.3))]" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-fg-muted text-xs focus:outline-none appearance-none cursor-pointer">
          <option value="">{t('users.allRoles')}</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{t(r.labelKey)}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 size={20} className="animate-spin text-purple-500" /></div>
      ) : users.length === 0 ? (
        <EmptyUsers onAdd={() => setShowCreate(true)} />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider">
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('users.colUser')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('users.colRole')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('users.colLanguage')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('users.colLastLogin')}</th>
                <th className="text-left px-3 py-2.5 font-medium text-fg-subtle">{t('users.colStatus')}</th>
                <th className="text-right px-3 py-2.5 font-medium text-fg-subtle">{t('users.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {users.map((u) => (
                <UserRow key={u.id} user={u}
                  onEdit={() => setEditUser(u)}
                  onBan={() => banMut.mutate(u.id)}
                  onResetPass={() => {
                    if (confirm(`Reset password for "${u.username}"?`)) resetPassMut.mutate(u.id);
                  }}
                  onDelete={() => {
                    if (confirm(`Delete "${u.username}"?`)) deleteMut.mutate(u.id);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <UserModal onClose={() => setShowCreate(false)} />}
      {editUser && <UserModal user={editUser} onClose={() => setEditUser(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════
// User Row
// ══════════════════════════════════════════════

function UserRow({ user: u, onEdit, onBan, onResetPass, onDelete }: {
  user: User; onEdit: () => void; onBan: () => void; onResetPass: () => void; onDelete: () => void;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const roleConf = ROLES.find((r) => r.value === u.role) || ROLES[3];
  const langFlags: Record<string, string> = { en: '🇬🇧', ru: '🇷🇺', zh: '🇨🇳', fa: '🇮🇷' };

  return (
    <tr className="hover:bg-bg-raised/20 transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
            u.banned ? "bg-red-500/10 text-red-400" : "bg-bg-raised text-fg-muted"
          )}>
            {u.username[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-fg truncate">{u.username}</span>
              {u.banned && <Ban size={10} className="text-red-400 shrink-0" />}
            </div>
            <div className="text-[11px] text-fg-muted truncate max-w-[160px]">{u.email || '—'}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", roleConf.color)}>
          {u.role === 'SUPER_ADMIN' ? <Shield size={9} /> : u.role === 'RESELLER' ? <UsersIcon size={9} /> : null}
          {t(roleConf.labelKey)}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-xs text-fg-muted">{langFlags[u.language || 'en'] || '🌐'} {u.language || 'en'}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs text-fg-muted">
          {u.lastLoginAt ? (
            <>
              <div>{formatDate(u.lastLoginAt)}</div>
              {u.lastLoginIp && <div className="text-[10px] text-fg-muted font-mono">{u.lastLoginIp}</div>}
            </>
          ) : (
            <span className="text-fg-muted">{t('users.never')}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
          u.banned ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
        )}>
          <span className={cn("w-1 h-1 rounded-full", u.banned ? "bg-red-400" : "bg-green-400")} />
          {u.banned ? t('users.banned') : t('users.active')}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="relative">
          <button onClick={() => setMenu(!menu)}
            className="p-1.5 rounded-md hover:bg-bg-raised text-fg-subtle hover:text-fg-muted">
            <MoreVertical size={14} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-bg-raised border border-border rounded-lg shadow-xl z-20 py-1">
                <button onClick={() => { onEdit(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-fg-muted hover:bg-bg-sunken flex items-center gap-2">
                  <Edit3 size={11} /> {t('users.edit')}
                </button>
                <button onClick={() => { onResetPass(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-fg-muted hover:bg-bg-sunken flex items-center gap-2">
                  <Key size={11} /> {t('users.resetPassword')}
                </button>
                <button onClick={() => { onBan(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-fg-muted hover:bg-bg-sunken flex items-center gap-2">
                  <Ban size={11} /> {u.banned ? t('users.unban') : t('users.ban')}
                </button>
                <div className="border-t border-border my-0.5" />
                <button onClick={() => { onDelete(); setMenu(false); }} className="w-full px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-bg-sunken flex items-center gap-2">
                  <Trash2 size={11} /> {t('users.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════
// User Modal (Create/Edit)
// ══════════════════════════════════════════════

function UserModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const isEdit = !!user;

  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'OPERATOR',
    language: user?.language || 'en',
  });
  const [showPass, setShowPass] = useState(false);
  const [generatedPass, setGeneratedPass] = useState('');

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const pass = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    update('password', pass);
    setGeneratedPass(pass);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const data: any = {
        username: form.username,
        email: form.email || undefined,
        role: form.role,
        language: form.language,
      };
      if (form.password) data.password = form.password;
      return isEdit ? usersApi.update(user!.id, data) : usersApi.create(data);
    },
    onSuccess: (r: any) => {
      if (!isEdit && r.data?.password) setGeneratedPass(r.data.password);
      qc.invalidateQueries({ queryKey: ['users'] });
      if (isEdit) onClose();
    },
  });

  return (
    <Modal onClose={onClose} title={isEdit ? t('users.editUser', { name: user!.username }) : t('users.createUser')} maxW="max-w-md">
      <div className="space-y-4">
        <Field label={t('users.username') + ' *'} value={form.username} onChange={(v) => update('username', v)} disabled={isEdit} placeholder="admin" />
        <Field label={t('users.email')} value={form.email} onChange={(v) => update('email', v)} placeholder="admin@example.com" />
        <div>
          <label className={labelCls}>{isEdit ? t('users.newPassword') : t('users.password') + ' *'}</label>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input className={cn(inputCls, "pr-8")} type={showPass ? 'text' : 'password'}
                value={form.password} onChange={(e) => { update('password', e.target.value); setGeneratedPass(''); }}
                placeholder={isEdit ? t('users.leaveEmptyKeep') : t('users.enterPassword')} />
              <button onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button onClick={genPassword}
              className="px-2.5 rounded-lg bg-bg-raised border border-border text-fg-muted hover:text-fg text-[11px] shrink-0">{t('users.gen')}</button>
          </div>
        </div>

        {generatedPass && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <div className="text-[10px] text-green-400 font-medium mb-1">{t('users.generatedPassword')}</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-green-300 font-mono">{generatedPass}</code>
              <button onClick={() => { navigator.clipboard.writeText(generatedPass); }}
                className="text-fg-subtle hover:text-fg-muted"><Copy size={12} /></button>
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>{t('users.role')} *</label>
          <div className="space-y-1.5">
            {ROLES.map((r) => (
              <button key={r.value} onClick={() => update('role', r.value)}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all",
                  form.role === r.value ? "border-[hsl(var(--accent/0.3))] bg-purple-500/5" : "border-border hover:border-border"
                )}>
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", r.color)}>{t(r.labelKey)}</span>
                <span className="text-[10px] text-fg-subtle">{t(r.descKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('users.language')}</label>
          <select className={inputCls} value={form.language} onChange={(e) => update('language', e.target.value)}>
            <option value="en">🇬🇧 English</option>
            <option value="ru">🇷🇺 Русский</option>
            <option value="zh">🇨🇳 中文</option>
            <option value="fa">🇮🇷 فارسی</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t border-border mt-4">
        <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg bg-bg-raised text-fg-muted text-xs">{t('common.cancel')}</button>
        <button onClick={() => mutation.mutate()}
          disabled={(!form.username && !isEdit) || mutation.isPending}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
          {mutation.isPending ? <><Loader2 size={12} className="animate-spin" /> {t('common.saving')}</> : isEdit ? t('users.saveChanges') : t('users.createUser')}
        </button>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════

const inputCls = "w-full px-2.5 py-1.5 rounded-lg bg-bg-raised border border-border text-fg text-xs focus:outline-none focus:border-[hsl(var(--accent))] focus:ring-1 focus:ring-[hsl(var(--accent/0.15))]";
const labelCls = "block text-[11px] font-medium text-fg-subtle mb-1";

function Modal({ onClose, title, maxW = 'max-w-lg', children }: {
  onClose: () => void; title: string; maxW?: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={cn("bg-surface border border-border rounded-xl w-full shadow-xl max-h-[85vh] flex flex-col", maxW)}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-raised text-fg-muted"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: any; onChange?: (v: any) => void; type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={cn(inputCls, disabled && "opacity-60 cursor-not-allowed")} type={type} value={value}
        onChange={onChange ? (e) => onChange(type === 'number' ? +e.target.value : e.target.value) : undefined}
        placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

function EmptyUsers({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="bg-surface border border-border rounded-xl p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-xl bg-bg-raised flex items-center justify-center mb-4">
        <UsersIcon size={24} className="text-fg-muted" />
      </div>
      <h3 className="text-sm font-medium text-fg-muted">{t('users.noUsers')}</h3>
      <p className="text-xs text-fg-muted mt-1 mb-4 max-w-xs mx-auto">{t('users.noUsersDesc')}</p>
      <button onClick={onAdd} className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium">{t('users.addUser')}</button>
    </div>
  );
}
