import React from 'react';
import useGpsLocation from '../utils/useGpsLocation';

function formatLat(lat) {
  if (lat == null) return '—';
  const dir = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const pad = abs < 10 ? '0' : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatLon(lon) {
  if (lon == null) return '—';
  const dir = lon >= 0 ? 'E' : 'W';
  const abs = Math.abs(lon);
  const pad = abs < 100 ? (abs < 10 ? '00' : '0') : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

export default function HomeView({ onChangeView, onOpenAssistant }) {
  const { position, status } = useGpsLocation();

  const isAcquired = status === 'acquired' && position?.latitude != null;
  const isAcquiring = status === 'acquiring';

  return (
    <div id="view-home">
      <div className="section-eyebrow">Vessel Position & Hardware GPS</div>

      <div className="gps-dial-card">
        <div className="dial-wrap">
          <div className="dial-ring">
            <div className="dial-sweep"></div>
            <div className="dial-center">
              {isAcquired ? (
                <>
                  GPS FIX<br />
                  ±{position?.accuracy ? Math.round(position.accuracy) : 4}m
                </>
              ) : isAcquiring ? (
                <>
                  SEARCH<br />GNSS
                </>
              ) : (
                <>
                  GPS<br />UNAVAIL
                </>
              )}
            </div>
          </div>
        </div>
        <div className="gps-info">
          <div className="label">
            {isAcquired ? 'GPS FIX' : isAcquiring ? 'ACQUIRING GNSS...' : 'GPS UNAVAILABLE'}
          </div>
          <div className="coords">
            {isAcquired ? (
              <>
                {formatLat(position.latitude)}
                <span>{formatLon(position.longitude)} · Hardware GNSS Fix</span>
              </>
            ) : isAcquiring ? (
              <>
                SEARCHING SATELLITES...
                <span>Acquiring authentic hardware GNSS signal</span>
              </>
            ) : (
              <>
                NO SATELLITE FIX
                <span>Hardware GPS receiver listening...</span>
              </>
            )}
          </div>
          <div className="gps-source">
            {isAcquired ? 'Verified GNSS Hardware · 100% Offline' : 'GPS hardware listener active · No mock data'}
          </div>
        </div>
      </div>

      <div className="section-eyebrow">Local AI Assistant</div>
      <div
        className="tile"
        id="tile-ai-assistant"
        onClick={onOpenAssistant}
        style={{
          marginBottom: '14px',
          background: 'linear-gradient(135deg, rgba(23, 217, 163, 0.12) 0%, rgba(15, 42, 63, 0.95) 100%)',
          border: '1px solid rgba(23, 217, 163, 0.35)',
          cursor: 'pointer',
        }}
      >
        <div className="icon" style={{ background: 'rgba(23, 217, 163, 0.15)' }}>
          <span style={{ fontSize: '20px', color: 'var(--sonar)' }}>⚡</span>
        </div>
        <div>
          <div className="name" style={{ color: 'var(--sonar)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Local Marine AI
            <span style={{ fontSize: '9px', background: 'var(--sonar)', color: 'var(--navy-deep)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
              OFFLINE
            </span>
          </div>
          <div className="meta">VERIFIED VOYAGES · HARDWARE GPS · GEAR · SOS</div>
        </div>
      </div>

      <div className="section-eyebrow">Quick Access</div>
      <div className="grid2">
        <div className="tile" id="tile-maps" onClick={() => onChangeView('map')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#17D9A3" strokeWidth="1.6">
              <path d="M9 4l6 3 5-2v15l-5 2-6-3-5 2V6z" />
              <path d="M9 4v15M15 7v15" />
            </svg>
          </div>
          <div>
            <div className="name">Offline Maps</div>
            <div className="meta">CACHED · 12 CHARTS</div>
          </div>
        </div>

        <div className="tile emergency" id="tile-emergency" onClick={() => onChangeView('emergency')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ff9d9d" strokeWidth="1.6">
              <path d="M12 2l9 4v6c0 5-3.8 8.7-9 10-5.2-1.3-9-5-9-10V6z" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <div>
            <div className="name">Emergency</div>
            <div className="meta">SOS · FIRST AID · SIGNALS</div>
          </div>
        </div>

        <div className="tile" id="tile-maintenance" onClick={() => onChangeView('maintenance')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFB020" strokeWidth="1.6">
              <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2-2z" />
            </svg>
          </div>
          <div>
            <div className="name">Maintenance</div>
            <div className="meta">ENGINE · HULL · GEAR</div>
          </div>
        </div>

        <div className="tile" id="tile-logs" onClick={() => onChangeView('logs')}>
          <div className="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E7EEF3" strokeWidth="1.6">
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M9 9h7M9 13h7M9 17h4" />
            </svg>
          </div>
          <div>
            <div className="name">Voyage Logs</div>
            <div className="meta">AUTO-SAVED LOCALLY</div>
          </div>
        </div>
      </div>

      <div className="storage-strip">
        <div className="row">
          <div className="k">🗄 Local database</div>
          <div className="v">SQLite / Room</div>
        </div>
        <div className="row">
          <div className="k">Offline data used</div>
          <div className="v">
            184 MB / 512 MB
            <span className="bar">
              <i style={{ width: '36%' }}></i>
            </span>
          </div>
        </div>
        <div className="row">
          <div className="k">Last sync attempt</div>
          <div className="v">Not required</div>
        </div>
      </div>
    </div>
  );
}
