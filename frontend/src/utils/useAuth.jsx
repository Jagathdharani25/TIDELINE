import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AUTH_STORAGE_KEY = 'tideline_staff_session_v2';
const API_BASE = 'http://localhost:8080';

// Multi-candidate URLs to ensure frontend reliably connects to the local backend
const API_CANDIDATES = [
  '',                      // Same-origin (Vite dev proxy: /api -> http://localhost:8080)
  'http://localhost:8080', // Direct localhost URL
  'http://127.0.0.1:8080', // Direct IPv4 loopback URL
];

async function authFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let lastError = null;

  for (const base of API_CANDIDATES) {
    try {
      const url = `${base}${normalizedPath}`;
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    'Unable to connect to TIDELINE backend server at localhost:8080. Please ensure the backend is running (mvnw spring-boot:run).'
  );
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Check localStorage first, then sessionStorage
      let stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) {
        stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      }
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.token && parsed.user) {
          setUser(parsed.user);
          setToken(parsed.token);
          setNeedsPasswordSetup(parsed.needsPasswordSetup || false);
        }
      }
    } catch (e) {
      console.warn('Could not restore auth session:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSession = (tok, usr, setupNeeded, rememberMe = true) => {
    setToken(tok);
    setUser(usr);
    setNeedsPasswordSetup(setupNeeded || false);
    const sessionData = JSON.stringify({
      token: tok, user: usr, needsPasswordSetup: setupNeeded || false,
      savedAt: new Date().toISOString()
    });
    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEY, sessionData);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, sessionData);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  const login = useCallback(async (username, password, rememberMe = true) => {
    if (!username) throw new Error('Username is required');
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: password || '', rememberMe }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Unexpected server response from TIDELINE backend');
    }
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Authentication failed');
    }
    saveSession(data.token, data.user, data.needsPasswordSetup, rememberMe);
    return data;
  }, []);

  const setupPassword = useCallback(async (newPassword, confirmPassword) => {
    const res = await authFetch('/api/auth/setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ newPassword, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Password setup failed');
    // Clear session — force re-login with new password
    setUser(null);
    setToken(null);
    setNeedsPasswordSetup(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return data;
  }, [token]);

  const changePassword = useCallback(async (currentPassword, newPassword, confirmPassword) => {
    const res = await authFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Password change failed');
    return data;
  }, [token]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
        }).catch(() => {});
      }
    } finally {
      setUser(null);
      setToken(null);
      setNeedsPasswordSetup(false);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [token]);

  const apiGet = useCallback(async (path) => {
    const res = await authFetch(path, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    return res.json();
  }, [token]);

  const apiPost = useCallback(async (path, body) => {
    const res = await authFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  }, [token]);

  const apiPut = useCallback(async (path, body) => {
    const res = await authFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  }, [token]);

  const recoverPassword = useCallback(async (username, recoveryKey, newPassword, confirmPassword) => {
    const res = await authFetch('/api/auth/recover-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, recoveryKey, newPassword, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Password recovery failed');
    return data;
  }, []);

  const adminResetPassword = useCallback(async (targetId) => {
    const res = await authFetch(`/api/auth/staff/${targetId}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Password reset failed');
    return data;
  }, [token]);

  const getAccountStatus = useCallback(async (username) => {
    try {
      const res = await authFetch(`/api/auth/status/${encodeURIComponent(username)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // offline or unreachable
    }
    return null;
  }, []);

  const value = {
    user, token, loading,
    needsPasswordSetup,
    isAuthenticated: !!user && !!token,
    isAdmin: user && user.role === 'ADMIN',
    isOfficer: user && (user.role === 'OFFICER' || user.role === 'ADMIN'),
    login, logout, setupPassword, changePassword,
    recoverPassword, adminResetPassword, getAccountStatus,
    apiGet, apiPost, apiPut,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}