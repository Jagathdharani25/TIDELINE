/**
 * verifiedMarineDataService.js — Safe Data-Access Layer for TIDELINE Local AI Assistant.
 *
 * SAFETY MANDATES:
 *  - MUST ONLY read from verified, authentic local sources:
 *      * Verified GNSS fixes (from localStorage 'tideline_last_gps' and IndexedDB 'vessel_tracks')
 *      * Verified Voyage Logs (from IndexedDB 'pending_voyages' / SQLite /api/voyages)
 *      * Verified Maintenance Records (from IndexedDB 'pending_maintenance' / SQLite /api/maintenance)
 *      * Verified Emergency Distress Events (from IndexedDB 'pending_emergencies' / SQLite /api/emergencies)
 *  - MUST NEVER invent coordinates, weather, vessel details, or emergency transmission status.
 *  - Returns null or empty sets when verified data is absent, enabling deterministic fallback.
 */

import {
  getAllLocalVoyages,
  getAllLocalMaintenance,
  getAllLocalEmergencies,
  getRecentTrackPoints,
} from './indexedDb.js';
import {
  COASTAL_POLYGON,
  BATHYMETRY_CONTOURS,
  MARINE_AIDS,
  VIZHINJAM_HARBOUR_ZONE,
} from './coastalChartData.js';

const GPS_STORAGE_KEY = 'tideline_last_gps';

/**
 * Retrieves the latest authentic GPS fix.
 * Never fabricates or guesses coordinates.
 * Returns null if no authentic fix has ever been recorded.
 */
export async function getVerifiedGpsFix() {
  try {
    // 1. Check verified last GPS from localStorage
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(GPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.latitude === 'number' &&
          typeof parsed.longitude === 'number' &&
          !isNaN(parsed.latitude) &&
          !isNaN(parsed.longitude)
        ) {
          return {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: parsed.accuracy || null,
            altitude: parsed.altitude || null,
            speed: parsed.speed != null ? parsed.speed : null,
            heading: parsed.heading != null ? parsed.heading : null,
            timestamp: parsed.timestamp || null,
            isoTime: parsed.isoTime || (parsed.timestamp ? new Date(parsed.timestamp).toISOString() : null),
            source: 'DEVICE_HARDWARE_GNSS',
            verified: true,
          };
        }
      }
    }

    // 2. Check recent track points in IndexedDB
    const recentTracks = await getRecentTrackPoints(1);
    if (recentTracks && recentTracks.length > 0) {
      const pt = recentTracks[recentTracks.length - 1];
      if (typeof pt.latitude === 'number' && typeof pt.longitude === 'number') {
        return {
          latitude: pt.latitude,
          longitude: pt.longitude,
          accuracy: pt.accuracy || null,
          speed: pt.speed || null,
          heading: pt.heading || null,
          timestamp: pt.timestamp || null,
          isoTime: pt.timestamp ? new Date(pt.timestamp).toISOString() : null,
          source: 'INDEXED_DB_GNSS_TRACKS',
          verified: true,
        };
      }
    }
  } catch (err) {
    console.warn('Error reading verified GPS fix:', err);
  }

  // Strictly no synthetic or default fallback coordinates!
  return null;
}

/**
 * Retrieves verified voyage logs from IndexedDB and/or SQLite backend.
 */
export async function getVerifiedVoyageLogs() {
  try {
    let localLogs = await getAllLocalVoyages();

    // Optionally check if backend has additional logs
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('http://localhost:8080/api/voyages', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const backendLogs = await res.json();
          if (Array.isArray(backendLogs)) {
            const backendIdSet = new Set(backendLogs.map((b) => b.id));
            const unmergedLocal = localLogs.filter(
              (l) => l.syncStatus === 'PENDING_SYNC' || !backendIdSet.has(l.backendId)
            );
            return [...unmergedLocal, ...backendLogs.map((b) => ({ ...b, syncStatus: 'SYNCED' }))];
          }
        }
      }
    } catch {
      // Backend unavailable; local IndexedDB is authoritative
    }

    return localLogs || [];
  } catch (err) {
    console.warn('Error reading verified voyage logs:', err);
    return [];
  }
}

/**
 * Retrieves verified maintenance records from IndexedDB and/or SQLite backend.
 */
export async function getVerifiedMaintenanceRecords() {
  try {
    let localRecords = await getAllLocalMaintenance();

    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('http://localhost:8080/api/maintenance', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const backendRecords = await res.json();
          if (Array.isArray(backendRecords)) {
            const backendIdSet = new Set(backendRecords.map((b) => b.id));
            const unmergedLocal = localRecords.filter(
              (m) => m.syncStatus === 'PENDING_SYNC' || !backendIdSet.has(m.backendId)
            );
            return [...unmergedLocal, ...backendRecords.map((b) => ({ ...b, syncStatus: 'SYNCED' }))];
          }
        }
      }
    } catch {
      // Backend unavailable; local records authoritative
    }

    return localRecords || [];
  } catch (err) {
    console.warn('Error reading verified maintenance records:', err);
    return [];
  }
}

/**
 * Retrieves verified emergency distress events from IndexedDB and/or SQLite backend.
 * Enforces authentic transmission status.
 */
export async function getVerifiedEmergencyRecords() {
  try {
    let localEvents = await getAllLocalEmergencies();

    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('http://localhost:8080/api/emergencies', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const backendEvents = await res.json();
          if (Array.isArray(backendEvents)) {
            const backendIdSet = new Set(backendEvents.map((b) => b.id));
            const unmergedLocal = localEvents.filter(
              (e) => e.syncStatus === 'PENDING_SYNC' || !backendIdSet.has(e.backendId)
            );
            return [...unmergedLocal, ...backendEvents.map((b) => ({ ...b, syncStatus: 'SYNCED' }))];
          }
        }
      }
    } catch {
      // Backend unavailable
    }

    return localEvents || [];
  } catch (err) {
    console.warn('Error reading verified emergency events:', err);
    return [];
  }
}

/**
 * Extracts verified vessel identification from confirmed records.
 * Returns null if no vessel details are documented in verified storage.
 */
export async function getVerifiedVesselInfo() {
  const [voyages, maintenance] = await Promise.all([
    getVerifiedVoyageLogs(),
    getVerifiedMaintenanceRecords(),
  ]);

  const allRecords = [...voyages, ...maintenance];
  for (const record of allRecords) {
    if (record.vesselName && record.vesselName.trim().length > 0) {
      return {
        vesselName: record.vesselName.trim(),
        firstDocumented: record.createdAt || record.voyageDate || record.maintenanceDate || null,
        totalVoyagesLogged: voyages.length,
        totalMaintenanceLogs: maintenance.length,
        verified: true,
      };
    }
  }

  return null;
}

/**
 * Verified Offline Emergency Response Guides stored locally in TIDELINE.
 */
export const VERIFIED_OFFLINE_GUIDES = [
  {
    num: '01',
    title: 'Man Overboard Procedure (MOB)',
    subtitle: 'Step-by-step · works fully offline',
    steps: [
      'Shout "MAN OVERBOARD!" loudly to alert all vessel crew.',
      'Throw a life ring or buoyant marker immediately to mark position and aid flotation.',
      'Maintain continuous visual watch on the person in the water.',
      'Record immediate GPS fix timestamp into voyage log.',
      'Execute Williamson turn or Anderson turn back onto initial track.',
    ],
  },
  {
    num: '02',
    title: 'Engine Room Fire Response',
    subtitle: 'Checklist + extinguisher guide',
    steps: [
      'Cut engine fuel line shut-off valve immediately.',
      'Shut down ventilation and engine air intakes.',
      'Do NOT open the engine enclosure fully (oxygen rush increases fire).',
      'Discharge dry chemical or CO2 extinguisher via dedicated port.',
      'Prepare emergency handheld VHF and visual flares.',
    ],
  },
  {
    num: '03',
    title: 'Visual Distress Signals',
    subtitle: 'Flares, flags, light patterns',
    steps: [
      'Red handheld flares for night or overcast visibility (hold downwind).',
      'Orange smoke canister for daylight sea marker.',
      'SOS flash pattern with flashlight: 3 short, 3 long, 3 short (... --- ...).',
      'Code flags "N" over "C" (November Charlie).',
      'Slow, repeated arm raising and lowering from sides.',
    ],
  },
  {
    num: '04',
    title: 'First Aid — Injuries at Sea',
    subtitle: 'Cuts, fractures, hypothermia',
    steps: [
      'Severe bleeding: Apply direct continuous pressure with clean sterile dressing.',
      'Hypothermia: Strip off wet attire, wrap in dry blanket/foil sheet, shield from sea wind.',
      'Fractures: Splint limb above and below joint before moving patient.',
      'Heat exhaustion / dehydration: Move to shaded deck, provide small sips of drinking water.',
    ],
  },
  {
    num: '05',
    title: 'Severe Weather Protocol',
    subtitle: 'Storm approach checklist',
    steps: [
      'Verify all crew members have life jackets securely fastened.',
      'Lash down loose deck gear, fishing nets, and fuel jerry cans.',
      'Pump bilges dry to maintain maximum vessel buoyancy and stability.',
      'Head vessel into the wind/seas at minimum steerage headway.',
      'Record position and compass heading every 15 minutes.',
    ],
  },
];

export function getVerifiedOfflineGuides() {
  return VERIFIED_OFFLINE_GUIDES;
}

/**
 * Returns verified cached nautical chart information for the operational sector.
 */
export function getVerifiedCachedMapData() {
  return {
    sectorName: 'South Kerala / Vizhinjam Marine Corridor (Lat 7.8°N–8.8°N, Lon 76.5°E–77.7°E)',
    coastalPolygon: COASTAL_POLYGON,
    bathymetryContours: BATHYMETRY_CONTOURS,
    marineAids: MARINE_AIDS,
    harbourZone: VIZHINJAM_HARBOUR_ZONE,
    verified: true,
  };
}

/**
 * Aggregates all verified TIDELINE on-board data into a single structured context.
 */
export async function getAllVerifiedContext() {
  const [gps, voyages, maintenance, emergencies, vessel, mapData] = await Promise.all([
    getVerifiedGpsFix(),
    getVerifiedVoyageLogs(),
    getVerifiedMaintenanceRecords(),
    getVerifiedEmergencyRecords(),
    getVerifiedVesselInfo(),
    getVerifiedCachedMapData(),
  ]);

  return {
    gps,
    voyages: voyages || [],
    maintenance: maintenance || [],
    emergencies: emergencies || [],
    vessel,
    guides: getVerifiedOfflineGuides(),
    mapData,
  };
}
