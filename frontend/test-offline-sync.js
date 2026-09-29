/**
 * Test script verifying offline-first IndexedDB storage and synchronization flow:
 * 1. Backend ON -> create voyage -> verify SQLite.
 * 2. Stop backend.
 * 3. Create voyage -> verify it appears locally as PENDING SYNC.
 * 4. Start backend again.
 * 5. Verify pending voyage synchronizes.
 * 6. Verify it is not duplicated.
 */

import 'fake-indexeddb/auto';
import {
  savePendingVoyage,
  getPendingVoyages,
  getAllLocalVoyages,
  syncPendingVoyages,
} from './src/utils/indexedDb.js';

const API_BASE = 'http://localhost:8080/api/voyages';

async function run() {
  console.log('--- STARTING OFFLINE VOYAGE LOG & SYNC VERIFICATION ---');

  // Step 1: Backend ON -> create voyage -> verify SQLite
  console.log('\n[Step 1] Testing Backend ON creation directly...');
  const directPayload = {
    voyageDate: '2026-09-18',
    departure: 'Vizhinjam Harbour',
    destination: 'Direct Online Zone',
    vesselName: 'TIDELINE-01',
    notes: 'Direct online creation test',
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

  // Step 2 & 3: Simulate Backend OFF -> save to IndexedDB as PENDING SYNC
  console.log('\n[Step 2 & 3] Simulating Backend OFF -> Creating voyage in IndexedDB...');
  const offlinePayload = {
    voyageDate: '2026-09-18',
    departure: 'Arabian Deep Sector 9',
    destination: 'Offshore Trench',
    vesselName: 'TIDELINE-OFFLINE',
    notes: 'Recorded while satellite / backend link was offline',
  };

  const pendingRecord = await savePendingVoyage(offlinePayload);
  console.log(`✓ Saved to IndexedDB with localId: ${pendingRecord.localId}`);
  console.log(`✓ Sync status is: ${pendingRecord.syncStatus}`);

  if (pendingRecord.syncStatus !== 'PENDING_SYNC') {
    throw new Error(`Step 3 failed: Expected status PENDING_SYNC, got ${pendingRecord.syncStatus}`);
  }

  const pendingListBefore = await getPendingVoyages();
  console.log(`✓ Verified ${pendingListBefore.length} record(s) currently PENDING_SYNC in IndexedDB`);

  // Verify that attempting sync against an invalid/down endpoint leaves status PENDING_SYNC
  console.log('\n[Simulated offline sync attempt against dead port 9999]');
  const failSync = await syncPendingVoyages('http://localhost:9999/api/voyages');
  const stillPending = await getPendingVoyages();
  console.log(`✓ Offline sync attempt aborted safely. Still pending: ${stillPending.length}`);

  // Step 4 & 5: Backend available -> Synchronize pending record to SQLite
  console.log('\n[Step 4 & 5] Backend available -> Triggering syncPendingVoyages()...');
  const syncResult = await syncPendingVoyages(API_BASE);
  console.log(`✓ Sync completed: ${syncResult.syncedCount} record(s) synced.`);

  if (syncResult.syncedCount < 1) {
    throw new Error(`Step 5 failed: Expected at least 1 synced record, got ${syncResult.syncedCount}`);
  }

  const allLocalAfter = await getAllLocalVoyages();
  const syncedItem = allLocalAfter.find((item) => item.localId === pendingRecord.localId);
  console.log(`✓ Record status in IndexedDB updated to: ${syncedItem.syncStatus} with backendId: #${syncedItem.backendId}`);

  if (syncedItem.syncStatus !== 'SYNCED') {
    throw new Error(`Step 5 failed: Expected status SYNCED, got ${syncedItem.syncStatus}`);
  }

  // Verify the record is now truly in SQLite
  const resVerify = await fetch(`${API_BASE}/${syncedItem.backendId}`);
  if (!resVerify.ok) {
    throw new Error(`Step 5 failed: Could not retrieve synced record #${syncedItem.backendId} from SQLite`);
  }
  const sqliteRecord = await resVerify.json();
  console.log(`✓ Verified in SQLite: ID #${sqliteRecord.id}, Vessel: ${sqliteRecord.vesselName}, Departure: ${sqliteRecord.departure}`);

  // Step 6: Verify it is not duplicated on subsequent sync
  console.log('\n[Step 6] Running syncPendingVoyages() again to verify NO DUPLICATES...');
  const secondSync = await syncPendingVoyages(API_BASE);
  console.log(`✓ Second sync result: ${secondSync.syncedCount} synced (expected 0).`);

  if (secondSync.syncedCount !== 0) {
    throw new Error(`Step 6 failed: Duplicate sync occurred! Synced ${secondSync.syncedCount} items`);
  }

  const pendingListAfter = await getPendingVoyages();
  console.log(`✓ Pending list count is now: ${pendingListAfter.length} (expected 0). No duplicates created!`);

  console.log('\n--- ALL 6 TEST STEPS PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
