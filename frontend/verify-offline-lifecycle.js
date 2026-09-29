/**
 * Lifecycle step tester for TIDELINE offline-first IndexedDB
 * Usage:
 *   node verify-offline-lifecycle.js create-offline
 *   node verify-offline-lifecycle.js sync-and-verify
 */

import 'fake-indexeddb/auto';
import {
  savePendingVoyage,
  getPendingVoyages,
  getAllLocalVoyages,
  syncPendingVoyages,
} from './src/utils/indexedDb.js';
import fs from 'fs';

const STATE_FILE = './test-state.json';
const API_BASE = 'http://localhost:8080/api/voyages';

const command = process.argv[2];

async function createOffline() {
  console.log('--- EXECUTING OFFLINE CREATION TEST ---');
  
  // 1. Confirm backend is unreachable
  try {
    const res = await fetch('http://localhost:8080/api/health', { signal: AbortSignal.timeout(2000) });
    console.warn('WARNING: Backend appears to still be reachable! Status:', res.status);
  } catch (err) {
    console.log('✓ Confirmed: Backend is unreachable (' + err.message + ')');
  }

  // 2. Try POSTing to backend directly as frontend does in handleAddLog
  let savedLocally = false;
  let localRecord = null;

  try {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voyageDate: '2026-09-18',
        departure: 'Vizhinjam Offshore Station',
        destination: 'Sector 7 Outer Shelf',
        vesselName: 'TIDELINE-OFFLINE-TEST',
        notes: 'Recorded during backend downtime simulation',
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (netErr) {
    console.log('✓ Network fetch failed as expected during downtime:', netErr.message);
    // Frontend falls back to IndexedDB:
    localRecord = await savePendingVoyage({
      voyageDate: '2026-09-18',
      departure: 'Vizhinjam Offshore Station',
      destination: 'Sector 7 Outer Shelf',
      vesselName: 'TIDELINE-OFFLINE-TEST',
      notes: 'Recorded during backend downtime simulation',
    });
    savedLocally = true;
  }

  if (!savedLocally || !localRecord) {
    throw new Error('Failed to save voyage log locally to IndexedDB');
  }

  console.log(`✓ Record saved to IndexedDB! localId: ${localRecord.localId}, syncStatus: ${localRecord.syncStatus}`);
  
  if (localRecord.syncStatus !== 'PENDING_SYNC') {
    throw new Error(`Expected syncStatus 'PENDING_SYNC', got: ${localRecord.syncStatus}`);
  }

  const pendingList = await getPendingVoyages();
  console.log(`✓ Verified pending queue length: ${pendingList.length}`);

  // Persist local record state for next step
  fs.writeFileSync(STATE_FILE, JSON.stringify(localRecord, null, 2));
  console.log('✓ Offline creation test complete and state persisted.');
}

async function syncAndVerify() {
  console.log('--- EXECUTING RECONNECT & SYNC VERIFICATION ---');

  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('No state file found! Run create-offline first.');
  }
  const savedRecord = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

  // 1. Confirm backend is back online
  const healthRes = await fetch('http://localhost:8080/api/health');
  if (!healthRes.ok) {
    throw new Error(`Backend is not online: HTTP ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  console.log('✓ Backend is UP:', JSON.stringify(healthData));

  // 2. Re-populate IndexedDB with the pending record to simulate page re-sync
  await savePendingVoyage(savedRecord);
  const pendingBefore = await getPendingVoyages();
  console.log(`✓ IndexedDB contains ${pendingBefore.length} pending record(s) awaiting sync`);

  // 3. Trigger synchronization
  console.log('Triggering syncPendingVoyages()...');
  const syncResult = await syncPendingVoyages(API_BASE);
  console.log(`✓ syncPendingVoyages returned: syncedCount = ${syncResult.syncedCount}`);

  if (syncResult.syncedCount < 1) {
    throw new Error(`Expected at least 1 record synced, got ${syncResult.syncedCount}`);
  }

  // 4. Verify record in IndexedDB updated to SYNCED
  const allLocal = await getAllLocalVoyages();
  const found = allLocal.find((r) => r.vesselName === 'TIDELINE-OFFLINE-TEST');
  if (!found) {
    throw new Error('Could not find record in local IndexedDB');
  }
  console.log(`✓ Local IndexedDB status updated: syncStatus = ${found.syncStatus}, backendId = #${found.backendId}`);
  if (found.syncStatus !== 'SYNCED') {
    throw new Error(`Expected syncStatus 'SYNCED', got ${found.syncStatus}`);
  }

  // 5. Query SQLite directly to confirm record exists in database
  const getRes = await fetch(`${API_BASE}/${found.backendId}`);
  if (!getRes.ok) {
    throw new Error(`Failed to fetch created record from backend: HTTP ${getRes.status}`);
  }
  const sqliteRecord = await getRes.json();
  console.log(`✓ Confirmed in SQLite database: ID #${sqliteRecord.id}, Vessel: ${sqliteRecord.vesselName}, Departure: ${sqliteRecord.departure}`);

  // 6. Test duplicate prevention: call sync again
  console.log('\nTesting duplicate prevention (second sync run)...');
  const secondSync = await syncPendingVoyages(API_BASE);
  console.log(`✓ Second sync result: syncedCount = ${secondSync.syncedCount} (expected 0)`);
  if (secondSync.syncedCount !== 0) {
    throw new Error(`DUPLICATE DETECTED: Second sync processed ${secondSync.syncedCount} items`);
  }

  // Clean up state file
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }

  console.log('\n✓ OFFLINE-TO-ONLINE SYNC & DUPLICATE PREVENTION VERIFIED SUCCESSFULLY!');
}

if (command === 'create-offline') {
  createOffline().catch((e) => { console.error(e); process.exit(1); });
} else if (command === 'sync-and-verify') {
  syncAndVerify().catch((e) => { console.error(e); process.exit(1); });
} else {
  console.log('Invalid command. Use "create-offline" or "sync-and-verify"');
  process.exit(1);
}
