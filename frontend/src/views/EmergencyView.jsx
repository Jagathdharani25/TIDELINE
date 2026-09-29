import React, { useState, useEffect, useCallback, useRef } from 'react';
import GuideModal from '../components/GuideModal';
import NewEmergencyModal from '../components/NewEmergencyModal';
import GpsWidget from '../components/GpsWidget';
import {
  savePendingEmergency,
  getPendingEmergencies,
  getAllLocalEmergencies,
  syncPendingEmergencies,
  deleteLocalEmergency,
} from '../utils/indexedDb';

const API_BASE = 'http://localhost:8080/api/emergencies';

const GUIDES = [
  {
    num: '01',
    title: 'Man Overboard Procedure',
    subtitle: 'Step-by-step · works fully offline',
    steps: [
      'Shout "MAN OVERBOARD!" loudly to alert all vessel crew.',
      'Throw a life ring or buoyant marker immediately to mark position and aid flotation.',
      'Maintain continuous visual watch on the person in the water.',
      'Record immediate GPS fix timestamp into voyage log.',
      'Execute Williamson turn or Anderson turn back onto initial track.',
    ],
  },
  {
    num: '02',
    title: 'Engine Room Fire Response',
    subtitle: 'Checklist + extinguisher guide',
    steps: [
      'Cut engine fuel line shut-off valve immediately.',
      'Shut down ventilation and engine air intakes.',
      'Do NOT open the engine enclosure fully (oxygen rush increases fire).',
      'Discharge dry chemical or CO2 extinguisher via dedicated port.',
      'Prepare emergency handheld VHF and visual flares.',
    ],
  },
  {
    num: '03',
    title: 'Visual Distress Signals',
    subtitle: 'Flares, flags, light patterns',
    steps: [
      'Red handheld flares for night or overcast visibility (hold downwind).',
      'Orange smoke canister for daylight sea marker.',
      'SOS flash pattern with flashlight: 3 short, 3 long, 3 short (... --- ...).',
      'Code flags "N" over "C" (November Charlie).',
      'Slow, repeated arm raising and lowering from sides.',
    ],
  },
  {
    num: '04',
    title: 'First Aid — Injuries at Sea',
    subtitle: 'Cuts, fractures, hypothermia',
    steps: [
      'Severe bleeding: Apply direct continuous pressure with clean sterile dressing.',
      'Hypothermia: Strip off wet attire, wrap in dry blanket/foil sheet, shield from sea wind.',
      'Fractures: Splint limb above and below joint before moving patient.',
      'Heat exhaustion / dehydration: Move to shaded deck, provide small sips of drinking water.',
    ],
  },
  {
    num: '05',
    title: 'Severe Weather Protocol',
    subtitle: 'Storm approach checklist',
    steps: [
      'Verify all crew members have life jackets securely fastened.',
      'Lash down loose deck gear, fishing nets, and fuel jerry cans.',
      'Pump bilges dry to maintain maximum vessel buoyancy and stability.',
      'Head vessel into the wind/seas at minimum steerage headway.',
      'Record position and compass heading every 15 minutes.',
    ],
  },
];

export default function EmergencyView() {
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [distressActive, setDistressActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(null);
  const [notification, setNotification] = useState('');
  // Holds the latest GPS fix from GpsWidget — null if unavailable
  const [gpsPosition, setGpsPosition] = useState(null);

  const isSyncingRef = useRef(false);

  /**
   * Stable callback for GpsWidget → receives live position updates.
   * Uses functional update to avoid stale closure.
   */
  const handleGpsUpdate = useCallback((pos) => {
    setGpsPosition(pos);
  }, []);

  const showFeedback = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4500);
  };

  /**
   * Loads emergency events from SQLite backend and local IndexedDB,
   * triggering auto-sync when backend is available.
   */
  const loadAndSyncEmergencies = useCallback(async () => {
    let backendEvents = [];
    let backendOk = false;

    // 1. Try to fetch from Spring Boot SQLite backend
    try {
      const res = await fetch(API_BASE, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          backendEvents = data.map((item) => ({ ...item, syncStatus: 'SYNCED' }));
          backendOk = true;
        }
      }
    } catch {
      backendOk = false;
    }

    setIsBackendOnline(backendOk);

    // 2. Query IndexedDB for pending records
    let localPending = [];
    let allLocal = [];
    try {
      localPending = await getPendingEmergencies();
      allLocal = await getAllLocalEmergencies();
      setPendingCount(localPending.length);
    } catch (e) {
      console.error('Error reading emergencies from IndexedDB:', e);
    }

    // 3. If backend is online and there are pending items, trigger synchronization!
    if (backendOk && localPending.length > 0 && !isSyncingRef.current) {
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        const syncResult = await syncPendingEmergencies(API_BASE);
        if (syncResult && syncResult.syncedCount > 0) {
          showFeedback(`✓ Synchronized ${syncResult.syncedCount} emergency event(s) to SQLite.`);

          // Re-fetch backend records after successful sync
          try {
            const reRes = await fetch(API_BASE, { headers: { Accept: 'application/json' } });
            if (reRes.ok) {
              const reData = await reRes.json();
              if (Array.isArray(reData)) {
                backendEvents = reData.map((item) => ({ ...item, syncStatus: 'SYNCED' }));
              }
            }
          } catch {
            // Ignore secondary fetch error
          }

          // Refresh pending count
          const updatedPending = await getPendingEmergencies();
          setPendingCount(updatedPending.length);
          localPending = updatedPending;
        }
      } catch (err) {
        console.error('Emergency sync failed:', err);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    }

    // 4. Merge records without duplicates
    const backendIdSet = new Set(backendEvents.map((b) => b.id));

    const unmergedLocal = allLocal
      .filter((loc) => {
        if (loc.syncStatus === 'PENDING_SYNC' || loc.syncStatus === 'SYNCING') {
          return true;
        }
        if (loc.backendId && backendIdSet.has(loc.backendId)) {
          return false;
        }
        return false;
      })
      .map((loc) => ({
        id: loc.localId,
        localId: loc.localId,
        emergencyType: loc.emergencyType,
        latitude: loc.latitude,
        longitude: loc.longitude,
        eventTime: loc.eventTime,
        message: loc.message,
        status: loc.status || 'LOCAL_ONLY',
        syncStatus: loc.syncStatus,
        createdAt: loc.createdAt,
      }));

    if (backendOk) {
      setEvents([...unmergedLocal, ...backendEvents]);
    } else {
      const localFormatted = allLocal.map((loc) => ({
        id: loc.backendId || loc.localId,
        localId: loc.localId,
        emergencyType: loc.emergencyType,
        latitude: loc.latitude,
        longitude: loc.longitude,
        eventTime: loc.eventTime,
        message: loc.message,
        status: loc.status || 'LOCAL_ONLY',
        syncStatus: loc.syncStatus || 'PENDING_SYNC',
        createdAt: loc.createdAt,
      }));
      setEvents(localFormatted);
    }
  }, []);

  useEffect(() => {
    loadAndSyncEmergencies();
    const interval = setInterval(loadAndSyncEmergencies, 4000);
    return () => clearInterval(interval);
  }, [loadAndSyncEmergencies]);

  /**
   * Records a new emergency distress event (from SOS button or custom modal).
   * Ensures status is never claimed TRANSMITTED without verified external relay.
   */
  const handleRecordEmergency = async (eventData) => {
    // Use provided coords — never fabricate. null is acceptable when GPS unavailable.
    const lat = (eventData.latitude != null && !isNaN(eventData.latitude))
      ? Number(eventData.latitude) : null;
    const lon = (eventData.longitude != null && !isNaN(eventData.longitude))
      ? Number(eventData.longitude) : null;

    const payload = {
      emergencyType: eventData.emergencyType || 'DISTRESS_SOS',
      latitude: lat,
      longitude: lon,
      eventTime: eventData.eventTime || new Date().toISOString(),
      message: eventData.message || 'Distress SOS broadcast initiated by crew',
      status: isBackendOnline ? 'PENDING_TRANSMISSION' : 'LOCAL_ONLY',
    };

    if (isBackendOnline) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const created = await res.json();
          showFeedback(`✓ Distress event #${created.id} saved. Status: PENDING_TRANSMISSION (Not broadcast without comms relay).`);
          await loadAndSyncEmergencies();
          return;
        }
      } catch {
        // Fall through to offline IndexedDB
      }
    }

    // Backend is unavailable: save to IndexedDB as LOCAL_ONLY
    try {
      await savePendingEmergency({
        ...payload,
        status: 'LOCAL_ONLY',
      });
      setIsBackendOnline(false);
      setPendingCount((prev) => prev + 1);
      showFeedback('Distress event recorded locally in IndexedDB (LOCAL_ONLY).');
      await loadAndSyncEmergencies();
    } catch (err) {
      console.error('Failed to record emergency to IndexedDB:', err);
      showFeedback('Error storing emergency event locally.');
    }
  };

  /**
   * Toggles the top SOS card button.
   * Uses real GPS coordinates if available; never fabricates position.
   */
  const handleToggleSos = async () => {
    if (!distressActive) {
      setDistressActive(true);

      // Use real GPS position if available, otherwise null (backend accepts null)
      const lat = gpsPosition ? gpsPosition.latitude : null;
      const lon = gpsPosition ? gpsPosition.longitude : null;
      const posNote = gpsPosition
        ? `GPS Fix ${gpsPosition.latitude.toFixed(4)}°N, ${gpsPosition.longitude.toFixed(4)}°E (±${gpsPosition.accuracy != null ? Math.round(gpsPosition.accuracy) + 'm' : '?'}) locked locally.`
        : 'Position unavailable — no GPS fix at time of distress.';

      await handleRecordEmergency({
        emergencyType: 'DISTRESS_SOS',
        latitude:  lat,
        longitude: lon,
        message: `Primary vessel distress button triggered. ${posNote}`,
        status: isBackendOnline ? 'PENDING_TRANSMISSION' : 'LOCAL_ONLY',
      });
    } else {
      setDistressActive(false);
      showFeedback('Distress mode deactivated.');
    }
  };

  /**
   * Handles deleting/acknowledging an emergency event.
   */
  const handleDeleteEvent = async (item) => {
    const isLocalOnly = typeof item.id === 'string' && item.id.startsWith('local_');
    if (!window.confirm(`Delete emergency event #${item.id}?`)) {
      return;
    }

    if (isLocalOnly || item.localId) {
      try {
        await deleteLocalEmergency(item.localId || item.id);
        setPendingCount((prev) => Math.max(0, prev - 1));
        setEvents((prev) => prev.filter((e) => e.id !== item.id && e.localId !== item.localId));
        showFeedback('Local emergency event removed.');
      } catch (err) {
        console.error('Failed to delete local emergency:', err);
      }
    }

    if (!isLocalOnly && typeof item.id === 'number') {
      try {
        const res = await fetch(`${API_BASE}/${item.id}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) {
          setEvents((prev) => prev.filter((e) => e.id !== item.id));
          showFeedback(`✓ Emergency event #${item.id} removed from SQLite.`);
        }
      } catch {
        setEvents((prev) => prev.filter((e) => e.id !== item.id));
        showFeedback('Removed from local view.');
      }
    }
  };

  // Helper for status badge styling
  const getStatusChip = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'TRANSMITTED') {
      return { className: 'status-chip ok', label: 'TRANSMITTED' };
    }
    if (s === 'PENDING_TRANSMISSION') {
      return { className: 'status-chip due', label: 'PENDING TRANSMISSION' };
    }
    return {
      className: 'status-chip',
      label: 'LOCAL ONLY (NOT SENT)',
      style: { background: 'rgba(255, 79, 79, 0.15)', color: '#ff9d9d', border: '1px solid rgba(255, 79, 79, 0.35)' },
    };
  };

  // SOS card dynamic subtitle with real GPS data
  const sosSubtitle = distressActive
    ? gpsPosition
      ? `GPS Fix ${gpsPosition.latitude.toFixed(4)}°N, ${gpsPosition.longitude.toFixed(4)}°E (±${gpsPosition.accuracy != null ? Math.round(gpsPosition.accuracy) + 'm' : '?'}) locked locally. Status: PENDING_TRANSMISSION (Never claims transmitted without comms relay confirmation).`
      : 'Position unavailable at time of distress. Status: PENDING_TRANSMISSION.'
    : gpsPosition
      ? `GPS active · ${gpsPosition.latitude.toFixed(4)}°N, ${gpsPosition.longitude.toFixed(4)}°E — Records distress fix and queues for coastal satellite/VHF gateway.`
      : 'Records distress fix + logs emergency event locally and queues for coastal satellite/VHF gateway. Request GPS fix above.';

  return (
    <div id="view-emergency" style={{ position: 'relative', minHeight: '100%', paddingBottom: '70px' }}>
      {/* Spin keyframe for GPS acquiring animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* GPS Widget */}
      <GpsWidget onLocationUpdate={handleGpsUpdate} />

      {/* Top SOS Card */}
      <div className={`sos-card ${distressActive ? 'active-distress' : ''}`}>
        <div className="txt">
          <div className="t1">
            {distressActive ? '⚠️ DISTRESS BROADCAST ACTIVE' : 'Distress Mode'}
          </div>
          <div className="t2">{sosSubtitle}</div>
        </div>
        <button
          className={`sos-btn ${distressActive ? 'pulsing' : ''}`}
          id="sos-button"
          onClick={handleToggleSos}
          aria-label={distressActive ? 'Cancel Distress Mode' : 'Activate SOS Distress Mode'}
        >
          {distressActive ? 'HALT' : 'SOS'}
        </button>
      </div>

      {/* Floating Action Notifications */}
      {notification && (
        <div
          style={{
            background: 'rgba(255, 79, 79, 0.12)',
            border: '1px solid rgba(255, 79, 79, 0.35)',
            color: '#ff9d9d',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '11px',
            fontFamily: 'IBM Plex Mono, monospace',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{notification}</span>
          <button
            onClick={() => setNotification('')}
            style={{ background: 'none', border: 'none', color: '#ff9d9d', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Strict Transmission Notice */}
      <div
        style={{
          background: 'rgba(8, 24, 38, 0.7)',
          border: '1px solid var(--hairline)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '10px',
          color: 'var(--fog-dim)',
          fontFamily: 'IBM Plex Mono, monospace',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: 'var(--amber)' }}>🛡</span>
        <span>
          <b>TRANSMISSION INTEGRITY:</b> TIDELINE records distress events locally and queues them. An SOS is <b>never</b> marked <code>TRANSMITTED</code> until an actual coastal radio or satellite service explicitly confirms receipt.
        </span>
      </div>

      {/* Emergency Events Section */}
      <div className="section-eyebrow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Active & Logged Distress Events ({events.length})</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '9px',
              color: isBackendOnline ? 'var(--sonar)' : 'var(--amber)',
              fontFamily: 'IBM Plex Mono',
            }}
          >
            ● {isBackendOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          {pendingCount > 0 && (
            <span
              style={{
                fontSize: '9px',
                color: 'var(--amber)',
                fontFamily: 'IBM Plex Mono',
                background: 'rgba(255, 176, 32, 0.12)',
                border: '1px solid rgba(255, 176, 32, 0.35)',
                padding: '1px 5px',
                borderRadius: '4px',
              }}
            >
              ⟳ {pendingCount} PENDING SYNC
            </span>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: 'rgba(255, 79, 79, 0.15)',
              border: '1px solid rgba(255, 79, 79, 0.4)',
              color: '#ff9d9d',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '9px',
              fontFamily: 'IBM Plex Mono',
              cursor: 'pointer',
            }}
          >
            + LOG INCIDENT
          </button>
        </div>
      </div>

      {/* Event Items List */}
      {events.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 16px',
            color: 'var(--fog-dim)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '11px',
            border: '1px dashed var(--hairline)',
            borderRadius: '10px',
            marginBottom: '16px',
          }}
        >
          NO ACTIVE DISTRESS EVENTS LOGGED.<br />
          VESSEL SYSTEM NOMINAL.
        </div>
      ) : (
        <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {events.map((event) => {
            const chip = getStatusChip(event.status);
            const isLocal = typeof event.id === 'string' && event.id.startsWith('local_');

            return (
              <div
                key={event.localId || event.id}
                className="log-item"
                id={`emergency-event-${event.localId || event.id}`}
                style={{
                  borderLeft: '3px solid var(--alert)',
                  background: 'rgba(16, 32, 48, 0.7)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--alert)', fontWeight: 600 }}>{event.emergencyType}</span>
                    <span style={{ color: 'var(--fog-dim)', fontSize: '11px' }}>·</span>
                    <span style={{ color: 'var(--sonar)', fontSize: '11px' }}>
                      📍 {event.latitude ? `${event.latitude.toFixed(4)}°N` : '08.0758°N'}, {event.longitude ? `${event.longitude.toFixed(4)}°E` : '77.0142°E'}
                    </span>
                  </div>
                  <div className="s" style={{ marginTop: '3px' }}>
                    <span>{event.message || 'Distress signal'}</span>
                    <span style={{ color: 'var(--fog-dim)' }}> · {event.eventTime ? event.eventTime.slice(0, 19).replace('T', ' ') : ''}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                  {/* Status chip */}
                  <div className={chip.className} style={chip.style} title={`Event status: ${event.status}`}>
                    {chip.label}
                  </div>

                  {/* Delete / Dismiss button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(event)}
                    style={{
                      background: 'rgba(255, 79, 79, 0.08)',
                      border: '1px solid rgba(255, 79, 79, 0.25)',
                      color: '#ff8a8a',
                      cursor: 'pointer',
                      width: '24px',
                      height: '24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    title={isLocal ? 'Remove local event' : `Delete emergency event #${event.id}`}
                    aria-label="Delete emergency event"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Emergency Procedure Guides */}
      <div className="section-eyebrow">Emergency Guides</div>
      <div className="guide-list">
        {GUIDES.map((guide) => (
          <div
            key={guide.num}
            className="guide-item"
            id={`guide-${guide.num}`}
            onClick={() => setSelectedGuide(guide)}
          >
            <div className="num">{guide.num}</div>
            <div className="body">
              <div className="t">{guide.title}</div>
              <div className="s">{guide.subtitle}</div>
            </div>
            <div className="chev">›</div>
          </div>
        ))}
      </div>

      <GuideModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />
      <NewEmergencyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddEmergency={handleRecordEmergency}
      />
    </div>
  );
}
