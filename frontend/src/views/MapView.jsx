import React from 'react';
import NauticalMap from '../components/NauticalMap';
import useGpsLocation from '../utils/useGpsLocation';

function formatLat(lat) {
  if (lat == null) return '08.3758° N';
  const dir = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const pad = abs < 10 ? '0' : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatLon(lon) {
  if (lon == null) return '76.9900° E';
  const dir = lon >= 0 ? 'E' : 'W';
  const abs = Math.abs(lon);
  const pad = abs < 100 ? (abs < 10 ? '00' : '0') : '';
  return `${pad}${abs.toFixed(4)}° ${dir}`;
}

function formatSpeed(speedMs) {
  if (speedMs == null || isNaN(speedMs)) return '0.0 kn';
  // Convert m/s to knots: 1 m/s = 1.94384 knots
  const knots = speedMs * 1.94384;
  return `${knots.toFixed(1)} kn`;
}

function formatHeading(headingDeg) {
  if (headingDeg == null || isNaN(headingDeg)) return '—';
  return `${Math.round(headingDeg)}°`;
}

export default function MapView() {
  const { position, status, permission } = useGpsLocation();

  const latDisplay = formatLat(position?.latitude);
  const lonDisplay = formatLon(position?.longitude);
  const speedDisplay = formatSpeed(position?.speed);
  const headingDisplay = formatHeading(position?.heading);

  return (
    <div id="view-map" className="view-map-container">
      <div className="section-eyebrow">OFFLINE CHART · NO INTERNET USED</div>

      <div className="map-canvas map-canvas-container">
        <NauticalMap position={position} status={status} />
      </div>

      <div className="coord-strip">
        <div className="coord-box">
          <div className="k">LATITUDE</div>
          <div className="v">{latDisplay}</div>
        </div>
        <div className="coord-box">
          <div className="k">LONGITUDE</div>
          <div className="v">{lonDisplay}</div>
        </div>
      </div>

      <div className="coord-strip">
        <div className="coord-box">
          <div className="k">SPEED</div>
          <div className="v">{speedDisplay}</div>
        </div>
        <div className="coord-box">
          <div className="k">HEADING</div>
          <div className="v">{headingDisplay}</div>
        </div>
      </div>

      <div className="legend-caption">
        <div className="k">
          <span className="swatch" style={{ background: '#17D9A3' }}></span>
          {status === 'acquired' ? 'GNSS Hardware Fix' : 'GPS Satellite Listener Active'}
        </div>
        <div className="k">
          <span className="swatch" style={{ background: '#00E5FF' }}></span>
          100% Offline Marine Cache
        </div>
      </div>
    </div>
  );
}
