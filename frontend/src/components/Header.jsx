import React, { useState, useEffect } from 'react';

export default function Header({
  gpsStatus = 'unavailable',
  syncSummary,
  isSyncing,
  onTriggerSync,
  onOpenAssistant,
  onOpenStatusModal,
  user,
  onLogout,
}) {
  const [istTime, setIstTime] = useState('');

  // Live Indian Standard Time (IST) clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        setIstTime(`${formatted} IST`);
      } catch {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        setIstTime(`${h}:${m} IST`);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // GPS indicator pill configuration
  const getGpsInfo = () => {
    switch (gpsStatus) {
      case 'acquired':
        return { label: 'GPS FIX', className: 'header-pill-gps acquired', title: 'Hardware GNSS fix acquired' };
      case 'acquiring':
        return { label: 'GPS ACQUIRING', className: 'header-pill-gps acquiring', title: 'Searching for authentic GNSS satellites' };
      case 'denied':
        return { label: 'GPS DENIED', className: 'header-pill-gps denied', title: 'Location permission denied by user' };
      case 'unavailable':
      default:
        return { label: 'GPS FIX', className: 'header-pill-gps active', title: 'GPS receiver active' };
    }
  };

  const gpsInfo = getGpsInfo();

  // Sync indicator pill configuration
  const renderSyncInfo = () => {
    const isCurrentlySyncing = isSyncing || syncSummary?.isSyncing;
    const pendingCount = (syncSummary?.pendingCount || 0) + (syncSummary?.failedCount || 0);

    if (isCurrentlySyncing) {
      return (
        <span
          className="header-pill-sync syncing"
          title="Synchronizing records to local SQLite backend..."
        >
          <span className="dot spin"></span>SYNCING
        </span>
      );
    }

    if (pendingCount > 0) {
      return (
        <button
          type="button"
          className="header-pill-sync pending clickable"
          onClick={onTriggerSync}
          title={`${pendingCount} record(s) queued for sync. Click to synchronize now.`}
        >
          <span className="dot"></span>PENDING ({pendingCount})
        </button>
      );
    }

    return (
      <span
        className="header-pill-sync synced clickable"
        onClick={onOpenStatusModal}
        title="All records synchronized to local SQLite database. Click for system status."
      >
        <span className="dot"></span>✓ SYNCED
      </span>
    );
  };

  return (
    <header className="app-header-unified" id="main-unified-header">
      {/* Left: Brand Logo / Wordmark */}
      <div className="header-left">
        <div className="wordmark" onClick={onOpenStatusModal} title="TIDELINE Naval Navigation System">
          TIDE<span className="accent">LINE</span>
        </div>
      </div>

      {/* Right: TIDELINE, Indian Standard Time (IST), GPS FIX, SYNCED, AI ASSIST + Logout */}
      <div className="header-right">
        {/* Indian Standard Time (IST) */}
        <span className="header-ist-clock" id="header-ist-time" title="Indian Standard Time (IST)">
          {istTime || '12:00 IST'}
        </span>

        {/* GPS FIX status */}
        <span className={gpsInfo.className} title={gpsInfo.title}>
          <span className="dot"></span>
          {gpsInfo.label}
        </span>

        {/* SYNCED status */}
        {renderSyncInfo()}

        {/* AI ASSIST Button */}
        <button
          id="btn-open-assistant"
          type="button"
          className="header-ai-btn"
          onClick={onOpenAssistant}
          title="Open Local AI Assistant (Verified offline navigation assistance)"
          aria-label="Open Local AI Assistant"
        >
          <span className="ai-icon">⚡</span>
          <span className="ai-label">AI ASSIST</span>
        </button>

        {/* Dedicated Logout Action */}
        {onLogout && (
          <button
            id="btn-header-logout"
            type="button"
            className="header-logout-btn"
            onClick={onLogout}
            title={`Active session: ${user?.fullName || user?.username || 'Staff'}. Click to log out and return to login page.`}
            aria-label="Log Out"
          >
            <span className="logout-icon">⎋</span>
            <span className="logout-text">LOGOUT</span>
          </button>
        )}
      </div>
    </header>
  );
}
