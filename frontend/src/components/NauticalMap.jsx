/**
 * NauticalMap.jsx — Offline Nautical Chart & Tactical Marine Navigation HUD for TIDELINE
 *
 * Implements:
 *  - 100% offline tactical nautical chart using Leaflet
 *  - Procedural Canvas-based tactical bathymetric grid layer
 *  - High-resolution coastal boundaries and bathymetric depth curves (10m, 20m, 50m, 100m)
 *  - Marine navigation aids (lighthouses, fairway buoys, harbour approaches, shoal hazards)
 *  - Live GPS position overlay with pulsing sonar marker, heading needle, and accuracy radius
 *  - Destination waypoint marker & Direct Rhumb Line (cyan dashed) vs Marine Fairway Route (sonar green solid)
 *  - Charted hazard buffer zones (Kallu Shoal, Breakwaters, shallow shelves)
 *  - Authorized staff location sharing radar overlay with active/stale/offline status
 *  - Offline breadcrumb track persistence via IndexedDB
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  COASTAL_POLYGON,
  BATHYMETRY_CONTOURS,
  MARINE_AIDS,
  VIZHINJAM_HARBOUR_ZONE,
  CHARTED_HAZARDS,
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

export default function NauticalMap({
  position,
  status,
  selectedSector,
  destination,
  routePlan,
  staffLocations = [],
  showStaffRadar = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const boatMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const trackPolylineRef = useRef(null);

  // Dynamic Navigation & Route Layers
  const destinationMarkerRef = useRef(null);
  const straightLinePolylineRef = useRef(null);
  const marineRoutePolylineRef = useRef(null);
  const routeWaypointsGroupRef = useRef(null);
  const hazardsLayerGroupRef = useRef(null);
  const staffRadarGroupRef = useRef(null);

  const [activeLayers, setActiveLayers] = useState({
    bathymetry: true,
    aids: true,
    coastal: true,
    hazards: true,
    staffRadar: true,
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
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      tap: true,
    });

    const mapDom = mapContainerRef.current;
    if (mapDom) {
      L.DomEvent.disableScrollPropagation(mapDom);
      L.DomEvent.disableClickPropagation(mapDom);
      // Intercept wheel events so map zooming never scrolls parent document/panels
      const stopPageScroll = (e) => {
        e.stopPropagation();
      };
      mapDom.addEventListener('wheel', stopPageScroll, { passive: true });
      mapDom.addEventListener('touchmove', stopPageScroll, { passive: true });
    }

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

    // 5. Charted Hazards Danger Buffers
    const hazardsGroup = L.layerGroup();
    CHARTED_HAZARDS.forEach((h) => {
      const hazardCircle = L.circle([h.lat, h.lon], {
        radius: h.radiusM,
        color: '#FF4F4F',
        fillColor: '#FF4F4F',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '3, 4',
      });
      hazardCircle.bindPopup(`
        <div class="tactical-popup">
          <div class="popup-title" style="color: #FF6B6B">⚠️ ${h.name}</div>
          <div class="popup-warning" style="margin-top: 6px;">${h.warning}</div>
          <div class="popup-meta" style="margin-top: 4px;">MIN DEPTH SOUNDING: <b>${h.minDepthM} m</b></div>
          <div class="popup-meta">RESTRICTED RADIUS: <b>${h.radiusM} m</b></div>
        </div>
      `, { className: 'tactical-popup-wrapper' });
      hazardsGroup.addLayer(hazardCircle);
    });
    hazardsGroup.addTo(map);
    hazardsLayerGroupRef.current = hazardsGroup;

    // 6. Marine Navigation Aids (Lighthouses, Buoys, Hazards)
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

    // 7. Breadcrumb Track Line
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

    // 8. Dynamic Navigation Groups
    const waypointsGroup = L.layerGroup().addTo(map);
    routeWaypointsGroupRef.current = waypointsGroup;

    const staffGroup = L.layerGroup().addTo(map);
    staffRadarGroupRef.current = staffGroup;

    // 9. Live GPS Vessel Marker
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

    // 10. GNSS Accuracy Circle
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

  // ── Update Destination & Routing Overlays ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 1. Remove previous destination marker and lines
    if (destinationMarkerRef.current) {
      map.removeLayer(destinationMarkerRef.current);
      destinationMarkerRef.current = null;
    }
    if (straightLinePolylineRef.current) {
      map.removeLayer(straightLinePolylineRef.current);
      straightLinePolylineRef.current = null;
    }
    if (marineRoutePolylineRef.current) {
      map.removeLayer(marineRoutePolylineRef.current);
      marineRoutePolylineRef.current = null;
    }
    if (routeWaypointsGroupRef.current) {
      routeWaypointsGroupRef.current.clearLayers();
    }

    if (!destination) return;

    // 2. Add Destination Marker
    const destIcon = L.divIcon({
      className: 'dest-marker-leaflet',
      html: `
        <div class="dest-pin-pulse">
          <span class="dest-beacon-ring"></span>
          <span class="dest-core-flag">🎯</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 28],
    });

    const destMarker = L.marker([destination.lat, destination.lon], {
      icon: destIcon,
      zIndexOffset: 950,
    }).addTo(map);

    destMarker.bindPopup(`
      <div class="tactical-popup">
        <div class="popup-title" style="color: #00E5FF">🎯 ${destination.name}</div>
        <div class="popup-meta">COORDINATES: <b>${destination.lat.toFixed(4)}°N, ${destination.lon.toFixed(4)}°E</b></div>
        <div class="popup-meta">MIN SOUNDING: <b>${destination.minDepthM || '18.0'} m</b></div>
        ${destination.description ? `<div class="popup-note">${destination.description}</div>` : ''}
      </div>
    `, { className: 'tactical-popup-wrapper' });

    destinationMarkerRef.current = destMarker;

    // 3. Render Straight-Line Distance (Rhumb Line) in Cyan Dashed
    const straightLine = L.polyline(
      [[currentLat, currentLon], [destination.lat, destination.lon]],
      {
        color: '#00E5FF',
        weight: 2,
        dashArray: '5, 8',
        opacity: 0.75,
      }
    ).addTo(map);

    straightLine.bindTooltip(
      `Direct Rhumb Line: ${routePlan ? routePlan.straightLineDistanceNm + ' NM' : 'Calculating...'}`,
      { className: 'tactical-tooltip', sticky: true }
    );
    straightLinePolylineRef.current = straightLine;

    // 4. Render Marine Fairway Navigation Route in Solid Sonar Green
    if (routePlan && routePlan.waypoints && routePlan.waypoints.length > 1) {
      const routePoints = routePlan.waypoints.map((wp) => [wp.lat, wp.lon]);
      const routeLine = L.polyline(routePoints, {
        color: routePlan.encounteredHazards?.length > 0 ? '#17D9A3' : '#17D9A3',
        weight: 3.5,
        opacity: 0.9,
      }).addTo(map);

      routeLine.bindTooltip(
        `Marine Route: ${routePlan.marineRouteDistanceNm} NM (Min Depth: ${routePlan.minSoundingM}m)`,
        { className: 'tactical-tooltip', sticky: true }
      );
      marineRoutePolylineRef.current = routeLine;

      // Add waypoint markers along the route
      routePlan.waypoints.forEach((wp, idx) => {
        if (idx === 0 || idx === routePlan.waypoints.length - 1) return; // Skip origin and dest
        const wpIcon = L.divIcon({
          className: 'waypoint-pin-leaflet',
          html: `<div class="route-wp-dot" title="${wp.name}">${idx}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        const wpMarker = L.marker([wp.lat, wp.lon], { icon: wpIcon });
        wpMarker.bindPopup(`
          <div class="tactical-popup">
            <div class="popup-title">WAYPOINT #${idx}: ${wp.name}</div>
            <div class="popup-meta">SOUNDING: <b>${wp.soundingM} m</b></div>
            <div class="popup-meta">LEG DISTANCE: <b>${wp.legDistanceNm} NM</b> · BEARING: <b>${wp.legBearingDeg}°T</b></div>
            <div class="popup-note">${wp.safetyNote}</div>
          </div>
        `, { className: 'tactical-popup-wrapper' });
        routeWaypointsGroupRef.current.addLayer(wpMarker);
      });
    }
  }, [destination, routePlan, currentLat, currentLon, mapReady]);

  // ── Render Authorized Staff Locations (Radar Overlay) ───────────────────
  useEffect(() => {
    if (!mapReady || !staffRadarGroupRef.current) return;
    const group = staffRadarGroupRef.current;
    group.clearLayers();

    if (!showStaffRadar || !activeLayers.staffRadar) return;

    staffLocations.forEach((staff) => {
      if (typeof staff.latitude !== 'number' || typeof staff.longitude !== 'number') return;

      const isLive = staff.freshness === 'ACTIVE';
      const isStale = staff.freshness === 'STALE';
      const color = isLive ? '#17D9A3' : isStale ? '#FFB800' : '#889DAF';

      const staffIcon = L.divIcon({
        className: 'staff-radar-marker',
        html: `
          <div class="staff-blip" style="border-color: ${color}">
            <span class="blip-dot" style="background: ${color}"></span>
            <span class="blip-label" style="color: ${color}">${staff.vesselName || staff.username}</span>
          </div>
        `,
        iconSize: [40, 20],
        iconAnchor: [20, 10],
      });

      const marker = L.marker([staff.latitude, staff.longitude], { icon: staffIcon });
      marker.bindPopup(`
        <div class="tactical-popup">
          <div class="popup-title" style="color: ${color}">⚓ ${staff.fullName || staff.username}</div>
          <div class="popup-meta">VESSEL: <b>${staff.vesselName || 'TIDELINE PATROL'}</b></div>
          <div class="popup-meta">ROLE: <b>${staff.role}</b></div>
          <div class="popup-meta">FRESHNESS: <b style="color: ${color}">${staff.freshness}</b></div>
          <div class="popup-meta">COORDINATES: <b>${staff.latitude.toFixed(4)}°N, ${staff.longitude.toFixed(4)}°E</b></div>
          ${staff.accuracy ? `<div class="popup-meta">GNSS ACCURACY: <b>±${Math.round(staff.accuracy)} m</b></div>` : ''}
          ${staff.speed != null ? `<div class="popup-meta">SPEED: <b>${(staff.speed * 1.94384).toFixed(1)} kn</b></div>` : ''}
          ${staff.heading != null ? `<div class="popup-meta">HEADING: <b>${Math.round(staff.heading)}°</b></div>` : ''}
          <div class="popup-note" style="margin-top: 6px;">Transmitted: ${new Date(staff.sharedAt).toLocaleTimeString()}</div>
        </div>
      `, { className: 'tactical-popup-wrapper' });

      group.addLayer(marker);
    });
  }, [staffLocations, showStaffRadar, activeLayers.staffRadar, mapReady]);

  // ── Zoom or Re-center when Sector Changes ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedSector) return;
    if (selectedSector.bounds) {
      mapInstanceRef.current.fitBounds(selectedSector.bounds, { padding: [20, 20], animate: true });
    }
  }, [selectedSector, mapReady]);

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

  // ── Auto-Resize Observer ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    const ro = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
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
      } else if (layerKey === 'hazards' && hazardsLayerGroupRef.current) {
        next.hazards ? map.addLayer(hazardsLayerGroupRef.current) : map.removeLayer(hazardsLayerGroupRef.current);
      } else if (layerKey === 'staffRadar' && staffRadarGroupRef.current) {
        next.staffRadar ? map.addLayer(staffRadarGroupRef.current) : map.removeLayer(staffRadarGroupRef.current);
      }

      return next;
    });
  }, []);

  return (
    <div className="nautical-map-wrapper">
      {/* Map DOM Mounting Container */}
      <div ref={mapContainerRef} className="nautical-map-canvas" />

      {/* Top Left: Fix Status Badge */}
      <div
        className="map-badge tactical-map-badge"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <span className="status-dot-pulse"></span>
        OFFLINE CHART · {status === 'acquired' ? 'GNSS FIX ACQUIRED' : 'SATELLITE LISTENER ACTIVE'}
        <b>±{position?.accuracy ? Math.round(position.accuracy) : '4.2'} m</b>
      </div>

      {/* Top Right: Tactical HUD Controls */}
      <div
        className="tactical-hud-controls"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
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

      {/* Bottom Controls: Layer Filters */}
      <div
        className="tactical-layer-bar"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`layer-chip ${activeLayers.bathymetry ? 'active' : ''}`}
          onClick={() => toggleLayer('bathymetry')}
        >
          DEPTH (ISOBATHS)
        </button>
        <button
          type="button"
          className={`layer-chip ${activeLayers.hazards ? 'active' : ''}`}
          onClick={() => toggleLayer('hazards')}
        >
          HAZARDS
        </button>
        <button
          type="button"
          className={`layer-chip ${activeLayers.aids ? 'active' : ''}`}
          onClick={() => toggleLayer('aids')}
        >
          NAV BUOYS
        </button>
        <button
          type="button"
          className={`layer-chip ${activeLayers.staffRadar ? 'active' : ''}`}
          onClick={() => toggleLayer('staffRadar')}
        >
          FLEET RADAR ({staffLocations.length})
        </button>
      </div>

      {/* Legend Badge */}
      <div
        className="map-legend tactical-map-legend"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="legend-row">
          <span className="swatch-line" style={{ background: '#00E5FF', borderTop: '2px dashed #00E5FF' }}></span> Direct Rhumb Line
        </div>
        <div className="legend-row">
          <span className="swatch-line" style={{ background: '#17D9A3' }}></span> Marine Fairway Route
        </div>
        <div className="legend-row">
          <span className="swatch-dot amber-dot"></span> Charted Hazard Zone
        </div>
        <div className="legend-row">
          <span className="swatch-dot sonar-dot"></span> Staff Vessel Blip
        </div>
      </div>
    </div>
  );
}
