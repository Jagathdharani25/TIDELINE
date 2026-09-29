/**
 * useSyncManager.js — Centralized synchronization coordinator hook for TIDELINE.
 *
 * Responsibilities:
 *  - Detects backend availability via /api/health and navigator online/offline events.
 *  - Automatically triggers synchronization when backend transitions from OFFLINE -> UP.
 *  - Prevents concurrent synchronization runs.
 *  - Maintains live summary of pending, failed, and synced records.
 *  - Provides manual triggerSync() function for user-initiated sync.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncSummary, syncAllPending } from './indexedDb';

const HEALTH_URL = 'http://localhost:8080/api/health';
const POLL_INTERVAL_MS = 4000;

export default function useSyncManager() {
  const [backendStatus, setBackendStatus] = useState('OFFLINE'); // 'UP' | 'OFFLINE'
  const [syncSummary, setSyncSummary] = useState({
    totalLocal: 0,
    pendingCount: 0,
    failedCount: 0,
    syncedCount: 0,
    lastSyncTimestamp: null,
    isSyncing: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastNotification, setLastNotification] = useState('');

  const prevBackendStatusRef = useRef('OFFLINE');
  const isSyncingRef = useRef(false);

  // Refresh summary from IndexedDB
  const refreshSummary = useCallback(async () => {
    try {
      const summary = await getSyncSummary();
      setSyncSummary(summary);
      return summary;
    } catch (e) {
      console.warn('Error fetching sync summary:', e);
      return null;
    }
  }, []);

  // Main synchronization runner — with health check, logging, and clear UI feedback
  const triggerSync = useCallback(async () => {
    console.log('[SYNC] ▶ Retry/sync triggered by user');

    if (isSyncingRef.current) {
      console.log('[SYNC] ⏸ Skipped — sync already in progress');
      return { skipped: true, reason: 'Sync already in progress' };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);
    setLastNotification(''); // Clear previous notification

    try {
      // STEP 1: Health check before attempting sync
      console.log('[SYNC] 🩺 Checking backend health at', HEALTH_URL);
      let backendIsUp = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const healthRes = await fetch(HEALTH_URL, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (healthRes.ok) {
          const healthData = await healthRes.json();
          backendIsUp = healthData && healthData.status === 'UP';
        }
      } catch {
        backendIsUp = false;
      }

      console.log('[SYNC] 🩺 Backend status:', backendIsUp ? 'UP ✓' : 'OFFLINE ✗');

      if (!backendIsUp) {
        setBackendStatus('OFFLINE');
        setLastNotification('BACKEND OFFLINE — records saved locally, will sync when available.');
        console.log('[SYNC] ✗ Aborting sync — backend offline');
        await refreshSummary();
        return { skipped: true, reason: 'Backend offline' };
      }

      // STEP 2: Backend confirmed UP — trigger sync
      setBackendStatus('UP');
      console.log('[SYNC] 🔄 Starting syncAllPending...');
      const result = await syncAllPending();
      console.log('[SYNC] 📦 syncAllPending result:', JSON.stringify(result, null, 2));

      // STEP 3: Refresh summary to get final counts
      const finalSummary = await refreshSummary();
      const totalSynced =
        (result.voyages?.syncedCount || 0) +
        (result.maintenance?.syncedCount || 0) +
        (result.emergencies?.syncedCount || 0);

      const remainingPending = finalSummary?.pendingCount || 0;
      const remainingFailed = finalSummary?.failedCount || 0;

      console.log('[SYNC] ✅ Synced:', totalSynced, '| Remaining pending:', remainingPending, '| Failed:', remainingFailed);

      // STEP 4: Set notification based on outcome
      if (totalSynced > 0 && remainingPending === 0 && remainingFailed === 0) {
        setLastNotification(`✓ ALL SYNCED — ${totalSynced} record(s) synchronized to SQLite.`);
      } else if (totalSynced > 0) {
        setLastNotification(`✓ Synced ${totalSynced} record(s). ${remainingPending + remainingFailed} still pending.`);
      } else if (remainingPending === 0 && remainingFailed === 0) {
        setLastNotification('✓ ALL SYNCED');
      } else {
        const totalErrors = [
          ...(result.voyages?.errors || []),
          ...(result.maintenance?.errors || []),
          ...(result.emergencies?.errors || []),
        ];
        setLastNotification(`Sync attempted — ${totalErrors.length} error(s). Will retry automatically.`);
      }

      return result;
    } catch (err) {
      console.error('[SYNC] ✗ Synchronization failed:', err);
      setLastNotification(`Sync failed: ${err.message}`);
      await refreshSummary();
      return null;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      console.log('[SYNC] ◼ Sync cycle complete');
    }
  }, [refreshSummary]);

  // Ping backend health
  const checkBackend = useCallback(async () => {
    let currentStatus = 'OFFLINE';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(HEALTH_URL, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'UP') {
          currentStatus = 'UP';
        }
      }
    } catch {
      currentStatus = 'OFFLINE';
    }

    setBackendStatus(currentStatus);

    // AUTO-SYNC TRIGGER:
    // If backend transitioned from OFFLINE -> UP, or if it is UP and there are pending records:
    const justCameOnline = prevBackendStatusRef.current === 'OFFLINE' && currentStatus === 'UP';
    prevBackendStatusRef.current = currentStatus;

    if (currentStatus === 'UP') {
      const summary = await refreshSummary();
      const needsSync = (summary?.pendingCount || 0) > 0 || (summary?.failedCount || 0) > 0;

      if ((justCameOnline || needsSync) && !isSyncingRef.current) {
        triggerSync();
      }
    } else {
      await refreshSummary();
    }
  }, [refreshSummary, triggerSync]);

  useEffect(() => {
    // Initial check
    checkBackend();

    // Poll health endpoint
    const interval = setInterval(checkBackend, POLL_INTERVAL_MS);

    // Browser network events
    const handleOnline = () => checkBackend();
    const handleOffline = () => {
      setBackendStatus('OFFLINE');
      prevBackendStatusRef.current = 'OFFLINE';
      refreshSummary();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkBackend, refreshSummary]);

  return {
    backendStatus,
    syncSummary,
    isSyncing,
    lastNotification,
    triggerSync,
    refreshSummary,
  };
}
