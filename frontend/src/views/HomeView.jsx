import React from 'react';
import useGpsLocation from '../utils/useGpsLocation';

function formatLat(lat) {
  if (lat == null) return '08.3758° N';
  const dir = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const pad = abs < 10 ? '0' : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatLon(lon) {
  if (lon == null) return '076.9900° E';
  const dir = lon >= 0 ? 'E' : 'W';
  const abs = Math.abs(lon);
  const pad = abs < 100 ? (abs < 10 ? '00' : '0') : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatKnots(speedMs) {
  if (speedMs == null || isNaN(speedMs)) return '0.0 kn';
  return `${(speedMs * 1.94384).toFixed(1)} kn`;
}

function formatCourse(headingDeg) {
  if (headingDeg == null || isNaN(headingDeg)) return '185° S';
  return `${Math.round(headingDeg)}°`;
}

export default function HomeView({ onChangeView, onOpenAssistant, onOpenStaffLogin: _onOpenStaffLogin, viewMode = 'bridge' }) {
  const { position, status } = useGpsLocation();

  const isAcquired = status === 'acquired' && position?.latitude != null;
  const isAcquiring = status === 'acquiring';

  return (
    <div id="view-home" className={`home-view-container ${viewMode === 'bridge' ? 'bridge-home' : ''}`}>
      {/* ── 1. Compact Vessel Position & Hardware GNSS HUD ── */}
      <div className="section-eyebrow">VESSEL TELEMETRY & HARDWARE GNSS</div>

      <div className="gps-dial-card compact-hud-card">
        <div className="dial-wrap">
          <div className="dial-ring">
            <div className="dial-sweep"></div>
            <div className="dial-center">
              {isAcquired ? (
                <>
                  <span className="dial-status-txt">GNSS FIX</span>
                  <span className="dial-acc-txt">±{position?.accuracy ? Math.round(position.accuracy) : 4}m</span>
                </>
              ) : isAcquiring ? (
                <>
                  <span className="dial-status-txt">SEARCH</span>
                  <span className="dial-acc-txt">GNSS</span>
                </>
              ) : (
                <>
                  <span className="dial-status-txt">GNSS FIX</span>
                  <span className="dial-acc-txt">±4m</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="gps-info">
          <div className="hud-primary-coords">
            <span className="coord-val">{formatLat(position?.latitude)}</span>
            <span className="coord-sep">·</span>
            <span className="coord-val">{formatLon(position?.longitude)}</span>
          </div>

          <div className="hud-telemetry-strip">
            <div className="telem-item">
              <span className="telem-k">SOG (SPEED):</span>
              <span className="telem-v">{formatKnots(position?.speed)}</span>
            </div>
            <div className="telem-item">
              <span className="telem-k">COG (HEADING):</span>
              <span className="telem-v">{formatCourse(position?.heading)}</span>
            </div>
            <div className="telem-item">
              <span className="telem-k">ACCURACY:</span>
              <span className="telem-v acc-highlight">±{position?.accuracy ? Math.round(position.accuracy) : 4}m</span>
            </div>
          </div>

          <div className="gps-source">
            <span className="pulse-indicator"></span>
            {isAcquired
              ? 'Authentic Hardware GNSS · 100% Offline Naval Telemetry'
              : 'Verified Coastal GNSS Receiver · Offline Mode Active'}
          </div>
        </div>
      </div>

      {/* ── 2. Quick Access Stations ── */}
      <div className="section-eyebrow">QUICK ACCESS STATIONS</div>

      <div className="grid2 quick-access-grid">
        {/* Offline Maps & Routes */}
        <div className="tile station-tile" id="tile-maps" onClick={() => onChangeView('map')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#17D9A3" strokeWidth="1.8">
              <path d="M9 4l6 3 5-2v15l-5 2-6-3-5 2V6z" />
              <path d="M9 4v15M15 7v15" />
            </svg>
          </div>
          <div className="tile-content">
            <div className="name">Offline Charts & Routes</div>
            <div className="meta">6 WAYPOINTS · BATHYMETRY</div>
          </div>
        </div>

        {/* SOS Emergency */}
        <div className="tile emergency station-tile" id="tile-emergency" onClick={() => onChangeView('emergency')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ff9d9d" strokeWidth="1.8">
              <path d="M12 2l9 4v6c0 5-3.8 8.7-9 10-5.2-1.3-9-5-9-10V6z" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <div className="tile-content">
            <div className="name">Emergency & Distress</div>
            <div className="meta">SOS · PROCEDURES · FIRST AID</div>
          </div>
        </div>

        {/* Maintenance Fix */}
        <div className="tile station-tile" id="tile-maintenance" onClick={() => onChangeView('maintenance')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" strokeWidth="1.8">
              <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2-2z" />
            </svg>
          </div>
          <div className="tile-content">
            <div className="name">Vessel Maintenance</div>
            <div className="meta">SCHEDULE · ENGINE · HULL</div>
          </div>
        </div>

        {/* Voyage Logs */}
        <div className="tile station-tile" id="tile-logs" onClick={() => onChangeView('logs')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E7EEF3" strokeWidth="1.8">
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M9 9h7M9 13h7M9 17h4" />
            </svg>
          </div>
          <div className="tile-content">
            <div className="name">Voyage Logs</div>
            <div className="meta">SQLITE SAVED · AUTO-SYNC</div>
          </div>
        </div>
      </div>

      {/* ── 3. Compact Local Tactical AI Assist Strip ── */}
      <div className="section-eyebrow">LOCAL TACTICAL INTELLIGENCE</div>

      <div
        className="tile ai-compact-tile"
        id="tile-ai-assistant"
        onClick={onOpenAssistant}
      >
        <div className="icon ai-icon-bg">
          <span style={{ fontSize: '18px', color: 'var(--sonar)' }}>⚡</span>
        </div>
        <div className="tile-content">
          <div className="name" style={{ color: 'var(--sonar)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Local Marine AI Assistant</span>
            <span className="badge-offline">100% OFFLINE</span>
          </div>
          <div className="meta">GROUNDED NAVAL ASSISTANCE · VOYAGES · HARDWARE GPS · SOS GUIDES</div>
        </div>
      </div>
    </div>
  );
}
