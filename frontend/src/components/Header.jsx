import React from 'react';

export default function Header({
  backendStatus = 'UP',
  onOpenAssistant,
  onOpenStatusModal,
}) {
  const isOnline = backendStatus === 'UP';

  return (
    <div className="app-header">
      <div className="header-left">
        <div className="wordmark">
          TIDE<span className="accent">LINE</span>
        </div>
      </div>

      <div className="header-actions">
        {/* Clickable Local API Online / Standby Block */}
        <button
          id="btn-api-status"
          type="button"
          className={`header-api-btn ${isOnline ? 'online' : 'offline'}`}
          onClick={onOpenStatusModal}
          title="Click to view Local API, SQLite, and System Status"
          aria-label="Local API Status"
        >
          <span className="api-dot"></span>
          <span className="api-btn-text">
            {isOnline ? 'LOCAL API ONLINE' : 'API LOCAL'}
          </span>
        </button>

        {/* Local AI Assistant Trigger */}
        <button
          id="btn-open-assistant"
          type="button"
          className="header-badge header-ai-btn"
          onClick={onOpenAssistant}
          title="Open Local AI Assistant (Verified Data Only)"
          aria-label="Open Local AI Assistant"
        >
          <span className="ai-icon">⚡</span> AI ASSIST
        </button>
      </div>
    </div>
  );
}
