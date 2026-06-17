import { create } from 'zustand';
import { authApi, User } from './api';

type Theme = 'light' | 'dark';

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  localStorage.setItem('theme', theme);

  // Восстанавливаем кастомные цвета из настроек (White-label fix)
  try {
    const wlEnabled = localStorage.getItem('wl_enabled') === 'true';
    const pColor = localStorage.getItem('wl_primary_color');
    if (wlEnabled && pColor) {
      root.style.setProperty('--accent', pColor);
    } else {
      root.style.removeProperty('--accent');
    }
  } catch (e) {}
}

export const useAppStore = create<AppState>((set) => {
  const storedTheme = localStorage.getItem('theme') as Theme | null;
  const initialTheme = storedTheme || getSystemTheme();
  
  if (typeof document !== 'undefined') applyTheme(initialTheme);

  return {
    theme: initialTheme,
    toggleTheme: () => set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { theme: next };
    }),
    setTheme: (t) => { applyTheme(t); set({ theme: t }); },
  };
});

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login:    (username: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
  loadUser: () => Promise<void>;
}

function getStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            getStoredUser(),
  isAuthenticated: !!getStoredUser(),
  isLoading:       false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login(username, password);
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      set({ user: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.getMe();
      localStorage.setItem('user', JSON.stringify(data));
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
