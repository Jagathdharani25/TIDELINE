import React, { useState } from 'react';

export default function NewMaintenanceModal({ isOpen, onClose, onAddRecord }) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [vesselName, setVesselName] = useState('TIDELINE-01');
  const [equipment, setEquipment] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState(todayStr);
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [status, setStatus] = useState('OK');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!equipment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddRecord({
        vesselName: vesselName.trim() || 'TIDELINE-01',
        equipment: equipment.trim(),
        maintenanceDate: maintenanceDate || todayStr,
        nextServiceDate: nextServiceDate.trim() || null,
        status: status || 'OK',
        notes: notes.trim(),
      });

      // Reset form
      setEquipment('');
      setNextServiceDate('');
      setStatus('OK');
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Error adding maintenance record:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">New Maintenance Record</div>
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
                placeholder="e.g. TIDELINE-01"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                EQUIPMENT / SERVICE ITEM
              </label>
              <input
                type="text"
                className="modal-input"
                placeholder="e.g. Main Engine Oil, Bilge Pump, Hull"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                  SERVICE DATE
                </label>
                <input
                  type="date"
                  className="modal-input"
                  value={maintenanceDate}
                  onChange={(e) => setMaintenanceDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                  NEXT SERVICE DUE
                </label>
                <input
                  type="date"
                  className="modal-input"
                  value={nextServiceDate}
                  onChange={(e) => setNextServiceDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                STATUS
              </label>
              <select
                className="modal-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  background: 'rgba(8, 24, 38, 0.95)',
                  color: status === 'OK' ? 'var(--sonar)' : status === 'DUE SOON' ? 'var(--amber)' : '#ff8a8a',
                  border: '1px solid var(--hairline)',
                }}
              >
                <option value="OK" style={{ color: '#17D9A3', background: '#081826' }}>OK (Nominal)</option>
                <option value="DUE SOON" style={{ color: '#FFB020', background: '#081826' }}>DUE SOON (Within 40 hrs)</option>
                <option value="OVERDUE" style={{ color: '#FF4F4F', background: '#081826' }}>OVERDUE (Service required)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--sonar)', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: '4px' }}>
                SERVICE NOTES
              </label>
              <input
                type="text"
                className="modal-input"
                placeholder="e.g. 15W-40 oil replaced, filters renewed"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'SAVING...' : 'SAVE RECORD'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
