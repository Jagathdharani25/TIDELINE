import React from 'react';

export default function GuideModal({ guide, onClose }) {
  if (!guide) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span style={{ color: 'var(--amber)', marginRight: '8px', fontFamily: 'IBM Plex Mono' }}>
              {guide.num}
            </span>
            {guide.title}
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close guide">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--sonar)', marginBottom: '10px', fontWeight: 500 }}>
            {guide.subtitle}
          </p>
          <ul>
            {guide.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--hairline)', fontSize: '10px', color: 'var(--fog-dim)' }}>
            ⚠️ Offline Safety Reference: Verified for coastal vessels & artisanal fishermen.
          </div>
        </div>
        <button
          className="modal-btn-primary"
          style={{ marginTop: '16px' }}
          onClick={onClose}
        >
          ACKNOWLEDGE & CLOSE
        </button>
      </div>
    </div>
  );
}
