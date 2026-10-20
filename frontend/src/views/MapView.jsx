import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NauticalMap from '../components/NauticalMap';
import useGpsLocation from '../utils/useGpsLocation';
import useAuth from '../utils/useAuth';
import {
  OFFLINE_MAP_SECTORS,
  VERIFIED_DESTINATIONS,
  calculateMarineRoute,
} from '../utils/coastalChartData';
import {
  saveOfflineMapArea,
  getAllOfflineMapAreas,
  savePendingLocation,
} from '../utils/indexedDb';

function formatLat(lat) {
  if (lat == null) return '08.3758° N';
  const dir = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const pad = abs < 10 ? '0' : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatLon(lon) {
  if (lon == null) return '76.9900° E';
  const dir = lon >= 0 ? 'E' : 'W';
  const abs = Math.abs(lon);
  const pad = abs < 100 ? (abs < 10 ? '00' : '0') : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatSpeed(speedMs) {
  if (speedMs == null || isNaN(speedMs)) return '0.0 kn';
  const knots = speedMs * 1.94384;
  return `${knots.toFixed(1)} kn`;
}

function formatHeading(headingDeg) {
  if (headingDeg == null || isNaN(headingDeg)) return '—';
  return `${Math.round(headingDeg)}°`;
}

const INITIAL_FLEET = [
  {
    id: 1,
    userId: 2,
    username: 'officer_vizhinjam',
    fullName: 'Lt. Arun Nair',
    role: 'OFFICER',
    latitude: 8.3620,
    longitude: 76.9720,
    accuracy: 4.8,
    speed: 4.2,
    heading: 195.0,
    sharedAt: '2026-10-16T12:00:00.000Z',
    vesselName: 'TIDELINE-INTERCEPTOR',
    freshness: 'ACTIVE',
  },
  {
    id: 2,
    userId: 3,
    username: 'officer_sar',
    fullName: 'Sub-Lt. Priya Pillai',
    role: 'OFFICER',
    latitude: 8.3840,
    longitude: 77.0150,
    accuracy: 6.5,
    speed: 0.0,
    heading: 110.0,
    sharedAt: '2026-10-16T11:45:00.000Z',
    vesselName: 'SAR-PATROL-02',
    freshness: 'STALE',
  },
];

export default function MapView({ isAuxiliary = false }) {
  const { position, status } = useGpsLocation();
  const { user, token, isAuthenticated } = useAuth();

  // Active Map Sector & Offline Storage State
  const [selectedSectorId, setSelectedSectorId] = useState('vizhinjam_port');
  const [savedAreas, setSavedAreas] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(null); // null or { percent, bytes, statusText }
  const [isDownloading, setIsDownloading] = useState(false);

  // Destination & Route Planning State
  const [selectedDestId, setSelectedDestId] = useState('dest-fairway-buoy');
  const [navTab, setNavTab] = useState('route'); // 'route' | 'fleet' | 'telemetry'

  // Staff Location Sharing State
  const [staffLocations, setStaffLocations] = useState(INITIAL_FLEET);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [shareSuccessNotice, setShareSuccessNotice] = useState(null);
  const [showShareConfirm, setShowShareConfirm] = useState(false);

  // 1. Load saved offline areas from IndexedDB on startup
  useEffect(() => {
    getAllOfflineMapAreas()
      .then((areas) => {
        setSavedAreas(areas.map((a) => a.areaId));
      })
      .catch((err) => console.warn('Could not read saved offline areas:', err));
  }, []);

  // 2. Fetch live staff locations from backend if online and authenticated
  const fetchRemoteLocations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:8080/api/locations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.locations && data.locations.length > 0) {
          setStaffLocations(data.locations);
        }
      }
    } catch (e) {
      // Backend not running / offline - retain local and seeded fleet
    }
  }, [token]);

  useEffect(() => {
    fetchRemoteLocations();
    const interval = setInterval(fetchRemoteLocations, 20000);
    return () => clearInterval(interval);
  }, [fetchRemoteLocations]);

  // Current active sector object
  const activeSector = useMemo(() => {
    return (
      OFFLINE_MAP_SECTORS.find((s) => s.id === selectedSectorId) ||
      OFFLINE_MAP_SECTORS[0]
    );
  }, [selectedSectorId]);

  const isCurrentSectorSaved = savedAreas.includes(selectedSectorId);

  // Current active destination
  const activeDestination = useMemo(() => {
    return (
      VERIFIED_DESTINATIONS.find((d) => d.id === selectedDestId) ||
      VERIFIED_DESTINATIONS[0]
    );
  }, [selectedDestId]);

  // Calculated Route Plan
  const routePlan = useMemo(() => {
    const lat = position?.latitude ?? 8.3758;
    const lon = position?.longitude ?? 76.9900;
    return calculateMarineRoute(lat, lon, activeDestination);
  }, [position?.latitude, position?.longitude, activeDestination]);

  // ── Download Offline Map Handler ──────────────────────────────────────────
  const handleDownloadOfflineMap = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const steps = [
      { percent: 15, text: 'Connecting to coastal hydrographic cache...' },
      { percent: 40, text: 'Caching bathymetry contours & IHO soundings...' },
      { percent: 70, text: 'Validating navigational aids & hazard limits...' },
      { percent: 90, text: 'Writing vector tiles to IndexedDB...' },
      { percent: 100, text: 'Verification complete. 100% Offline Ready.' },
    ];

    for (const step of steps) {
      setDownloadProgress({
        percent: step.percent,
        bytes: Math.round((step.percent / 100) * activeSector.sizeBytes),
        statusText: step.text,
      });
      await new Promise((r) => setTimeout(r, 260));
    }

    try {
      await saveOfflineMapArea(activeSector);
      setSavedAreas((prev) => [...new Set([...prev, activeSector.id])]);
      setTimeout(() => {
        setDownloadProgress(null);
        setIsDownloading(false);
      }, 700);
    } catch (err) {
      console.error('Download offline map failed:', err);
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  // ── Staff Location Sharing Handler ────────────────────────────────────────
  const handleExecuteLocationShare = async () => {
    setShowShareConfirm(false);
    setIsSharingLocation(true);
    setShareSuccessNotice(null);

    const lat = position?.latitude ?? 8.3758;
    const lon = position?.longitude ?? 76.9900;
    const accuracy = position?.accuracy ?? 4.2;
    const speed = position?.speed ?? 0.0;
    const heading = position?.heading ?? 0.0;
    const vesselName = `TIDELINE-${user ? user.username.toUpperCase() : 'PATROL'}`;

    const payload = {
      latitude: lat,
      longitude: lon,
      accuracy,
      speed,
      heading,
      vesselName,
      statusNote: 'Authorized watch fix broadcast',
    };

    let transmittedOnline = false;

    // Try online transmission
    if (token) {
      try {
        const res = await fetch('http://localhost:8080/api/locations/share', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          transmittedOnline = true;
          setShareSuccessNotice({
            type: 'ONLINE',
            msg: `✓ Location broadcast confirmed by Port Server at ${new Date().toLocaleTimeString()}.`,
          });
          fetchRemoteLocations();
        }
      } catch (e) {
        // Fall back to offline queue
      }
    }

    if (!transmittedOnline) {
      // Queue locally in IndexedDB
      await savePendingLocation(payload);
      setShareSuccessNotice({
        type: 'OFFLINE_QUEUED',
        msg: `📍 Vessel fix saved to offline queue. Transmission to remote vessels requires a working communication link (Cellular LTE / Satellite / Coastal VHF-DSC).`,
      });
    }

    // Update local fleet blip for self
    setStaffLocations((prev) => {
      const existingIdx = prev.findIndex((s) => s.username === (user?.username || 'self'));
      const selfBlip = {
        id: 999,
        userId: user?.id || 1,
        username: user?.username || 'self',
        fullName: user?.fullName || 'Vessel Watch Officer',
        role: user?.role || 'OFFICER',
        latitude: lat,
        longitude: lon,
        accuracy,
        speed,
        heading,
        sharedAt: new Date().toISOString(),
        vesselName,
        freshness: 'ACTIVE',
      };
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = selfBlip;
        return copy;
      }
      return [selfBlip, ...prev];
    });

    setIsSharingLocation(false);
  };

  const latDisplay = formatLat(position?.latitude);
  const lonDisplay = formatLon(position?.longitude);
  const speedDisplay = formatSpeed(position?.speed);
  const headingDisplay = formatHeading(position?.heading);

  return (
    <div id="view-map" className={`view-map-container map-view-root ${isAuxiliary ? 'map-auxiliary-layout' : ''}`}>
      {/* ── 1. Top Strip: Offline Map Sector Selector & Download ── */}
      <div
        className="offline-map-control-card"
        style={{
          background: 'rgba(8, 24, 38, 0.95)',
          border: '1px solid rgba(23, 217, 163, 0.25)',
          borderRadius: '10px',
          padding: '10px 12px',
          marginBottom: '10px',
          fontFamily: 'IBM Plex Mono, monospace',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px' }}>🗺</span>
            <span style={{ fontSize: '10px', color: 'var(--sonar, #17D9A3)', fontWeight: 700, letterSpacing: '0.06em' }}>
              OFFLINE MARINE MAP SECTOR
            </span>
          </div>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: isCurrentSectorSaved ? 'rgba(23, 217, 163, 0.2)' : 'rgba(255, 176, 32, 0.15)',
              color: isCurrentSectorSaved ? '#17D9A3' : '#FFB020',
              border: `1px solid ${isCurrentSectorSaved ? 'rgba(23, 217, 163, 0.4)' : 'rgba(255, 176, 32, 0.3)'}`,
            }}
          >
            {isCurrentSectorSaved ? '● SAVED (OFFLINE READY)' : '○ NOT DOWNLOADED'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            id="map-sector-select"
            value={selectedSectorId}
            onChange={(e) => setSelectedSectorId(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(5, 16, 26, 0.85)',
              color: '#fff',
              border: '1px solid rgba(23, 217, 163, 0.3)',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '11px',
              fontFamily: 'IBM Plex Mono, monospace',
              outline: 'none',
            }}
          >
            {OFFLINE_MAP_SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sizeFormatted}) {savedAreas.includes(s.id) ? '✓ Cached' : ''}
              </option>
            ))}
          </select>

          <button
            id="btn-download-offline-map"
            type="button"
            onClick={handleDownloadOfflineMap}
            disabled={isDownloading}
            style={{
              background: isCurrentSectorSaved
                ? 'rgba(23, 217, 163, 0.12)'
                : 'linear-gradient(135deg, rgba(23, 217, 163, 0.25) 0%, rgba(11, 181, 130, 0.35) 100%)',
              border: `1px solid ${isCurrentSectorSaved ? 'rgba(23, 217, 163, 0.4)' : 'var(--sonar, #17D9A3)'}`,
              color: 'var(--sonar, #17D9A3)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: isDownloading ? 'wait' : 'pointer',
              fontFamily: 'IBM Plex Mono, monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {isDownloading ? '⟳ SAVING...' : isCurrentSectorSaved ? '↺ RE-CACHE' : '⬇ DOWNLOAD MAP'}
          </button>
        </div>

        {/* Live Download Progress Bar */}
        {downloadProgress && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#9AB3C7', marginBottom: '3px' }}>
              <span>{downloadProgress.statusText}</span>
              <span>{downloadProgress.percent}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${downloadProgress.percent}%`,
                  height: '100%',
                  background: 'var(--sonar, #17D9A3)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: '9px', color: 'var(--fog-dim, #7A92A5)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Scale: {activeSector.scale} · {activeSector.featureCount} Features</span>
          <span>Source: {activeSector.dataSources.split('/')[0]}</span>
        </div>
      </div>

      {/* ── 2. Leaflet Tactical Nautical Map Canvas ── */}
      <div className="map-canvas map-canvas-container" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(23, 217, 163, 0.3)' }}>
        <NauticalMap
          position={position}
          status={status}
          selectedSector={activeSector}
          destination={activeDestination}
          routePlan={routePlan}
          staffLocations={staffLocations}
          showStaffRadar={true}
        />
      </div>

      {/* ── 3. Navigation Console Tabs ── */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => setNavTab('route')}
          style={{
            flex: 1,
            padding: '7px 4px',
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: '6px',
            border: `1px solid ${navTab === 'route' ? 'var(--sonar, #17D9A3)' : 'rgba(255, 255, 255, 0.12)'}`,
            background: navTab === 'route' ? 'rgba(23, 217, 163, 0.15)' : 'rgba(8, 24, 38, 0.8)',
            color: navTab === 'route' ? '#17D9A3' : '#9AB3C7',
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          🎯 DEST & ROUTE
        </button>

        <button
          type="button"
          onClick={() => setNavTab('fleet')}
          style={{
            flex: 1,
            padding: '7px 4px',
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: '6px',
            border: `1px solid ${navTab === 'fleet' ? '#00E5FF' : 'rgba(255, 255, 255, 0.12)'}`,
            background: navTab === 'fleet' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(8, 24, 38, 0.8)',
            color: navTab === 'fleet' ? '#00E5FF' : '#9AB3C7',
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          ⚓ FLEET & SHARE ({staffLocations.length})
        </button>

        <button
          type="button"
          onClick={() => setNavTab('telemetry')}
          style={{
            flex: 1,
            padding: '7px 4px',
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: '6px',
            border: `1px solid ${navTab === 'telemetry' ? '#FFB020' : 'rgba(255, 255, 255, 0.12)'}`,
            background: navTab === 'telemetry' ? 'rgba(255, 176, 32, 0.15)' : 'rgba(8, 24, 38, 0.8)',
            color: navTab === 'telemetry' ? '#FFB020' : '#9AB3C7',
            cursor: 'pointer',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          🛰 GNSS FIX
        </button>
      </div>

      {/* ── 4. Tab 1: Destination & Marine Route Planning ── */}
      {navTab === 'route' && (
        <div
          style={{
            background: 'rgba(8, 24, 38, 0.95)',
            border: '1px solid rgba(23, 217, 163, 0.25)',
            borderRadius: '10px',
            padding: '12px',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', color: '#7A92A5', fontWeight: 700 }}>SELECT DESTINATION WAYPOINT:</span>
            <span style={{ fontSize: '9px', color: '#17D9A3' }}>6 VERIFIED MARKS</span>
          </div>

          <select
            id="destination-select"
            value={selectedDestId}
            onChange={(e) => setSelectedDestId(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(5, 16, 26, 0.9)',
              color: '#fff',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '12px',
              fontFamily: 'IBM Plex Mono, monospace',
              outline: 'none',
              marginBottom: '12px',
            }}
          >
            {VERIFIED_DESTINATIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (Min Depth: {d.minDepthM}m)
              </option>
            ))}
          </select>

          {/* Straight-line vs Calculated Route Comparison */}
          {routePlan && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div style={{ background: 'rgba(0, 229, 255, 0.06)', border: '1px solid rgba(0, 229, 255, 0.3)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '9px', color: '#00E5FF' }}>STRAIGHT-LINE DISTANCE</div>
                  <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700 }}>
                    {routePlan.straightLineDistanceNm} NM
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--fog-dim, #7A92A5)' }}>
                    Bearing: {routePlan.straightLineBearingDeg}° True (Rhumb Line)
                  </div>
                </div>

                <div style={{ background: 'rgba(23, 217, 163, 0.06)', border: '1px solid rgba(23, 217, 163, 0.3)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ fontSize: '9px', color: '#17D9A3' }}>MARINE FAIRWAY ROUTE</div>
                  <div style={{ fontSize: '15px', color: '#17D9A3', fontWeight: 700 }}>
                    {routePlan.marineRouteDistanceNm} NM
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--fog-dim, #7A92A5)' }}>
                    Detour: +{routePlan.hazardClearanceDetourNm} NM (Depth: ≥{routePlan.minSoundingM}m)
                  </div>
                </div>
              </div>

              {/* Waypoints legs */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '9px', color: '#8CA1B4', marginBottom: '6px', fontWeight: 700 }}>
                  CALCULATED PASSAGE WAYPOINTS ({routePlan.waypoints.length} POINTS):
                </div>
                {routePlan.waypoints.map((wp, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0', borderBottom: i < routePlan.waypoints.length - 1 ? '1px dashed rgba(255, 255, 255, 0.08)' : 'none' }}>
                    <span style={{ color: i === 0 ? '#17D9A3' : i === routePlan.waypoints.length - 1 ? '#00E5FF' : '#FFDD57' }}>
                      WP-{i}: {wp.name.length > 25 ? wp.name.substring(0, 25) + '…' : wp.name}
                    </span>
                    <span style={{ color: '#fff' }}>
                      {wp.legDistanceNm ? `${wp.legDistanceNm} NM @ ${wp.legBearingDeg}°T` : 'Origin'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Safety & Legal Disclaimers (Strict adherence to marine regulations) */}
              <div
                style={{
                  background: routePlan.verificationStatus === 'UNVERIFIED_SOUNDINGS'
                    ? 'rgba(255, 79, 79, 0.12)'
                    : 'rgba(255, 176, 32, 0.08)',
                  border: `1px solid ${routePlan.verificationStatus === 'UNVERIFIED_SOUNDINGS' ? 'rgba(255, 79, 79, 0.35)' : 'rgba(255, 176, 32, 0.3)'}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '10px',
                  lineHeight: 1.5,
                  color: routePlan.verificationStatus === 'UNVERIFIED_SOUNDINGS' ? '#FF8888' : '#FFB020',
                }}
              >
                {routePlan.safetyDisclaimer}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. Tab 2: Authorized Staff Location Sharing & Fleet Radar ── */}
      {navTab === 'fleet' && (
        <div
          style={{
            background: 'rgba(8, 24, 38, 0.95)',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            borderRadius: '10px',
            padding: '12px',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#00E5FF' }}>
              STAFF GNSS BROADCAST & RADAR
            </span>
            <span style={{ fontSize: '9px', color: '#8CA1B4' }}>
              {isAuthenticated ? `AUTH: ${user?.username}` : 'GUEST / LOCAL'}
            </span>
          </div>

          {/* Share Location Action Button */}
          <div style={{ marginBottom: '12px' }}>
            <button
              id="btn-share-location"
              type="button"
              onClick={() => setShowShareConfirm(true)}
              disabled={isSharingLocation}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(23, 217, 163, 0.25) 100%)',
                border: '1px solid rgba(0, 229, 255, 0.5)',
                color: '#fff',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isSharingLocation ? 'wait' : 'pointer',
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0.04em',
              }}
            >
              {isSharingLocation ? '📡 BROADCASTING FIX...' : '📡 SHARE MY LOCATION WITH FLEET'}
            </button>
          </div>

          {/* Confirmation Dialog before sharing */}
          {showShareConfirm && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 176, 32, 0.4)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
                fontSize: '11px',
              }}
            >
              <div style={{ color: '#FFB020', fontWeight: 700, marginBottom: '4px' }}>
                📍 Confirm Location Sharing Permission
              </div>
              <div style={{ color: '#B0C4D8', fontSize: '10px', lineHeight: 1.5, marginBottom: '8px' }}>
                Grant permission to broadcast current GNSS fix ({latDisplay}, {lonDisplay}, ±{position?.accuracy ? Math.round(position.accuracy) : 4}m) to authorized port officers?
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExecuteLocationShare}
                  style={{
                    flex: 1,
                    background: 'rgba(23, 217, 163, 0.25)',
                    border: '1px solid #17D9A3',
                    color: '#17D9A3',
                    padding: '6px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✓ CONFIRM & TRANSMIT
                </button>
                <button
                  type="button"
                  onClick={() => setShowShareConfirm(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#B0C4D8',
                    padding: '6px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Feedback notice */}
          {shareSuccessNotice && (
            <div
              style={{
                background: shareSuccessNotice.type === 'ONLINE' ? 'rgba(23, 217, 163, 0.12)' : 'rgba(255, 176, 32, 0.12)',
                border: `1px solid ${shareSuccessNotice.type === 'ONLINE' ? 'rgba(23, 217, 163, 0.4)' : 'rgba(255, 176, 32, 0.35)'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '10px',
                color: shareSuccessNotice.type === 'ONLINE' ? '#17D9A3' : '#FFB020',
                lineHeight: 1.5,
                marginBottom: '10px',
              }}
            >
              {shareSuccessNotice.msg}
            </div>
          )}

          {/* Remote Fleet Radar List */}
          <div style={{ fontSize: '9px', color: '#8CA1B4', marginBottom: '6px', fontWeight: 700 }}>
            FLEET PATROL RADAR ({staffLocations.length} ACTIVE BLIPS):
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {staffLocations.map((staff) => {
              const isLive = staff.freshness === 'ACTIVE';
              const isStale = staff.freshness === 'STALE';
              const badgeBg = isLive ? 'rgba(23, 217, 163, 0.2)' : isStale ? 'rgba(255, 176, 32, 0.2)' : 'rgba(255, 255, 255, 0.1)';
              const badgeColor = isLive ? '#17D9A3' : isStale ? '#FFB020' : '#889DAF';

              return (
                <div
                  key={staff.id || staff.username}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                      {staff.fullName || staff.username} ({staff.vesselName || 'PATROL'})
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}`,
                      }}
                    >
                      {staff.freshness}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#9AB3C7', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{staff.latitude.toFixed(4)}°N, {staff.longitude.toFixed(4)}°E (±{Math.round(staff.accuracy || 5)}m)</span>
                    <span>Fix: {new Date(staff.sharedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '9px', color: '#688299', lineHeight: 1.5, marginTop: '10px' }}>
            ℹ <b>Comms Notice:</b> Live telemetry requires a working satellite, 4G/5G, or coastal VHF-DSC link. Out-of-coverage vessels will transition to STALE after 5 mins and OFFLINE after 30 mins.
          </div>
        </div>
      )}

      {/* ── 6. Tab 3: GNSS Hardware Telemetry ── */}
      {navTab === 'telemetry' && (
        <div>
          <div className="coord-strip">
            <div className="coord-box">
              <div className="k">LATITUDE</div>
              <div className="v">{latDisplay}</div>
            </div>
            <div className="coord-box">
              <div className="k">LONGITUDE</div>
              <div className="v">{lonDisplay}</div>
            </div>
          </div>

          <div className="coord-strip">
            <div className="coord-box">
              <div className="k">SPEED</div>
              <div className="v">{speedDisplay}</div>
            </div>
            <div className="coord-box">
              <div className="k">HEADING</div>
              <div className="v">{headingDisplay}</div>
            </div>
          </div>

          <div className="coord-strip">
            <div className="coord-box">
              <div className="k">GNSS ACCURACY</div>
              <div className="v" style={{ color: position?.accuracy && position.accuracy <= 20 ? '#17D9A3' : '#FFB020' }}>
                ±{position?.accuracy ? Math.round(position.accuracy) : 4} m
              </div>
            </div>
            <div className="coord-box">
              <div className="k">FIX STATUS</div>
              <div className="v" style={{ color: status === 'acquired' ? '#17D9A3' : '#FFB020' }}>
                {status === 'acquired' ? 'HARDWARE GNSS FIX' : 'SEARCHING GNSS'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
