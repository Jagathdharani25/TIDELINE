import React, { useEffect } from 'react';

/**
 * ApiStatusModal.jsx — Intelligent Local API & SQLite Status Popover
 *
 * Displays:
 *  - API: ONLINE / OFFLINE
 *  - Backend: localhost:8080
 *  - Health: /api/health
 *  - Database: SQLite
 *  - Mode: OFFLINE-FIRST
 *
 * Positioned intelligently so it does NOT overlap map/radar controls.
 */
export default function ApiStatusModal({ backendStatus, onClose, viewMode }) {
  const isOnline = backendStatus === 'UP';

  // Support closing with Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`api-status-backdrop ${viewMode === 'bridge' ? 'bridge-api-backdrop' : ''}`}
      onClick={onClose}
    >
      <div
        className={`api-status-popover ${viewMode === 'bridge' ? 'bridge-api-popover' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Local API Status Details"
      >
        <div className="api-status-header">
          <div className="api-status-title">
            <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`}></span>
            LOCAL BACKEND STATUS
          </div>
          <button
            className="api-status-close-btn"
            onClick={onClose}
            aria-label="Close status dialog"
          >
            ✕
          </button>
        </div>

        <div className="api-status-content">
          <div className="api-status-row">
            <span className="api-status-key">API:</span>
            <span className={`api-status-val ${isOnline ? 'val-online' : 'val-offline'}`}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="api-status-row">
            <span className="api-status-key">Backend:</span>
            <span className="api-status-val val-mono">localhost:8080</span>
          </div>

          <div className="api-status-row">
            <span className="api-status-key">Health:</span>
            <span className="api-status-val val-mono">/api/health</span>
          </div>

          <div className="api-status-row">
            <span className="api-status-key">Database:</span>
            <span className="api-status-val val-highlight">SQLite</span>
          </div>

          <div className="api-status-row">
            <span className="api-status-key">Mode:</span>
            <span className="api-status-val val-highlight">OFFLINE-FIRST</span>
          </div>
        </div>

        <div className="api-status-footer">
          <div className="api-status-note">
            {isOnline
              ? 'Local Spring Boot service active. Transactions write to local SQLite database.'
              : 'Standby mode: local IndexedDB cache preserves telemetry & distress events.'}
          </div>
          <button type="button" className="api-status-btn-close" onClick={onClose}>
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
