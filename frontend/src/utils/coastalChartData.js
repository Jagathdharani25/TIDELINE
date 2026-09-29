/**
 * coastalChartData.js
 *
 * Embedded Offline Nautical Chart Data for TIDELINE
 * Operational Sector: South-West Coast of India / Vizhinjam Marine Corridor
 * Coverage: Lat 7.8°N – 8.8°N, Lon 76.5°E – 77.7°E
 *
 * Provides:
 *  - High-resolution coastal polygon and shoreline
 *  - Bathymetric depth isobaths (10m, 20m, 50m, 100m)
 *  - Navigational aids (lighthouses, harbour approach buoys, shoal hazards)
 *  - Shipping channel / Fairway boundaries
 */

export const COASTAL_POLYGON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'South Kerala Coastal Mainland', type: 'land' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            // Northern landward boundary
            [76.6800, 8.8000],
            [76.7100, 8.7400], // Varkala cliffs
            [76.7550, 8.6800], // Anjengo
            [76.8100, 8.5900], // Perumathura
            [76.8750, 8.5150], // Veli
            [76.9100, 8.4800], // Shankhumugham
            [76.9400, 8.4350], // Panathura
            [76.9780, 8.4000], // Kovalam Cove
            [76.9880, 8.3750], // Vizhinjam Harbour Point
            [77.0200, 8.3500], // Mulloor
            [77.0680, 8.3150], // Poovar Estuary
            [77.1400, 8.2700], // Pozhiyoor
            [77.2000, 8.2100], // Thengapattanam
            [77.2550, 8.1750], // Colachel Harbour
            [77.3150, 8.1200], // Muttom Headland
            [77.4100, 8.0950], // Manakudy
            [77.5450, 8.0780], // Kanyakumari Cape
            // Inset mainland anchor points
            [77.7000, 8.0780],
            [77.7000, 8.8000],
            [76.6800, 8.8000],
          ]
        ]
      }
    }
  ]
};

export const BATHYMETRY_CONTOURS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { depth: 10, label: '10m Isobath (Nearshore Shelf)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.6900, 8.7900],
          [76.7300, 8.7200],
          [76.8400, 8.5300],
          [76.9450, 8.4050],
          [76.9700, 8.3700],
          [77.0400, 8.3100],
          [77.1600, 8.2400],
          [77.2700, 8.1500],
          [77.3400, 8.1000],
          [77.5300, 8.0600],
        ]
      }
    },
    {
      type: 'Feature',
      properties: { depth: 20, label: '20m Isobath (Coastal Trawl Line)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.6500, 8.7900],
          [76.7000, 8.7000],
          [76.8000, 8.5200],
          [76.9200, 8.3800],
          [76.9400, 8.3500],
          [77.0100, 8.2800],
          [77.1200, 8.2100],
          [77.2300, 8.1200],
          [77.3100, 8.0700],
          [77.5100, 8.0400],
        ]
      }
    },
    {
      type: 'Feature',
      properties: { depth: 50, label: '50m Isobath (Deep Offshore)' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.5500, 8.7900],
          [76.6200, 8.6800],
          [76.7300, 8.4800],
          [76.8400, 8.3200],
          [76.9200, 8.2200],
          [77.0500, 8.1400],
          [77.1800, 8.0600],
          [77.3200, 8.0100],
          [77.4800, 7.9800],
        ]
      }
    },
    {
      type: 'Feature',
      properties: { depth: 100, label: '100m Continental Shelf Edge' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.4500, 8.7800],
          [76.5300, 8.6300],
          [76.6400, 8.4200],
          [76.7600, 8.2400],
          [76.8800, 8.1100],
          [77.0200, 8.0100],
          [77.2000, 7.9200],
          [77.4000, 7.8700],
        ]
      }
    }
  ]
};

export const MARINE_AIDS = [
  {
    id: 'aid-vzh-light',
    name: 'Vizhinjam Main Lighthouse',
    type: 'lighthouse',
    lat: 8.3833,
    lon: 76.9833,
    rangeNm: 24,
    characteristic: 'Fl(2) W 15s',
  },
  {
    id: 'aid-vzh-buoy1',
    name: 'Vizhinjam Fairway Approach Buoy',
    type: 'safe_water_buoy',
    lat: 8.3580,
    lon: 76.9650,
    characteristic: 'Iso W 4s',
  },
  {
    id: 'aid-vzh-breakwater',
    name: 'Breakwater South Head Light',
    type: 'port_beacon',
    lat: 8.3735,
    lon: 76.9860,
    characteristic: 'Q G 1s',
  },
  {
    id: 'aid-kovalam-light',
    name: 'Kovalam Beacon',
    type: 'lighthouse',
    lat: 8.3995,
    lon: 76.9785,
    rangeNm: 12,
    characteristic: 'Fl W 5s',
  },
  {
    id: 'aid-reef-hazard',
    name: 'Kallu Shoal Reef Hazard',
    type: 'hazard',
    lat: 8.3450,
    lon: 77.0120,
    warning: 'Submerged granite ridge (depth <2.1m at LWS)',
  },
  {
    id: 'aid-colachel-light',
    name: 'Colachel Port Light',
    type: 'lighthouse',
    lat: 8.1750,
    lon: 77.2550,
    rangeNm: 16,
    characteristic: 'Fl W 10s',
  },
  {
    id: 'aid-muttom-light',
    name: 'Muttom Point Lighthouse',
    type: 'lighthouse',
    lat: 8.1200,
    lon: 77.3150,
    rangeNm: 22,
    characteristic: 'Fl(3) W 20s',
  },
  {
    id: 'aid-wadge-bank',
    name: 'Wadge Bank Marine Fishery Reserve',
    type: 'reserve',
    lat: 7.9500,
    lon: 77.1200,
    notes: 'Rich artisanal demersal fishing zone',
  }
];

export const VIZHINJAM_HARBOUR_ZONE = {
  type: 'Feature',
  properties: { name: 'Vizhinjam International Deepwater Port Approach' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [76.9550, 8.3850],
        [76.9950, 8.3850],
        [76.9950, 8.3550],
        [76.9550, 8.3550],
        [76.9550, 8.3850],
      ]
    ]
  }
};
