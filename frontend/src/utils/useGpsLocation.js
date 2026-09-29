/**
 * useGpsLocation — React hook for Browser Geolocation API
 *
 * States exposed:
 *   permission  : 'unknown' | 'prompt' | 'granted' | 'denied'
 *   status      : 'idle' | 'acquiring' | 'acquired' | 'unavailable' | 'denied'
 *   position    : { latitude, longitude, accuracy, timestamp } | null
 *   error       : string | null
 *
 * Behaviour:
 *   - Does NOT fabricate coordinates.
 *   - Persists last verified fix to localStorage under 'tideline_last_gps'.
 *   - Clears stale position when permission is denied.
 *   - Provides requestLocation() to manually trigger acquisition.
 *   - Subscribes to watchPosition for continuous updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'tideline_last_gps';
const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,       // 15 s before timeout error
  maximumAge: 30000,    // accept cached fix up to 30 s old
};

function loadStoredFix() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Basic sanity check — must have numeric lat/lon
    if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function storeFix(fix) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fix));
  } catch {
    // Quota errors — not critical
  }
}

export default function useGpsLocation() {
  const [permission, setPermission]   = useState('unknown');  // unknown|prompt|granted|denied
  const [status, setStatus]           = useState('idle');      // idle|acquiring|acquired|unavailable|denied
  const [position, setPosition]       = useState(loadStoredFix);
  const [error, setError]             = useState(null);

  const watchIdRef     = useRef(null);
  const mountedRef     = useRef(true);
  const autoStartedRef = useRef(false);

  // ── Success handler ──────────────────────────────────────────────────────
  const onSuccess = useCallback((pos) => {
    if (!mountedRef.current) return;

    const fix = {
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy:  pos.coords.accuracy,        // metres
      altitude:  pos.coords.altitude,        // may be null
      speed:     pos.coords.speed,           // m/s or null
      heading:   pos.coords.heading,         // deg or null
      timestamp: pos.timestamp,              // ms since epoch
      isoTime:   new Date(pos.timestamp).toISOString(),
    };

    storeFix(fix);
    setPosition(fix);
    setPermission('granted');
    setStatus('acquired');
    setError(null);
  }, []);

  // ── Error handler ────────────────────────────────────────────────────────
  const onError = useCallback((err) => {
    if (!mountedRef.current) return;

    switch (err.code) {
      case err.PERMISSION_DENIED:
        setPermission('denied');
        setStatus('denied');
        setError('Location permission denied. Enable it in browser settings and refresh.');
        break;
      case err.POSITION_UNAVAILABLE:
        setStatus('unavailable');
        setError('Location unavailable. No GPS signal or device sensor error.');
        break;
      case err.TIMEOUT:
        setStatus('unavailable');
        setError('Location request timed out. Check GPS signal and try again.');
        break;
      default:
        setStatus('unavailable');
        setError('Unknown location error occurred.');
    }
  }, []);

  // ── Query current permission state ──────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!navigator.geolocation) {
      setPermission('denied');
      setStatus('unavailable');
      setError('Geolocation is not supported by this browser.');
      return;
    }

    // Use Permissions API if available
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (!mountedRef.current) return;
          setPermission(result.state); // 'granted' | 'denied' | 'prompt'

          // Listen for future changes (user toggles permission in browser)
          result.onchange = () => {
            if (!mountedRef.current) return;
            setPermission(result.state);
            if (result.state === 'denied') {
              setStatus('denied');
              setError('Location permission was denied. Enable it in your browser settings.');
            }
          };
        })
        .catch(() => {
          if (mountedRef.current) setPermission('prompt');
        });
    } else {
      // Fallback: we won't know until we actually request
      setPermission('prompt');
    }

    return () => {
      mountedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // ── Auto-start GPS acquisition on mount ────────────────────────────────
  // Once the Permissions API resolves, automatically start watching position
  // so the browser shows its permission dialog and GPS data appears immediately.
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (permission === 'unknown') return; // Still querying Permissions API

    if (permission === 'granted' || permission === 'prompt') {
      autoStartedRef.current = true;

      // Small delay to let React settle before triggering browser permission prompt
      const timer = setTimeout(() => {
        if (!mountedRef.current) return;
        if (watchIdRef.current !== null) return; // Already watching

        setStatus('acquiring');
        setError(null);

        watchIdRef.current = navigator.geolocation.watchPosition(
          onSuccess,
          onError,
          GEO_OPTIONS,
        );
      }, 300);

      return () => clearTimeout(timer);
    } else if (permission === 'denied') {
      setStatus('denied');
      setError('Location permission denied. Enable it in browser settings and refresh.');
    }
  }, [permission, onSuccess, onError]);

  // ── Start / restart watching ─────────────────────────────────────────────
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setError('Geolocation is not supported by this browser.');
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setStatus('acquiring');
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      GEO_OPTIONS,
    );
  }, [onSuccess, onError]);

  // ── Stop watching ────────────────────────────────────────────────────────
  const stopLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (mountedRef.current) {
      setStatus('idle');
    }
  }, []);

  return {
    permission,
    status,
    position,
    error,
    requestLocation,
    stopLocation,
  };
}
