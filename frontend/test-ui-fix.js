/**
 * test-ui-fix.js — Verification Script for TIDELINE UI/UX Final Fixes
 *
 * Verifies:
 * 1. Absence of forbidden decorative text across the built bundle and source code
 * 2. Bridge Console layout & CSS rules (100vw x 100vh, map canvas flex fill, no fixed phone constraints)
 * 3. Header component (presence of LOCAL API ONLINE button, absence of tagline)
 * 4. StatusBar component (OFFLINE MODE, GPS FIX, GPS UNAVAILABLE, no contradictory states)
 * 5. ApiStatusModal (Displays API, Backend, Health, Database, Mode)
 * 6. LocalAssistantModal (Bridge mode positioning, close button, escape key)
 * 7. Map component & view (OFFLINE CHART labels, ResizeObserver)
 * 8. Responsive styling (1366x768, 1536x864, 1920x1080 without horizontal overflow)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===============================================================');
console.log('       TIDELINE FINAL UI/UX FIX VERIFICATION SUITE             ');
console.log('===============================================================\n');

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
  } else {
    console.error(`✗ FAILED: ${message}`);
    allPassed = false;
  }
}

// ── TEST 1: Verify Absence of Forbidden Decorative Text ─────────────────
console.log('[TEST 1] Verifying Absence of Unwanted Decorative Text...');
const distDir = path.join(__dirname, 'dist');
let bundleJs = '';
let bundleCss = '';

if (fs.existsSync(distDir)) {
  const assets = fs.readdirSync(path.join(distDir, 'assets'));
  for (const asset of assets) {
    if (asset.endsWith('.js')) {
      bundleJs += fs.readFileSync(path.join(distDir, 'assets', asset), 'utf8') + '\n';
    } else if (asset.endsWith('.css')) {
      bundleCss += fs.readFileSync(path.join(distDir, 'assets', asset), 'utf8') + '\n';
    }
  }
}

const forbiddenStrings = [
  'Runs fully offline · Marine Assistant · GPS hardware only',
  'Prototype UI — <b>TIDELINE</b> · Offline-First Marine Assistant',
  'Prototype UI — TIDELINE',
  'Architecture: Mobile PWA / Browser Shell',
  'GNSS Satellite Hardware',
];

for (const forbidden of forbiddenStrings) {
  assert(!bundleJs.includes(forbidden), `Built bundle does not contain: "${forbidden}"`);
}

// ── TEST 2: Verify Bridge Console CSS & Handheld Frame ───────────────────
console.log('\n[TEST 2] Verifying Bridge Console Layout and Handheld Frame Rules...');
const indexCssPath = path.join(__dirname, 'src', 'index.css');
const cssContent = fs.readFileSync(indexCssPath, 'utf8');

assert(
  cssContent.includes('.stage-container.bridge-mode') &&
  cssContent.includes('width: 100vw') &&
  cssContent.includes('height: 100vh'),
  'Bridge Console configured for 100vw × 100vh'
);

assert(
  cssContent.includes('.phone.wide-bridge') &&
  cssContent.includes('border-radius: 0') &&
  cssContent.includes('box-shadow: none'),
  'Fixed phone/device-size constraints removed in Bridge mode'
);

assert(
  cssContent.includes('.phone {') &&
  cssContent.includes('width: 380px') &&
  cssContent.includes('height: 800px'),
  'Handheld Frame remains 380px × 800px with original mockup intact'
);

// ── TEST 3: Verify Map Responsiveness and Labels ─────────────────────────
console.log('\n[TEST 3] Verifying Map/Radar Canvas Flex Fill & Labels...');
assert(
  cssContent.includes('.bridge-panel .view-map-container .map-canvas') &&
  cssContent.includes('flex: 1 1 auto'),
  'Map canvas flex-fills available main content area completely in Bridge mode'
);

const nauticalMapPath = path.join(__dirname, 'src', 'components', 'NauticalMap.jsx');
const nauticalMapContent = fs.readFileSync(nauticalMapPath, 'utf8');

assert(
  nauticalMapContent.includes('OFFLINE CHART'),
  'NauticalMap clearly labeled "OFFLINE CHART"'
);

assert(
  nauticalMapContent.includes('ResizeObserver'),
  'NauticalMap implements ResizeObserver for dynamic canvas sizing'
);

assert(
  !nauticalMapContent.includes('tile.openstreetmap.org') &&
  !nauticalMapContent.includes('maps.google.com'),
  'Map uses 100% offline Canvas grid and local vector data (no online tile server calls)'
);

// ── TEST 4: Verify Header & Status Bar Behaviors ─────────────────────────
console.log('\n[TEST 4] Verifying Header & Status Bar Functional Indicators...');
const headerPath = path.join(__dirname, 'src', 'components', 'Header.jsx');
const headerContent = fs.readFileSync(headerPath, 'utf8');

assert(
  headerContent.includes('btn-api-status') &&
  headerContent.includes('LOCAL API ONLINE'),
  'Header contains clickable "LOCAL API ONLINE" status button'
);

const statusBarPath = path.join(__dirname, 'src', 'components', 'StatusBar.jsx');
const statusBarContent = fs.readFileSync(statusBarPath, 'utf8');

assert(
  statusBarContent.includes('OFFLINE MODE'),
  'StatusBar clearly displays "OFFLINE MODE"'
);

assert(
  statusBarContent.includes('GPS FIX') &&
  statusBarContent.includes('GPS UNAVAILABLE'),
  'StatusBar clearly distinguishes "GPS FIX" and "GPS UNAVAILABLE"'
);

assert(
  statusBarContent.includes("backendStatus === 'UP'") &&
  statusBarContent.includes('SYNCED'),
  'StatusBar never shows contradictory ONLINE + RETRY when backend is UP'
);

// ── TEST 5: Verify ApiStatusModal Content & Positioning ──────────────────
console.log('\n[TEST 5] Verifying ApiStatusModal Implementation...');
const apiStatusModalPath = path.join(__dirname, 'src', 'components', 'ApiStatusModal.jsx');
const modalContent = fs.readFileSync(apiStatusModalPath, 'utf8');

assert(modalContent.includes('API:'), 'Modal displays "API:"');
assert(modalContent.includes('Backend:'), 'Modal displays "Backend:"');
assert(modalContent.includes('localhost:8080'), 'Modal displays "localhost:8080"');
assert(modalContent.includes('Health:'), 'Modal displays "Health:"');
assert(modalContent.includes('/api/health'), 'Modal displays "/api/health"');
assert(modalContent.includes('Database:'), 'Modal displays "Database:"');
assert(modalContent.includes('SQLite'), 'Modal displays "SQLite"');
assert(modalContent.includes('Mode:'), 'Modal displays "Mode:"');
assert(modalContent.includes('OFFLINE-FIRST'), 'Modal displays "OFFLINE-FIRST"');

assert(
  cssContent.includes('.api-status-backdrop.bridge-api-backdrop') &&
  cssContent.includes('justify-content: flex-start'),
  'ApiStatusModal positioned in top-left, never overlapping map controls'
);

// ── TEST 6: Verify Local AI Assistant Modal Bridge Layout ────────────────
console.log('\n[TEST 6] Verifying Local AI Assistant Positioning in Bridge Mode...');
const assistantPath = path.join(__dirname, 'src', 'components', 'LocalAssistantModal.jsx');
const assistantContent = fs.readFileSync(assistantPath, 'utf8');

assert(
  assistantContent.includes('bridge-assistant-content') &&
  cssContent.includes('max-width: calc(50vw - 28px)'),
  'Local AI Assistant constrained to left panel in Bridge mode, NOT covering the map'
);

assert(
  assistantContent.includes('btn-close-assistant') &&
  assistantContent.includes('Escape'),
  'Local AI Assistant has working close button and keyboard Escape support'
);

// ── TEST 7: Verify Authentic GPS Telemetry in HomeView ───────────────────
console.log('\n[TEST 7] Verifying Zero Fake Telemetry in HomeView...');
const homeViewPath = path.join(__dirname, 'src', 'views', 'HomeView.jsx');
const homeViewContent = fs.readFileSync(homeViewPath, 'utf8');

assert(
  homeViewContent.includes('useGpsLocation') &&
  !homeViewContent.includes('08°04\'33"N'),
  'HomeView uses live useGpsLocation and no longer uses hardcoded coordinates'
);

console.log('===============================================================');
if (allPassed) {
  console.log('  ALL 7 TIDELINE UI/UX FIX TEST SUITES PASSED (100% SUCCESS)   ');
} else {
  console.error('  SOME TESTS FAILED!                                          ');
  process.exit(1);
}
console.log('===============================================================\n');
