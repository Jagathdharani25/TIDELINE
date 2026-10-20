import React, { useState, useEffect } from 'react';
import useAuth from '../utils/useAuth';

export const STAFF_ACCOUNTS = [
  {
    username: 'John Antony',
    label: 'John Antony',
    role: 'ADMIN',
    color: '#FFB020',
    id: 'btn-john-antony',
    title: 'Chief Marine Officer & Watch Administrator',
  },
  {
    username: 'Pazhiniyappan',
    label: 'Pazhiniyappan',
    role: 'OFFICER',
    color: '#17D9A3',
    id: 'btn-pazhiniyappan',
    title: 'Navigation Officer',
  },
  {
    username: 'Sanjana',
    label: 'Sanjana',
    role: 'OFFICER',
    color: '#17D9A3',
    id: 'btn-sanjana',
    title: 'Search & Rescue Officer',
  },
  {
    username: 'Harsha',
    label: 'Harsha',
    role: 'OFFICER',
    color: '#17D9A3',
    id: 'btn-harsha',
    title: 'Watch & Telemetry Officer',
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-restore previously selected staff member on mount
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('tideline_remembered_staff');
      if (remembered) {
        const found = STAFF_ACCOUNTS.find((a) => a.username === remembered);
        if (found) {
          setSelectedUser(found);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleSelect = (account) => {
    setSelectedUser(account);
    setError(null);
    try {
      localStorage.setItem('tideline_remembered_staff', account.username);
    } catch {
      // Ignore storage errors
    }
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError('Please select your name from the staff roster.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(selectedUser.username);
    } catch (err) {
      setIsSubmitting(false);
      setError(err?.message || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% -10%, #0d2438 0%, #081826 60%)',
        padding: '24px 16px',
        fontFamily: 'IBM Plex Sans, Inter, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Subtle tactical radar background grid */}
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
          maxWidth: '460px',
          background: 'rgba(8, 22, 36, 0.97)',
          border: '1px solid rgba(23, 217, 163, 0.35)',
          borderRadius: '20px',
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(23, 217, 163, 0.08)',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
        }}
      >
        {/* Top Header Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '36px',
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

        {/* Error Alert */}
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

        <form onSubmit={handleSignIn}>
          {/* Header Label for the 4 Staff Members */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '10px',
                color: '#8CA1B4',
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.12em',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>SELECT WATCH CREW MEMBER</span>
              <span style={{ fontSize: '9px', color: '#17D9A3' }}>4 AUTHORIZED</span>
            </div>

            {/* Exactly the Four Selectable Staff Names */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {STAFF_ACCOUNTS.map((acct) => {
                const isSel = selectedUser && selectedUser.username === acct.username;
                return (
                  <button
                    key={acct.username}
                    type="button"
                    id={acct.id}
                    onClick={() => handleSelect(acct)}
                    style={{
                      background: isSel
                        ? acct.role === 'ADMIN'
                          ? 'rgba(255, 176, 32, 0.22)'
                          : 'rgba(23, 217, 163, 0.2)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid ' + (isSel ? acct.color : 'rgba(255, 255, 255, 0.1)'),
                      borderRadius: '12px',
                      padding: '16px 10px',
                      color: isSel ? acct.color : '#B0C4D8',
                      cursor: 'pointer',
                      fontFamily: 'IBM Plex Mono, monospace',
                      textAlign: 'center',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isSel
                        ? `0 0 16px ${acct.role === 'ADMIN' ? 'rgba(255, 176, 32, 0.3)' : 'rgba(23, 217, 163, 0.3)'}`
                        : 'none',
                      transform: isSel ? 'scale(1.02)' : 'scale(1)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        marginBottom: '4px',
                        color: isSel ? '#fff' : '#C4D6E6',
                      }}
                    >
                      {acct.label}
                    </div>
                    <div
                      style={{
                        fontSize: '9.5px',
                        letterSpacing: '0.08em',
                        color: isSel ? acct.color : '#7A92A5',
                        fontWeight: 700,
                      }}
                    >
                      {acct.role}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Selection Indicator */}
          {selectedUser && (
            <div
              style={{
                background: 'rgba(23, 217, 163, 0.08)',
                border: '1px solid rgba(23, 217, 163, 0.25)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '20px',
                fontSize: '11px',
                color: '#17D9A3',
                fontFamily: 'IBM Plex Mono, monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚓</span>
              <span>
                Selected: <b>{selectedUser.label}</b> ({selectedUser.role})
              </span>
            </div>
          )}

          {/* Sign In Button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={isSubmitting || !selectedUser}
            style={{
              width: '100%',
              background:
                !selectedUser || isSubmitting
                  ? 'rgba(23, 217, 163, 0.25)'
                  : 'linear-gradient(135deg, #17D9A3 0%, #0BB582 100%)',
              color: !selectedUser || isSubmitting ? '#5B7A8C' : '#071826',
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: !selectedUser || isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
              boxShadow:
                selectedUser && !isSubmitting
                  ? '0 4px 20px rgba(23, 217, 163, 0.4)'
                  : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {isSubmitting ? 'OPENING BRIDGE CONSOLE...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}