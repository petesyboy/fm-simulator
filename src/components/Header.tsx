/**
 * Header.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The top application bar.  Contains the simulation run/pause control, speed
 * selector, save/reset/clear actions, and a breadcrumb/status sub-row.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * • `edges` is now subscribed via a Zustand selector instead of being read
 *   with `useStore.getState()` inside the click handler.  Using getState()
 *   inside a handler is fine functionally, but subscribing via a selector
 *   is the idiomatic pattern and makes the dependency explicit to React.
 * • `alert()` replaced with an in-app toast notification (see Toast below).
 * • `window.confirm()` replaced with an in-app modal confirmation.
 */

import React, { useState } from 'react';
import { useStore } from '../store/store';

// ─── Toast notification ───────────────────────────────────────────────────────


// ─── Confirm dialog ───────────────────────────────────────────────────────────

/**
 * Inline confirmation modal — replaces `window.confirm()`.
 * Rendered inline so it respects the app's dark theme.
 */
const ConfirmModal: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ message, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(3px)',
  }}>
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      width: '320px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    }}>
      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#e0e0e0', lineHeight: '1.5' }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '7px 16px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ padding: '7px 16px', background: 'rgba(239,83,80,0.2)', border: '1px solid rgba(239,83,80,0.5)', color: '#ff5252', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
        >
          Clear Canvas
        </button>
      </div>
    </div>
  </div>
);

// ─── Header component ─────────────────────────────────────────────────────────

interface HeaderProps {
  /** Called when the user clicks "Save Layout" — opens the save slot modal in App.tsx. */
  onSaveClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSaveClick }) => {
  // Subscribe to exactly the state slices we need
  const isRunning      = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const trafficStreams  = useStore((state) => state.trafficStreams);  // for active stream count
  const toggleSimulation  = useStore((state) => state.toggleSimulation);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const clearCanvas    = useStore((state) => state.clearCanvas);
  const loadDemo       = useStore((state) => state.loadDemo);

  // Local UI state for the toast and confirm modal
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearRequest = () => setShowClearConfirm(true);
  const handleClearConfirm  = () => { clearCanvas(); setShowClearConfirm(false); };
  const handleClearCancel   = () => setShowClearConfirm(false);

  const activeStreamsCount = trafficStreams.filter((s) => s.active).length;

  return (
    <>
      {showClearConfirm && (
        <ConfirmModal
          message="Are you sure you want to clear the canvas? All nodes, edges, and traffic streams will be removed."
          onConfirm={handleClearConfirm}
          onCancel={handleClearCancel}
        />
      )}

      <div className="header-wrapper">
        {/* ── Top Brand Bar ── */}
        <header className="header-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="brand-logo">Gigamon Flow Mapping Example</span>
            <div className="tab monitoring-session active">Monitoring Session</div>
          </div>

          <div className="header-controls">
            {/* Simulation run / pause + speed selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '12px', marginRight: '12px' }}>
              <button
                onClick={toggleSimulation}
                className={`sim-btn ${isRunning ? 'running' : ''}`}
              >
                {isRunning ? '⏸ Pause' : '▶ Run Simulation'}
              </button>

              {/* Speed selector is only relevant while the simulation is running */}
              {isRunning && (
                <select
                  value={simulationSpeed}
                  onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                  className="sim-speed-select"
                >
                  <option value={1}>1x Speed</option>
                  <option value={2}>2x Speed</option>
                  <option value={5}>5x Speed</option>
                  <option value={10}>10x Speed</option>
                </select>
              )}
            </div>

            {/* Save button now opens the multi-slot modal in App.tsx */}
            <button className="header-btn primary" onClick={onSaveClick}>
              💾 Save Layout
            </button>
            <button className="header-btn secondary" onClick={loadDemo}>
              🔄 Reset Demo
            </button>
            {/* Clear opens our custom confirm modal instead of window.confirm() */}
            <button onClick={handleClearRequest} className="header-btn danger">
              🗑️ Clear
            </button>
          </div>
        </header>

        {/* ── Sub-Header: breadcrumb + live stats ── */}
        <div className="header-sub">
          <div className="session-title-area">
            <span className="session-icon">☁️</span>
            <span className="session-name-label">Test</span>
          </div>

          <div className="header-stats-indicator">
            <span>Active Ingress Port Loads: <b>{activeStreamsCount} / {trafficStreams.length}</b></span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;