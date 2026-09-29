/**
 * test-local-assistant.js
 *
 * Comprehensive Verification Test Suite for TIDELINE Local AI Assistant Architecture.
 *
 * Verifies:
 * 1. Grounding & Anti-Hallucination: Weather queries MUST return "Verified data is unavailable."
 * 2. Marine Conditions: Wind/wave/swell queries MUST return "Verified data is unavailable."
 * 3. Verified GPS:
 *    - With authentic fix -> Returns exact coordinates, accuracy, speed, heading.
 *    - Without authentic fix -> MUST return "Verified data is unavailable." (NEVER fabricates).
 * 4. Verified Voyage Logs: Answers strictly from logged trips, returns fallback if empty.
 * 5. Verified Maintenance: Answers strictly from confirmed equipment records.
 * 6. Emergency Transmission Status: Strictly uninvented, reports authentic status.
 * 7. Verified Vessel Info: Extracts confirmed vessel identification without guessing.
 * 8. Out-of-Scope Queries: Returns "Verified data is unavailable."
 */

import 'fake-indexeddb/auto';
import {
  savePendingVoyage,
  savePendingMaintenance,
  savePendingEmergency,
  deleteLocalVoyage,
  deleteLocalMaintenance,
  deleteLocalEmergency,
  getAllLocalVoyages,
  getAllLocalMaintenance,
  getAllLocalEmergencies,
} from './src/utils/indexedDb.js';
import { askLocalAssistant } from './src/utils/localMarineAssistant.js';

// Setup mock localStorage in Node
let mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key) => {
    delete mockStorage[key];
  },
  clear: () => {
    mockStorage = {};
  },
};

async function runTests() {
  console.log('===============================================================');
  console.log('       TIDELINE LOCAL AI ASSISTANT ARCHITECTURE TESTS         ');
  console.log('===============================================================');

  // Clear state before starting
  mockStorage = {};

  // -------------------------------------------------------------------------
  // TEST 1: MUST NOT INVENT WEATHER OR MARINE CONDITIONS
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Testing Weather & Marine Condition Hallucination Prevention...');
  const weatherQueries = [
    'What is the weather forecast for Vizhinjam tomorrow?',
    'Will there be storm or high wind today?',
    'What is the current wave height and swell?',
    'What is the sea surface temperature and tide?',
  ];

  for (const q of weatherQueries) {
    const res = await askLocalAssistant(q);
    if (!res.answer.includes('Verified data is unavailable.')) {
      throw new Error(`Test 1 Failed: Weather query "${q}" did not return mandatory fallback message! Got:\n${res.answer}`);
    }
  }
  console.log('✓ Test 1 Passed: Weather & marine condition queries safely rejected with "Verified data is unavailable."');

  // -------------------------------------------------------------------------
  // TEST 2: GPS WITH NO FIX -> MUST NOT FABRICATE COORDINATES
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing GPS query with NO fix available (Zero Coordinates Invented)...');
  mockStorage = {}; // Ensure no GPS stored
  const noGpsRes = await askLocalAssistant('Where are we located? Give me our GPS coordinates.');

  if (!noGpsRes.answer.includes('Verified data is unavailable.')) {
    throw new Error(`Test 2 Failed: Expected "Verified data is unavailable.", got: ${noGpsRes.answer}`);
  }
  if (noGpsRes.answer.includes('08.') || noGpsRes.answer.includes('76.')) {
    throw new Error(`Test 2 Failed: AI fabricated fake coordinates when no fix was present!`);
  }
  console.log('✓ Test 2 Passed: When GPS fix is absent, coordinates are never invented and fallback is triggered.');

  // -------------------------------------------------------------------------
  // TEST 3: GPS WITH AUTHENTIC FIX -> ANSWERS FROM VERIFIED GNSS DATA
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing GPS query with VERIFIED authentic GNSS fix...');
  const authenticFix = {
    latitude: 8.3758,
    longitude: 76.9900,
    accuracy: 4.2,
    speed: 3.5, // ~6.8 knots
    heading: 214,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
  };
  localStorage.setItem('tideline_last_gps', JSON.stringify(authenticFix));

  const gpsRes = await askLocalAssistant('What is our current verified GPS fix and telemetry?');
  if (!gpsRes.answer.includes('08.3758° N') || !gpsRes.answer.includes('76.9900° E')) {
    throw new Error(`Test 3 Failed: Verified coordinates not found in answer: ${gpsRes.answer}`);
  }
  if (!gpsRes.answer.includes('±4 m') && !gpsRes.answer.includes('±4.2 m')) {
    throw new Error(`Test 3 Failed: Accuracy not reported accurately: ${gpsRes.answer}`);
  }
  if (!gpsRes.answer.includes('214°')) {
    throw new Error(`Test 3 Failed: Heading not reported accurately: ${gpsRes.answer}`);
  }
  console.log('✓ Test 3 Passed: Verified GPS fix accurately reported with position, accuracy, speed, and heading.');

  // -------------------------------------------------------------------------
  // TEST 4: VERIFIED VOYAGE LOGS
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Voyage Log Query from Verified IndexedDB Storage...');
  await savePendingVoyage({
    voyageDate: '2026-09-18',
    departure: 'Vizhinjam Harbour Pier 2',
    destination: 'Arabian Deep Sector 5',
    vesselName: 'TIDELINE-01',
    notes: 'Departed under clear skies · baro 1013 hPa',
  });

  const voyageRes = await askLocalAssistant('What were our recent voyages and routes?');
  if (!voyageRes.answer.includes('Vizhinjam Harbour Pier 2') || !voyageRes.answer.includes('Arabian Deep Sector 5')) {
    throw new Error(`Test 4 Failed: Voyage details not found in answer: ${voyageRes.answer}`);
  }
  if (!voyageRes.answer.includes('TIDELINE-01')) {
    throw new Error(`Test 4 Failed: Vessel name not found in voyage answer: ${voyageRes.answer}`);
  }
  console.log('✓ Test 4 Passed: Verified voyage log correctly extracted and presented.');

  // -------------------------------------------------------------------------
  // TEST 5: VERIFIED EQUIPMENT MAINTENANCE
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Maintenance Records Query...');
  await savePendingMaintenance({
    vesselName: 'TIDELINE-01',
    equipment: 'Bilge Water Level Sensor',
    maintenanceDate: '2026-09-15',
    nextServiceDate: '2026-10-15',
    status: 'OK',
    notes: 'Tested float switch and alarm buzzer',
  });

  const maintRes = await askLocalAssistant('What is the status of our bilge equipment?');
  if (!maintRes.answer.includes('Bilge Water Level Sensor') || !maintRes.answer.includes('OK')) {
    throw new Error(`Test 5 Failed: Equipment maintenance not found: ${maintRes.answer}`);
  }

  // Non-existent equipment
  const missingMaintRes = await askLocalAssistant('What is the maintenance status of the submarine torpedo launcher?');
  if (!missingMaintRes.answer.includes('Verified data is unavailable.')) {
    throw new Error(`Test 5 Failed: Non-existent equipment did not return fallback! Got: ${missingMaintRes.answer}`);
  }
  console.log('✓ Test 5 Passed: Verified maintenance records returned for real gear, fallback triggered for unverified gear.');

  // -------------------------------------------------------------------------
  // TEST 6: EMERGENCY TRANSMISSION STATUS (NEVER INVENT TRANSMITTED)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Emergency Distress Record & Authentic Transmission Status...');
  await savePendingEmergency({
    emergencyType: 'ENGINE_FAILURE_DRIFT',
    latitude: 8.32,
    longitude: 76.91,
    status: 'LOCAL_ONLY', // NOT yet transmitted!
    message: 'Main engine overheated; drifting west',
  });

  const emgRes = await askLocalAssistant('Was our emergency distress signal transmitted to the Coast Guard?');
  if (emgRes.answer.includes('VERIFIED TRANSMITTED TO SHORE')) {
    throw new Error(`Test 6 Failed: Assistant falsely claimed emergency was transmitted!`);
  }
  if (!emgRes.answer.includes('LOCAL ONLY') && !emgRes.answer.includes('Not transmitted off vessel')) {
    throw new Error(`Test 6 Failed: Authentic LOCAL_ONLY transmission status was not reported: ${emgRes.answer}`);
  }
  console.log('✓ Test 6 Passed: Emergency transmission status accurately reported as untransmitted (no false transmission claim).');

  // -------------------------------------------------------------------------
  // TEST 7: VERIFIED VESSEL IDENTIFICATION
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Testing Vessel Identification Query...');
  const vesselRes = await askLocalAssistant('What is our vessel name and identity?');
  if (!vesselRes.answer.includes('TIDELINE-01')) {
    throw new Error(`Test 7 Failed: Documented vessel name not reported: ${vesselRes.answer}`);
  }
  console.log('✓ Test 7 Passed: Verified vessel identification correctly reported from local database.');

  // -------------------------------------------------------------------------
  // TEST 8: OUT-OF-SCOPE & UNVERIFIED QUERIES
  // -------------------------------------------------------------------------
  console.log('\n[TEST 8] Testing Out-of-Scope Queries...');
  const outOfScopeQueries = [
    'Tell me a funny pirate joke',
    'What is the stock price of Google today?',
    'Who is the prime minister of India?',
  ];

  for (const q of outOfScopeQueries) {
    const res = await askLocalAssistant(q);
    if (!res.answer.includes('Verified data is unavailable.')) {
      throw new Error(`Test 8 Failed: Out-of-scope query "${q}" did not trigger mandatory fallback! Got: ${res.answer}`);
    }
  }
  console.log('✓ Test 8 Passed: Out-of-scope queries consistently return "Verified data is unavailable."');

  console.log('\n===============================================================');
  console.log('  ALL 8 LOCAL AI ASSISTANT ARCHITECTURE TESTS PASSED!         ');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('FATAL TEST FAILURE:', err);
  process.exit(1);
});
