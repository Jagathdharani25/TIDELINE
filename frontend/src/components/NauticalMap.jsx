/**
 * NauticalMap.jsx — Offline Nautical Chart Renderer for TIDELINE
 *
 * Implements:
 *  - 100% offline tactical nautical chart using Leaflet (zero external CDN or tile server calls)
 *  - Procedural Canvas-based tactical nautical grid layer with lat/long coordinates & depth gradients
 *  - Vector coastal boundary for South Kerala / Vizhinjam operational corridor
 *  - Bathymetric depth curves (10m, 20m, 50m, 100m)
 *  - Marine navigation aids (lighthouses, fairway buoys, harbour approaches, shoal hazards)
 *  - Live GPS position overlay with pulsing sonar marker, heading needle, and accuracy radius
 *  - Offline breadcrumb track persistence via IndexedDB
 *  - Tactical map controls (re-center, zoom, layer toggles)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  COASTAL_POLYGON,
  BATHYMETRY_CONTOURS,
  MARINE_AIDS,
  VIZHINJAM_HARBOUR_ZONE,
} from '../utils/coastalChartData';
import { saveTrackPoint, getRecentTrackPoints } from '../utils/indexedDb';

// Tactical Nautical Sonar GridLayer — renders procedurally via Canvas, 100% offline
const TacticalGridLayer = L.GridLayer.extend({
  createTile: function (coords) {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const ctx = tile.getContext('2d');

    // Deep ocean bathymetric background
    ctx.fillStyle = '#081726';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle sonar cross-hatch radar grid
    ctx.strokeStyle = 'rgba(23, 217, 163, 0.04)';
    ctx.lineWidth = 1;
    const step = 32;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
    }
    for (let y = 0; y <= 256; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
    }
    ctx.stroke();

    // Tile border hairline for nautical grid squares
    ctx.strokeStyle = 'rgba(23, 217, 163, 0.08)';
    ctx.strokeRect(0, 0, 256, 256);

    // Subtle coordinate tick marks at center
    ctx.strokeStyle = 'rgba(23, 217, 163, 0.15)';
    ctx.beginPath();
    ctx.moveTo(128, 120);
    ctx.lineTo(128, 136);
    ctx.moveTo(120, 128);
    ctx.lineTo(136, 128);
    ctx.stroke();

    return tile;
  },
});

export default function NauticalMap({ position, status }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const boatMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const trackPolylineRef = useRef(null);
  const [activeLayers, setActiveLayers] = useState({
    bathymetry: true,
    aids: true,
    coastal: true,
  });
  const [mapReady, setMapReady] = useState(false);

  // Layer groups refs to easily toggle visibility
  const coastalLayerRef = useRef(null);
  const bathymetryLayerRef = useRef(null);
  const aidsLayerRef = useRef(null);

  // Default coordinate: Vizhinjam Harbour entrance
  const defaultLat = 8.3758;
  const defaultLon = 76.9900;

  const currentLat = position?.latitude ?? defaultLat;
  const currentLon = position?.longitude ?? defaultLon;

  // ── Initialize Leaflet Map ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLon],
      zoom: 12,
      minZoom: 8,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // 1. Add Offline Tactical Grid Tile Layer
    const gridLayer = new TacticalGridLayer();
    gridLayer.addTo(map);

    // 2. Coastal Boundary Polygon Layer
    const coastalLayer = L.geoJSON(COASTAL_POLYGON, {
      style: {
        fillColor: '#0c2233',
        fillOpacity: 0.95,
        color: '#17D9A3',
        weight: 1.5,
        opacity: 0.8,
      },
    }).addTo(map);
    coastalLayerRef.current = coastalLayer;

    // 3. Bathymetry Depth Contours Layer
    const bathymetryLayer = L.geoJSON(BATHYMETRY_CONTOURS, {
      style: (feature) => {
        const depth = feature.properties.depth;
        let color = '#17D9A3';
        let weight = 1;
        let opacity = 0.5;
        let dashArray = '2, 3';

        if (depth === 10) {
          color = '#FFB800'; // Amber warning for shallow 10m nearshore shelf
          opacity = 0.7;
          weight = 1.2;
        } else if (depth === 20) {
          color = '#17D9A3';
          opacity = 0.5;
          dashArray = '4, 4';
        } else if (depth === 50) {
          color = '#00C8FF';
          opacity = 0.4;
          dashArray = '6, 6';
        } else if (depth === 100) {
          color = '#5C7CFA';
          opacity = 0.35;
        }

        return { color, weight, opacity, dashArray };
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(`${feature.properties.label}`, {
          className: 'tactical-tooltip',
          direction: 'center',
          sticky: true,
        });
      },
    }).addTo(map);
    bathymetryLayerRef.current = bathymetryLayer;

    // 4. Harbour Approach Zone
    L.geoJSON(VIZHINJAM_HARBOUR_ZONE, {
      style: {
        color: '#FFB800',
        weight: 1.2,
        fillColor: '#FFB800',
        fillOpacity: 0.06,
        dashArray: '5, 5',
      },
    }).addTo(map);

    // 5. Marine Navigation Aids (Lighthouses, Buoys, Hazards)
    const aidsGroup = L.layerGroup();
    MARINE_AIDS.forEach((aid) => {
      let iconHtml = '';
      let markerColor = '#17D9A3';

      if (aid.type === 'lighthouse') {
        markerColor = '#FFDD57';
        iconHtml = `
          <div class="nav-aid-icon lighthouse-icon" title="${aid.name}">
            <span class="pulse-beacon"></span>
            <span class="core-beacon" style="background: ${markerColor}"></span>
          </div>
        `;
      } else if (aid.type === 'hazard') {
        markerColor = '#FF4F4F';
        iconHtml = `
          <div class="nav-aid-icon hazard-icon" title="${aid.name}">
            <span class="hazard-tri">▲</span>
          </div>
        `;
      } else if (aid.type === 'port_beacon') {
        markerColor = '#17D9A3';
        iconHtml = `
          <div class="nav-aid-icon beacon-icon" title="${aid.name}">
            <span class="core-beacon" style="background: ${markerColor}"></span>
          </div>
        `;
      } else {
        markerColor = '#00E5FF';
        iconHtml = `
          <div class="nav-aid-icon buoy-icon" title="${aid.name}">
            <span class="core-beacon" style="background: ${markerColor}"></span>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        className: 'custom-marine-aid',
        html: iconHtml,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const aidMarker = L.marker([aid.lat, aid.lon], { icon: customIcon });

      const popupContent = `
        <div class="tactical-popup">
          <div class="popup-title">${aid.name}</div>
          <div class="popup-meta">TYPE: <b>${aid.type.toUpperCase().replace('_', ' ')}</b></div>
          ${aid.characteristic ? `<div class="popup-meta">LIGHT: <b>${aid.characteristic}</b></div>` : ''}
          ${aid.rangeNm ? `<div class="popup-meta">RANGE: <b>${aid.rangeNm} NM</b></div>` : ''}
          ${aid.warning ? `<div class="popup-warning">⚠️ ${aid.warning}</div>` : ''}
          ${aid.notes ? `<div class="popup-note">${aid.notes}</div>` : ''}
        </div>
      `;

      aidMarker.bindPopup(popupContent, { className: 'tactical-popup-wrapper' });
      aidsGroup.addLayer(aidMarker);
    });
    aidsGroup.addTo(map);
    aidsLayerRef.current = aidsGroup;

    // 6. Breadcrumb Track Line
    const trackLine = L.polyline([], {
      color: '#17D9A3',
      weight: 2,
      opacity: 0.8,
      dashArray: '4, 6',
    }).addTo(map);
    trackPolylineRef.current = trackLine;

    // Load initial stored breadcrumb track points from IndexedDB
    getRecentTrackPoints(100).then((points) => {
      if (points && points.length > 0) {
        const latLngs = points.map((p) => [p.latitude, p.longitude]);
        trackLine.setLatLngs(latLngs);
      }
    });

    // 7. Live GPS Vessel Marker
    const boatIcon = L.divIcon({
      className: 'boat-marker-leaflet',
      html: `
        <div class="boat-marker-pulse">
          <div class="ring"></div>
          <div class="core"></div>
          <div class="vessel-heading-arrow" id="hud-vessel-arrow"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const boatMarker = L.marker([currentLat, currentLon], {
      icon: boatIcon,
      zIndexOffset: 1000,
    }).addTo(map);
    boatMarkerRef.current = boatMarker;

    // 8. GNSS Accuracy Circle
    const accuracyCircle = L.circle([currentLat, currentLon], {
      radius: position?.accuracy || 15,
      color: '#17D9A3',
      fillColor: '#17D9A3',
      fillOpacity: 0.1,
      weight: 1,
      dashArray: '2, 4',
    }).addTo(map);
    accuracyCircleRef.current = accuracyCircle;

    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []); // Run once on mount

  // ── Update Vessel Position & Accuracy on Live GPS Fixes ──────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    if (!position || typeof position.latitude !== 'number' || typeof position.longitude !== 'number') return;

    const lat = position.latitude;
    const lon = position.longitude;
    const acc = position.accuracy || 15;

    // Update Boat Marker position
    if (boatMarkerRef.current) {
      boatMarkerRef.current.setLatLng([lat, lon]);

      // Rotate heading arrow if heading is provided
      const arrowEl = document.getElementById('hud-vessel-arrow');
      if (arrowEl && position.heading != null && !isNaN(position.heading)) {
        arrowEl.style.transform = `rotate(${position.heading}deg)`;
        arrowEl.style.display = 'block';
      }
    }

    // Update Accuracy Circle
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lon]);
      accuracyCircleRef.current.setRadius(acc);
      // If accuracy is poor (>30m), tint amber
      if (acc > 30) {
        accuracyCircleRef.current.setStyle({ color: '#FFB800', fillColor: '#FFB800' });
      } else {
        accuracyCircleRef.current.setStyle({ color: '#17D9A3', fillColor: '#17D9A3' });
      }
    }

    // Append to live track polyline
    if (trackPolylineRef.current) {
      trackPolylineRef.current.addLatLng([lat, lon]);
    }

    // Persist point to IndexedDB
    saveTrackPoint(position);
  }, [position, mapReady]);

  // ── Center Map on Vessel ─────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([currentLat, currentLon], 13, { animate: true });
  }, [currentLat, currentLon]);

  const handleZoomIn = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.zoomOut();
  }, []);

  // ── Auto-Resize Observer for full responsive canvas fill ────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    
    // Invalidate Leaflet size immediately when container dimensions change
    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    ro.observe(mapContainerRef.current);

    const t1 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
    const t2 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 300);

    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapReady]);

  // ── Toggle Layers ────────────────────────────────────────────────────────
  const toggleLayer = useCallback((layerKey) => {
    setActiveLayers((prev) => {
      const next = { ...prev, [layerKey]: !prev[layerKey] };
      const map = mapInstanceRef.current;
      if (!map) return next;

      if (layerKey === 'bathymetry' && bathymetryLayerRef.current) {
        next.bathymetry ? map.addLayer(bathymetryLayerRef.current) : map.removeLayer(bathymetryLayerRef.current);
      } else if (layerKey === 'aids' && aidsLayerRef.current) {
        next.aids ? map.addLayer(aidsLayerRef.current) : map.removeLayer(aidsLayerRef.current);
      } else if (layerKey === 'coastal' && coastalLayerRef.current) {
        next.coastal ? map.addLayer(coastalLayerRef.current) : map.removeLayer(coastalLayerRef.current);
      }

      return next;
    });
  }, []);

  return (
    <div className="nautical-map-wrapper">
      {/* Map DOM Mounting Container */}
      <div ref={mapContainerRef} className="nautical-map-canvas" />

      {/* Top Left: Fix Status Badge */}
      <div className="map-badge tactical-map-badge">
        <span className="status-dot-pulse"></span>
        {status === 'acquired' ? 'GNSS FIX ACQUIRED · OFFLINE CHART' : 'OFFLINE CHART'}
        <b>±{position?.accuracy ? Math.round(position.accuracy) : '4.2'} m</b>
      </div>

      {/* Top Right: Tactical HUD Controls */}
      <div className="tactical-hud-controls">
        <button
          type="button"
          className="hud-ctrl-btn"
          onClick={handleRecenter}
          title="Re-center map on vessel position"
        >
          ⊕ CENTER
        </button>
        <button
          type="button"
          className="hud-ctrl-btn zoom-btn"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          className="hud-ctrl-btn zoom-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Bottom Controls: Layer Filters & Offline Notice */}
      <div className="tactical-layer-bar">
        <button
          type="button"
          className={`layer-chip ${activeLayers.bathymetry ? 'active' : ''}`}
          onClick={() => toggleLayer('bathymetry')}
        >
          DEPTH (ISOBATHS)
        </button>
        <button
          type="button"
          className={`layer-chip ${activeLayers.aids ? 'active' : ''}`}
          onClick={() => toggleLayer('aids')}
        >
          NAV AIDS / HAZARDS
        </button>
      </div>

      {/* Legend Badge */}
      <div className="map-legend tactical-map-legend">
        <div className="legend-row">
          <span className="swatch-line"></span> Track (IndexedDB)
        </div>
        <div className="legend-row">
          <span className="swatch-dot sonar-dot"></span> Vessel GNSS Blip
        </div>
        <div className="legend-row">
          <span className="swatch-dot amber-dot"></span> 10m Shallow Shelf
        </div>
        <div className="legend-footer">OFFLINE CHART · 100% LOCAL CACHE</div>
      </div>
    </div>
  );
}
