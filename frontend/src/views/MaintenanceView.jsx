import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewMaintenanceModal from '../components/NewMaintenanceModal';
import {
  savePendingMaintenance,
  getPendingMaintenance,
  getAllLocalMaintenance,
  syncPendingMaintenance,
  deleteLocalMaintenance,
} from '../utils/indexedDb';

const API_BASE = 'http://localhost:8080/api/maintenance';

// Initial sample checklist if both backend and IndexedDB are empty
const INITIAL_SAMPLE_RECORDS = [
  {
    id: 1,
    vesselName: 'TIDELINE-01',
    equipment: 'Main Engine Oil Change',
    maintenanceDate: '2026-09-10',
    nextServiceDate: '2026-10-10',
    status: 'DUE SOON',
    notes: 'Every 250 hrs · 15W-40 multi-grade',
    syncStatus: 'SYNCED',
  },
  {
    id: 2,
    vesselName: 'TIDELINE-01',
    equipment: 'Hull Inspection',
    maintenanceDate: '2026-08-15',
    nextServiceDate: '2026-11-15',
    status: 'OK',
    notes: 'Quarterly · zinc anodes & rudder inspected',
    syncStatus: 'SYNCED',
  },
  {
    id: 3,
    vesselName: 'TIDELINE-01',
    equipment: 'Bilge Pump Test',
    maintenanceDate: '2026-07-28',
    nextServiceDate: '2026-08-28',
    status: 'OVERDUE',
    notes: 'Monthly · float switch verification required',
    syncStatus: 'SYNCED',
  },
  {
    id: 4,
    vesselName: 'TIDELINE-01',
    equipment: 'Fire Extinguisher Check',
    maintenanceDate: '2026-07-01',
    nextServiceDate: '2027-01-01',
    status: 'OK',
    notes: 'Semi-annual · pressure pins checked',
    syncStatus: 'SYNCED',
  },
  {
    id: 5,
    vesselName: 'TIDELINE-01',
    equipment: 'Life Jacket Inventory',
    maintenanceDate: '2026-09-06',
    nextServiceDate: '2026-10-06',
    status: 'OK',
    notes: 'Monthly · 6 solas compliant vests certified',
    syncStatus: 'SYNCED',
  },
];

export default function MaintenanceView() {
  const [records, setRecords] = useState([]);
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
   * Loads maintenance records from SQLite backend and local IndexedDB,
   * triggering auto-synchronization if backend is available.
   */
  const loadAndSyncMaintenance = useCallback(async () => {
    let backendRecords = [];
    let backendOk = false;

    // 1. Try to fetch from Spring Boot SQLite backend
    try {
      const res = await fetch(API_BASE, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          backendRecords = data.map((item) => ({ ...item, syncStatus: 'SYNCED' }));
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
      localPending = await getPendingMaintenance();
      allLocal = await getAllLocalMaintenance();
      setPendingCount(localPending.length);
    } catch (e) {
      console.error('Error reading maintenance from IndexedDB:', e);
    }

    // 3. If backend is online and there are pending items, trigger synchronization!
    if (backendOk && localPending.length > 0 && !isSyncingRef.current) {
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        const syncResult = await syncPendingMaintenance(API_BASE);
        if (syncResult && syncResult.syncedCount > 0) {
          showFeedback(`✓ Synchronized ${syncResult.syncedCount} pending maintenance record(s) to SQLite.`);

          // Re-fetch backend records after successful sync
          try {
            const reRes = await fetch(API_BASE, { headers: { Accept: 'application/json' } });
            if (reRes.ok) {
              const reData = await reRes.json();
              if (Array.isArray(reData)) {
                backendRecords = reData.map((item) => ({ ...item, syncStatus: 'SYNCED' }));
              }
            }
          } catch {
            // Ignore secondary fetch error
          }

          // Refresh pending count
          const updatedPending = await getPendingMaintenance();
          setPendingCount(updatedPending.length);
          localPending = updatedPending;
        }
      } catch (err) {
        console.error('Maintenance sync failed:', err);
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
      }
    }

    // 4. Merge records without duplicates
    const backendIdSet = new Set(backendRecords.map((b) => b.id));

    const unmergedLocal = allLocal
      .filter((loc) => {
        if (loc.syncStatus === 'PENDING_SYNC' || loc.syncStatus === 'SYNCING') {
          return true;
        }
        if (loc.backendId && backendIdSet.has(loc.backendId)) {
          return false; // Already in backend list
        }
        return false;
      })
      .map((loc) => ({
        id: loc.localId,
        localId: loc.localId,
        vesselName: loc.vesselName,
        equipment: loc.equipment,
        maintenanceDate: loc.maintenanceDate,
        nextServiceDate: loc.nextServiceDate,
        status: loc.status,
        notes: loc.notes,
        syncStatus: loc.syncStatus,
        createdAt: loc.createdAt,
      }));

    if (backendOk) {
      const combined = [...unmergedLocal, ...backendRecords];
      setRecords(combined);
    } else {
      if (allLocal.length > 0) {
        const localFormatted = allLocal.map((loc) => ({
          id: loc.backendId || loc.localId,
          localId: loc.localId,
          vesselName: loc.vesselName,
          equipment: loc.equipment,
          maintenanceDate: loc.maintenanceDate,
          nextServiceDate: loc.nextServiceDate,
          status: loc.status,
          notes: loc.notes,
          syncStatus: loc.syncStatus || 'PENDING_SYNC',
          createdAt: loc.createdAt,
        }));
        setRecords(localFormatted);
      } else {
        setRecords(INITIAL_SAMPLE_RECORDS);
      }
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadAndSyncMaintenance();
    const interval = setInterval(loadAndSyncMaintenance, 4000);
    return () => clearInterval(interval);
  }, [loadAndSyncMaintenance]);

  /**
   * Handles creating a new maintenance record.
   * If backend is online, saves to SQLite. If offline or error, saves to IndexedDB as PENDING_SYNC.
   */
  const handleAddRecord = async (newEntry) => {
    let savedToBackend = false;

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
          const backendRecord = await res.json();
          savedToBackend = true;
          showFeedback(`✓ Maintenance record #${backendRecord.id} saved to SQLite.`);
          await loadAndSyncMaintenance();
          return;
        }
      } catch {
        savedToBackend = false;
      }
    }

    // Backend is unavailable: save to IndexedDB with PENDING_SYNC
    try {
      const localRecord = await savePendingMaintenance(newEntry);
      setIsBackendOnline(false);
      setPendingCount((prev) => prev + 1);
      showFeedback('Saved locally to IndexedDB (PENDING SYNC).');
      await loadAndSyncMaintenance();
    } catch (err) {
      console.error('Failed to save maintenance to IndexedDB:', err);
      showFeedback('Error saving maintenance record locally.');
    }
  };

  /**
   * Handles deleting a maintenance record from SQLite or IndexedDB.
   */
  const handleDeleteRecord = async (item) => {
    const isLocalOnly = typeof item.id === 'string' && item.id.startsWith('local_');
    const confirmPrompt = isLocalOnly
      ? 'Delete pending local maintenance record from IndexedDB?'
      : `Delete maintenance record #${item.id} from SQLite storage?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    if (isLocalOnly || item.localId) {
      try {
        await deleteLocalMaintenance(item.localId || item.id);
        setPendingCount((prev) => Math.max(0, prev - 1));
        setRecords((prev) => prev.filter((r) => r.id !== item.id && r.localId !== item.localId));
        showFeedback('Local maintenance record removed.');
      } catch (err) {
        console.error('Failed to delete from IndexedDB:', err);
      }
    }

    if (!isLocalOnly && typeof item.id === 'number') {
      try {
        const res = await fetch(`${API_BASE}/${item.id}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) {
          setRecords((prev) => prev.filter((r) => r.id !== item.id));
          showFeedback(`✓ Maintenance record #${item.id} deleted from SQLite.`);
        }
      } catch {
        setRecords((prev) => prev.filter((r) => r.id !== item.id));
        showFeedback(`Removed from local view (Backend offline).`);
      }
    }
  };

  // Helper to map status to CSS chip class
  const getStatusChipClass = (statusStr) => {
    const s = (statusStr || '').toUpperCase();
    if (s.includes('OVERDUE')) return 'overdue';
    if (s.includes('DUE')) return 'due';
    return 'ok';
  };

  return (
    <div id="view-maintenance" style={{ position: 'relative', minHeight: '100%', paddingBottom: '70px' }}>
      {/* Top Header / Status Section */}
      <div className="section-eyebrow">
        <span>Maintenance Schedule · SQLite Stored</span>
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
              title="Maintenance records saved locally in IndexedDB awaiting backend synchronization"
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
            {records.length} ITEMS
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
            Backend offline. New maintenance records are saved to <b>IndexedDB</b> and will automatically sync to SQLite when online.
          </span>
        </div>
      )}

      {/* Empty State */}
      {records.length === 0 && !isLoading && (
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
          NO MAINTENANCE RECORDS LOGGED YET.<br />
          TAP THE <span style={{ color: 'var(--sonar)' }}>+</span> BUTTON TO LOG EQUIPMENT SERVICE.
        </div>
      )}

      {/* Maintenance Records List */}
      {records.map((item) => {
        const isPending = item.syncStatus === 'PENDING_SYNC';
        const isSyncingItem = item.syncStatus === 'SYNCING';
        const chipClass = getStatusChipClass(item.status);

        return (
          <div
            key={item.localId || item.id}
            className="log-item"
            id={`maintenance-item-${item.localId || item.id}`}
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
                <span style={{ color: '#fff', fontWeight: 600 }}>{item.equipment}</span>
                <span style={{ color: 'var(--fog-dim)', fontSize: '11px' }}>·</span>
                <span style={{ color: 'var(--sonar)', fontSize: '11px' }}>{item.vesselName || 'TIDELINE-01'}</span>
              </div>
              <div className="s" style={{ marginTop: '4px', wordBreak: 'break-word' }}>
                <span style={{ color: 'var(--fog-dim)' }}>
                  📅 Serviced: {item.maintenanceDate}
                  {item.nextServiceDate ? ` · Next: ${item.nextServiceDate}` : ''}
                </span>
                {item.notes ? <span> · {item.notes}</span> : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
              {/* Equipment Status Chip (OK / DUE SOON / OVERDUE) */}
              <div className={`status-chip ${chipClass}`}>
                {item.status || 'OK'}
              </div>

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
                onClick={() => handleDeleteRecord(item)}
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
                title={isPending ? 'Delete pending local record' : `Delete maintenance record #${item.id} from SQLite`}
                aria-label="Delete maintenance record"
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
        id="fab-add-maintenance"
        onClick={() => setIsModalOpen(true)}
        aria-label="Add new maintenance record"
        title="Add new maintenance record (stored in SQLite or IndexedDB)"
      >
        +
      </button>

      {/* Modal */}
      <NewMaintenanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddRecord={handleAddRecord}
      />
    </div>
  );
}
