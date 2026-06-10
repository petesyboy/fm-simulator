import React from 'react';
import { useStore } from '../store/store';

const Header: React.FC = () => {
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const isRunning = useStore((state) => state.isRunning);
  const toggleSimulation = useStore((state) => state.toggleSimulation);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useStore((state) => state.setSimulationSpeed);
  const trafficStreams = useStore((state) => state.trafficStreams);
  const clearCanvas = useStore((state) => state.clearCanvas);
  const loadDemo = useStore((state) => state.loadDemo);

  const handleSave = () => {
    const flow = { nodes, edges };
    localStorage.setItem('fm-simulator-default-file', JSON.stringify(flow));
    alert('Canvas state saved successfully!');
  };

  const activeStreamsCount = trafficStreams.filter(s => s.active).length;

  return (
    <header className="header">
      <h1>
        <span style={{ fontSize: '24px' }}>⚙️</span> 
        Gigamon Fabric Flow Map Simulator
      </h1>

      <div className="header-controls">
        {/* Simulation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '16px', marginRight: '16px' }}>
          <button
            onClick={toggleSimulation}
            style={{
              background: isRunning 
                ? 'linear-gradient(135deg, #ff9100 0%, #ff6d00 100%)' 
                : 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              fontWeight: 'bold',
              boxShadow: isRunning 
                ? '0 0 10px rgba(255, 145, 0, 0.4)' 
                : '0 0 10px rgba(76, 175, 80, 0.4)'
            }}
          >
            {isRunning ? '⏸ Pause' : '▶ Run Simulation'}
          </button>

          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Speed:</label>
              <select
                value={simulationSpeed}
                onChange={(e) => setSimulationSpeed(Number(e.target.value))}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <option value={1}>1x Speed</option>
                <option value={2}>2x Speed</option>
                <option value={5}>5x Speed</option>
                <option value={10}>10x Speed</option>
              </select>
            </div>
          )}
        </div>

        {/* Info Indicators */}
        <div className="header-stats">
          <div className="header-stats-item">
            Nodes: <span>{nodes.length}</span>
          </div>
          <div className="header-stats-item">
            Ingress Streams: <span>{activeStreamsCount} / {trafficStreams.length}</span>
          </div>
        </div>

        {/* Layout Management Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="primary" onClick={handleSave}>
            💾 Save Layout
          </button>
          <button className="secondary" onClick={loadDemo}>
            🔄 Reset Demo
          </button>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the canvas?')) {
                clearCanvas();
              }
            }}
            style={{
              background: 'rgba(239, 83, 80, 0.1)',
              color: '#ff8a80',
              border: '1px solid rgba(239, 83, 80, 0.2)',
              padding: '8px 12px'
            }}
          >
            🗑️ Clear
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;