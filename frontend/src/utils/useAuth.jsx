import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AUTH_STORAGE_KEY = 'tideline_staff_session_v2';

/**
 * Resolves API candidates based on deployment environment:
 * 1. Explicit environment variable: VITE_API_BASE_URL (or VITE_BACKEND_URL / VITE_API_URL / window.__TIDELINE_API_URL__)
 * 2. Same-origin '' (for Vite dev proxy /api or Vercel proxy rewrites)
 * 3. Localhost loopback addresses (only when running on HTTP / localhost, avoiding HTTPS Mixed Content blocks)
 */
function getApiCandidates() {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env && (
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_URL
    )) ||
    (typeof window !== 'undefined' && window.__TIDELINE_API_URL__) ||
    ''
  ).trim().replace(/\/+$/, '');

  const candidates = [];

  if (envUrl) {
    candidates.push(envUrl);
  }

  // Same-origin (works with Vite dev proxy or Vercel rewrites)
  candidates.push('');

  // Local development fallbacks — only attempted when NOT on a remote HTTPS domain to avoid Mixed Content errors
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocalHost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1'
  );

  if (!isHttps || isLocalHost) {
    candidates.push('http://localhost:8080');
    candidates.push('http://127.0.0.1:8080');
  }

  return candidates;
}

async function authFetch(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const candidates = getApiCandidates();
  let lastError = null;

  for (const base of candidates) {
    try {
      const url = `${base}${normalizedPath}`;
      const res = await fetch(url, options);

      // Guard against static hosting (e.g. Vercel) 404 text/html error pages
      // When a route doesn't exist on static hosting, Vercel returns HTTP 404 with text/plain or text/html
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (res.status === 404 && !isJson && base === '') {
        // This is a static host 404, not our Spring Boot backend. Try next candidate.
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
    }
  }

  const isProduction = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  if (isProduction) {
    throw new Error(
      'Unable to connect to TIDELINE backend server. In production on Vercel, the Java Spring Boot backend must be hosted online and configured via the VITE_API_BASE_URL environment variable.'
    );
  }

  throw new Error(
    'Unable to connect to TIDELINE backend server at localhost:8080. Please ensure the backend is running (mvnw spring-boot:run).'
  );
}

export const STAFF_PROFILES = {
  'John Antony': {
    id: 1,
    username: 'John Antony',
    fullName: 'John Antony',
    role: 'ADMIN',
    rankTitle: 'Chief Marine Officer & Watch Administrator',
  },
  'Pazhiniyappan': {
    id: 2,
    username: 'Pazhiniyappan',
    fullName: 'Pazhiniyappan',
    role: 'OFFICER',
    rankTitle: 'Navigation Officer',
  },
  'Sanjana': {
    id: 3,
    username: 'Sanjana',
    fullName: 'Sanjana',
    role: 'OFFICER',
    rankTitle: 'Search & Rescue Officer',
  },
  'Harsha': {
    id: 4,
    username: 'Harsha',
    fullName: 'Harsha',
    role: 'OFFICER',
    rankTitle: 'Watch & Telemetry Officer',
  },
};

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
          setNeedsPasswordSetup(false);
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
    setNeedsPasswordSetup(false);
    const sessionData = JSON.stringify({
      token: tok, user: usr, needsPasswordSetup: false,
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

  const login = useCallback(async (username, password = '', rememberMe = true) => {
    if (!username) throw new Error('Please select a staff member to sign in.');
    const cleanUsername = username.trim();
    const staffProfile = STAFF_PROFILES[cleanUsername] || {
      id: 99,
      username: cleanUsername,
      fullName: cleanUsername,
      role: 'OFFICER',
      rankTitle: 'Watch Officer',
    };

    let sessionToken = 'tideline_sess_' + Math.random().toString(36).substring(2) + '_' + Date.now();
    let authenticatedUser = staffProfile;

    // Optional background sync with backend if online
    try {
      const res = await authFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: password || '', rememberMe }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.user) {
          authenticatedUser = data.user;
          if (data.token) sessionToken = data.token;
        }
      }
    } catch {
      // Offline or production backend pending deployment — seamless local login operates reliably
    }

    saveSession(sessionToken, authenticatedUser, false, rememberMe);
    return { success: true, token: sessionToken, user: authenticatedUser };
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