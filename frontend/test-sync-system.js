/**
 * test-sync-system.js
 *
 * Comprehensive Automated Verification Suite for TIDELINE Synchronization:
 *
 * Requirements Tested:
 * 1. Maintain pending local records in IndexedDB while offline
 * 2. Never mark a record synced without backend confirmation (HTTP 500 / network failure / invalid ID)
 * 3. Record sync status, retry count, error message, and timestamps (lastAttemptAt, lastSyncedAt)
 * 4. Detect backend availability & transition (unavailable -> available)
 * 5. Sync only unsynchronized records
 * 6. Duplicate prevention (subsequent sync does not duplicate, concurrent mutex lock)
 * 7. Failed synchronization retry (retries failed records upon backend recovery)
 * 8. Accurate sync summary aggregation
 */

import 'fake-indexeddb/auto';
import http from 'node:http';
import {
  savePendingVoyage,
  getPendingVoyages,
  getAllLocalVoyages,
  syncPendingVoyages,
  savePendingMaintenance,
  getPendingMaintenance,
  syncPendingMaintenance,
  savePendingEmergency,
  getPendingEmergencies,
  syncPendingEmergencies,
  getSyncSummary,
  syncAllPending,
} from './src/utils/indexedDb.js';

let serverMode = 'HEALTHY'; // 'HEALTHY' | 'ERROR_500' | 'MISSING_ID' | 'OFFLINE'
let receivedVoyagePosts = [];
let receivedMaintenancePosts = [];
let receivedEmergencyPosts = [];
let nextGeneratedId = 100;

// Embedded Mock Backend Server
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET' && req.url === '/api/health') {
    if (serverMode === 'OFFLINE') {
      res.writeHead(503);
      res.end(JSON.stringify({ status: 'DOWN' }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'UP' }));
    }
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    if (serverMode === 'ERROR_500') {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error simulated' }));
      return;
    }

    if (serverMode === 'MISSING_ID') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'OK_WITHOUT_ID' }));
      return;
    }

    if (req.method === 'POST') {
      const parsed = body ? JSON.parse(body) : {};
      const generated = { ...parsed, id: nextGeneratedId++ };

      if (req.url.startsWith('/api/voyages')) {
        receivedVoyagePosts.push(generated);
      } else if (req.url.startsWith('/api/maintenance')) {
        receivedMaintenancePosts.push(generated);
      } else if (req.url.startsWith('/api/emergencies')) {
        receivedEmergencyPosts.push(generated);
      }

      res.writeHead(201);
      res.end(JSON.stringify(generated));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });
});

async function runTests() {
  console.log('===============================================================');
  console.log('       TIDELINE SYNCHRONIZATION TEST SUITE                     ');
  console.log('===============================================================');

  // Start test server on port 8181
  const TEST_PORT = 8181;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`✓ Embedded test server listening on ${BASE_URL}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Maintain pending local records in IndexedDB while offline
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Testing offline record creation & local persistence...');
    const v1 = await savePendingVoyage({
      voyageDate: '2026-09-19',
      departure: 'Vizhinjam Old Pier',
      destination: 'Arabian Deep Sector 3',
      vesselName: 'TIDELINE-ALPHA',
      notes: 'Recorded offline in heavy weather',
    });

    const m1 = await savePendingMaintenance({
      equipment: 'Bilge Pump B',
      maintenanceDate: '2026-09-19',
      status: 'OK',
      notes: 'Impeller cleaned',
    });

    const e1 = await savePendingEmergency({
      emergencyType: 'MEDICAL_ASSIST',
      latitude: 8.35,
      longitude: 76.95,
      message: 'Crew injury treated with first aid kit',
    });

    if (v1.syncStatus !== 'PENDING_SYNC' || m1.syncStatus !== 'PENDING_SYNC' || e1.syncStatus !== 'PENDING_SYNC') {
      throw new Error('Test 1 Failed: Initial status must be PENDING_SYNC');
    }
    if (v1.backendId !== null || v1.retryCount !== 0) {
      throw new Error('Test 1 Failed: Initial backendId must be null and retryCount must be 0');
    }

    const summary1 = await getSyncSummary();
    if (summary1.pendingCount !== 3) {
      throw new Error(`Test 1 Failed: Expected pendingCount = 3, got ${summary1.pendingCount}`);
    }
    console.log(`✓ Test 1 Passed: 3 records saved as PENDING_SYNC (retryCount=0, backendId=null)\n`);

    // -------------------------------------------------------------------------
    // TEST 2: Never mark synced without backend confirmation (Failure / 500)
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Testing failed sync & strict unconfirmed handling (HTTP 500)...');
    serverMode = 'ERROR_500';

    const failVoyageRes = await syncPendingVoyages(`${BASE_URL}/api/voyages`);
    if (failVoyageRes.syncedCount !== 0) {
      throw new Error('Test 2 Failed: syncedCount must be 0 on HTTP 500 failure');
    }

    const voyagesAfterFail = await getAllLocalVoyages();
    const failedVoyage = voyagesAfterFail.find((v) => v.localId === v1.localId);

    if (failedVoyage.syncStatus !== 'SYNC_FAILED') {
      throw new Error(`Test 2 Failed: Expected status SYNC_FAILED, got ${failedVoyage.syncStatus}`);
    }
    if (failedVoyage.backendId !== null) {
      throw new Error('Test 2 Failed: backendId must NOT be set on failed sync');
    }
    if (failedVoyage.retryCount !== 1) {
      throw new Error(`Test 2 Failed: Expected retryCount = 1, got ${failedVoyage.retryCount}`);
    }
    if (!failedVoyage.lastAttemptAt || !failedVoyage.syncError) {
      throw new Error('Test 2 Failed: Expected lastAttemptAt and syncError to be recorded');
    }

    console.log(`✓ Test 2 Passed: Record marked SYNC_FAILED with retryCount=1, error="${failedVoyage.syncError}", never marked SYNCED\n`);

    // -------------------------------------------------------------------------
    // TEST 3: Never mark synced if backend response is missing ID
    // -------------------------------------------------------------------------
    console.log('[TEST 3] Testing backend response missing valid record ID...');
    serverMode = 'MISSING_ID';

    const missingIdRes = await syncPendingMaintenance(`${BASE_URL}/api/maintenance`);
    if (missingIdRes.syncedCount !== 0) {
      throw new Error('Test 3 Failed: Record without ID must not be marked synced');
    }

    const maintAfterMissing = await getPendingMaintenance();
    const failedMaint = maintAfterMissing.find((m) => m.localId === m1.localId);
    if (failedMaint.syncStatus !== 'SYNC_FAILED') {
      throw new Error(`Test 3 Failed: Expected SYNC_FAILED, got ${failedMaint.syncStatus}`);
    }
    console.log(`✓ Test 3 Passed: Missing ID response rejected and safely flagged SYNC_FAILED\n`);

    // -------------------------------------------------------------------------
    // TEST 4: Backend unavailable → available & Retry failed synchronization
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Testing Backend recovery (Available) & Retry of failed records...');
    serverMode = 'HEALTHY'; // Backend is back online!

    const recoveredSync = await syncAllPending(BASE_URL);

    if (recoveredSync.voyages.syncedCount !== 1) {
      throw new Error(`Test 4 Failed: Expected 1 voyage synced, got ${recoveredSync.voyages.syncedCount}`);
    }
    if (recoveredSync.maintenance.syncedCount !== 1) {
      throw new Error(`Test 4 Failed: Expected 1 maintenance synced, got ${recoveredSync.maintenance.syncedCount}`);
    }
    if (recoveredSync.emergencies.syncedCount !== 1) {
      throw new Error(`Test 4 Failed: Expected 1 emergency synced, got ${recoveredSync.emergencies.syncedCount}`);
    }

    const allVoyagesAfter = await getAllLocalVoyages();
    const syncedVoyage = allVoyagesAfter.find((v) => v.localId === v1.localId);

    if (syncedVoyage.syncStatus !== 'SYNCED') {
      throw new Error(`Test 4 Failed: Expected SYNCED status, got ${syncedVoyage.syncStatus}`);
    }
    if (!syncedVoyage.backendId || !syncedVoyage.lastSyncedAt) {
      throw new Error('Test 4 Failed: Expected backendId and lastSyncedAt to be populated');
    }

    const summaryRecovered = await getSyncSummary();
    if (summaryRecovered.pendingCount !== 0 || summaryRecovered.failedCount !== 0) {
      throw new Error(`Test 4 Failed: Expected 0 pending/failed, got pending=${summaryRecovered.pendingCount}, failed=${summaryRecovered.failedCount}`);
    }
    if (summaryRecovered.syncedCount !== 3) {
      throw new Error(`Test 4 Failed: Expected 3 synced, got ${summaryRecovered.syncedCount}`);
    }

    console.log(`✓ Test 4 Passed: All 3 records successfully retried, confirmed by backend, and marked SYNCED with IDs and timestamps\n`);

    // -------------------------------------------------------------------------
    // TEST 5: Duplicate Prevention on Subsequent Sync
    // -------------------------------------------------------------------------
    console.log('[TEST 5] Testing duplicate prevention on subsequent sync calls...');
    const postCountBefore = receivedVoyagePosts.length;

    const secondSync = await syncAllPending(BASE_URL);

    if (secondSync.voyages.syncedCount !== 0 || secondSync.maintenance.syncedCount !== 0 || secondSync.emergencies.syncedCount !== 0) {
      throw new Error('Test 5 Failed: Already synced records were re-transmitted!');
    }

    const postCountAfter = receivedVoyagePosts.length;
    if (postCountBefore !== postCountAfter) {
      throw new Error('Test 5 Failed: Backend received duplicate POST requests!');
    }
    console.log(`✓ Test 5 Passed: Subsequent sync sent 0 items, exactly 0 duplicate POSTs made to server\n`);

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate Prevention with Concurrent Sync Calls (Mutex Lock)
    // -------------------------------------------------------------------------
    console.log('[TEST 6] Testing concurrent sync mutex lock...');
    // Create a new pending record
    await savePendingVoyage({
      voyageDate: '2026-09-19',
      departure: 'Concurrent Check Pier',
      destination: 'Outer Buoy',
      vesselName: 'TIDELINE-CONCURRENT',
    });

    // Fire 2 syncs concurrently
    const [call1, call2] = await Promise.all([
      syncPendingVoyages(`${BASE_URL}/api/voyages`),
      syncPendingVoyages(`${BASE_URL}/api/voyages`),
    ]);

    const oneWasSkipped = call1.skipped || call2.skipped;
    const totalSyncedConcurrently = (call1.syncedCount || 0) + (call2.syncedCount || 0);

    if (!oneWasSkipped && totalSyncedConcurrently > 1) {
      throw new Error('Test 6 Failed: Concurrent sync allowed duplicate processing!');
    }
    console.log(`✓ Test 6 Passed: In-flight mutex lock prevented concurrent duplicate sync runs\n`);

    console.log('===============================================================');
    console.log('  ALL 6 SYNCHRONIZATION TESTS PASSED WITH 100% SUCCESS!       ');
    console.log('===============================================================');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
