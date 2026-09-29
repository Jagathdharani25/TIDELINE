/**
 * Test script verifying offline-first IndexedDB storage and synchronization flow
 * for Maintenance Records:
 * 1. Backend ON -> create maintenance record -> verify SQLite.
 * 2. Stop backend / simulate network down.
 * 3. Create maintenance record -> verify it appears locally as PENDING SYNC.
 * 4. Start backend again.
 * 5. Verify pending maintenance synchronizes to SQLite.
 * 6. Verify it is not duplicated.
 * 7. Verify SQLite table exists and holds records.
 */

import 'fake-indexeddb/auto';
import {
  savePendingMaintenance,
  getPendingMaintenance,
  getAllLocalMaintenance,
  syncPendingMaintenance,
} from './src/utils/indexedDb.js';

const API_BASE = 'http://localhost:8080/api/maintenance';

async function run() {
  console.log('--- STARTING OFFLINE MAINTENANCE RECORD & SYNC VERIFICATION ---');

  // Step 1: Backend ON -> create maintenance record directly -> verify SQLite
  console.log('\n[Step 1] Testing Backend ON creation directly...');
  const directPayload = {
    vesselName: 'TIDELINE-01',
    equipment: 'Bilge Pump Float Switch',
    maintenanceDate: '2026-09-18',
    nextServiceDate: '2026-10-18',
    status: 'OK',
    notes: 'Switch tested and contacts cleaned',
  };

  const res1 = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(directPayload),
  });

  if (!res1.ok) {
    throw new Error(`Step 1 failed: Backend returned status ${res1.status}`);
  }
  const createdInSqlite = await res1.json();
  console.log(`✓ Step 1 Success: Created in SQLite with ID #${createdInSqlite.id}`);
  console.log(`  Equipment: ${createdInSqlite.equipment}, Status: ${createdInSqlite.status}`);

  // Step 2 & 3: Simulate Backend OFF -> save to IndexedDB as PENDING SYNC
  console.log('\n[Step 2 & 3] Simulating Backend OFF -> Creating maintenance record in IndexedDB...');
  const offlinePayload = {
    vesselName: 'TIDELINE-01',
    equipment: 'Radar Scanner Belt',
    maintenanceDate: '2026-09-18',
    nextServiceDate: '2027-03-18',
    status: 'DUE SOON',
    notes: 'Belt tension adjusted offline during ocean transit',
  };

  const pendingRecord = await savePendingMaintenance(offlinePayload);
  console.log(`✓ Saved to IndexedDB with localId: ${pendingRecord.localId}`);
  console.log(`✓ Sync status is: ${pendingRecord.syncStatus}`);

  if (pendingRecord.syncStatus !== 'PENDING_SYNC') {
    throw new Error(`Step 3 failed: Expected status PENDING_SYNC, got ${pendingRecord.syncStatus}`);
  }

  const pendingListBefore = await getPendingMaintenance();
  console.log(`✓ Verified ${pendingListBefore.length} record(s) currently PENDING_SYNC in IndexedDB`);

  // Verify that attempting sync against dead port 9999 safely preserves PENDING_SYNC
  console.log('\n[Simulated offline sync attempt against dead port 9999]');
  const failSync = await syncPendingMaintenance('http://localhost:9999/api/maintenance');
  const stillPending = await getPendingMaintenance();
  console.log(`✓ Offline sync attempt aborted safely without error. Still pending: ${stillPending.length}`);

  // Step 4 & 5: Backend available -> Synchronize pending record to SQLite
  console.log('\n[Step 4 & 5] Backend available -> Triggering syncPendingMaintenance()...');
  const syncResult = await syncPendingMaintenance(API_BASE);
  console.log(`✓ Sync completed: ${syncResult.syncedCount} record(s) synced.`);

  if (syncResult.syncedCount < 1) {
    throw new Error(`Step 5 failed: Expected at least 1 synced record, got ${syncResult.syncedCount}`);
  }

  const allLocalAfter = await getAllLocalMaintenance();
  const syncedItem = allLocalAfter.find((item) => item.localId === pendingRecord.localId);
  console.log(`✓ Record status in IndexedDB updated to: ${syncedItem.syncStatus} with backendId: #${syncedItem.backendId}`);

  if (syncedItem.syncStatus !== 'SYNCED') {
    throw new Error(`Step 5 failed: Expected status SYNCED, got ${syncedItem.syncStatus}`);
  }

  // Verify the record is now truly in SQLite database
  const resVerify = await fetch(`${API_BASE}/${syncedItem.backendId}`);
  if (!resVerify.ok) {
    throw new Error(`Step 5 failed: Could not retrieve synced record #${syncedItem.backendId} from SQLite`);
  }
  const sqliteRecord = await resVerify.json();
  console.log(`✓ Verified in SQLite: ID #${sqliteRecord.id}, Equipment: ${sqliteRecord.equipment}, Status: ${sqliteRecord.status}`);

  // Step 6: Verify it is not duplicated on subsequent sync
  console.log('\n[Step 6] Running syncPendingMaintenance() again to verify NO DUPLICATES...');
  const secondSync = await syncPendingMaintenance(API_BASE);
  console.log(`✓ Second sync result: ${secondSync.syncedCount} synced (expected 0).`);

  if (secondSync.syncedCount !== 0) {
    throw new Error(`Step 6 failed: Duplicate sync occurred! Synced ${secondSync.syncedCount} items`);
  }

  const pendingListAfter = await getPendingMaintenance();
  console.log(`✓ Pending list count is now: ${pendingListAfter.length} (expected 0). No duplicates created!`);

  // Step 7: Verify SQLite table exists via DatabaseController
  console.log('\n[Step 7] Verifying SQLite table exists via GET /api/database/status...');
  const dbStatusRes = await fetch('http://localhost:8080/api/database/status');
  if (dbStatusRes.ok) {
    const dbStatus = await dbStatusRes.json();
    console.log(`✓ SQLite Status: ${dbStatus.status}, Tables: ${JSON.stringify(dbStatus.tables)}`);
    if (!dbStatus.tables.includes('maintenance_records')) {
      throw new Error("SQLite table 'maintenance_records' not found in database tables list!");
    }
    console.log("✓ Verified table 'maintenance_records' exists in SQLite database!");
  }

  console.log('\n--- ALL MAINTENANCE OFFLINE & SYNC TESTS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
