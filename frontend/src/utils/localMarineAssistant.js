/**
 * localMarineAssistant.js — Real Local AI Assistant Engine for TIDELINE.
 *
 * CORE PRINCIPLES:
 * 1. 100% Local & Offline — interacts only with on-board Ollama local LLM runtime
 *    and verified local storage (IndexedDB + SQLite).
 * 2. Strict Grounding — answers vessel questions strictly from verified data:
 *     - Hardware GPS position & telemetry
 *     - Voyage logs
 *     - Maintenance & equipment status
 *     - Emergency distress events & transmission status
 *     - Offline emergency response guides
 *     - Cached nautical charts & aids
 * 3. ZERO Hallucination Mandate — must NOT invent coordinates, vessel telemetry,
 *    unconfirmed emergency transmissions, or live weather/sea state.
 * 4. Clear Distinction — clearly distinguishes stored TIDELINE verified data
 *    from general AI/maritime knowledge.
 * 5. Robust Fallback — if Ollama is not running, deterministic verified data is returned
 *    with a clear notification explaining how to launch Ollama.
 */

import {
  getVerifiedGpsFix,
  getVerifiedVoyageLogs,
  getVerifiedMaintenanceRecords,
  getVerifiedEmergencyRecords,
  getVerifiedVesselInfo,
  getVerifiedOfflineGuides,
  getVerifiedCachedMapData,
  getAllVerifiedContext,
} from './verifiedMarineDataService.js';

const FALLBACK_MESSAGE = 'Verified data is unavailable.';
const DEFAULT_MODEL = 'llama3.2:1b';
const BACKEND_API = 'http://localhost:8080/api/assistant';
const OLLAMA_DIRECT = 'http://localhost:11434';

/**
 * Formats coordinates for nautical display.
 */
function formatCoord(deg, posDir, negDir) {
  if (deg == null || isNaN(deg)) return '—';
  const dir = deg >= 0 ? posDir : negDir;
  const abs = Math.abs(deg);
  const pad = abs < 10 ? '0' : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

/**
 * Checks the status of the local LLM runtime (Ollama) either via Spring Boot
 * backend or direct to Ollama on localhost:11434.
 *
 * @returns {Promise<{ status: 'ONLINE'|'UNAVAILABLE', runtime: string, model: string, availableModels: string[], backendOnline: boolean }>}
 */
export async function checkLocalModelStatus() {
  // 1. Try checking via Spring Boot backend
  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`${BACKEND_API}/status`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          status: data.status || 'UNAVAILABLE',
          runtime: data.runtime || 'Ollama',
          model: data.model || DEFAULT_MODEL,
          availableModels: data.availableModels || [],
          endpoint: data.endpoint || OLLAMA_DIRECT,
          backendOnline: true,
          message: data.message,
        };
      }
    }
  } catch {
    // Backend unavailable or timed out; try direct Ollama
  }

  // 2. Direct browser-to-Ollama check
  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`${OLLAMA_DIRECT}/api/tags`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m) => m.name).filter(Boolean);
        return {
          status: 'ONLINE',
          runtime: 'Ollama',
          model: DEFAULT_MODEL,
          availableModels: models,
          endpoint: OLLAMA_DIRECT,
          backendOnline: false,
          message: 'Direct local LLM runtime connected at ' + OLLAMA_DIRECT,
        };
      }
    }
  } catch {
    // Both offline
  }

  return {
    status: 'UNAVAILABLE',
    runtime: 'Ollama',
    model: DEFAULT_MODEL,
    availableModels: [],
    endpoint: OLLAMA_DIRECT,
    backendOnline: false,
    message: 'Local LLM runtime is unavailable. Start Ollama with: ollama run ' + DEFAULT_MODEL,
  };
}

/**
 * Builds a prompt for direct client-side Ollama invocation if backend is down.
 */
function buildDirectOllamaPrompt(userQuery, context) {
  let ctxStr = '=== VERIFIED TIDELINE ON-BOARD DATA ===\n';
  if (context.gps) {
    ctxStr += `• GPS: Lat ${context.gps.latitude}, Lon ${context.gps.longitude}, Speed ${context.gps.speed || 0}, Hdg ${context.gps.heading || 0}, Source: ${context.gps.source}\n`;
  }
  if (context.voyages && context.voyages.length > 0) {
    ctxStr += `• VOYAGES (${context.voyages.length} logged): ` + context.voyages.slice(-3).map(v => `${v.voyageDate}: ${v.departure} -> ${v.destination}`).join('; ') + '\n';
  }
  if (context.maintenance && context.maintenance.length > 0) {
    ctxStr += `• MAINTENANCE (${context.maintenance.length} records): ` + context.maintenance.slice(-3).map(m => `${m.equipment}: ${m.status}`).join('; ') + '\n';
  }
  if (context.emergencies && context.emergencies.length > 0) {
    ctxStr += `• DISTRESS EVENTS (${context.emergencies.length} logged): ` + context.emergencies.map(e => `${e.emergencyType} (${e.status})`).join('; ') + '\n';
  }
  ctxStr += '• GUIDES: 01 Man Overboard (MOB), 02 Engine Fire, 03 Visual Signals, 04 First Aid, 05 Storm Protocol\n';
  ctxStr += '• CACHED CHARTS: Vizhinjam Lighthouse, Fairway Buoy, South Breakwater Light, Kovalam Beacon, Kallu Shoal Hazard\n';
  ctxStr += '=======================================\n';

  return `You are TIDELINE Local Marine AI Assistant aboard a vessel. Answer 100% offline.
DIRECTIVES:
1. Ground vessel queries strictly in the verified on-board data above.
2. Never invent GPS coordinates, voyage dates, or false emergency transmission statuses.
3. If vessel data is not in context, say: "Verified data is unavailable."
4. Clearly distinguish [VERIFIED TIDELINE DATA] from [GENERAL MARITIME KNOWLEDGE].
5. Answer general seamanship, navigation rules, and marine engineering questions accurately using your knowledge.

${ctxStr}

QUESTION: ${userQuery}
ANSWER:`;
}

/**
 * Deterministic verified data resolver (runs entirely in browser).
 */
async function resolveDeterministicQuery(queryLower, context) {
  // A. GPS Telemetry
  const gpsKeywords = ['gps', 'position', 'coordinate', 'coordinates', 'location', 'where are we', 'where am i', 'lat', 'lon', 'latitude', 'longitude', 'heading', 'speed'];
  if (gpsKeywords.some(kw => queryLower.includes(kw))) {
    const fix = context.gps || await getVerifiedGpsFix();
    if (!fix || typeof fix.latitude !== 'number' || typeof fix.longitude !== 'number') {
      return {
        answer: `${FALLBACK_MESSAGE} No verified GNSS fix has been acquired by the device's hardware receiver. Coordinates will not be fabricated.`,
        intent: 'GPS_TELEMETRY',
        verifiedSource: null,
        grounded: true,
      };
    }

    const latStr = formatCoord(fix.latitude, 'N', 'S');
    const lonStr = formatCoord(fix.longitude, 'E', 'W');
    const accStr = fix.accuracy ? `±${Math.round(fix.accuracy)} m` : 'Unspecified';
    const speedKnots = fix.speed != null ? `${(fix.speed * 1.94384).toFixed(1)} kn` : '0.0 kn';
    const headingStr = fix.heading != null ? `${Math.round(fix.heading)}°` : 'Stationary / Unspecified';
    const timeStr = fix.isoTime ? fix.isoTime.replace('T', ' ').slice(0, 19) + ' UTC' : 'Recorded fix';

    return {
      answer: `● [VERIFIED TIDELINE DATA] HARDWARE GPS FIX:\n• Position: ${latStr}, ${lonStr}\n• Accuracy: ${accStr}\n• Speed: ${speedKnots}\n• Heading: ${headingStr}\n• Source: ${fix.source || 'DEVICE_HARDWARE_GNSS'}\n• Recorded: ${timeStr}`,
      intent: 'GPS_TELEMETRY',
      verifiedSource: fix.source || 'DEVICE_HARDWARE_GNSS',
      grounded: true,
    };
  }

  // B. Voyage Logs
  const voyageKeywords = ['voyage', 'voyages', 'log', 'logs', 'departure', 'destination', 'trip', 'trips', 'route', 'journey'];
  if (voyageKeywords.some(kw => queryLower.includes(kw))) {
    const voyages = context.voyages || await getVerifiedVoyageLogs();
    if (!voyages || voyages.length === 0) {
      return {
        answer: `${FALLBACK_MESSAGE} No voyage logs are currently recorded in verified local storage.`,
        intent: 'VOYAGE_LOGS',
        verifiedSource: null,
        grounded: true,
      };
    }
    const recent = voyages.slice(-3).reverse();
    const formatted = recent
      .map((v, i) => `[${i + 1}] ${v.voyageDate || 'Date N/A'} · ${v.departure || 'Departure'} ➔ ${v.destination || 'Destination'} (Vessel: ${v.vesselName || 'TIDELINE'}) ${v.notes ? `\n    Notes: "${v.notes}"` : ''}`)
      .join('\n');

    return {
      answer: `● [VERIFIED TIDELINE DATA] VOYAGE LOGS (${voyages.length} total logged):\n${formatted}`,
      intent: 'VOYAGE_LOGS',
      verifiedSource: 'VERIFIED_VOYAGE_DB',
      grounded: true,
    };
  }

  // C. Maintenance & Equipment
  const maintenanceKeywords = ['maintenance', 'equipment', 'engine', 'pump', 'battery', 'gear', 'service', 'inspection', 'repair'];
  if (maintenanceKeywords.some(kw => queryLower.includes(kw))) {
    const records = context.maintenance || await getVerifiedMaintenanceRecords();
    if (!records || records.length === 0) {
      return {
        answer: `${FALLBACK_MESSAGE} No equipment maintenance records are currently saved in verified local storage.`,
        intent: 'MAINTENANCE_RECORDS',
        verifiedSource: null,
        grounded: true,
      };
    }
    const items = records.slice(-4).reverse();
    const formatted = items
      .map((m, i) => `[${i + 1}] ${m.equipment} — Status: ${m.status || 'OK'}\n    Date: ${m.maintenanceDate || 'N/A'}${m.nextServiceDate ? ` · Next due: ${m.nextServiceDate}` : ''}${m.notes ? `\n    Notes: ${m.notes}` : ''}`)
      .join('\n');

    return {
      answer: `● [VERIFIED TIDELINE DATA] MAINTENANCE STATUS (${records.length} records logged):\n${formatted}`,
      intent: 'MAINTENANCE_RECORDS',
      verifiedSource: 'VERIFIED_MAINTENANCE_DB',
      grounded: true,
    };
  }

  // D. Emergency Distress Records
  const emergencyKeywords = ['emergency', 'distress', 'sos', 'incident', 'mayday', 'pan pan', 'signal'];
  if (emergencyKeywords.some(kw => queryLower.includes(kw))) {
    const events = context.emergencies || await getVerifiedEmergencyRecords();
    if (!events || events.length === 0) {
      return {
        answer: `● [VERIFIED TIDELINE DATA] EMERGENCY STATUS: No active emergency distress events recorded in verified local storage. Vessel status nominal.`,
        intent: 'EMERGENCY_RECORDS',
        verifiedSource: 'VERIFIED_EMERGENCY_DB',
        grounded: true,
      };
    }
    const formatted = events.map((e, i) => {
      let txDesc = e.status === 'TRANSMITTED' ? 'VERIFIED TRANSMITTED TO SHORE/SAR' : (e.status === 'PENDING_TRANSMISSION' ? 'PENDING TRANSMISSION (Awaiting link)' : 'LOCAL ONLY');
      const timeStr = e.eventTime ? e.eventTime.slice(0, 19).replace('T', ' ') : 'Time unrecorded';
      return `[${i + 1}] ${e.emergencyType} — ${txDesc}\n    Logged: ${timeStr}\n    Message: "${e.message || 'Distress signal'}"`;
    }).join('\n');

    return {
      answer: `● [VERIFIED TIDELINE DATA] EMERGENCY DISTRESS RECORDS (${events.length} logged):\n${formatted}`,
      intent: 'EMERGENCY_RECORDS',
      verifiedSource: 'VERIFIED_EMERGENCY_DB',
      grounded: true,
    };
  }

  // E. Offline Emergency Guides
  const guideKeywords = ['guide', 'procedure', 'man overboard', 'mob', 'fire', 'flares', 'first aid', 'hypothermia', 'severe weather'];
  if (guideKeywords.some(kw => queryLower.includes(kw))) {
    if (queryLower.includes('mob') || queryLower.includes('man overboard')) {
      return {
        answer: `● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 01: MAN OVERBOARD (MOB) PROCEDURE\n1. Shout "MAN OVERBOARD!" loudly to alert all vessel crew.\n2. Throw a life ring or buoyant marker immediately.\n3. Maintain continuous visual watch on the person.\n4. Record immediate GPS fix timestamp into voyage log.\n5. Execute Williamson turn or Anderson turn back onto initial track.`,
        intent: 'OFFLINE_GUIDES',
        verifiedSource: 'OFFLINE_GUIDES',
        grounded: true,
      };
    }
    if (queryLower.includes('fire')) {
      return {
        answer: `● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 02: ENGINE ROOM FIRE RESPONSE\n1. Cut engine fuel line shut-off valve immediately.\n2. Shut down ventilation and engine air intakes.\n3. Do NOT open the engine enclosure fully (oxygen rush increases fire).\n4. Discharge dry chemical or CO2 extinguisher via dedicated port.\n5. Prepare emergency handheld VHF and visual flares.`,
        intent: 'OFFLINE_GUIDES',
        verifiedSource: 'OFFLINE_GUIDES',
        grounded: true,
      };
    }
    if (queryLower.includes('flares') || queryLower.includes('distress signal') || queryLower.includes('visual')) {
      return {
        answer: `● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 03: VISUAL DISTRESS SIGNALS\n1. Red handheld flares for night or overcast visibility (hold downwind).\n2. Orange smoke canister for daylight sea marker.\n3. SOS flash pattern with flashlight: 3 short, 3 long, 3 short (... --- ...).\n4. Code flags "N" over "C" (November Charlie).\n5. Slow, repeated arm raising and lowering from sides.`,
        intent: 'OFFLINE_GUIDES',
        verifiedSource: 'OFFLINE_GUIDES',
        grounded: true,
      };
    }
    if (queryLower.includes('first aid') || queryLower.includes('hypothermia')) {
      return {
        answer: `● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 04: FIRST AID AT SEA\n1. Severe bleeding: Apply direct continuous pressure with clean sterile dressing.\n2. Hypothermia: Strip off wet attire, wrap in dry blanket/foil sheet, shield from wind.\n3. Fractures: Splint limb above and below joint before moving patient.\n4. Heat exhaustion: Move to shaded deck, provide small sips of drinking water.`,
        intent: 'OFFLINE_GUIDES',
        verifiedSource: 'OFFLINE_GUIDES',
        grounded: true,
      };
    }
    return {
      answer: `● [VERIFIED TIDELINE DATA] OFFLINE SAFETY GUIDES AVAILABLE:\n• Guide 01: Man Overboard Procedure (MOB)\n• Guide 02: Engine Room Fire Response\n• Guide 03: Visual Distress Signals\n• Guide 04: First Aid - Marine Injuries & Hypothermia\n• Guide 05: Severe Weather & Storm Protocol`,
      intent: 'OFFLINE_GUIDES',
      verifiedSource: 'OFFLINE_GUIDES',
      grounded: true,
    };
  }

  // F. Cached Nautical Charts & Hazards
  const mapKeywords = ['map', 'chart', 'hazard', 'lighthouse', 'buoy', 'bathymetry', 'depth', 'shoal', 'vizhinjam', 'harbour', 'reef', 'channel'];
  if (mapKeywords.some(kw => queryLower.includes(kw))) {
    return {
      answer: `● [VERIFIED TIDELINE DATA] CACHED NAUTICAL CHART & AIDS (Vizhinjam Sector):\n• Vizhinjam Main Lighthouse : Lat 8.3833° N, Lon 76.9833° E · Fl(2) W 15s · Range 24 NM\n• Fairway Approach Buoy    : Lat 8.3580° N, Lon 76.9650° E · Iso W 4s\n• Breakwater South Light   : Lat 8.3735° N, Lon 76.9860° E · Q G 1s\n• Kovalam Beacon           : Lat 8.3995° N, Lon 76.9785° E · Fl W 5s · Range 12 NM\n• Kallu Shoal Reef Hazard  : Lat 8.3450° N, Lon 77.0120° E · Submerged granite ridge (<2.1m at LWS)\n• Depth Contours           : 10m Nearshore Shelf, 20m Coastal Trawl Line, 50m Deep Offshore, 100m Shelf Edge\n• Harbour Zone             : Vizhinjam International Deepwater Port Approach`,
      intent: 'CACHED_CHARTS',
      verifiedSource: 'CACHED_CHARTS',
      grounded: true,
    };
  }

  // G. Vessel info
  const vesselKeywords = ['vessel', 'boat', 'ship', 'who are we', 'callsign'];
  if (vesselKeywords.some(kw => queryLower.includes(kw))) {
    const vessel = context.vessel || await getVerifiedVesselInfo();
    return {
      answer: `● [VERIFIED TIDELINE DATA] VESSEL IDENTITY:\n• Vessel Name: ${vessel?.vesselName || 'TIDELINE'}\n• Total Logged Voyages: ${vessel?.totalVoyagesLogged || 0}\n• Total Maintenance Entries: ${vessel?.totalMaintenanceLogs || 0}\n• Operational Status: Commissioned (Offline-First Bridge)`,
      intent: 'VESSEL_INFO',
      verifiedSource: 'VERIFIED_LOCAL_DATA',
      grounded: true,
    };
  }

  return null;
}

/**
 * Main query entry point for the Local Marine Assistant.
 *
 * @param {string} rawQuery - The mariner's natural language question
 * @param {string} [targetModel] - Optional model identifier (defaults to llama3.2:1b)
 * @returns {Promise<{ answer: string, intent: string, source: string, model?: string, verifiedSource: string | null, grounded: boolean, isModelUnavailable?: boolean, timestamp: string }>}
 */
export async function askLocalAssistant(rawQuery, targetModel = DEFAULT_MODEL) {
  const timestamp = new Date().toLocaleTimeString();
  const activeModel = targetModel || DEFAULT_MODEL;

  if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
    return {
      answer: `${FALLBACK_MESSAGE} Please provide a query regarding verified vessel logs, maintenance, emergencies, GPS position, offline guides, or nautical charts.`,
      intent: 'EMPTY',
      source: 'VALIDATION',
      model: activeModel,
      verifiedSource: null,
      grounded: false,
      timestamp,
    };
  }

  const query = rawQuery.trim();
  const queryLower = query.toLowerCase();

  // 1. WEATHER & MARINE CONDITIONS MANDATE (NEVER FABRICATE)
  const weatherRegex = /\b(weather|forecast|forecasts|wave|waves|wind|winds|tide|tides|storm|storms|sea state|rain|rainfall|swell|swells|cyclone|barometer)\b/i;
  if (weatherRegex.test(queryLower)) {
    return {
      answer: `${FALLBACK_MESSAGE} TIDELINE operates fully offline and does not fabricate weather forecasts, wind speeds, or live marine conditions without certified on-board sensor feeds.`,
      intent: 'WEATHER_UNAVAILABLE',
      source: 'VERIFIED_TIDELINE_DATA',
      model: activeModel,
      verifiedSource: 'SAFETY_POLICY',
      grounded: true,
      timestamp,
    };
  }

  // 2. Gather verified on-board data context
  let context = null;
  try {
    context = await getAllVerifiedContext();
  } catch (err) {
    console.warn('Error collecting verified context:', err);
    context = {};
  }

  // 3. Attempt query via Spring Boot /api/assistant/chat (which communicates with Ollama)
  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`${BACKEND_API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query,
          context: {
            gps: context.gps,
            voyages: context.voyages,
            maintenance: context.maintenance,
            emergencies: context.emergencies,
          },
          model: activeModel,
        }),
        signal: AbortSignal.timeout(18000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ONLINE' && data.source && data.source.includes('LOCAL_LLM')) {
          return {
            answer: data.answer,
            intent: data.grounded ? 'GROUNDED_AI_QUERY' : 'GENERAL_AI_QUERY',
            source: data.source,
            model: data.model || activeModel,
            verifiedSource: data.verifiedSource,
            grounded: data.grounded,
            isModelUnavailable: false,
            timestamp,
          };
        }

        // If backend reported model unavailable but provided deterministic verified answer
        if (data.status === 'MODEL_UNAVAILABLE') {
          if (data.grounded && data.answer) {
            return {
              answer: data.answer,
              intent: 'STORED_TIDELINE_DATA',
              source: 'STORED_TIDELINE_DATA',
              model: data.model || activeModel,
              verifiedSource: data.verifiedSource,
              grounded: true,
              isModelUnavailable: true,
              message: data.message,
              timestamp,
            };
          }
          // General question with model unavailable
          return {
            answer: data.answer,
            intent: 'MODEL_UNAVAILABLE',
            source: 'MODEL_UNAVAILABLE',
            model: data.model || activeModel,
            verifiedSource: null,
            grounded: false,
            isModelUnavailable: true,
            message: data.message,
            timestamp,
          };
        }
      }
    }
  } catch {
    // Spring Boot assistant endpoint unreachable or timed out
  }

  // 4. Fallback: Try direct browser-to-Ollama local inference
  try {
    if (typeof fetch !== 'undefined') {
      const prompt = buildDirectOllamaPrompt(query, context);
      const res = await fetch(`${OLLAMA_DIRECT}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel,
          prompt,
          stream: false,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response && data.response.trim().length > 0) {
          return {
            answer: data.response.trim(),
            intent: 'LOCAL_LLM_DIRECT',
            source: `LOCAL_LLM (${activeModel} · Direct Ollama)`,
            model: activeModel,
            verifiedSource: 'VERIFIED_CONTEXT_DIRECT',
            grounded: true,
            isModelUnavailable: false,
            timestamp,
          };
        }
      }
    }
  } catch {
    // Direct Ollama unreachable
  }

  // 5. Deterministic fallback for verified TIDELINE data
  const deterministic = await resolveDeterministicQuery(queryLower, context);
  if (deterministic) {
    return {
      answer: deterministic.answer,
      intent: deterministic.intent,
      source: 'STORED_TIDELINE_DATA',
      model: activeModel,
      verifiedSource: deterministic.verifiedSource,
      grounded: true,
      isModelUnavailable: true,
      timestamp,
    };
  }

  // 6. General query fallback when local LLM is unavailable
  return {
    answer: `● LOCAL AI RUNTIME UNAVAILABLE\n\nTo answer general questions and enable offline generative AI, please launch Ollama on this device:\n  $ ollama run ${activeModel}\n\n● VERIFIED ON-BOARD DATA IS FULLY OPERATIONAL:\nAll on-board TIDELINE vessel data (GPS fix, voyage logs, gear maintenance, emergency distress records, offline emergency guides, and nautical charts) remains 100% accessible offline without Ollama.`,
    intent: 'MODEL_UNAVAILABLE',
    source: 'MODEL_UNAVAILABLE',
    model: activeModel,
    verifiedSource: null,
    grounded: false,
    isModelUnavailable: true,
    timestamp,
  };
}
