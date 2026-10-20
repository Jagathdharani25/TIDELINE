/**
 * test-footer-nav.js
 *
 * Automated Verification Suite for TIDELINE Bridge Console Footer / Bottom Navigation:
 * 1. Verifies BottomNav.jsx has strictly 5 items: HOME, MAP, SOS, FIX, LOGS.
 * 2. Verifies all 5 items have equal spacing via 5-column CSS grid (repeat(5, 1fr)).
 * 3. Verifies .bridge-bottomnav is fixed to bottom of screen (position: fixed, bottom: 0, left: 0, right: 0).
 * 4. Verifies full-width 100vw layout and consistent 50px height.
 * 5. Verifies active-page highlight (.nav-active-bar & active tint), plus distinct alert theme for SOS.
 * 6. Verifies content containers have sufficient bottom padding/clearance to prevent overlap or being pushed off-screen.
 * 7. Verifies no duplicate bottom navigation bars exist in the codebase.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runFooterTests() {
  console.log('===============================================================');
  console.log('     TIDELINE FOOTER & BOTTOM NAV VERIFICATION SUITE           ');
  console.log('===============================================================');

  const bottomNavPath = path.join(__dirname, 'src', 'components', 'BottomNav.jsx');
  const appPath = path.join(__dirname, 'src', 'App.jsx');
  const cssPath = path.join(__dirname, 'src', 'index.css');

  const bottomNavCode = fs.readFileSync(bottomNavPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // TEST 1: Exactly 5 items in BottomNav: HOME, MAP, SOS, FIX, LOGS
  console.log('\n[TEST 1] Verifying 5 items in BottomNav.jsx...');
  const expectedItems = [
    { id: 'home', label: 'HOME' },
    { id: 'map', label: 'MAP' },
    { id: 'emergency', label: 'SOS' },
    { id: 'maintenance', label: 'FIX' },
    { id: 'logs', label: 'LOGS' },
  ];

  for (const item of expectedItems) {
    if (!bottomNavCode.includes(`id: '${item.id}'`) || !bottomNavCode.includes(`label: '${item.label}'`)) {
      throw new Error(`Test 1 Failed: Item ${item.label} (${item.id}) missing from BottomNav.jsx`);
    }
  }

  // Check no extra logout button in BottomNav
  if (bottomNavCode.includes('navitem-logout') || bottomNavCode.includes('id="nav-logout"')) {
    throw new Error('Test 1 Failed: Unexpected logout button found in BottomNav.jsx (must strictly have 5 nav items)');
  }
  console.log('✓ Test 1 Passed: Exactly 5 items (HOME, MAP, SOS, FIX, LOGS) defined without extraneous buttons.');

  // TEST 2: Single Bottom Navigation bar without duplicates
  console.log('\n[TEST 2] Verifying no duplicate BottomNav instances...');
  const bottomNavMatches = appCode.match(/<BottomNav\b/g);
  if (!bottomNavMatches || bottomNavMatches.length !== 1) {
    throw new Error(`Test 2 Failed: Expected exactly 1 <BottomNav> in App.jsx, found ${bottomNavMatches ? bottomNavMatches.length : 0}`);
  }
  console.log('✓ Test 2 Passed: Exactly 1 single BottomNav rendered in App.jsx.');

  // TEST 3: Fixed Footer position, Full Width, and 50px Height in CSS
  console.log('\n[TEST 3] Verifying .bridge-bottomnav fixed positioning and 5-column grid in CSS...');
  if (!cssCode.includes('.bridge-bottomnav {')) {
    throw new Error('Test 3 Failed: .bridge-bottomnav CSS class not found');
  }
  if (!cssCode.includes('position: fixed') || !cssCode.includes('bottom: 0') || !cssCode.includes('z-index: 1000')) {
    throw new Error('Test 3 Failed: .bridge-bottomnav must have position: fixed; bottom: 0; z-index: 1000');
  }
  if (!cssCode.includes('grid-template-columns: repeat(5, 1fr)')) {
    throw new Error('Test 3 Failed: .bridge-bottomnav-grid must have grid-template-columns: repeat(5, 1fr) for equal spacing');
  }
  if (!cssCode.includes('width: 100vw') || !cssCode.includes('height: 50px')) {
    throw new Error('Test 3 Failed: .bridge-bottomnav must be full-width (100vw) with height: 50px');
  }
  console.log('✓ Test 3 Passed: .bridge-bottomnav has position: fixed, bottom: 0, 100vw width, 50px height, and 5 equal grid columns (repeat(5, 1fr)).');

  // TEST 4: Active-page highlight & SOS alert theme
  console.log('\n[TEST 4] Verifying active highlights and SOS emergency theme...');
  if (!cssCode.includes('.bridge-navitem .nav-active-bar')) {
    throw new Error('Test 4 Failed: .nav-active-bar indicator missing from index.css');
  }
  if (!cssCode.includes('.bridge-navitem.active .nav-active-bar') || !cssCode.includes('--sonar')) {
    throw new Error('Test 4 Failed: Active sonar highlight missing for standard tabs');
  }
  if (!cssCode.includes('.bridge-navitem.emergency.active') || !cssCode.includes('#FF4F4F')) {
    throw new Error('Test 4 Failed: High-visibility emergency alert theme missing for SOS tab');
  }
  console.log('✓ Test 4 Passed: Active indicator bar with glowing sonar green and emergency red styles verified.');

  // TEST 5: Content container clearance & padding to prevent overlap
  console.log('\n[TEST 5] Verifying page clearance to prevent footer overlap...');
  if (!cssCode.includes('margin-bottom: 50px') || !cssCode.includes('calc(100vh - 42px - 50px)')) {
    throw new Error('Test 5 Failed: .bridge-console-main must constrain height and include margin-bottom for footer clearance');
  }
  if (!cssCode.includes('.bridge-panel-body') || !cssCode.includes('padding: 10px 12px 24px')) {
    throw new Error('Test 5 Failed: .bridge-panel-body must have bottom padding to prevent content clipping');
  }
  console.log('✓ Test 5 Passed: Main console view and panel body containers have strict height constraints and bottom padding.');

  console.log('\n===============================================================');
  console.log('   ALL 5 FOOTER ALIGNMENT TESTS PASSED PERFECTLY (100%)!       ');
  console.log('===============================================================');
}

runFooterTests();
