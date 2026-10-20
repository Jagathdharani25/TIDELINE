import React, { useState, useEffect, useCallback } from 'react';
import useAuth from '../utils/useAuth';

export const INITIAL_STAFF_LIST = [
  { id: 1, username: 'John Antony', fullName: 'John Antony', role: 'ADMIN', rankTitle: 'Chief Marine Officer & Watch Administrator' },
  { id: 2, username: 'Pazhiniyappan', fullName: 'Pazhiniyappan', role: 'OFFICER', rankTitle: 'Navigation Officer' },
  { id: 3, username: 'Sanjana', fullName: 'Sanjana', role: 'OFFICER', rankTitle: 'Search & Rescue Officer' },
  { id: 4, username: 'Harsha', fullName: 'Harsha', role: 'OFFICER', rankTitle: 'Watch & Telemetry Officer' },
];

export default function StaffLoginModal({ onClose }) {
  const { user, isAuthenticated, isAdmin, changePassword, adminResetPassword, apiGet, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'change-password' | 'admin-reset'

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changeError, setChangeError] = useState(null);
  const [changeSuccess, setChangeSuccess] = useState(null);
  const [isChanging, setIsChanging] = useState(false);

  // Admin Reset state
  const [staffList, setStaffList] = useState(INITIAL_STAFF_LIST);
  const [adminNotice, setAdminNotice] = useState(null);
  const [adminError, setAdminError] = useState(null);
  const [resettingId, setResettingId] = useState(null);

  const fetchStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await apiGet('/api/auth/staff');
      if (Array.isArray(data) && data.length > 0) {
        setStaffList(data);
      }
    } catch {
      // Use fallback initial list
    }
  }, [isAdmin, apiGet]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(null);

    if (!currentPassword) {
      setChangeError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setChangeError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeError('New password and confirm password do not match.');
      return;
    }

    setIsChanging(true);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setIsChanging(false);
      setChangeSuccess('Password changed successfully! Keep your new password secure.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setIsChanging(false);
      setChangeError(err.message || 'Failed to change password. Verify your current password.');
    }
  };

  const handleAdminReset = async (staffMember) => {
    setAdminNotice(null);
    setAdminError(null);
    setResettingId(staffMember.id);

    try {
      await adminResetPassword(staffMember.id);
      setAdminNotice(`Password reset for ${staffMember.fullName}. They will establish a new password on their next login.`);
      await fetchStaff();
    } catch (err) {
      setAdminError(err.message || `Failed to reset password for ${staffMember.fullName}`);
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container staff-login-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '480px',
          width: '94%',
          background: 'rgba(8, 22, 36, 0.96)',
          border: '1px solid rgba(23, 217, 163, 0.35)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(23, 217, 163, 0.1)',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚓</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--sonar, #17D9A3)' }}>
                NAVAL WATCH STAFF PROFILE
              </div>
              <div style={{ fontSize: '10px', color: 'var(--fog-dim, #7A92A5)', fontFamily: 'IBM Plex Mono, monospace' }}>
                INDIVIDUAL WATCH ACCOUNTS · ROLE ACCESS CONTROL
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8CA1B4',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '6px',
              border: `1px solid ${activeTab === 'profile' ? '#17D9A3' : 'rgba(255,255,255,0.1)'}`,
              background: activeTab === 'profile' ? 'rgba(23,217,163,0.15)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'profile' ? '#17D9A3' : '#8CA1B4',
              cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            SESSION
          </button>

          <button
            type="button"
            id="tab-change-password"
            onClick={() => setActiveTab('change-password')}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '6px',
              border: `1px solid ${activeTab === 'change-password' ? '#17D9A3' : 'rgba(255,255,255,0.1)'}`,
              background: activeTab === 'change-password' ? 'rgba(23,217,163,0.15)' : 'rgba(255,255,255,0.03)',
              color: activeTab === 'change-password' ? '#17D9A3' : '#8CA1B4',
              cursor: 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
            }}
          >
            CHANGE PASSWORD
          </button>

          {isAdmin && (
            <button
              type="button"
              id="tab-admin-reset"
              onClick={() => setActiveTab('admin-reset')}
              style={{
                flex: 1,
                padding: '8px 6px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: `1px solid ${activeTab === 'admin-reset' ? '#FFB020' : 'rgba(255,176,32,0.3)'}`,
                background: activeTab === 'admin-reset' ? 'rgba(255,176,32,0.2)' : 'rgba(255,176,32,0.05)',
                color: '#FFB020',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              ADMIN RESET
            </button>
          )}
        </div>

        {/* Tab 1: Current Session Profile */}
        {activeTab === 'profile' && (
          <div>
            <div
              style={{
                background: 'rgba(23, 217, 163, 0.08)',
                border: '1px solid rgba(23, 217, 163, 0.25)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{user?.fullName || 'Watch Officer'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--sonar, #17D9A3)', fontFamily: 'IBM Plex Mono, monospace' }}>
                    {user?.rankTitle || 'Naval Staff Member'}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: isAdmin ? 'rgba(255, 176, 32, 0.2)' : 'rgba(23, 217, 163, 0.2)',
                    color: isAdmin ? '#FFB020' : '#17D9A3',
                    border: `1px solid ${isAdmin ? 'rgba(255, 176, 32, 0.4)' : 'rgba(23, 217, 163, 0.4)'}`,
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}
                >
                  {user?.role} ROLE
                </span>
              </div>

              <div style={{ fontSize: '11px', color: '#9AB3C7', lineHeight: 1.6, marginTop: '10px' }}>
                <div>• Username: <code style={{ color: '#fff' }}>{user?.username}</code></div>
                <div>• Privilege Level: <b style={{ color: '#fff' }}>{isAdmin ? 'Full Administrative Access' : 'Officer Watch & Logs Access'}</b></div>
                <div>• Security: <span style={{ color: '#17D9A3' }}>● Authenticated Session (SQLite Backend)</span></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                id="btn-modal-logout"
                onClick={logout}
                style={{
                  flex: 1,
                  background: 'rgba(255, 79, 79, 0.15)',
                  border: '1px solid rgba(255, 79, 79, 0.35)',
                  color: '#FF6B6B',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                LOGOUT / SIGN OUT
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  background: 'rgba(23, 217, 163, 0.15)',
                  border: '1px solid rgba(23, 217, 163, 0.4)',
                  color: '#17D9A3',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                RETURN TO BRIDGE
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Change Password (Individual user credential update) */}
        {activeTab === 'change-password' && (
          <form onSubmit={handleChangePassword}>
            <div style={{ fontSize: '11px', color: '#8CA1B4', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '14px' }}>
              Set your new password. You will use this new password for subsequent logins.
            </div>

            {changeSuccess && (
              <div
                style={{
                  background: 'rgba(23, 217, 163, 0.12)',
                  border: '1px solid rgba(23, 217, 163, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#17D9A3',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                ✓ {changeSuccess}
              </div>
            )}

            {changeError && (
              <div
                style={{
                  background: 'rgba(255, 79, 79, 0.14)',
                  border: '1px solid rgba(255, 79, 79, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#FF8888',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                ⚠️ {changeError}
              </div>
            )}

            {/* Current Password */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', color: '#8CA1B4', fontFamily: 'IBM Plex Mono, monospace' }}>CURRENT PASSWORD</label>
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{ background: 'none', border: 'none', color: '#17D9A3', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                >
                  {showCurrent ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <input
                id="input-change-current"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password..."
                required
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(23, 217, 163, 0.25)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* New Password */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', color: '#8CA1B4', fontFamily: 'IBM Plex Mono, monospace' }}>NEW PASSWORD (MIN 8 CHARS)</label>
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{ background: 'none', border: 'none', color: '#17D9A3', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                >
                  {showNew ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <input
                id="input-change-new"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose new password..."
                required
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(23, 217, 163, 0.25)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', color: '#8CA1B4', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '4px' }}>
                CONFIRM NEW PASSWORD
              </label>
              <input
                id="input-change-confirm"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password..."
                required
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(23, 217, 163, 0.25)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              id="btn-save-new-password"
              type="submit"
              disabled={isChanging}
              style={{
                width: '100%',
                background: isChanging ? 'rgba(23,217,163,0.3)' : 'linear-gradient(135deg, #17D9A3 0%, #0BB582 100%)',
                color: '#071826',
                border: 'none',
                borderRadius: '8px',
                padding: '11px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: isChanging ? 'wait' : 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.05em',
              }}
            >
              {isChanging ? 'UPDATING...' : 'UPDATE MY PASSWORD'}
            </button>
          </form>
        )}

        {/* Tab 3: Admin Roster & Password Reset */}
        {activeTab === 'admin-reset' && isAdmin && (
          <div>
            <div style={{ fontSize: '11px', color: '#FFB020', fontFamily: 'IBM Plex Mono, monospace', marginBottom: '12px' }}>
              ADMINISTRATOR WATCH ROSTER · RESET PASSWORDS
            </div>

            {adminNotice && (
              <div
                style={{
                  background: 'rgba(23, 217, 163, 0.12)',
                  border: '1px solid rgba(23, 217, 163, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#17D9A3',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                ✓ {adminNotice}
              </div>
            )}

            {adminError && (
              <div
                style={{
                  background: 'rgba(255, 79, 79, 0.14)',
                  border: '1px solid rgba(255, 79, 79, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#FF8888',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                ⚠️ {adminError}
              </div>
            )}

            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '16px' }}>
              {staffList.map((member) => {
                const isCurrent = user?.username === member.username;
                const isResetting = resettingId === member.id;
                return (
                  <div
                    key={member.id || member.username}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {member.fullName}
                        {isCurrent && (
                          <span style={{ fontSize: '8px', background: '#17D9A3', color: '#081826', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                            YOU
                          </span>
                        )}
                        <span style={{ fontSize: '8px', color: member.role === 'ADMIN' ? '#FFB020' : '#17D9A3' }}>
                          [{member.role}]
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#7A92A5', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {member.rankTitle || 'Watch Member'}
                      </div>
                    </div>

                    <button
                      type="button"
                      id={`btn-reset-password-${member.username.replace(/\s+/g, '-').toLowerCase()}`}
                      disabled={isResetting}
                      onClick={() => handleAdminReset(member)}
                      style={{
                        background: 'rgba(255, 176, 32, 0.15)',
                        border: '1px solid rgba(255, 176, 32, 0.4)',
                        color: '#FFB020',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: isResetting ? 'wait' : 'pointer',
                        fontFamily: 'IBM Plex Mono, monospace',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isResetting ? 'RESETTING...' : 'RESET PASSWORD'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
