/**
 * NewEmergencyModal — Log a marine emergency distress event.
 *
 * GPS integration:
 *  - Auto-fills latitude/longitude from the browser Geolocation API.
 *  - Shows GPS status inline so user knows if coords are real or manual.
 *  - Allows manual override when GPS is unavailable.
 *  - Never claims coordinates are GPS-verified unless geolocation succeeded.
 */

import React, { useState, useEffect, useCallback } from 'react';

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 30000,
};

// Read last stored fix from localStorage (set by GpsWidget)
function getStoredFix() {
  try {
    const raw = localStorage.getItem('tideline_last_gps');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.latitude === 'number' && typeof p.longitude === 'number') return p;
  } catch { /* ignore */ }
  return null;
}

export default function NewEmergencyModal({ isOpen, onClose, onAddEmergency }) {
  const [emergencyType, setEmergencyType] = useState('DISTRESS_SOS');
  const [latitude,  setLatitude]          = useState('');
  const [longitude, setLongitude]         = useState('');
  const [message,   setMessage]           = useState('');
  const [isSubmitting, setIsSubmitting]   = useState(false);

  // GPS state within modal
  const [gpsStatus, setGpsStatus]   = useState('idle'); // idle|acquiring|acquired|unavailable|denied
  const [gpsSource, setGpsSource]   = useState(null);   // 'live'|'stored'|'manual'|null
  const [gpsError,  setGpsError]    = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // ── On open: try to fill from stored fix, then request live ─────────────
  useEffect(() => {
    if (!isOpen) return;

    // Reset fields
    setMessage('');
    setEmergencyType('DISTRESS_SOS');
    setGpsError(null);

    // 1. Seed with last stored fix
    const stored = getStoredFix();
    if (stored) {
      setLatitude(stored.latitude.toFixed(6));
      setLongitude(stored.longitude.toFixed(6));
      setGpsAccuracy(stored.accuracy);
      setGpsSource('stored');
      setGpsStatus('acquired');
    } else {
      setLatitude('');
      setLongitude('');
      setGpsSource(null);
      setGpsStatus('idle');
    }

    // 2. Attempt live GPS acquisition
    if (!navigator.geolocation) {
      setGpsStatus(stored ? 'acquired' : 'unavailable');
      setGpsError('Geolocation not supported by this browser.');
      return;
    }

    setGpsStatus('acquiring');

    let watchId = null;
    let resolved = false;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        resolved = true;
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsAccuracy(pos.coords.accuracy);
        setGpsStatus('acquired');
        setGpsSource('live');
        setGpsError(null);

        // Persist the live fix
        try {
          localStorage.setItem('tideline_last_gps', JSON.stringify({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy,
            timestamp: pos.timestamp,
            isoTime:   new Date(pos.timestamp).toISOString(),
          }));
        } catch { /* ignore */ }
      },
      (err) => {
        if (resolved) return; // Already got a good fix; ignore subsequent errors
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setGpsError('Location permission denied. Enable in browser settings.');
          if (!stored) { setLatitude(''); setLongitude(''); setGpsSource('manual'); }
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsStatus(stored ? 'acquired' : 'unavailable');
          setGpsError('GPS signal unavailable. Using last stored fix or enter manually.');
          if (!stored) { setLatitude(''); setLongitude(''); setGpsSource('manual'); }
        } else {
          setGpsStatus(stored ? 'acquired' : 'unavailable');
          setGpsError('Location timed out. Using last stored fix or enter manually.');
          if (!stored) { setLatitude(''); setLongitude(''); setGpsSource('manual'); }
        }
      },
      GEO_OPTIONS,
    );

    // Clean up on unmount / close
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Manual coord entry marks source as manual ────────────────────────────
  const handleLatChange  = (e) => { setLatitude(e.target.value);  setGpsSource('manual'); };
  const handleLonChange  = (e) => { setLongitude(e.target.value); setGpsSource('manual'); };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    const hasValidCoords = !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

    try {
      await onAddEmergency({
        emergencyType,
        latitude:  hasValidCoords ? lat : null,
        longitude: hasValidCoords ? lon : null,
        eventTime: new Date().toISOString(),
        message:   message.trim() || `Urgent ${emergencyType.replace(/_/g, ' ')} logged at sea`,
        status:    'PENDING_TRANSMISSION',
        gpsSource, // informational — not persisted to backend schema
      });

      setMessage('');
      onClose();
    } catch (err) {
      console.error('Error recording emergency event:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [emergencyType, latitude, longitude, message, onAddEmergency, onClose, gpsSource]);

  if (!isOpen) return null;

  // ── GPS status badge for modal ───────────────────────────────────────────
  const gpsBadge = () => {
    switch (gpsStatus) {
      case 'acquiring':
        return { icon: '⟳', label: 'ACQUIRING GPS…', color: 'var(--amber)' };
      case 'acquired':
        if (gpsSource === 'live')
          return { icon: '●', label: `GPS FIX (LIVE ±${gpsAccuracy != null ? Math.round(gpsAccuracy) + 'm' : '?'})`, color: 'var(--sonar)' };
        if (gpsSource === 'stored')
          return { icon: '●', label: 'LAST STORED FIX', color: 'var(--amber)' };
        return { icon: '●', label: 'MANUAL COORDS', color: 'var(--fog)' };
      case 'denied':
        return { icon: '✕', label: 'GPS DENIED', color: 'var(--alert)' };
      case 'unavailable':
        return { icon: '✕', label: 'LOCATION UNAVAILABLE', color: 'var(--alert)' };
      default:
        return { icon: '○', label: 'GPS IDLE', color: 'var(--fog-dim)' };
    }
  };

  const badge = gpsBadge();
  const hasCoords = latitude !== '' && longitude !== '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: 'var(--alert)' }}>
            ⚠️ Log Marine Emergency Event
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Transmission warning */}
            <div
              style={{
                background: 'rgba(255, 79, 79, 0.1)',
                border: '1px solid rgba(255, 79, 79, 0.3)',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '10px',
                color: '#ff9d9d',
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            >
              ⚠ TRANSMISSION PROTOCOL: This event will be queued locally as <b>PENDING_TRANSMISSION</b>. TIDELINE will never claim an SOS was transmitted without confirmed satellite/VHF gateway acknowledgement.
            </div>

            {/* Emergency type */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                EMERGENCY INCIDENT TYPE
              </label>
              <select
                className="modal-input"
                value={emergencyType}
                onChange={(e) => setEmergencyType(e.target.value)}
                style={{ background: 'rgba(8, 24, 38, 0.95)', color: '#fff', border: '1px solid var(--hairline)' }}
              >
                <option value="DISTRESS_SOS"        style={{ background: '#081826' }}>DISTRESS_SOS (General Distress)</option>
                <option value="MAN_OVERBOARD"        style={{ background: '#081826' }}>MAN_OVERBOARD (Crew in Water)</option>
                <option value="ENGINE_FIRE"          style={{ background: '#081826' }}>ENGINE_FIRE (Machinery Space Fire)</option>
                <option value="MEDICAL_EMERGENCY"    style={{ background: '#081826' }}>MEDICAL_EMERGENCY (Severe Injury)</option>
                <option value="HULL_BREACH"          style={{ background: '#081826' }}>HULL_BREACH (Taking Water / Flooding)</option>
                <option value="STEERING_FAILURE"     style={{ background: '#081826' }}>STEERING_FAILURE (Vessel Not Under Command)</option>
              </select>
            </div>

            {/* GPS position block */}
            <div
              style={{
                background: 'rgba(8, 24, 38, 0.7)',
                border: `1px solid ${gpsStatus === 'acquired' && gpsSource === 'live' ? 'rgba(0,255,180,0.25)' : 'var(--hairline)'}`,
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              {/* GPS status row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>
                  🛰 VESSEL POSITION
                </span>
                <span style={{ fontSize: '9px', color: badge.color, fontFamily: 'IBM Plex Mono' }}>
                  {badge.icon} {badge.label}
                </span>
              </div>

              {/* GPS error notice */}
              {gpsError && (
                <div style={{ fontSize: '10px', color: 'var(--amber)', marginBottom: '8px', lineHeight: 1.4 }}>
                  ⚠ {gpsError}
                </div>
              )}

              {/* LOCATION UNAVAILABLE message if no coords at all */}
              {!hasCoords && gpsStatus !== 'acquiring' && gpsSource !== 'live' && (
                <div style={{ fontSize: '10px', color: '#ff9d9d', marginBottom: '8px', fontFamily: 'IBM Plex Mono' }}>
                  LOCATION UNAVAILABLE — enter coordinates manually below.
                </div>
              )}

              {/* Coord inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--fog-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '3px' }}>
                    LATITUDE
                  </label>
                  <input
                    id="emergency-latitude"
                    type="number"
                    step="0.000001"
                    min="-90"
                    max="90"
                    className="modal-input"
                    value={latitude}
                    onChange={handleLatChange}
                    placeholder={gpsStatus === 'acquiring' ? 'Acquiring…' : 'e.g. 8.075800'}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--fog-dim)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '3px' }}>
                    LONGITUDE
                  </label>
                  <input
                    id="emergency-longitude"
                    type="number"
                    step="0.000001"
                    min="-180"
                    max="180"
                    className="modal-input"
                    value={longitude}
                    onChange={handleLonChange}
                    placeholder={gpsStatus === 'acquiring' ? 'Acquiring…' : 'e.g. 77.014200'}
                    style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* Manual entry notice */}
              {gpsSource === 'manual' && (
                <div style={{ fontSize: '9px', color: 'var(--fog-dim)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>
                  ✎ MANUAL ENTRY — not GPS-verified
                </div>
              )}
            </div>

            {/* Situation / message */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                SITUATION / MESSAGE
              </label>
              <input
                type="text"
                id="emergency-message"
                className="modal-input"
                placeholder="e.g. Taking water in aft bilge, pumps running"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="btn-primary"
              id="emergency-submit-btn"
              style={{ background: 'var(--alert)', borderColor: 'var(--alert)', color: '#fff' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'LOGGING…' : 'LOG INCIDENT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
