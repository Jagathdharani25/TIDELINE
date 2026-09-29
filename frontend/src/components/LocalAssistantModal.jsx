import React, { useState, useEffect, useCallback } from 'react';
import { askLocalAssistant, checkLocalModelStatus } from '../utils/localMarineAssistant';

export default function LocalAssistantModal({ onClose, viewMode = 'handheld' }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [checkingModel, setCheckingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.2:1b');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [history, setHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : false);

  // Monitor online/offline network connectivity (vessel airgap detection)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Probe local LLM runtime status
  const probeModelStatus = useCallback(async () => {
    setCheckingModel(true);
    try {
      const status = await checkLocalModelStatus();
      setModelStatus(status);
      if (status.availableModels && status.availableModels.length > 0) {
        if (!status.availableModels.includes(selectedModel)) {
          setSelectedModel(status.availableModels[0]);
        }
      }
    } catch {
      setModelStatus({ status: 'UNAVAILABLE', runtime: 'Ollama', model: 'llama3.2:1b', availableModels: [] });
    } finally {
      setCheckingModel(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    probeModelStatus();
  }, [probeModelStatus]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const quickPrompts = [
    { label: '📍 Verified GPS', text: 'What is our current verified GPS fix and telemetry?' },
    { label: '📜 Recent Voyages', text: 'What were our recent voyages and routes?' },
    { label: '🛠️ Equipment Status', text: 'What is our equipment and maintenance status?' },
    { label: '🚨 Emergency Records', text: 'Are there any recorded emergency distress events?' },
    { label: '📖 Offline Guides', text: 'What is the Man Overboard (MOB) procedure?' },
    { label: '🗺️ Chart Hazards', text: 'What navigational aids and hazards are near Vizhinjam?' },
    { label: '🚢 Vessel Info', text: 'What is our vessel name and identity?' },
    { label: '💡 General AI Q', text: 'Explain the working principles of a marine diesel fuel injector.' },
    { label: '🌊 Weather Check', text: 'What is tomorrow\'s weather forecast?' },
  ];

  const handleQuery = async (queryText) => {
    const q = queryText || query;
    if (!q || !q.trim()) return;

    setLoading(true);
    try {
      const res = await askLocalAssistant(q, selectedModel);
      const newResult = {
        query: q,
        answer: res.answer,
        intent: res.intent,
        source: res.source,
        model: res.model || selectedModel,
        verifiedSource: res.verifiedSource,
        grounded: res.grounded,
        isModelUnavailable: res.isModelUnavailable,
        timestamp: res.timestamp || new Date().toLocaleTimeString(),
      };
      setResult(newResult);
      setHistory((prev) => [newResult, ...prev.filter((p) => p.query !== q)].slice(0, 8));
    } catch (err) {
      const errResult = {
        query: q,
        answer: 'Verified data is unavailable. Internal query error occurred.',
        intent: 'ERROR',
        source: 'ERROR',
        model: selectedModel,
        verifiedSource: null,
        grounded: false,
        isModelUnavailable: true,
        timestamp: new Date().toLocaleTimeString(),
      };
      setResult(errResult);
      setHistory((prev) => [errResult, ...prev].slice(0, 8));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleQuery(query);
  };

  const isBridge = viewMode === 'bridge';
  const isLlmOnline = modelStatus?.status === 'ONLINE';

  return (
    <div
      className={`modal-backdrop ${isBridge ? 'bridge-assistant-backdrop' : ''}`}
      onClick={onClose}
    >
      <div
        className={`modal-content ${isBridge ? 'bridge-assistant-content' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: isBridge ? 'calc(100vh - 120px)' : '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Local AI Assistant"
      >
        <div className="modal-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--sonar)' }}>⚡</span>
              LOCAL AI ASSISTANT
            </div>
            {/* Live Runtime & Airgap Status Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              {/* Local LLM Runtime Status Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '9.5px',
                  fontFamily: 'IBM Plex Mono',
                  background: isLlmOnline ? 'rgba(23, 217, 163, 0.12)' : 'rgba(255, 176, 32, 0.12)',
                  border: `1px solid ${isLlmOnline ? 'rgba(23, 217, 163, 0.35)' : 'rgba(255, 176, 32, 0.35)'}`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: isLlmOnline ? 'var(--sonar)' : 'var(--amber)',
                }}
              >
                <span>{isLlmOnline ? '●' : '○'}</span>
                <span>
                  {isLlmOnline
                    ? `LOCAL LLM ONLINE (${selectedModel || modelStatus.model} · Ollama)`
                    : 'LOCAL LLM UNAVAILABLE · VERIFIED ENGINE ACTIVE'}
                </span>
                <button
                  type="button"
                  onClick={probeModelStatus}
                  title="Re-check Ollama status"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: '10px',
                  }}
                >
                  {checkingModel ? '⌛' : '↻'}
                </button>
              </div>

              {/* Airgap / Offline Connectivity Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '9.5px',
                  fontFamily: 'IBM Plex Mono',
                  background: !isOnline ? 'rgba(23, 217, 163, 0.12)' : 'rgba(142, 155, 255, 0.12)',
                  border: `1px solid ${!isOnline ? 'rgba(23, 217, 163, 0.35)' : 'rgba(142, 155, 255, 0.35)'}`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: !isOnline ? 'var(--sonar)' : '#8E9BFF',
                }}
              >
                <span>{!isOnline ? '⚓ AIRGAPPED LOCAL' : '🌐 LAN LINK'}</span>
              </div>

              {/* Model Selector Dropdown if multiple models installed */}
              {isLlmOnline && modelStatus?.availableModels && modelStatus.availableModels.length > 1 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--fog-dim)' }}>MODEL:</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{
                      background: 'var(--steel)',
                      border: '1px solid var(--hairline)',
                      color: 'var(--sonar)',
                      fontFamily: 'IBM Plex Mono',
                      fontSize: '9.5px',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {modelStatus.availableModels.map((m) => (
                      <option key={m} value={m} style={{ background: 'var(--navy-deep)', color: 'var(--fog)' }}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <button
            id="btn-close-assistant"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Assistant"
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {/* Grounding Safety Notice */}
          <div
            style={{
              background: 'rgba(8, 24, 38, 0.7)',
              border: '1px solid var(--hairline)',
              borderRadius: '8px',
              padding: '8px 10px',
              fontSize: '11px',
              color: 'var(--fog-dim)',
              lineHeight: 1.4,
              marginBottom: '12px',
            }}
          >
            <b style={{ color: 'var(--fog)' }}>Operational Safety Policy:</b> Strictly grounded in verified logs, GPS fix, emergency guides, and cached charts. Zero hallucination of coordinates or weather. General questions answered via local offline LLM.
          </div>

          {/* Quick Prompts */}
          <div
            style={{
              fontSize: '10px',
              color: 'var(--fog-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '6px',
            }}
          >
            TACTICAL QUICK QUERIES
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(p.text);
                  handleQuery(p.text);
                }}
                style={{
                  background: 'var(--steel)',
                  border: '1px solid var(--hairline)',
                  borderRadius: '6px',
                  color: 'var(--fog)',
                  fontSize: '11px',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  fontFamily: 'IBM Plex Sans',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search/Query Input */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="modal-input"
                style={{ margin: 0, flex: 1 }}
                placeholder="Ask about voyages, GPS, gear, MOB guide, charts, or general marine topics..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                className="modal-btn-primary"
                style={{ width: 'auto', padding: '0 16px', fontSize: '12px' }}
                disabled={loading}
              >
                {loading ? 'QUERYING...' : 'QUERY'}
              </button>
            </div>
          </form>

          {/* Loading State Indicator */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                background: 'var(--navy-deep)',
                borderRadius: '8px',
                border: '1px solid var(--hairline)',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: 'var(--sonar)',
                  animation: 'pulse-sync 1s infinite ease-in-out',
                }}
              />
              <span style={{ fontSize: '11px', fontFamily: 'IBM Plex Mono', color: 'var(--sonar)' }}>
                QUERYING LOCAL AI (OFFLINE INFERENCE)...
              </span>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div
              style={{
                background: 'var(--navy-deep)',
                border: `1px solid ${
                  result.grounded
                    ? 'rgba(23, 217, 163, 0.4)'
                    : result.isModelUnavailable
                    ? 'rgba(255, 176, 32, 0.4)'
                    : 'rgba(142, 155, 255, 0.4)'
                }`,
                borderRadius: '10px',
                padding: '12px',
              }}
            >
              {/* Header Badges */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {/* Category Badge */}
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'IBM Plex Mono',
                      background: result.grounded
                        ? 'rgba(23, 217, 163, 0.15)'
                        : result.isModelUnavailable
                        ? 'rgba(255, 176, 32, 0.15)'
                        : 'rgba(142, 155, 255, 0.15)',
                      color: result.grounded
                        ? 'var(--sonar)'
                        : result.isModelUnavailable
                        ? 'var(--amber)'
                        : '#8E9BFF',
                      border: `1px solid ${
                        result.grounded
                          ? 'rgba(23, 217, 163, 0.3)'
                          : result.isModelUnavailable
                          ? 'rgba(255, 176, 32, 0.3)'
                          : 'rgba(142, 155, 255, 0.3)'
                      }`,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {result.grounded
                      ? '● VERIFIED TIDELINE DATA'
                      : result.isModelUnavailable
                      ? '⚠ MODEL UNAVAILABLE'
                      : '● GENERAL MARITIME AI'}
                  </span>

                  {/* Intent Tag */}
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'IBM Plex Mono',
                      background: 'var(--steel)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      color: 'var(--fog-dim)',
                    }}
                  >
                    {result.intent}
                  </span>
                </div>

                {/* Sourcing Indicator */}
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: 'IBM Plex Mono',
                    color: result.verifiedSource ? 'var(--sonar)' : 'var(--fog-dim)',
                    fontWeight: 600,
                  }}
                >
                  {result.verifiedSource
                    ? `✓ SOURCE: ${result.verifiedSource}`
                    : result.source?.includes('LOCAL_LLM')
                    ? `⚙ ${result.model || 'LLAMA3.2:1B'} (OLLAMA)`
                    : 'OFFLINE ENGINE'}
                </span>
              </div>

              {/* Answer Content */}
              <div
                style={{
                  fontFamily: 'IBM Plex Mono',
                  fontSize: '11px',
                  color: 'var(--fog)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  borderLeft: `3px solid ${
                    result.grounded
                      ? 'var(--sonar)'
                      : result.isModelUnavailable
                      ? 'var(--amber)'
                      : '#8E9BFF'
                  }`,
                }}
              >
                {result.answer}
              </div>

              {/* Offline Setup Tip if Ollama is unavailable */}
              {result.isModelUnavailable && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    background: 'rgba(255, 176, 32, 0.08)',
                    border: '1px dashed rgba(255, 176, 32, 0.3)',
                    borderRadius: '6px',
                    fontSize: '10px',
                    color: 'var(--fog)',
                    lineHeight: 1.4,
                  }}
                >
                  <b style={{ color: 'var(--amber)' }}>💡 Offline AI Tip:</b> To enable generative AI for general questions, run Ollama locally:
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <code
                      style={{
                        fontFamily: 'IBM Plex Mono',
                        background: 'rgba(0,0,0,0.4)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        color: 'var(--sonar)',
                        fontSize: '10.5px',
                        flex: 1,
                        userSelect: 'all',
                      }}
                    >
                      ollama run {selectedModel || 'llama3.2:1b'}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(`ollama run ${selectedModel || 'llama3.2:1b'}`);
                          setCopiedCmd(true);
                          setTimeout(() => setCopiedCmd(false), 2000);
                        }
                      }}
                      style={{
                        background: copiedCmd ? 'var(--sonar)' : 'var(--steel)',
                        color: copiedCmd ? 'var(--navy-deep)' : 'var(--fog)',
                        border: '1px solid var(--hairline)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '9.5px',
                        fontFamily: 'IBM Plex Mono',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {copiedCmd ? '✓ COPIED' : 'COPY'}
                    </button>
                  </div>
                </div>
              )}

              {/* Footer Metadata */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  fontSize: '9px',
                  color: 'var(--fog-dim)',
                  fontFamily: 'IBM Plex Mono',
                }}
              >
                <span>QUERY: "{result.query}"</span>
                <span>{result.timestamp}</span>
              </div>
            </div>
          )}

          {/* Session Query History */}
          {history.length > 1 && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--hairline)', paddingTop: '8px' }}>
              <div
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'IBM Plex Mono',
                  color: 'var(--fog-dim)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                SESSION QUERY LOG ({history.length} QUERIES)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {history.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setResult(item)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: result?.query === item.query ? 'rgba(23, 217, 163, 0.1)' : 'var(--steel)',
                      border: `1px solid ${result?.query === item.query ? 'rgba(23, 217, 163, 0.3)' : 'transparent'}`,
                      fontSize: '10px',
                      color: 'var(--fog)',
                      cursor: 'pointer',
                      fontFamily: 'IBM Plex Sans',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                      {item.query}
                    </span>
                    <span style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', color: 'var(--fog-dim)' }}>
                      {item.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="modal-btn-primary"
          style={{ marginTop: '14px', background: 'var(--steel)' }}
          onClick={onClose}
        >
          CLOSE ASSISTANT
        </button>
      </div>
    </div>
  );
}
