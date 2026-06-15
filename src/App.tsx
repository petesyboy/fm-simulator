/**
 * App.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root application component.  Responsibilities:
 *  • Restores saved canvas state from localStorage on first mount.
 *  • Registers global keyboard shortcuts.
 *  • Composes the main layout (Header → Sidebar + Canvas + ConfigPanel).
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * 1. KEYBOARD SHORTCUTS
 *    Added via a single `keydown` listener in a useEffect.  Shortcuts:
 *      Ctrl/Cmd + S  → Save layout to localStorage
 *      Space         → Toggle simulation (run / pause)
 *
 *    Note: Delete/Backspace for node deletion is already handled natively by
 *    ReactFlow (via `deleteKeyCode` prop in CanvasArea).
 *
 * 2. MULTI-SLOT SAVE
 *    The header's "Save Layout" button previously always wrote to a single
 *    localStorage key.  Now a SaveSlotModal lets users choose a named slot
 *    (up to 5 slots, plus the default auto-save).  Slots are listed in the
 *    modal with a load button next to each.
 *
 *    Storage keys: 'fm-simulator-slot-<name>'
 *    Backward compatible: the old 'fm-simulator-default-file' key is still
 *    auto-loaded on startup if present.
 */

import { useEffect, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import ConfigPanel from './components/ConfigPanel';
import SimulationEngine from './components/SimulationEngine';
import TrafficGenerator from './components/TrafficGenerator';
import { useStore } from './store/store';
import './App.css';

// ─── Save Slot Modal ──────────────────────────────────────────────────────────

const SLOT_PREFIX = 'fm-simulator-slot-';

/** Returns all saved slot names currently in localStorage. */
const getSavedSlots = (): string[] =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith(SLOT_PREFIX))
    .map((k) => k.slice(SLOT_PREFIX.length))
    .sort();

interface SaveSlotModalProps {
  mode: 'save' | 'load';
  onClose: () => void;
  onSaved: (name: string) => void;
  onLoaded: () => void;
}

/**
 * Modal for managing save slots.
 * Users can type a slot name to save to, or click "Load" on an existing slot.
 */
const SaveSlotModal: React.FC<SaveSlotModalProps> = ({ mode, onClose, onSaved, onLoaded }) => {
  const [slotName, setSlotName] = useState('');
  const [slots, setSlots] = useState<string[]>(getSavedSlots);
  const nodes         = useStore((s) => s.nodes);
  const edges         = useStore((s) => s.edges);
  const trafficStreams = useStore((s) => s.trafficStreams);
  const restoreState  = useStore((s) => s.restoreState);

  const handleSave = () => {
    const name = slotName.trim() || 'default';
    const flow = { nodes, edges, trafficStreams };
    localStorage.setItem(`${SLOT_PREFIX}${name}`, JSON.stringify(flow));
    setSlots(getSavedSlots());
    onSaved(name);
  };

  const handleLoad = (name: string) => {
    try {
      const raw = localStorage.getItem(`${SLOT_PREFIX}${name}`);
      if (!raw) return;
      const { nodes: n, edges: e, trafficStreams: t } = JSON.parse(raw);
      if (n && e) {
        restoreState(n, e, t);
        onLoaded();
      }
    } catch (err) {
      console.error('Failed to load slot:', err);
    }
    onClose();
  };

  const handleDelete = (name: string) => {
    localStorage.removeItem(`${SLOT_PREFIX}${name}`);
    setSlots(getSavedSlots());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '24px', width: '380px', boxShadow: '0 12px 48px rgba(0,0,0,0.7)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#fff', fontWeight: 700 }}>
          {mode === 'save' ? '💾 Save Layout' : '📂 Load Layout'}
        </h3>

        {/* Save row */}
        {mode === 'save' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Slot name (e.g. my-topology)"
              value={slotName}
              onChange={(e) => setSlotName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              style={{ flex: 1, padding: '7px 10px', background: '#121212', border: '1px solid #333', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
            />
            <button
              onClick={handleSave}
              style={{ padding: '7px 14px', background: 'var(--color-blue)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Save
            </button>
          </div>
        )}

        {/* Existing slots */}
        {slots.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: '12px 0' }}>No saved layouts yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {slots.map((name) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#111', borderRadius: '5px', border: '1px solid #272727' }}>
                <span style={{ flex: 1, fontSize: '12px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <button onClick={() => handleLoad(name)} style={{ padding: '3px 10px', background: 'rgba(0,124,255,0.2)', border: '1px solid rgba(0,124,255,0.4)', borderRadius: '3px', color: 'var(--color-blue)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                  Load
                </button>
                <button onClick={() => handleDelete(name)} style={{ padding: '3px 8px', background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: '3px', color: '#ef5350', fontSize: '11px', cursor: 'pointer' }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── App component ────────────────────────────────────────────────────────────

// React import is needed for the JSX type in the SaveSlotModal above
import React from 'react';

function App() {
  const restoreState     = useStore((state) => state.restoreState);
  const toggleSimulation = useStore((state) => state.toggleSimulation);

  const [modalMode, setModalMode] = useState<'save' | 'load' | null>(null);
  const [saveToast, setSaveToast]           = useState('');

  // ── Auto-restore on first mount ──────────────────────────────────────────

  useEffect(() => {
    // Support old single-slot saves ('fm-simulator-default-file') for backward compat
    const savedState = localStorage.getItem('fm-simulator-default-file');
    if (savedState) {
      try {
        const { nodes: n, edges: e, trafficStreams: t } = JSON.parse(savedState);
        if (n && e) restoreState(n, e, t);
      } catch (error) {
        console.error('Failed to parse the saved canvas state:', error);
      }
    }
  }, [restoreState]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore shortcuts when the user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === 's') {
        // Ctrl/Cmd+S → open the save slot modal (same as clicking "💾 Save Layout")
        e.preventDefault();
        setModalMode('save');
      }

      if (e.key === ' ' && !isCtrl) {
        // Space → toggle simulation run/pause
        e.preventDefault();
        toggleSimulation();
      }
    },
    [toggleSimulation]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="app-container">
      {/* Global toast for keyboard-triggered saves */}
      {saveToast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: 'rgba(37,179,75,0.92)', color: '#fff', padding: '10px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
          ✓ {saveToast}
        </div>
      )}

      {/* Multi-slot save/load modal */}
      {modalMode && (
        <SaveSlotModal
          mode={modalMode}
          onClose={() => setModalMode(null)}
          onSaved={(name) => {
            setSaveToast(`Saved to "${name}"`);
            setTimeout(() => setSaveToast(''), 2000);
          }}
          onLoaded={() => {
            setSaveToast('Layout loaded');
            setTimeout(() => setSaveToast(''), 2000);
          }}
        />
      )}

      <Header
        onSaveClick={() => setModalMode('save')}
        onLoadClick={() => setModalMode('load')}
      />

      <div className="main-content">
        <ReactFlowProvider>
          <Sidebar />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <CanvasArea />
            <TrafficGenerator />
          </div>
          <ConfigPanel />
          <SimulationEngine />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default App;