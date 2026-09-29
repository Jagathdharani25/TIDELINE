import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewLogModal from '../components/NewLogModal';
import {
  savePendingVoyage,
  getPendingVoyages,
  getAllLocalVoyages,
  syncPendingVoyages,
  deleteLocalVoyage,
} from '../utils/indexedDb';

const API_BASE = 'http://localhost:8080/api/voyages';

// Default offline fallback entries if both backend and IndexedDB are fresh
const INITIAL_SAMPLE_LOGS = [
  {
    id: 1,
    voyageDate: '2026-09-18',
    departure: 'Vizhinjam Harbour',
    destination: 'Arabian Sea Sector 4',
    vesselName: 'TIDELINE-01',
    notes: 'Departed 05:12 · GPS 08.0234°N, 77.0741°E · sea state calm',
    syncStatus: 'SYNCED',
  },
  {
    id: 2,
    voyageDate: '2026-09-18',
    departure: 'Arabian Sea Sector 4',
    destination: 'Offshore Trench',
    vesselName: 'TIDELINE-01',
    notes: 'Course 214° · GPS 08.0612°N, 76.9855°E · baro 1012 hPa',
    syncStatus: 'SYNCED',
  },
];

export default function LogsView() {
  const [logs, setLogs] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(null); // null = checking, true/false
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState('');

  const isSyncingRef = useRef(false);

  const showFeedback = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4500);
  };

  /**
   * Loads both SQLite backend logs and local IndexedDB pending logs,
   * then merges them deduplicated.
   */
  const loadAndSyncLogs = useCallback(async () => {
    let backendLogs = [];
    let backendOk = false;

    // 1. Try to fetch from Spring Boot SQLite backend
    try {
      const res = await fetch(API_BASE, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          backendLogs = data.map((item) => ({ ...item, syncStatus: 'SYNCED' }));
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
      localPending = await getPendingVoyages();
      allLocal = await getAllLocalVoyages();
      setPendingCount(localPending.length);
    } catch (e) {
      console.error('Error reading from IndexedDB:', e);
    }

    // 3. If backend is online and there are pending items, trigger synchronization!
    if (backendOk && localPending.length > 0 && !isSyncingRef.current) {
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        const syncResult = await syncPendingVoyages(API_BASE);
        if (syncResult && syncResult.syncedCount > 0) {
          showFeedback(`✓ Synchronized ${syncResult.syncedCount} pending voyage(s) to SQLite.`);

          // Re-fetch backend logs after successful sync
          try {
            const reRes = await fetch(API_BASE, { headers: { Accept: 'application/json' } });
            if (reRes.ok) {
              const reData = await reRes.json();
              if (Array.isArray(reData)) {
                backendLogs = reData.map((item) => ({ ...item, syncStatus: 'SYNCED' }));
              }
            }
          } catch {
            // Ignore if secondary fetch fails
          }

          // Refresh pending count
          const updatedPending = await getPendingVoyages();
          setPendingCount(updatedPending.length);
          localPending = updatedPending;
        }
      } catch (err) {
        console.error('Sync failed:', err);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    }

    // 4. Merge logs without duplicates
    // Collect all backend IDs to prevent displaying synced local duplicates
    const backendIdSet = new Set(backendLogs.map((b) => b.id));

    // Only include local items that have not yet been synced to backend (PENDING_SYNC or SYNCING)
    // or synced local items that aren't yet in the backend list
    const unmergedLocal = allLocal
      .filter((loc) => {
        if (loc.syncStatus === 'PENDING_SYNC' || loc.syncStatus === 'SYNCING') {
          return true;
        }
        if (loc.backendId && backendIdSet.has(loc.backendId)) {
          return false; // Already present in backend list
        }
        return false;
      })
      .map((loc) => ({
        id: loc.localId,
        localId: loc.localId,
        voyageDate: loc.voyageDate,
        departure: loc.departure,
        destination: loc.destination,
        vesselName: loc.vesselName,
        notes: loc.notes,
        syncStatus: loc.syncStatus,
        createdAt: loc.createdAt,
      }));

    if (backendOk) {
      // Show pending items first, then backend logs
      const combined = [...unmergedLocal, ...backendLogs];
      setLogs(combined);
    } else {
      // Backend is offline: show all local IndexedDB records
      if (allLocal.length > 0) {
        const localFormatted = allLocal.map((loc) => ({
          id: loc.backendId || loc.localId,
          localId: loc.localId,
          voyageDate: loc.voyageDate,
          departure: loc.departure,
          destination: loc.destination,
          vesselName: loc.vesselName,
          notes: loc.notes,
          syncStatus: loc.syncStatus || 'PENDING_SYNC',
          createdAt: loc.createdAt,
        }));
        setLogs(localFormatted);
      } else {
        setLogs(INITIAL_SAMPLE_LOGS);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadAndSyncLogs();
    const interval = setInterval(loadAndSyncLogs, 4000);
    return () => clearInterval(interval);
  }, [loadAndSyncLogs]);

  /**
   * Handles creating a new voyage log.
   * If backend is online, saves to SQLite. If offline or on error, saves to IndexedDB with PENDING_SYNC.
   */
  const handleAddLog = async (newEntry) => {
    let savedToBackend = false;

    // Check if backend is currently online
    if (isBackendOnline) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(newEntry),
        });

        if (res.ok) {
          const backendLog = await res.json();
          savedToBackend = true;
          showFeedback(`✓ Voyage #${backendLog.id} saved to SQLite.`);
          await loadAndSyncLogs();
          return;
        }
      } catch {
        savedToBackend = false;
      }
    }

    // Backend is unavailable or request failed: save to IndexedDB as PENDING_SYNC
    try {
      const localRecord = await savePendingVoyage(newEntry);
      setIsBackendOnline(false);
      setPendingCount((prev) => prev + 1);
      showFeedback('Saved locally to IndexedDB (PENDING SYNC).');
      await loadAndSyncLogs();
    } catch (err) {
      console.error('Failed to save to IndexedDB:', err);
      showFeedback('Error saving voyage log locally.');
    }
  };

  /**
   * Handles deleting a voyage log.
   * Deletes from backend if numeric ID, or from IndexedDB if localId.
   */
  const handleDeleteLog = async (item) => {
    const isLocalOnly = typeof item.id === 'string' && item.id.startsWith('local_');
    const confirmPrompt = isLocalOnly
      ? 'Delete pending local voyage log from IndexedDB?'
      : `Delete voyage log #${item.id} from SQLite storage?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    if (isLocalOnly || item.localId) {
      try {
        await deleteLocalVoyage(item.localId || item.id);
        setPendingCount((prev) => Math.max(0, prev - 1));
        setLogs((prev) => prev.filter((log) => log.id !== item.id && log.localId !== item.localId));
        showFeedback('Local voyage log removed.');
      } catch (err) {
        console.error('Failed to delete from IndexedDB:', err);
      }
    }

    if (!isLocalOnly && typeof item.id === 'number') {
      try {
        const res = await fetch(`${API_BASE}/${item.id}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) {
          setLogs((prev) => prev.filter((log) => log.id !== item.id));
          showFeedback(`✓ Voyage #${item.id} deleted from SQLite.`);
        }
      } catch {
        setLogs((prev) => prev.filter((log) => log.id !== item.id));
        showFeedback(`Removed from local view (Backend offline).`);
      }
    }
  };

  return (
    <div id="view-logs" style={{ position: 'relative', minHeight: '100%', paddingBottom: '70px' }}>
      {/* Top Header / Status Section */}
      <div className="section-eyebrow">
        <span>Voyage Log · SQLite Stored</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Online/Offline Badge */}
          <span
            style={{
              fontSize: '9px',
              color: isBackendOnline ? 'var(--sonar)' : 'var(--amber)',
              fontFamily: 'IBM Plex Mono',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isBackendOnline ? 'var(--sonar)' : 'var(--amber)',
                display: 'inline-block',
              }}
            />
            {isBackendOnline ? 'ONLINE' : 'OFFLINE'}
          </span>

          {/* Sync Status Badge */}
          {isSyncing ? (
            <span
              style={{
                fontSize: '9px',
                color: 'var(--sonar)',
                fontFamily: 'IBM Plex Mono',
                background: 'rgba(23, 217, 163, 0.1)',
                border: '1px solid rgba(23, 217, 163, 0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              ⟳ SYNCING...
            </span>
          ) : pendingCount > 0 ? (
            <span
              style={{
                fontSize: '9px',
                color: 'var(--amber)',
                fontFamily: 'IBM Plex Mono',
                background: 'rgba(255, 176, 32, 0.12)',
                border: '1px solid rgba(255, 176, 32, 0.35)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              title="Voyage logs saved locally in IndexedDB awaiting backend synchronization"
            >
              ⟳ {pendingCount} PENDING SYNC
            </span>
          ) : isBackendOnline ? (
            <span
              style={{
                fontSize: '9px',
                color: 'var(--sonar)',
                fontFamily: 'IBM Plex Mono',
                opacity: 0.8,
              }}
            >
              ✓ ALL SYNCED
            </span>
          ) : null}

          <span style={{ fontSize: '9px', color: 'var(--fog-dim)', fontFamily: 'IBM Plex Mono' }}>
            {logs.length} ENTRIES
          </span>
        </div>
      </div>

      {/* Floating Action Notifications */}
      {notification && (
        <div
          style={{
            background: 'rgba(23, 217, 163, 0.12)',
            border: '1px solid rgba(23, 217, 163, 0.35)',
            color: 'var(--sonar)',
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
            style={{ background: 'none', border: 'none', color: 'var(--sonar)', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Offline Status Warning Banner */}
      {isBackendOnline === false && (
        <div
          style={{
            background: 'rgba(255, 176, 32, 0.08)',
            border: '1px solid rgba(255, 176, 32, 0.25)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '11px',
            color: 'var(--amber)',
            marginBottom: '10px',
            fontFamily: 'IBM Plex Mono, monospace',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠</span>
          <span>
            Backend offline. New logs are saved to <b>IndexedDB</b> and will automatically sync to SQLite when online.
          </span>
        </div>
      )}

      {/* Empty State */}
      {logs.length === 0 && !isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 16px',
            color: 'var(--fog-dim)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '11px',
            border: '1px dashed var(--hairline)',
            borderRadius: '14px',
            margin: '14px 0',
          }}
        >
          NO VOYAGE LOGS RECORDED YET.<br />
          TAP THE <span style={{ color: 'var(--sonar)' }}>+</span> BUTTON TO LOG YOUR FIRST OFFSHORE VOYAGE.
        </div>
      )}

      {/* Voyage Logs List */}
      {logs.map((item) => {
        const isPending = item.syncStatus === 'PENDING_SYNC';
        const isSyncingItem = item.syncStatus === 'SYNCING';

        return (
          <div
            key={item.localId || item.id}
            className="log-item"
            id={`log-item-${item.localId || item.id}`}
            style={{
              borderColor: isPending
                ? 'rgba(255, 176, 32, 0.35)'
                : isSyncingItem
                ? 'rgba(23, 217, 163, 0.4)'
                : undefined,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--sonar)', fontWeight: 600 }}>{item.vesselName || 'VESSEL'}</span>
                <span style={{ color: 'var(--fog-dim)', fontSize: '11px' }}>·</span>
                <span style={{ color: '#fff' }}>{item.departure || 'DEPARTURE'}</span>
                <span style={{ color: 'var(--sonar)' }}>➔</span>
                <span style={{ color: '#fff' }}>{item.destination || 'DESTINATION'}</span>
              </div>
              <div className="s" style={{ marginTop: '4px', wordBreak: 'break-word' }}>
                <span style={{ color: 'var(--fog-dim)' }}>📅 {item.voyageDate}</span>
                {item.notes ? <span> · {item.notes}</span> : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
              {/* Sync Status Chip */}
              {isSyncingItem ? (
                <div
                  className="status-chip due"
                  style={{ background: 'rgba(23, 217, 163, 0.12)', color: 'var(--sonar)', borderColor: 'rgba(23, 217, 163, 0.3)' }}
                >
                  SYNCING...
                </div>
              ) : isPending ? (
                <div
                  className="status-chip due"
                  title="Stored locally in IndexedDB. Will sync when backend is available."
                >
                  PENDING SYNC
                </div>
              ) : (
                <div className="status-chip ok" title="Persisted in SQLite database">
                  SYNCED #{item.id}
                </div>
              )}

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleDeleteLog(item)}
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
                  lineHeight: 1,
                  transition: 'all 0.15s ease',
                }}
                title={isPending ? 'Delete pending local voyage log' : `Delete voyage #${item.id} from SQLite`}
                aria-label="Delete voyage log"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 79, 79, 0.25)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 79, 79, 0.08)';
                  e.currentTarget.style.color = '#ff8a8a';
                }}
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}

      {/* Floating Add Button */}
      <button
        className="fab"
        id="fab-add-log"
        onClick={() => setIsModalOpen(true)}
        aria-label="Add new voyage log entry"
        title="Add new voyage log entry (stored in SQLite or IndexedDB)"
      >
        +
      </button>

      {/* Modal */}
      <NewLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddLog={handleAddLog}
      />
    </div>
  );
}
