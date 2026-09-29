import React, { useState } from 'react';

export default function NewLogModal({ isOpen, onClose, onAddLog }) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [vesselName, setVesselName] = useState('TIDELINE-01');
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [voyageDate, setVoyageDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!departure.trim() || !destination.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddLog({
        voyageDate: voyageDate || todayStr,
        departure: departure.trim(),
        destination: destination.trim(),
        vesselName: vesselName.trim() || 'TIDELINE-01',
        notes: notes.trim(),
      });

      // Reset form
      setDeparture('');
      setDestination('');
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Error adding voyage log:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New Voyage Log Entry</div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                VESSEL NAME
              </label>
              <input
                type="text"
                className="modal-input"
                placeholder="e.g. TIDELINE-01, SEA-QUEEN"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                  DEPARTURE
                </label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Vizhinjam"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                  DESTINATION
                </label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Sector 4"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                VOYAGE DATE
              </label>
              <input
                type="date"
                className="modal-input"
                value={voyageDate}
                onChange={(e) => setVoyageDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                LOG NOTES & OBSERVATIONS
              </label>
              <textarea
                className="modal-input"
                rows="3"
                placeholder="e.g. Engine RPM nominal, 08.0645°N 76.9820°E, calm seas, fishing gear deployed."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: 'vertical', minHeight: '60px' }}
              />
            </div>

            <div style={{ fontSize: '10px', color: 'var(--fog-dim)', marginTop: '2px' }}>
              💾 Saved to local SQLite database (<span style={{ color: 'var(--sonar)' }}>voyage_logs</span>). Offline-ready.
            </div>
          </div>

          <button
            type="submit"
            className="modal-btn-primary"
            disabled={isSubmitting}
            style={{ marginTop: '16px' }}
          >
            {isSubmitting ? 'RECORDING TO SQLITE...' : 'RECORD IN VOYAGE LOG'}
          </button>
        </form>
      </div>
    </div>
  );
}
