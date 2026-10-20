import React, { useState, useEffect } from 'react';
import useAuth from '../utils/useAuth';

export const STAFF_ACCOUNTS = [
  { username: 'John Antony', label: 'John Antony', role: 'ADMIN', color: '#FFB020', title: 'Chief Marine Officer & Watch Administrator' },
  { username: 'Pazhiniyappan', label: 'Pazhiniyappan', role: 'OFFICER', color: '#17D9A3', title: 'Navigation Officer' },
  { username: 'Sanjana', label: 'Sanjana', role: 'OFFICER', color: '#17D9A3', title: 'Search & Rescue Officer' },
  { username: 'Harsha', label: 'Harsha', role: 'OFFICER', color: '#17D9A3', title: 'Watch & Telemetry Officer' },
];

export default function LoginPage() {
  const { login, recoverPassword, getAccountStatus } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'recovery'
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [userStatus, setUserStatus] = useState(null);

  // Recovery form state
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load remembered staff on mount
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('tideline_remembered_staff');
      if (remembered) {
        const found = STAFF_ACCOUNTS.find((a) => a.username === remembered);
        if (found) {
          setSelectedUser(found);
          setRememberMe(true);
          getAccountStatus(found.username).then((st) => setUserStatus(st));
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [getAccountStatus]);

  const handleSelect = async (account) => {
    setSelectedUser(account);
    setPassword('');
    setError(null);
    setSuccessNotice(null);
    setUserStatus(null);

    const st = await getAccountStatus(account.username);
    if (st) {
      setUserStatus(st);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select your name from the staff watch roster.');
      return;
    }

    // If user already has password set, password is required
    if (!userStatus?.needsPasswordSetup && !password) {
      setError('Please enter your password.');
      return;
    }

    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      if (rememberMe) {
        localStorage.setItem('tideline_remembered_staff', selectedUser.username);
      } else {
        localStorage.removeItem('tideline_remembered_staff');
      }

      await login(selectedUser.username, password, rememberMe);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || msg.includes('Unable to connect')) {
        setError('Unable to connect to TIDELINE backend server at localhost:8080. Please ensure the backend is running (mvnw spring-boot:run).');
      } else {
        setError(msg || 'Authentication failed. Please verify credentials.');
      }
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select your staff name for password reset.');
      return;
    }
    if (!recoveryKey.trim()) {
      setError('Please enter the security recovery authorization key.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await recoverPassword(selectedUser.username, recoveryKey, newPassword, confirmPassword);
      setIsSubmitting(false);
      setSuccessNotice(res.message || 'Password reset successfully! Please log in with your new password.');
      setPassword('');
      setRecoveryKey('');
      setNewPassword('');
      setConfirmPassword('');
      setUserStatus({ needsPasswordSetup: false });
      setMode('login');
    } catch (err) {
      setIsSubmitting(false);
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || msg.includes('Unable to connect')) {
        setError('Unable to connect to TIDELINE backend server at localhost:8080. Please ensure the backend is running (mvnw spring-boot:run).');
      } else {
        setError(msg || 'Password recovery failed. Check recovery authorization key.');
      }
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% -10%, #0d2438 0%, #081826 60%)',
        padding: '24px 16px',
        fontFamily: 'IBM Plex Sans, Inter, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(23, 217, 163, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(23, 217, 163, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: 'rgba(8, 22, 36, 0.97)',
          border: '1px solid rgba(23, 217, 163, 0.35)',
          borderRadius: '20px',
          padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(23, 217, 163, 0.08)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '34px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              marginBottom: '4px',
              color: '#fff',
            }}
          >
            TIDE<span style={{ color: '#17D9A3' }}>LINE</span>
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#7A92A5',
              fontFamily: 'IBM Plex Mono, monospace',
              letterSpacing: '0.14em',
            }}
          >
            NAVAL OPERATIONS SYSTEM · WATCH CREW ACCESS
          </div>
          <div
            style={{
              width: '48px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #17D9A3, transparent)',
              margin: '12px auto 0',
            }}
          />
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div
            style={{
              background: 'rgba(23, 217, 163, 0.12)',
              border: '1px solid rgba(23, 217, 163, 0.4)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '18px',
              fontSize: '11px',
              color: '#17D9A3',
              fontFamily: 'IBM Plex Mono, monospace',
              lineHeight: 1.5,
            }}
          >
            ✓ {successNotice}
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div
            style={{
              background: 'rgba(255, 79, 79, 0.14)',
              border: '1px solid rgba(255, 79, 79, 0.45)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '18px',
              fontSize: '11px',
              color: '#FF8888',
              fontFamily: 'IBM Plex Mono, monospace',
              lineHeight: 1.5,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* ── Mode 1: Standard Login ── */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit}>
            {/* Exactly the 4 Staff Names */}
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  fontSize: '10px',
                  color: '#8CA1B4',
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '0.12em',
                  marginBottom: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>SELECT WATCH CREW MEMBER</span>
                <span style={{ fontSize: '9px', color: '#527289' }}>4 AUTHORIZED</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {STAFF_ACCOUNTS.map((acct) => {
                  const isSel = selectedUser && selectedUser.username === acct.username;
                  return (
                    <button
                      key={acct.username}
                      type="button"
                      id={'btn-' + acct.username.replace(/\s+/g, '-').toLowerCase()}
                      onClick={() => handleSelect(acct)}
                      style={{
                        background: isSel
                          ? acct.role === 'ADMIN'
                            ? 'rgba(255, 176, 32, 0.22)'
                            : 'rgba(23, 217, 163, 0.2)'
                          : 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid ' + (isSel ? acct.color : 'rgba(255, 255, 255, 0.1)'),
                        borderRadius: '10px',
                        padding: '12px 8px',
                        color: isSel ? acct.color : '#B0C4D8',
                        cursor: 'pointer',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '11px',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isSel ? `0 0 14px ${acct.role === 'ADMIN' ? 'rgba(255, 176, 32, 0.25)' : 'rgba(23, 217, 163, 0.25)'}` : 'none',
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px', color: isSel ? '#fff' : '#C4D6E6' }}>
                        {acct.label}
                      </div>
                      <div style={{ fontSize: '9px', letterSpacing: '0.08em', color: isSel ? acct.color : '#7A92A5', fontWeight: 600 }}>
                        {acct.role}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Status Badge */}
            {userStatus?.needsPasswordSetup && (
              <div
                style={{
                  background: 'rgba(255, 176, 32, 0.12)',
                  border: '1px solid rgba(255, 176, 32, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '16px',
                  fontSize: '11px',
                  color: '#FFB020',
                  fontFamily: 'IBM Plex Mono, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>🔑</span>
                <span>First-time setup: You will set your personal password upon entering.</span>
              </div>
            )}

            {/* Password Field */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <label
                  style={{
                    fontSize: '10px',
                    color: '#8CA1B4',
                    fontFamily: 'IBM Plex Mono, monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  PASSWORD
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#17D9A3',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Mono, monospace',
                    padding: 0,
                  }}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <input
                id="input-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder={
                  selectedUser
                    ? userStatus?.needsPasswordSetup
                      ? 'Click Authenticate to setup your password'
                      : 'Enter your password...'
                    : 'Select your name above'
                }
                disabled={!selectedUser}
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: selectedUser ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.2)',
                  border: '1px solid ' + (error ? 'rgba(255,79,79,0.5)' : 'rgba(23,217,163,0.25)'),
                  borderRadius: '10px',
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  opacity: selectedUser ? 1 : 0.5,
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                fontSize: '11px',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#9AB3C7',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  id="chk-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    accentColor: '#17D9A3',
                    width: '14px',
                    height: '14px',
                    cursor: 'pointer',
                  }}
                />
                Remember me
              </label>

              <button
                type="button"
                id="btn-forgot-password"
                onClick={() => {
                  setMode('recovery');
                  setError(null);
                  setSuccessNotice(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFB020',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                  padding: 0,
                  textDecoration: 'underline',
                  opacity: 0.9,
                }}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={isSubmitting || !selectedUser}
              style={{
                width: '100%',
                background:
                  !selectedUser || isSubmitting
                    ? 'rgba(23,217,163,0.3)'
                    : 'linear-gradient(135deg, #17D9A3 0%, #0BB582 100%)',
                color: '#071826',
                border: 'none',
                borderRadius: '10px',
                padding: '13px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: !selectedUser || isSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
                boxShadow:
                  selectedUser && !isSubmitting
                    ? '0 4px 16px rgba(23,217,163,0.35)'
                    : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {isSubmitting
                ? 'VERIFYING...'
                : userStatus?.needsPasswordSetup
                ? 'PROCEED TO SET PASSWORD ➔'
                : 'AUTHENTICATE & ENTER'}
            </button>
          </form>
        ) : (
          /* ── Mode 2: Secure Password Recovery / Reset ── */
          <form onSubmit={handleRecoverySubmit}>
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#FFB020',
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '0.1em',
                  marginBottom: '6px',
                }}
              >
                SECURE PASSWORD RESET
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#9AB3C7',
                  lineHeight: 1.5,
                  fontFamily: 'IBM Plex Mono, monospace',
                  marginBottom: '14px',
                }}
              >
                Reset your watch credentials. Forgotten passwords are never displayed. Select your staff account and enter your security authorization key.
              </div>

              {/* Roster Selection for Reset */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {STAFF_ACCOUNTS.map((acct) => {
                  const isSel = selectedUser && selectedUser.username === acct.username;
                  return (
                    <button
                      key={acct.username}
                      type="button"
                      onClick={() => handleSelect(acct)}
                      style={{
                        background: isSel ? 'rgba(255, 176, 32, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid ' + (isSel ? '#FFB020' : 'rgba(255, 255, 255, 0.1)'),
                        borderRadius: '8px',
                        padding: '10px 6px',
                        color: isSel ? '#FFB020' : '#B0C4D8',
                        cursor: 'pointer',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '11px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{acct.label}</div>
                      <div style={{ fontSize: '9px', opacity: 0.8 }}>{acct.role}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recovery Key Input */}
            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color: '#8CA1B4',
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '0.1em',
                  marginBottom: '6px',
                }}
              >
                SECURITY RECOVERY AUTHORIZATION KEY
              </label>
              <input
                id="input-recovery-key"
                type="text"
                value={recoveryKey}
                onChange={(e) => {
                  setRecoveryKey(e.target.value);
                  setError(null);
                }}
                placeholder="Station code (e.g. VIZHINJAM or naval PIN)"
                required
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(255, 176, 32, 0.3)',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '9px', color: '#668095', marginTop: '4px', fontFamily: 'IBM Plex Mono, monospace' }}>
                Assigned station key: <code>VIZHINJAM</code> (or administrator reset authorization)
              </div>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <label
                  style={{
                    fontSize: '10px',
                    color: '#8CA1B4',
                    fontFamily: 'IBM Plex Mono, monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  NEW PASSWORD (MIN 8 CHARS)
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#17D9A3',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontFamily: 'IBM Plex Mono, monospace',
                    padding: 0,
                  }}
                >
                  {showNewPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <input
                id="input-new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Choose your new secure password..."
                required
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(23, 217, 163, 0.3)',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '18px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color: '#8CA1B4',
                  fontFamily: 'IBM Plex Mono, monospace',
                  letterSpacing: '0.1em',
                  marginBottom: '6px',
                }}
              >
                CONFIRM NEW PASSWORD
              </label>
              <input
                id="input-confirm-password"
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Repeat your new password..."
                required
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(23, 217, 163, 0.3)',
                  borderRadius: '10px',
                  padding: '11px 14px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Action Buttons */}
            <button
              id="btn-recover-submit"
              type="submit"
              disabled={isSubmitting || !selectedUser}
              style={{
                width: '100%',
                background:
                  !selectedUser || isSubmitting
                    ? 'rgba(255, 176, 32, 0.3)'
                    : 'linear-gradient(135deg, #FFB020 0%, #D48800 100%)',
                color: '#071826',
                border: 'none',
                borderRadius: '10px',
                padding: '13px',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: !selectedUser || isSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
                boxShadow:
                  selectedUser && !isSubmitting
                    ? '0 4px 16px rgba(255, 176, 32, 0.35)'
                    : 'none',
                marginBottom: '10px',
                transition: 'all 0.2s ease',
              }}
            >
              {isSubmitting ? 'RESETTING...' : 'SECURELY RESET PASSWORD'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#9AB3C7',
                borderRadius: '10px',
                padding: '10px',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              ← BACK TO LOGIN
            </button>
          </form>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '22px',
            fontSize: '9px',
            color: '#415D72',
            fontFamily: 'IBM Plex Mono, monospace',
            letterSpacing: '0.08em',
          }}
        >
          TIDELINE NAVAL OPERATIONS · SECURE ACCESS ONLY
        </div>
      </div>
    </div>
  );
}