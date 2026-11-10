import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ensureCsrf, setCsrfToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data.user);
    } catch {
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    ensureCsrf().catch(() => {});
    refresh();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    setCsrfToken(res.data.data.csrfToken);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    setCsrfToken(res.data.data.csrfToken);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      await ensureCsrf(true).catch(() => {});
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: Boolean(user),
      can: (permission) => Boolean(user?.permissions?.includes(permission)),
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
      login,
      register,
      logout,
      refresh,
      setUser,
    }),
    [user, status, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Where a user lands after login, by role. */
// eslint-disable-next-line react-refresh/only-export-components
export function homePathFor(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'reviewer') return '/admin/reviews';
  if (user.role === 'instructor') return '/admin/courses';
  return '/student';
}
