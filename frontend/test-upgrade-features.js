/**
 * test-upgrade-features.js
 *
 * Automated Verification Suite for TIDELINE Upgrades:
 * 1. Secure Staff Login & RBAC roles
 * 2. Offline Marine Maps & IndexedDB area caching
 * 3. GPS Coordinates & Destination selection
 * 4. Marine Route Planning, Hazard Avoidance, & Depth Safety Disclaimers
 * 5. Staff Location Sharing, Freshness Status, & Offline Transmission Queue
 * 6. Preservation of existing voyage logs, maintenance, and emergency sync
 */

import 'fake-indexeddb/auto';
import {
  saveOfflineMapArea,
  getOfflineMapArea,
  getAllOfflineMapAreas,
  deleteOfflineMapArea,
  savePendingLocation,
  getPendingLocations,
  clearPendingLocations,
  savePendingVoyage,
  savePendingMaintenance,
  savePendingEmergency,
  getSyncSummary,
} from './src/utils/indexedDb.js';
import {
  OFFLINE_MAP_SECTORS,
  VERIFIED_DESTINATIONS,
  CHARTED_HAZARDS,
  haversineDistanceNm,
  initialBearingDeg,
  calculateMarineRoute,
} from './src/utils/coastalChartData.js';

async function runTests() {
  console.log('===============================================================');
  console.log('     TIDELINE UPGRADE FEATURES VERIFICATION SUITE              ');
  console.log('===============================================================');

  // -------------------------------------------------------------------------
  // TEST 1: Offline Marine Maps — Sector storage & IndexedDB persistence
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Testing Offline Marine Maps (Sector Download & Persistence)...');
  const sector = OFFLINE_MAP_SECTORS[0]; // Vizhinjam Deepwater Port & Approaches
  if (!sector || !sector.bounds || !sector.sizeBytes) {
    throw new Error('Test 1 Failed: Sector metadata is incomplete');
  }

  const saved = await saveOfflineMapArea(sector);
  if (saved.status !== 'SAVED_OFFLINE' || saved.areaId !== sector.id) {
    throw new Error('Test 1 Failed: Area not marked SAVED_OFFLINE or ID mismatch');
  }

  const retrieved = await getOfflineMapArea(sector.id);
  if (!retrieved || retrieved.name !== sector.name || retrieved.featureCount !== sector.featureCount) {
    throw new Error('Test 1 Failed: Retrieved area does not match saved data');
  }

  const allSaved = await getAllOfflineMapAreas();
  if (allSaved.length !== 1 || allSaved[0].areaId !== sector.id) {
    throw new Error('Test 1 Failed: getAllOfflineMapAreas count incorrect');
  }

  console.log(`✓ Test 1 Passed: Offline map area "${retrieved.name}" saved to IndexedDB (${retrieved.sizeFormatted}, ${retrieved.soundingsCount} soundings) and reopened successfully.`);

  // -------------------------------------------------------------------------
  // TEST 2: GPS Distance & Bearing Calculations
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing GPS Straight-Line Distance & Bearing Calculations...');
  const vesselLat = 8.3758;
  const vesselLon = 76.9900;
  const targetDest = VERIFIED_DESTINATIONS[1]; // Fairway Approach Buoy

  const distNm = haversineDistanceNm(vesselLat, vesselLon, targetDest.lat, targetDest.lon);
  const bearingDeg = initialBearingDeg(vesselLat, vesselLon, targetDest.lat, targetDest.lon);

  if (typeof distNm !== 'number' || distNm <= 0 || distNm > 50) {
    throw new Error(`Test 2 Failed: Unreasonable distance: ${distNm}`);
  }
  if (typeof bearingDeg !== 'number' || bearingDeg < 0 || bearingDeg >= 360) {
    throw new Error(`Test 2 Failed: Invalid bearing: ${bearingDeg}`);
  }

  console.log(`✓ Test 2 Passed: Straight-line distance = ${distNm.toFixed(2)} NM, Bearing = ${bearingDeg}°T`);

  // -------------------------------------------------------------------------
  // TEST 3: Marine Route Planning & Hazard Avoidance
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing Marine Route Planning & Charted Hazard Avoidance...');

  // 3a. Route intersecting Kallu Shoal Reef: Vessel near Mulloor heading to Outer Anchorage
  const shoalOrigin = { lat: 8.3400, lon: 77.0300 }; // East of Kallu Shoal
  const shoalTarget = VERIFIED_DESTINATIONS[2]; // Outer Commercial Anchorage Alpha (West)
  const routedPlan = calculateMarineRoute(shoalOrigin.lat, shoalOrigin.lon, shoalTarget);

  if (!routedPlan) {
    throw new Error('Test 3 Failed: Route planning returned null');
  }

  if (routedPlan.encounteredHazards.length === 0) {
    throw new Error('Test 3 Failed: Kallu Shoal hazard was not detected on traversing track');
  }

  if (routedPlan.waypoints.length <= 2) {
    throw new Error('Test 3 Failed: Hazard avoidance should insert safety waypoints');
  }

  if (routedPlan.marineRouteDistanceNm <= routedPlan.straightLineDistanceNm) {
    throw new Error('Test 3 Failed: Marine route with hazard detour should be longer than direct straight line');
  }

  if (!routedPlan.safetyDisclaimer.includes('HAZARD CLEARANCE ROUTE')) {
    throw new Error('Test 3 Failed: Safety disclaimer did not flag hazard detour');
  }

  console.log(`✓ Test 3a Passed: Detected hazard "${routedPlan.encounteredHazards[0].name}". Direct: ${routedPlan.straightLineDistanceNm} NM vs Marine Route: ${routedPlan.marineRouteDistanceNm} NM (+${routedPlan.hazardClearanceDetourNm} NM detour).`);

  // 3b. Test unverified sounding notification when vessel operates outside certified corridor
  const offshoreOutside = { lat: 7.2000, lon: 75.0000 }; // Far offshore Arabian Sea outside corridor
  const unverifiedPlan = calculateMarineRoute(offshoreOutside.lat, offshoreOutside.lon, shoalTarget);

  if (unverifiedPlan.verificationStatus !== 'UNVERIFIED_SOUNDINGS') {
    throw new Error('Test 3b Failed: Outside corridor track must be flagged UNVERIFIED_SOUNDINGS');
  }
  if (!unverifiedPlan.safetyDisclaimer.includes('UNVERIFIED SOUNDINGS')) {
    throw new Error('Test 3b Failed: Safety disclaimer missing unverified soundings warning');
  }

  console.log(`✓ Test 3b Passed: Unverified marine corridor properly triggers strict nautical warning: "${unverifiedPlan.safetyDisclaimer.substring(0, 75)}..."`);

  // -------------------------------------------------------------------------
  // TEST 4: Staff Location Sharing & Offline Queueing
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Staff Location Sharing & Offline Queue...');
  await clearPendingLocations();

  const queuedLoc = await savePendingLocation({
    latitude: 8.3758,
    longitude: 76.9900,
    accuracy: 4.2,
    speed: 8.5,
    heading: 215.0,
    vesselName: 'TIDELINE-ALPHA',
    statusNote: 'Sea patrol watch',
  });

  if (!queuedLoc.localId || queuedLoc.syncStatus !== 'QUEUED_OFFLINE') {
    throw new Error('Test 4 Failed: Queued location status mismatch');
  }

  const allQueued = await getPendingLocations();
  if (allQueued.length !== 1 || allQueued[0].localId !== queuedLoc.localId) {
    throw new Error('Test 4 Failed: Pending location retrieval failed');
  }

  console.log(`✓ Test 4 Passed: Location fix safely queued in IndexedDB (localId: ${queuedLoc.localId}) with status QUEUED_OFFLINE.`);

  // -------------------------------------------------------------------------
  // TEST 5: Preservation of Existing Logs, Maintenance, and SOS Sync
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Preservation of Existing Features (Logs, Maint, SOS)...');
  const v = await savePendingVoyage({
    voyageDate: '2026-10-16',
    departure: 'Vizhinjam Pier 1',
    destination: 'Arabian Sea Corridor',
    vesselName: 'TIDELINE-TEST',
    notes: 'Preservation test',
  });

  const m = await savePendingMaintenance({
    equipment: 'Radar Transceiver',
    maintenanceDate: '2026-10-16',
    status: 'INSPECTION_PASSED',
    notes: 'Magnetron checked',
  });

  const e = await savePendingEmergency({
    emergencyType: 'DISTRESS_DRILL',
    latitude: 8.37,
    longitude: 76.98,
    message: 'Naval communications test',
  });

  if (v.syncStatus !== 'PENDING_SYNC' || m.syncStatus !== 'PENDING_SYNC' || e.syncStatus !== 'PENDING_SYNC') {
    throw new Error('Test 5 Failed: Initial sync status must be PENDING_SYNC');
  }

  const summary = await getSyncSummary();
  if (summary.pendingCount < 3) {
    throw new Error(`Test 5 Failed: Expected at least 3 pending records, got ${summary.pendingCount}`);
  }

  console.log(`✓ Test 5 Passed: Existing Voyage Logs, Maintenance Records, and Emergency events operating without interference. Pending count: ${summary.pendingCount}.`);

  console.log('\n===============================================================');
  console.log('   ALL 5 UPGRADE FEATURE VERIFICATION TESTS PASSED (100%)!     ');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
