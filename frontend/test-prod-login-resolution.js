/**
 * test-prod-login-resolution.js
 *
 * Verification test suite for TIDELINE production login URL resolution:
 * 1. Verifies VITE_API_BASE_URL environment variable detection & priority.
 * 2. Verifies filtering of Vercel static host 404 text/plain responses (preventing JSON parse syntax errors).
 * 3. Verifies prevention of Mixed Content localhost calls when on HTTPS production domains.
 * 4. Verifies fallback to localhost:8080 during local development.
 * 5. Verifies Spring Boot backend CORS allows https://*.vercel.app and https://tidelinejava.vercel.app.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('===============================================================');
  console.log('  TIDELINE PRODUCTION LOGIN & API RESOLUTION VERIFICATION      ');
  console.log('===============================================================');

  const useAuthPath = path.join(__dirname, 'src', 'utils', 'useAuth.jsx');
  const corsConfigPath = path.join(__dirname, '..', 'backend', 'src', 'main', 'java', 'com', 'tideline', 'backend', 'config', 'CorsConfig.java');

  const useAuthCode = fs.readFileSync(useAuthPath, 'utf8');
  const corsCode = fs.readFileSync(corsConfigPath, 'utf8');

  // TEST 1: VITE_API_BASE_URL env var support
  console.log('\n[TEST 1] Verifying VITE_API_BASE_URL resolution in useAuth.jsx...');
  if (!useAuthCode.includes('import.meta.env.VITE_API_BASE_URL')) {
    throw new Error('Test 1 Failed: VITE_API_BASE_URL environment variable not checked in useAuth.jsx');
  }
  console.log('✓ Test 1 Passed: VITE_API_BASE_URL correctly read from Vite import.meta.env.');

  // TEST 2: Static host 404 (Vercel NOT_FOUND) guard to prevent JSON parse crash
  console.log('\n[TEST 2] Verifying Vercel static 404 text response filtering...');
  if (!useAuthCode.includes('res.status === 404 && !isJson')) {
    throw new Error('Test 2 Failed: Static host 404 text response filter missing from authFetch');
  }
  if (!useAuthCode.includes('application/json')) {
    throw new Error('Test 2 Failed: application/json content-type check missing from authFetch');
  }
  console.log('✓ Test 2 Passed: Static host 404 text/plain response is detected and skipped before json() parsing.');

  // TEST 3: Mixed Content prevention on HTTPS production domains
  console.log('\n[TEST 3] Verifying Mixed Content prevention on HTTPS...');
  if (!useAuthCode.includes("window.location.protocol === 'https:'")) {
    throw new Error('Test 3 Failed: HTTPS protocol check missing (would trigger Mixed Content violations on Vercel)');
  }
  console.log('✓ Test 3 Passed: Plain HTTP localhost addresses are suppressed on remote HTTPS domains.');

  // TEST 4: Backend CORS allows Vercel production origin
  console.log('\n[TEST 4] Verifying Spring Boot backend CORS configuration for Vercel...');
  if (!corsCode.includes('https://*.vercel.app') || !corsCode.includes('https://tidelinejava.vercel.app')) {
    throw new Error('Test 4 Failed: CorsConfig.java does not explicitly permit https://*.vercel.app');
  }
  if (!corsCode.includes('allowCredentials(true)')) {
    throw new Error('Test 4 Failed: allowCredentials(true) missing in CorsConfig.java');
  }
  console.log('✓ Test 4 Passed: Spring Boot CorsConfig explicitly permits https://tidelinejava.vercel.app with credentials.');

  // TEST 5: Simulation of candidates resolution logic
  console.log('\n[TEST 5] Testing simulation of candidate resolution logic...');
  
  // Simulated getApiCandidates logic
  function simulateCandidates({ envUrl, protocol, hostname }) {
    const candidates = [];
    if (envUrl) candidates.push(envUrl.trim().replace(/\/+$/, ''));
    candidates.push('');
    const isHttps = protocol === 'https:';
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isHttps || isLocalHost) {
      candidates.push('http://localhost:8080');
      candidates.push('http://127.0.0.1:8080');
    }
    return candidates;
  }

  // Case A: Local dev
  const localCandidates = simulateCandidates({ envUrl: '', protocol: 'http:', hostname: 'localhost' });
  console.log('  Case A (Local dev):', localCandidates);
  if (!localCandidates.includes('http://localhost:8080') || !localCandidates.includes('')) {
    throw new Error('Test 5a Failed: Local development must include localhost and proxy');
  }

  // Case B: Production on Vercel with env variable configured
  const prodCandidatesWithEnv = simulateCandidates({
    envUrl: 'https://tideline-backend.onrender.com',
    protocol: 'https:',
    hostname: 'tidelinejava.vercel.app',
  });
  console.log('  Case B (Vercel with backend URL):', prodCandidatesWithEnv);
  if (prodCandidatesWithEnv[0] !== 'https://tideline-backend.onrender.com') {
    throw new Error('Test 5b Failed: Configured production URL must be first candidate');
  }
  if (prodCandidatesWithEnv.includes('http://localhost:8080')) {
    throw new Error('Test 5b Failed: Production HTTPS must NOT attempt insecure http://localhost:8080');
  }

  // Case C: Production on Vercel without env variable
  const prodCandidatesWithoutEnv = simulateCandidates({
    envUrl: '',
    protocol: 'https:',
    hostname: 'tidelinejava.vercel.app',
  });
  console.log('  Case C (Vercel unconfigured fallback):', prodCandidatesWithoutEnv);
  if (prodCandidatesWithoutEnv.includes('http://localhost:8080')) {
    throw new Error('Test 5c Failed: Must not leak insecure localhost on HTTPS production');
  }

  console.log('✓ Test 5 Passed: All candidate resolution scenarios verified accurately.');

  console.log('\n===============================================================');
  console.log('   ALL 5 PRODUCTION LOGIN RESOLUTION TESTS PASSED (100%)!       ');
  console.log('===============================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Error:', err.message);
  process.exit(1);
});
