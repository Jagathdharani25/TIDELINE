import React, { useState } from 'react';
import useAuth from '../utils/useAuth';

export default function PasswordSetupPage() {
  const { user, setupPassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Passwords match', met: newPassword && newPassword === confirmPassword },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setSubmitting(true);
    try {
      await setupPassword(newPassword, confirmPassword);
      setSuccess(true);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || msg.includes('Unable to connect')) {
        setError('Unable to connect to TIDELINE backend server at localhost:8080. Please ensure the backend is running (mvnw spring-boot:run).');
      } else {
        setError(msg || 'Failed to set password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      React.createElement('div', {
        style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% -10%, #0d2438 0%, #081826 60%)', padding: '20px' }
      },
        React.createElement('div', {
          style: { textAlign: 'center', maxWidth: '380px', color: '#fff', fontFamily: 'IBM Plex Mono, monospace' }
        },
          React.createElement('div', { style: { fontSize: '48px', marginBottom: '16px' } }, ''),
          React.createElement('div', { style: { fontSize: '18px', fontWeight: 700, color: '#17D9A3', marginBottom: '8px' } }, 'PASSWORD SET SUCCESSFULLY'),
          React.createElement('div', { style: { fontSize: '12px', color: '#7A92A5', marginBottom: '24px' } },
            'Your password has been secured. Please log in again with your new password.'),
          React.createElement('button', {
            onClick: logout,
            style: { background: 'linear-gradient(135deg, #17D9A3 0%, #0BB582 100%)', color: '#071826', border: 'none',
              borderRadius: '10px', padding: '12px 28px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em' }
          }, 'GO TO LOGIN')
        )
      )
    );
  }

  return (
    React.createElement('div', {
      style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% -10%, #0d2438 0%, #081826 60%)', padding: '20px',
        fontFamily: 'IBM Plex Sans, sans-serif' }
    },
      React.createElement('div', {
        style: { position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(23,217,163,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(23,217,163,0.03) 1px,transparent 1px)',
          backgroundSize: '40px 40px', pointerEvents: 'none', zIndex: 0 }
      }),
      React.createElement('div', {
        style: { width: '100%', maxWidth: '420px', maxHeight: '94vh', overflowY: 'auto', background: 'rgba(8,22,36,0.97)',
          border: '1px solid rgba(255,176,32,0.4)', borderRadius: '20px', padding: '28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(255,176,32,0.08)', position: 'relative', zIndex: 1 }
      },
        React.createElement('div', { style: { textAlign: 'center', marginBottom: '28px' } },
          React.createElement('div', { style: { fontFamily: 'Oswald, sans-serif', fontSize: '28px', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '6px' } },
            'TIDE', React.createElement('span', { style: { color: '#17D9A3' } }, 'LINE')),
          React.createElement('div', { style: { fontSize: '10px', color: '#FFB020', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.14em', marginBottom: '4px' } },
            'FIRST-TIME PASSWORD SETUP'),
          React.createElement('div', { style: { fontSize: '12px', color: '#B0C4D8' } },
            'Welcome, ', React.createElement('b', { style: { color: '#fff' } }, user && user.fullName || 'Staff Member')),
          React.createElement('div', { style: { width: '48px', height: '2px', background: 'linear-gradient(90deg,transparent,#FFB020,transparent)', margin: '12px auto 0' } })
        ),
        React.createElement('div', {
          style: { background: 'rgba(255,176,32,0.08)', border: '1px solid rgba(255,176,32,0.25)', borderRadius: '10px',
            padding: '12px 14px', marginBottom: '20px', fontSize: '11px', color: '#B0C4D8', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.6 }
        }, 'Your account requires a password. Choose a secure password that you will use to log in every time.'),
        React.createElement('form', { onSubmit: handleSubmit },
          React.createElement('div', { style: { marginBottom: '14px' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' } },
              React.createElement('label', { style: { fontSize: '10px', color: '#8CA1B4', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em' } }, 'NEW PASSWORD'),
              React.createElement('button', { type: 'button', onClick: () => setShowNew(!showNew), style: { background: 'none', border: 'none', color: '#17D9A3', fontSize: '10px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', padding: 0 } }, showNew ? 'HIDE' : 'SHOW')
            ),
            React.createElement('input', {
              id: 'input-new-password',
              type: showNew ? 'text' : 'password',
              value: newPassword,
              onChange: (e) => { setNewPassword(e.target.value); setError(null); },
              placeholder: 'Choose a strong password...',
              style: { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(23,217,163,0.2)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', outline: 'none', boxSizing: 'border-box' }
            })
          ),
          React.createElement('div', { style: { marginBottom: '14px' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' } },
              React.createElement('label', { style: { fontSize: '10px', color: '#8CA1B4', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.1em' } }, 'CONFIRM PASSWORD'),
              React.createElement('button', { type: 'button', onClick: () => setShowConfirm(!showConfirm), style: { background: 'none', border: 'none', color: '#17D9A3', fontSize: '10px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', padding: 0 } }, showConfirm ? 'HIDE' : 'SHOW')
            ),
            React.createElement('input', {
              id: 'input-confirm-password',
              type: showConfirm ? 'text' : 'password',
              value: confirmPassword,
              onChange: (e) => { setConfirmPassword(e.target.value); setError(null); },
              placeholder: 'Repeat your password...',
              style: { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(23,217,163,0.2)', borderRadius: '10px', padding: '11px 14px', color: '#fff', fontSize: '14px', fontFamily: 'IBM Plex Mono, monospace', outline: 'none', boxSizing: 'border-box' }
            })
          ),
          React.createElement('div', { style: { marginBottom: '14px' } },
            requirements.map((r, i) =>
              React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: r.met ? '#17D9A3' : '#5A7A8A', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '4px' } },
                React.createElement('span', null, r.met ? '' : ''),
                r.label
              )
            )
          ),
          error && React.createElement('div', {
            style: { background: 'rgba(255,79,79,0.12)', border: '1px solid rgba(255,79,79,0.35)', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', fontSize: '11px', color: '#FF8888', fontFamily: 'IBM Plex Mono, monospace' }
          }, error),
          React.createElement('button', {
            id: 'btn-setup-password',
            type: 'submit',
            disabled: submitting,
            style: { width: '100%', background: submitting ? 'rgba(23,217,163,0.3)' : 'linear-gradient(135deg,#17D9A3 0%,#0BB582 100%)', color: '#071826', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '10px' }
          }, submitting ? 'SAVING...' : 'SET MY PASSWORD'),
          React.createElement('button', {
            type: 'button', onClick: logout,
            style: { width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8CA1B4', borderRadius: '10px', padding: '10px', fontSize: '11px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' }
          }, 'CANCEL & LOGOUT')
        )
      )
    )
  );
}