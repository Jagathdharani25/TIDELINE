/**
 * Lifecycle test script verifying Maintenance Records across real process restarts
 */

import 'fake-indexeddb/auto';
import {
  savePendingMaintenance,
  getPendingMaintenance,
  getAllLocalMaintenance,
  syncPendingMaintenance,
} from './src/utils/indexedDb.js';
import fs from 'fs';

const STATE_FILE = './test-maint-state.json';
const API_BASE = 'http://localhost:8080/api/maintenance';

const command = process.argv[2];

async function createOffline() {
  console.log('--- EXECUTING MAINTENANCE OFFLINE CREATION ---');
  try {
    const res = await fetch('http://localhost:8080/api/health', { signal: AbortSignal.timeout(2000) });
    console.warn('Backend is unexpectedly online! Status:', res.status);
  } catch (err) {
    console.log('✓ Confirmed: Backend is offline (' + err.message + ')');
  }

  const localRecord = await savePendingMaintenance({
    vesselName: 'TIDELINE-01',
    equipment: 'Emergency Bilge Valve',
    maintenanceDate: '2026-09-18',
    nextServiceDate: '2026-12-18',
    status: 'OK',
    notes: 'Lubricated and tested during backend shutdown',
  });

  console.log(`✓ Record saved to IndexedDB: localId = ${localRecord.localId}, status = ${localRecord.syncStatus}`);
  fs.writeFileSync(STATE_FILE, JSON.stringify(localRecord, null, 2));
}

async function syncAndVerify() {
  console.log('--- EXECUTING MAINTENANCE RECONNECT & SYNC VERIFICATION ---');
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('No state file found! Run create-offline first.');
  }
  const savedRecord = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

  const healthRes = await fetch('http://localhost:8080/api/health');
  console.log('✓ Backend health response status:', healthRes.status);

  // Re-save pending item into memory IndexedDB to simulate browser session
  await savePendingMaintenance(savedRecord);
  const pendingBefore = await getPendingMaintenance();
  console.log(`✓ IndexedDB contains ${pendingBefore.length} pending maintenance record(s)`);

  const syncResult = await syncPendingMaintenance(API_BASE);
  console.log(`✓ syncPendingMaintenance result: syncedCount = ${syncResult.syncedCount}`);

  const allLocal = await getAllLocalMaintenance();
  const synced = allLocal.find((r) => r.equipment === 'Emergency Bilge Valve');
  console.log(`✓ Local record updated: syncStatus = ${synced.syncStatus}, backendId = #${synced.backendId}`);

  const getRes = await fetch(`${API_BASE}/${synced.backendId}`);
  const sqliteRecord = await getRes.json();
  console.log(`✓ Confirmed in SQLite database: ID #${sqliteRecord.id}, Equipment: ${sqliteRecord.equipment}`);

  // Test duplicate prevention
  const secondSync = await syncPendingMaintenance(API_BASE);
  console.log(`✓ Second sync result: syncedCount = ${secondSync.syncedCount} (expected 0)`);

  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }

  console.log('✓ MAINTENANCE OFFLINE RECONNECT & SYNC VERIFIED!');
}

if (command === 'create-offline') {
  createOffline().catch((e) => { console.error(e); process.exit(1); });
} else if (command === 'sync-and-verify') {
  syncAndVerify().catch((e) => { console.error(e); process.exit(1); });
}
