/**
 * IndexedDB storage utility for offline-first Voyage Logs, Maintenance Records,
 * and Emergency Distress Events in TIDELINE.
 *
 * DB Name: tideline_offline_db
 * Stores:
 *   - pending_voyages (keyPath: localId)
 *   - pending_maintenance (keyPath: localId)
 *   - pending_emergencies (keyPath: localId)
 */

const DB_NAME = 'tideline_offline_db';
const DB_VERSION = 4;
const STORE_VOYAGES = 'pending_voyages';
const STORE_MAINTENANCE = 'pending_maintenance';
const STORE_EMERGENCIES = 'pending_emergencies';
const STORE_TRACKS = 'vessel_tracks';

let dbInstance = null;
let isVoyageSyncInProgress = false;
let isMaintenanceSyncInProgress = false;
let isEmergencySyncInProgress = false;

/**
 * Initializes and returns the IndexedDB database instance.
 */
export function openOfflineDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const idb = (typeof window !== 'undefined' && window.indexedDB) || (typeof globalThis !== 'undefined' && globalThis.indexedDB);
    if (!idb) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // 1. Voyage logs store
      if (!db.objectStoreNames.contains(STORE_VOYAGES)) {
        const voyageStore = db.createObjectStore(STORE_VOYAGES, { keyPath: 'localId' });
        voyageStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        voyageStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 2. Maintenance records store
      if (!db.objectStoreNames.contains(STORE_MAINTENANCE)) {
        const maintStore = db.createObjectStore(STORE_MAINTENANCE, { keyPath: 'localId' });
        maintStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        maintStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 3. Emergency distress events store
      if (!db.objectStoreNames.contains(STORE_EMERGENCIES)) {
        const emgStore = db.createObjectStore(STORE_EMERGENCIES, { keyPath: 'localId' });
        emgStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        emgStore.createIndex('status', 'status', { unique: false });
        emgStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      // 4. Vessel breadcrumb track points store
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const trackStore = db.createObjectStore(STORE_TRACKS, { keyPath: 'id', autoIncrement: true });
        trackStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/* ==========================================================================
   VOYAGE LOGS OFFLINE UTILITIES
   ========================================================================== */

export async function savePendingVoyage(voyageData) {
  const db = await openOfflineDB();
  const localId = `local_voyage_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const record = {
    localId,
    voyageDate: voyageData.voyageDate,
    departure: voyageData.departure,
    destination: voyageData.destination,
    vesselName: voyageData.vesselName || 'TIDELINE-01',
    notes: voyageData.notes || '',
    syncStatus: 'PENDING_SYNC', // PENDING_SYNC | SYNCING | SYNCED | SYNC_FAILED
    backendId: null,
    retryCount: 0,
    lastSyncedAt: null,
    lastAttemptAt: null,
    syncError: null,
    createdAt: voyageData.createdAt || new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VOYAGES], 'readwrite');
    const store = tx.objectStore(STORE_VOYAGES);
    const req = store.add(record);

    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getPendingVoyages() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VOYAGES], 'readonly');
    const store = tx.objectStore(STORE_VOYAGES);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const pending = all.filter((item) => item.syncStatus === 'PENDING_SYNC' || item.syncStatus === 'SYNC_FAILED');
      resolve(pending);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllLocalVoyages() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VOYAGES], 'readonly');
    const store = tx.objectStore(STORE_VOYAGES);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function updateVoyageSyncStatus(localId, syncStatus, backendId = null, extra = {}) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VOYAGES], 'readwrite');
    const store = tx.objectStore(STORE_VOYAGES);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        resolve(null);
        return;
      }
      record.syncStatus = syncStatus;
      if (backendId != null) {
        record.backendId = backendId;
      }
      if (extra.lastSyncedAt !== undefined) {
        record.lastSyncedAt = extra.lastSyncedAt;
      }
      if (extra.lastAttemptAt !== undefined) {
        record.lastAttemptAt = extra.lastAttemptAt;
      }
      if (extra.syncError !== undefined) {
        record.syncError = extra.syncError;
      }
      if (extra.retryCount !== undefined) {
        record.retryCount = extra.retryCount;
      }
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject(e.target.error);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteLocalVoyage(localId) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_VOYAGES], 'readwrite');
    const store = tx.objectStore(STORE_VOYAGES);
    const req = store.delete(localId);

    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function syncPendingVoyages(apiEndpoint = 'http://localhost:8080/api/voyages') {
  if (isVoyageSyncInProgress) {
    console.log('[SYNC:VOYAGES] ⏸ Skipped — voyage sync already in progress');
    return { skipped: true, reason: 'Sync already in progress' };
  }

  isVoyageSyncInProgress = true;
  let syncedCount = 0;
  const errors = [];

  try {
    const pendingList = await getPendingVoyages();
    console.log(`[SYNC:VOYAGES] 📋 Found ${pendingList.length} pending voyage(s) to sync`);

    if (pendingList.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    for (const item of pendingList) {
      // Duplicate prevention: skip if already synced or assigned backendId
      if (item.syncStatus === 'SYNCED' || item.backendId != null) {
        console.log(`[SYNC:VOYAGES] ⏭ Skipping ${item.localId} — already synced (backendId: ${item.backendId})`);
        continue;
      }

      console.log(`[SYNC:VOYAGES] 🔄 Syncing ${item.localId}...`);
      await updateVoyageSyncStatus(item.localId, 'SYNCING');

      try {
        const payload = {
          voyageDate: item.voyageDate,
          departure: item.departure,
          destination: item.destination,
          vesselName: item.vesselName,
          notes: item.notes,
          createdAt: item.createdAt,
        };

        console.log(`[SYNC:VOYAGES] 📤 POST ${apiEndpoint}`, payload);
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log(`[SYNC:VOYAGES] 📥 Response: ${res.status} ${res.statusText}`);

        if (res.ok) {
          const backendLog = await res.json();
          // Never mark synced without backend confirmation (must have valid id)
          if (backendLog && backendLog.id != null) {
            await updateVoyageSyncStatus(item.localId, 'SYNCED', backendLog.id, {
              lastSyncedAt: new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              syncError: null,
            });
            syncedCount++;
            console.log(`[SYNC:VOYAGES] ✅ ${item.localId} → SYNCED (backendId: ${backendLog.id})`);
          } else {
            await updateVoyageSyncStatus(item.localId, 'SYNC_FAILED', null, {
              lastAttemptAt: new Date().toISOString(),
              syncError: 'Backend confirmed response without valid record ID',
              retryCount: (item.retryCount || 0) + 1,
            });
            errors.push({ localId: item.localId, error: 'Missing backend ID in response' });
            console.warn(`[SYNC:VOYAGES] ⚠ ${item.localId} — response missing backend ID`);
          }
        } else {
          await updateVoyageSyncStatus(item.localId, 'SYNC_FAILED', null, {
            lastAttemptAt: new Date().toISOString(),
            syncError: `HTTP error ${res.status}`,
            retryCount: (item.retryCount || 0) + 1,
          });
          errors.push({ localId: item.localId, status: res.status });
          console.warn(`[SYNC:VOYAGES] ✗ ${item.localId} — HTTP ${res.status}`);
          // Continue trying remaining records instead of aborting
        }
      } catch (err) {
        await updateVoyageSyncStatus(item.localId, 'SYNC_FAILED', null, {
          lastAttemptAt: new Date().toISOString(),
          syncError: err.message,
          retryCount: (item.retryCount || 0) + 1,
        });
        errors.push({ localId: item.localId, error: err.message });
        console.error(`[SYNC:VOYAGES] ✗ ${item.localId} — network error:`, err.message);
        // Continue trying remaining records instead of aborting
      }
    }

    console.log(`[SYNC:VOYAGES] 📊 Complete: ${syncedCount} synced, ${errors.length} error(s)`);
    return { syncedCount, errors };
  } finally {
    isVoyageSyncInProgress = false;
  }
}

/* ==========================================================================
   MAINTENANCE RECORDS OFFLINE UTILITIES
   ========================================================================== */

export async function savePendingMaintenance(recordData) {
  const db = await openOfflineDB();
  const localId = `local_maint_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const record = {
    localId,
    vesselName: recordData.vesselName || 'TIDELINE-01',
    equipment: recordData.equipment || 'General Equipment',
    maintenanceDate: recordData.maintenanceDate || new Date().toISOString().slice(0, 10),
    nextServiceDate: recordData.nextServiceDate || '',
    status: recordData.status || 'OK',
    notes: recordData.notes || '',
    syncStatus: 'PENDING_SYNC', // PENDING_SYNC | SYNCING | SYNCED | SYNC_FAILED
    backendId: null,
    retryCount: 0,
    lastSyncedAt: null,
    lastAttemptAt: null,
    syncError: null,
    createdAt: recordData.createdAt || new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAINTENANCE], 'readwrite');
    const store = tx.objectStore(STORE_MAINTENANCE);
    const req = store.add(record);

    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getPendingMaintenance() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAINTENANCE], 'readonly');
    const store = tx.objectStore(STORE_MAINTENANCE);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const pending = all.filter((item) => item.syncStatus === 'PENDING_SYNC' || item.syncStatus === 'SYNC_FAILED');
      resolve(pending);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllLocalMaintenance() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAINTENANCE], 'readonly');
    const store = tx.objectStore(STORE_MAINTENANCE);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function updateMaintenanceSyncStatus(localId, syncStatus, backendId = null, extra = {}) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAINTENANCE], 'readwrite');
    const store = tx.objectStore(STORE_MAINTENANCE);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        resolve(null);
        return;
      }
      record.syncStatus = syncStatus;
      if (backendId != null) {
        record.backendId = backendId;
      }
      if (extra.lastSyncedAt !== undefined) {
        record.lastSyncedAt = extra.lastSyncedAt;
      }
      if (extra.lastAttemptAt !== undefined) {
        record.lastAttemptAt = extra.lastAttemptAt;
      }
      if (extra.syncError !== undefined) {
        record.syncError = extra.syncError;
      }
      if (extra.retryCount !== undefined) {
        record.retryCount = extra.retryCount;
      }
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject(e.target.error);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteLocalMaintenance(localId) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_MAINTENANCE], 'readwrite');
    const store = tx.objectStore(STORE_MAINTENANCE);
    const req = store.delete(localId);

    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function syncPendingMaintenance(apiEndpoint = 'http://localhost:8080/api/maintenance') {
  if (isMaintenanceSyncInProgress) {
    console.log('[SYNC:MAINT] ⏸ Skipped — maintenance sync already in progress');
    return { skipped: true, reason: 'Sync already in progress' };
  }

  isMaintenanceSyncInProgress = true;
  let syncedCount = 0;
  const errors = [];

  try {
    const pendingList = await getPendingMaintenance();
    console.log(`[SYNC:MAINT] 📋 Found ${pendingList.length} pending maintenance record(s) to sync`);

    if (pendingList.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    for (const item of pendingList) {
      // Duplicate prevention: skip if already synced or assigned backendId
      if (item.syncStatus === 'SYNCED' || item.backendId != null) {
        console.log(`[SYNC:MAINT] ⏭ Skipping ${item.localId} — already synced`);
        continue;
      }

      console.log(`[SYNC:MAINT] 🔄 Syncing ${item.localId}...`);
      await updateMaintenanceSyncStatus(item.localId, 'SYNCING');

      try {
        const payload = {
          vesselName: item.vesselName,
          equipment: item.equipment,
          maintenanceDate: item.maintenanceDate,
          nextServiceDate: item.nextServiceDate,
          status: item.status,
          notes: item.notes,
          createdAt: item.createdAt,
        };

        console.log(`[SYNC:MAINT] 📤 POST ${apiEndpoint}`, payload);
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log(`[SYNC:MAINT] 📥 Response: ${res.status} ${res.statusText}`);

        if (res.ok) {
          const backendRecord = await res.json();
          if (backendRecord && backendRecord.id != null) {
            await updateMaintenanceSyncStatus(item.localId, 'SYNCED', backendRecord.id, {
              lastSyncedAt: new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              syncError: null,
            });
            syncedCount++;
            console.log(`[SYNC:MAINT] ✅ ${item.localId} → SYNCED (backendId: ${backendRecord.id})`);
          } else {
            await updateMaintenanceSyncStatus(item.localId, 'SYNC_FAILED', null, {
              lastAttemptAt: new Date().toISOString(),
              syncError: 'Backend confirmed response without valid record ID',
              retryCount: (item.retryCount || 0) + 1,
            });
            errors.push({ localId: item.localId, error: 'Missing backend ID in response' });
            console.warn(`[SYNC:MAINT] ⚠ ${item.localId} — response missing backend ID`);
          }
        } else {
          await updateMaintenanceSyncStatus(item.localId, 'SYNC_FAILED', null, {
            lastAttemptAt: new Date().toISOString(),
            syncError: `HTTP error ${res.status}`,
            retryCount: (item.retryCount || 0) + 1,
          });
          errors.push({ localId: item.localId, status: res.status });
          console.warn(`[SYNC:MAINT] ✗ ${item.localId} — HTTP ${res.status}`);
        }
      } catch (err) {
        await updateMaintenanceSyncStatus(item.localId, 'SYNC_FAILED', null, {
          lastAttemptAt: new Date().toISOString(),
          syncError: err.message,
          retryCount: (item.retryCount || 0) + 1,
        });
        errors.push({ localId: item.localId, error: err.message });
        console.error(`[SYNC:MAINT] ✗ ${item.localId} — network error:`, err.message);
      }
    }

    console.log(`[SYNC:MAINT] 📊 Complete: ${syncedCount} synced, ${errors.length} error(s)`);
    return { syncedCount, errors };
  } finally {
    isMaintenanceSyncInProgress = false;
  }
}

/* ==========================================================================
   EMERGENCY DISTRESS EVENTS OFFLINE UTILITIES
   ========================================================================== */

/**
 * Saves a new emergency distress event to IndexedDB.
 * Status is set to 'LOCAL_ONLY' when recorded offline.
 * SyncStatus tracks SQLite backend upload ('PENDING_SYNC' -> 'SYNCED').
 */
export async function savePendingEmergency(eventData) {
  const db = await openOfflineDB();
  const localId = `local_emg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const record = {
    localId,
    emergencyType: eventData.emergencyType || 'DISTRESS_SOS',
    latitude: typeof eventData.latitude === 'number' ? eventData.latitude : 8.0758,
    longitude: typeof eventData.longitude === 'number' ? eventData.longitude : 77.0142,
    eventTime: eventData.eventTime || new Date().toISOString(),
    message: eventData.message || 'Distress signal activated',
    status: eventData.status || 'LOCAL_ONLY', // LOCAL_ONLY | PENDING_TRANSMISSION | TRANSMITTED
    syncStatus: 'PENDING_SYNC', // PENDING_SYNC | SYNCING | SYNCED | SYNC_FAILED
    backendId: null,
    retryCount: 0,
    lastSyncedAt: null,
    lastAttemptAt: null,
    syncError: null,
    createdAt: eventData.createdAt || new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_EMERGENCIES], 'readwrite');
    const store = tx.objectStore(STORE_EMERGENCIES);
    const req = store.add(record);

    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retrieves all pending emergency records awaiting sync to SQLite.
 */
export async function getPendingEmergencies() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_EMERGENCIES], 'readonly');
    const store = tx.objectStore(STORE_EMERGENCIES);
    const req = store.getAll();

    req.onsuccess = () => {
      const all = req.result || [];
      const pending = all.filter((item) => item.syncStatus === 'PENDING_SYNC' || item.syncStatus === 'SYNC_FAILED');
      resolve(pending);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retrieves all locally stored emergency records.
 */
export async function getAllLocalEmergencies() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_EMERGENCIES], 'readonly');
    const store = tx.objectStore(STORE_EMERGENCIES);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Updates an emergency record's sync status and optionally assigns the backendId.
 */
export async function updateEmergencySyncStatus(localId, syncStatus, backendId = null, extra = {}) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_EMERGENCIES], 'readwrite');
    const store = tx.objectStore(STORE_EMERGENCIES);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        resolve(null);
        return;
      }
      record.syncStatus = syncStatus;
      if (backendId != null) {
        record.backendId = backendId;
        // When synchronized to backend, mark transmission status as PENDING_TRANSMISSION
        if (record.status === 'LOCAL_ONLY') {
          record.status = 'PENDING_TRANSMISSION';
        }
      }
      if (extra.lastSyncedAt !== undefined) {
        record.lastSyncedAt = extra.lastSyncedAt;
      }
      if (extra.lastAttemptAt !== undefined) {
        record.lastAttemptAt = extra.lastAttemptAt;
      }
      if (extra.syncError !== undefined) {
        record.syncError = extra.syncError;
      }
      if (extra.retryCount !== undefined) {
        record.retryCount = extra.retryCount;
      }
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (e) => reject(e.target.error);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Deletes an emergency record from IndexedDB by localId.
 */
export async function deleteLocalEmergency(localId) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_EMERGENCIES], 'readwrite');
    const store = tx.objectStore(STORE_EMERGENCIES);
    const req = store.delete(localId);

    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Synchronizes pending emergency records to SQLite backend.
 * Never marks as TRANSMITTED unless actual communications service confirms.
 */
export async function syncPendingEmergencies(apiEndpoint = 'http://localhost:8080/api/emergencies') {
  if (isEmergencySyncInProgress) {
    console.log('[SYNC:EMERG] ⏸ Skipped — emergency sync already in progress');
    return { skipped: true, reason: 'Sync already in progress' };
  }

  isEmergencySyncInProgress = true;
  let syncedCount = 0;
  const errors = [];

  try {
    const pendingList = await getPendingEmergencies();
    console.log(`[SYNC:EMERG] 📋 Found ${pendingList.length} pending emergency record(s) to sync`);

    if (pendingList.length === 0) {
      return { syncedCount: 0, errors: [] };
    }

    for (const item of pendingList) {
      // Duplicate prevention: skip if already synced or assigned backendId
      if (item.syncStatus === 'SYNCED' || item.backendId != null) {
        console.log(`[SYNC:EMERG] ⏭ Skipping ${item.localId} — already synced`);
        continue;
      }

      console.log(`[SYNC:EMERG] 🔄 Syncing ${item.localId}...`);
      await updateEmergencySyncStatus(item.localId, 'SYNCING');

      try {
        const payload = {
          emergencyType: item.emergencyType,
          latitude: item.latitude,
          longitude: item.longitude,
          eventTime: item.eventTime,
          message: item.message,
          status: 'PENDING_TRANSMISSION', // Enforce realistic status (never false TRANSMITTED)
          createdAt: item.createdAt,
        };

        console.log(`[SYNC:EMERG] 📤 POST ${apiEndpoint}`, payload);
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log(`[SYNC:EMERG] 📥 Response: ${res.status} ${res.statusText}`);

        if (res.ok) {
          const backendEvent = await res.json();
          if (backendEvent && backendEvent.id != null) {
            await updateEmergencySyncStatus(item.localId, 'SYNCED', backendEvent.id, {
              lastSyncedAt: new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              syncError: null,
            });
            syncedCount++;
            console.log(`[SYNC:EMERG] ✅ ${item.localId} → SYNCED (backendId: ${backendEvent.id})`);
          } else {
            await updateEmergencySyncStatus(item.localId, 'SYNC_FAILED', null, {
              lastAttemptAt: new Date().toISOString(),
              syncError: 'Backend confirmed response without valid record ID',
              retryCount: (item.retryCount || 0) + 1,
            });
            errors.push({ localId: item.localId, error: 'Missing backend ID in response' });
            console.warn(`[SYNC:EMERG] ⚠ ${item.localId} — response missing backend ID`);
          }
        } else {
          await updateEmergencySyncStatus(item.localId, 'SYNC_FAILED', null, {
            lastAttemptAt: new Date().toISOString(),
            syncError: `HTTP error ${res.status}`,
            retryCount: (item.retryCount || 0) + 1,
          });
          errors.push({ localId: item.localId, status: res.status });
          console.warn(`[SYNC:EMERG] ✗ ${item.localId} — HTTP ${res.status}`);
        }
      } catch (err) {
        await updateEmergencySyncStatus(item.localId, 'SYNC_FAILED', null, {
          lastAttemptAt: new Date().toISOString(),
          syncError: err.message,
          retryCount: (item.retryCount || 0) + 1,
        });
        errors.push({ localId: item.localId, error: err.message });
        console.error(`[SYNC:EMERG] ✗ ${item.localId} — network error:`, err.message);
      }
    }

    console.log(`[SYNC:EMERG] 📊 Complete: ${syncedCount} synced, ${errors.length} error(s)`);
    return { syncedCount, errors };
  } finally {
    isEmergencySyncInProgress = false;
  }
}

/* ==========================================================================
   GLOBAL SYNC COORDINATION & SUMMARY
   ========================================================================== */

let isGlobalSyncInProgress = false;

export async function getSyncSummary() {
  try {
    const [voyages, maintenance, emergencies] = await Promise.all([
      getAllLocalVoyages(),
      getAllLocalMaintenance(),
      getAllLocalEmergencies(),
    ]);

    const allRecords = [...voyages, ...maintenance, ...emergencies];

    const pendingCount = allRecords.filter(
      (r) => r.syncStatus === 'PENDING_SYNC' || r.syncStatus === 'SYNCING'
    ).length;

    const failedCount = allRecords.filter(
      (r) => r.syncStatus === 'SYNC_FAILED'
    ).length;

    const syncedCount = allRecords.filter(
      (r) => r.syncStatus === 'SYNCED'
    ).length;

    let lastSyncTimestamp = null;
    for (const r of allRecords) {
      if (r.lastSyncedAt) {
        if (!lastSyncTimestamp || r.lastSyncedAt > lastSyncTimestamp) {
          lastSyncTimestamp = r.lastSyncedAt;
        }
      }
    }

    return {
      totalLocal: allRecords.length,
      pendingCount,
      failedCount,
      syncedCount,
      lastSyncTimestamp,
      isSyncing: isGlobalSyncInProgress || isVoyageSyncInProgress || isMaintenanceSyncInProgress || isEmergencySyncInProgress,
    };
  } catch (err) {
    console.warn('Error reading sync summary:', err);
    return {
      totalLocal: 0,
      pendingCount: 0,
      failedCount: 0,
      syncedCount: 0,
      lastSyncTimestamp: null,
      isSyncing: false,
    };
  }
}

export async function syncAllPending(baseUrl = 'http://localhost:8080') {
  if (isGlobalSyncInProgress) {
    console.log('[SYNC:ALL] ⏸ Skipped — global sync already in progress');
    return { skipped: true, reason: 'Global sync already in progress' };
  }
  console.log('[SYNC:ALL] ▶ Starting global sync to', baseUrl);

  isGlobalSyncInProgress = true;
  try {
    const voyages = await syncPendingVoyages(`${baseUrl}/api/voyages`);
    const maintenance = await syncPendingMaintenance(`${baseUrl}/api/maintenance`);
    const emergencies = await syncPendingEmergencies(`${baseUrl}/api/emergencies`);

    const summary = await getSyncSummary();

    return {
      voyages,
      maintenance,
      emergencies,
      summary,
    };
  } finally {
    isGlobalSyncInProgress = false;
  }
}

/* ==========================================================================
   VESSEL TRACK RECORDING & BREADCRUMB HISTORY
   ========================================================================== */

export async function saveTrackPoint(point) {
  if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
    return;
  }

  try {
    const db = await openOfflineDB();
    const record = {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy || null,
      speed: point.speed || null,
      heading: point.heading || null,
      timestamp: point.timestamp || Date.now(),
    };

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_TRACKS], 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.add(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('Could not save track point to IndexedDB:', err);
    return false;
  }
}

export async function getRecentTrackPoints(limit = 120) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_TRACKS], 'readonly');
      const store = tx.objectStore(STORE_TRACKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        // Sort chronologically and take most recent points
        list.sort((a, b) => a.timestamp - b.timestamp);
        resolve(list.slice(-limit));
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Could not load track points from IndexedDB:', err);
    return [];
  }
}

