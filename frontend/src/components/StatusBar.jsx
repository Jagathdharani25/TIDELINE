import React, { useState, useEffect } from 'react';

export default function StatusBar({
  backendStatus = 'UP',
  gpsStatus = 'unavailable',
  syncSummary,
  isSyncing,
  onTriggerSync,
  onOpenStatusModal,
}) {
  const [time, setTime] = useState('14:02');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setTime(`${h}:${m}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Derive authentic GPS pill label and CSS class from real hardware GPS state
  const getGpsPill = () => {
    switch (gpsStatus) {
      case 'acquired':
        return { label: 'GPS FIX', className: 'gps-pill gps-fix' };
      case 'acquiring':
        return { label: 'GPS ACQUIRING', className: 'gps-pill gps-acquiring' };
      case 'denied':
        return { label: 'GPS DENIED', className: 'gps-pill gps-denied' };
      case 'unavailable':
      default:
        return { label: 'GPS UNAVAILABLE', className: 'gps-pill gps-unavailable' };
    }
  };

  const gpsPill = getGpsPill();

  // Derive Sync pill status without contradictory states (e.g. ONLINE + RETRY)
  const renderSyncPill = () => {
    const isCurrentlySyncing = isSyncing || syncSummary?.isSyncing;

    // Common interactive props for clickable sync pills
    const clickableProps = {
      role: 'button',
      tabIndex: 0,
      style: { cursor: 'pointer' },
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTriggerSync?.(); } },
    };

    if (isCurrentlySyncing) {
      return (
        <div className="sync-pill syncing" title="Synchronizing pending records to SQLite backend...">
          <span className="dot"></span>SYNCING
        </div>
      );
    }

    // When backend is online (healthy), auto-sync is handled and we avoid showing "RETRY"
    if (backendStatus === 'UP') {
      if (syncSummary?.pendingCount > 0 || syncSummary?.failedCount > 0) {
        const count = (syncSummary.pendingCount || 0) + (syncSummary.failedCount || 0);
        return (
          <div
            className="sync-pill pending clickable"
            title={`${count} record(s) queued for sync. Click to sync now.`}
            onClick={() => { console.log('[UI] Sync pill clicked (backend UP, pending)'); onTriggerSync?.(); }}
            {...clickableProps}
          >
            <span className="dot"></span>PENDING ({count})
          </div>
        );
      }
      return (
        <div
          className="sync-pill synced"
          title={
            syncSummary?.lastSyncTimestamp
              ? `All records synchronized. Last sync: ${new Date(syncSummary.lastSyncTimestamp).toLocaleTimeString()}`
              : 'All records synchronized to local SQLite backend'
          }
        >
          <span className="dot"></span>✓ SYNCED
        </div>
      );
    }

    // When backend is offline:
    if (syncSummary?.failedCount > 0 || syncSummary?.pendingCount > 0) {
      const count = (syncSummary.pendingCount || 0) + (syncSummary.failedCount || 0);
      return (
        <div
          className="sync-pill failed clickable"
          title={`${count} record(s) pending — backend offline. Click to retry.`}
          onClick={() => { console.log('[UI] RETRY pill clicked (backend offline)'); onTriggerSync?.(); }}
          {...clickableProps}
        >
          <span className="dot"></span>RETRY ({count})
        </div>
      );
    }

    return (
      <div
        className="sync-pill synced"
        title="Local storage active (IndexedDB)"
      >
        <span className="dot"></span>✓ SYNCED
      </div>
    );
  };

  return (
    <div className="statusbar" id="status-bar">
      <span className="statusbar-clock" id="clock">{time}</span>
      <div className="statusbar-pills">
        {/* Offline Mode indicator */}
        <div
          className="net-pill"
          title="TIDELINE operates fully offline without cellular or cloud dependency"
        >
          <span className="dot"></span>OFFLINE MODE
        </div>

        {/* GPS Hardware Fix / Unavailable */}
        <div className={gpsPill.className} title={`GNSS Satellite status: ${gpsPill.label}`}>
          <span className="dot"></span>{gpsPill.label}
        </div>

        {/* Clickable Local API Online Pill */}
        <div
          className={`api-pill clickable ${backendStatus === 'UP' ? 'connected' : ''}`}
          onClick={onOpenStatusModal}
          title={
            backendStatus === 'UP'
              ? 'Spring Boot REST API connected (GET /api/health). Click for details.'
              : 'Backend in local standby mode. Click for details.'
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenStatusModal?.(); }}
        >
          <span className="dot"></span>
          {backendStatus === 'UP' ? 'LOCAL API ONLINE' : 'API LOCAL'}
        </div>

        {/* Sync Pill */}
        {renderSyncPill()}
      </div>
    </div>
  );
}
