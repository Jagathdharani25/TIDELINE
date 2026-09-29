/**
 * GpsWidget — TIDELINE GPS location panel component.
 *
 * Displays:
 *  - Real-time latitude, longitude, accuracy and timestamp from browser Geolocation API.
 *  - Clear LOCATION UNAVAILABLE state if GPS is inaccessible.
 *  - Permission denied / prompt states with clear messaging.
 *  - Last verified fix even after page reload (from localStorage).
 *  - GPS FIX / NO FIX indicator badge.
 *
 * Never fabricates coordinates.
 * Exposes onLocationUpdate callback so parent can receive live coords.
 */

import React, { useEffect } from 'react';
import useGpsLocation from '../utils/useGpsLocation';

// Format decimal degrees to DMS display
function toDMS(deg, posLabel, negLabel) {
  const abs    = Math.abs(deg);
  const d      = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m      = Math.floor(mFloat);
  const s      = ((mFloat - m) * 60).toFixed(1);
  const dir    = deg >= 0 ? posLabel : negLabel;
  return `${d}°${m}'${s}"${dir}`;
}

function formatAccuracy(meters) {
  if (meters == null) return '—';
  if (meters < 1000) return `±${Math.round(meters)} m`;
  return `±${(meters / 1000).toFixed(1)} km`;
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(typeof ts === 'string' ? ts : ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

export default function GpsWidget({ onLocationUpdate }) {
  const { permission, status, position, error, requestLocation, stopLocation } = useGpsLocation();

  // Notify parent whenever position changes
  useEffect(() => {
    if (position && typeof onLocationUpdate === 'function') {
      onLocationUpdate(position);
    }
  }, [position, onLocationUpdate]);

  // ── Status badge helper ──────────────────────────────────────────────────
  const getStatusBadge = () => {
    switch (status) {
      case 'acquired':
        return { label: '● GPS FIX', color: 'var(--sonar)' };
      case 'acquiring':
        return { label: '⟳ ACQUIRING', color: 'var(--amber)' };
      case 'denied':
        return { label: '✕ DENIED', color: 'var(--alert)' };
      case 'unavailable':
        return { label: '✕ NO SIGNAL', color: 'var(--alert)' };
      default:
        return { label: '○ IDLE', color: 'var(--fog-dim)' };
    }
  };

  const badge = getStatusBadge();
  const hasLiveFix = status === 'acquired' && position;
  const hasStoredFix = position && status !== 'acquired';

  // ── Styles ───────────────────────────────────────────────────────────────
  const panelStyle = {
    background: 'rgba(8, 24, 38, 0.85)',
    border: `1px solid ${hasLiveFix ? 'rgba(0, 255, 180, 0.3)' : 'var(--hairline)'}`,
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '14px',
    fontFamily: 'IBM Plex Mono, monospace',
  };

  const labelStyle = {
    fontSize: '9px',
    color: 'var(--fog-dim)',
    letterSpacing: '0.08em',
    marginBottom: '2px',
    textTransform: 'uppercase',
  };

  const valueStyle = {
    fontSize: '13px',
    color: '#fff',
    fontWeight: 500,
    lineHeight: 1.3,
  };

  const smallValueStyle = {
    fontSize: '11px',
    color: 'var(--fog)',
    lineHeight: 1.4,
  };

  return (
    <div style={panelStyle} id="gps-widget">
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px' }}>🛰</span>
          <span style={{ fontSize: '11px', color: 'var(--sonar)', fontWeight: 600, letterSpacing: '0.05em' }}>
            VESSEL GPS POSITION
          </span>
        </div>
        <span style={{ fontSize: '9px', color: badge.color, fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>
          {badge.label}
        </span>
      </div>

      {/* Permission prompt — show if not yet requested */}
      {permission === 'prompt' && status === 'idle' && (
        <div
          style={{
            background: 'rgba(255, 176, 32, 0.08)',
            border: '1px solid rgba(255, 176, 32, 0.3)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '10px',
            fontSize: '11px',
            color: 'var(--amber)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>📍 Location Permission Required</div>
          <div style={{ color: 'var(--fog)', fontSize: '10px', lineHeight: 1.5 }}>
            TIDELINE uses your device GPS for emergency positioning. Your location is stored only on this device — never transmitted without your action.
          </div>
        </div>
      )}

      {/* Permission denied state */}
      {(status === 'denied' || permission === 'denied') && (
        <div
          style={{
            background: 'rgba(255, 79, 79, 0.1)',
            border: '1px solid rgba(255, 79, 79, 0.3)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '10px',
            fontSize: '11px',
            color: '#ff9d9d',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>🚫 Location Permission Denied</div>
          <div style={{ fontSize: '10px', color: 'var(--fog)', lineHeight: 1.5 }}>
            Enable location access in your browser settings (Site Settings → Location → Allow), then refresh.
          </div>
        </div>
      )}

      {/* Acquiring spinner */}
      {status === 'acquiring' && (
        <div style={{ fontSize: '11px', color: 'var(--amber)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⟳</span>
          Acquiring GPS fix… keep device in open sky for best accuracy.
        </div>
      )}

      {/* Unavailable (not denied — could be hardware / no signal) */}
      {status === 'unavailable' && (
        <div
          style={{
            background: 'rgba(255, 79, 79, 0.08)',
            border: '1px solid rgba(255, 79, 79, 0.25)',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '10px',
            fontSize: '11px',
            color: '#ff9d9d',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
          }}
        >
          <span>⚠</span>
          <span>
            <b>LOCATION UNAVAILABLE</b>
            <br />
            <span style={{ fontSize: '10px', color: 'var(--fog)' }}>{error || 'No GPS signal. Ensure device is outdoors or GPS is enabled.'}</span>
          </span>
        </div>
      )}

      {/* Live position display */}
      {position && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '10px',
          }}
        >
          {/* Latitude */}
          <div
            style={{
              background: 'rgba(0, 255, 180, 0.04)',
              border: '1px solid rgba(0, 255, 180, 0.12)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={labelStyle}>Latitude</div>
            <div style={valueStyle}>{position.latitude.toFixed(6)}°</div>
            <div style={smallValueStyle}>{toDMS(position.latitude, 'N', 'S')}</div>
          </div>

          {/* Longitude */}
          <div
            style={{
              background: 'rgba(0, 255, 180, 0.04)',
              border: '1px solid rgba(0, 255, 180, 0.12)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={labelStyle}>Longitude</div>
            <div style={valueStyle}>{position.longitude.toFixed(6)}°</div>
            <div style={smallValueStyle}>{toDMS(position.longitude, 'E', 'W')}</div>
          </div>

          {/* Accuracy */}
          <div
            style={{
              background: 'rgba(8, 24, 38, 0.6)',
              border: '1px solid var(--hairline)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={labelStyle}>Accuracy</div>
            <div style={{ ...valueStyle, color: position.accuracy <= 20 ? 'var(--sonar)' : position.accuracy <= 100 ? 'var(--amber)' : '#ff9d9d' }}>
              {formatAccuracy(position.accuracy)}
            </div>
            <div style={smallValueStyle}>
              {position.accuracy <= 20 ? 'HIGH' : position.accuracy <= 100 ? 'MODERATE' : 'LOW'}
            </div>
          </div>

          {/* Timestamp */}
          <div
            style={{
              background: 'rgba(8, 24, 38, 0.6)',
              border: '1px solid var(--hairline)',
              borderRadius: '8px',
              padding: '8px 10px',
            }}
          >
            <div style={labelStyle}>Fix Time</div>
            <div style={smallValueStyle}>{formatTimestamp(position.isoTime || position.timestamp)}</div>
            <div style={{ fontSize: '9px', color: hasStoredFix ? 'var(--amber)' : 'var(--fog-dim)', marginTop: '2px' }}>
              {hasStoredFix ? 'LAST STORED FIX' : 'LIVE'}
            </div>
          </div>
        </div>
      )}

      {/* No position at all and not acquiring */}
      {!position && status !== 'acquiring' && status !== 'denied' && permission !== 'denied' && (
        <div
          style={{
            textAlign: 'center',
            padding: '12px 8px',
            fontSize: '11px',
            color: 'var(--fog-dim)',
            fontFamily: 'IBM Plex Mono, monospace',
            border: '1px dashed var(--hairline)',
            borderRadius: '8px',
            marginBottom: '10px',
          }}
        >
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>🛰</div>
          LOCATION UNAVAILABLE
          <br />
          <span style={{ fontSize: '10px' }}>Press REQUEST FIX to acquire GPS position</span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {status !== 'acquiring' && (permission !== 'denied') && (
          <button
            id="gps-request-btn"
            onClick={requestLocation}
            style={{
              flex: 1,
              background: hasLiveFix ? 'rgba(0, 255, 180, 0.1)' : 'rgba(0, 255, 180, 0.15)',
              border: `1px solid ${hasLiveFix ? 'rgba(0, 255, 180, 0.4)' : 'rgba(0, 255, 180, 0.5)'}`,
              color: 'var(--sonar)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '10px',
              fontFamily: 'IBM Plex Mono, monospace',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            aria-label="Request GPS location"
          >
            {status === 'acquired' ? '↺ REFRESH FIX' : '📍 REQUEST FIX'}
          </button>
        )}

        {status === 'acquiring' && (
          <button
            id="gps-stop-btn"
            onClick={stopLocation}
            style={{
              flex: 1,
              background: 'rgba(255, 176, 32, 0.1)',
              border: '1px solid rgba(255, 176, 32, 0.35)',
              color: 'var(--amber)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '10px',
              fontFamily: 'IBM Plex Mono, monospace',
              cursor: 'pointer',
            }}
            aria-label="Stop GPS acquisition"
          >
            ✕ CANCEL
          </button>
        )}

        {/* Decimal coords for quick copy */}
        {position && (
          <button
            id="gps-copy-btn"
            onClick={() => {
              const text = `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
              navigator.clipboard?.writeText(text).catch(() => {});
            }}
            title={`Copy: ${position?.latitude?.toFixed(6)}, ${position?.longitude?.toFixed(6)}`}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--hairline)',
              color: 'var(--fog)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '10px',
              fontFamily: 'IBM Plex Mono, monospace',
              cursor: 'pointer',
            }}
            aria-label="Copy coordinates to clipboard"
          >
            ⎘ COPY
          </button>
        )}
      </div>
    </div>
  );
}
