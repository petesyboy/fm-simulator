import React, { useState } from 'react';
import { useStore, type MapCondition } from '../store/store';

const ConfigPanel: React.FC = () => {
  const selectedNodeId = useStore((state) => state.selectedNodeId);
  const nodes = useStore((state) => state.nodes);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const nodeMetrics = useStore((state) => state.nodeMetrics);
  const isRunning = useStore((state) => state.isRunning);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [prevSelectedNodeId, setPrevSelectedNodeId] = useState<string | null>(null);

  if (selectedNodeId !== prevSelectedNodeId) {
    setPrevSelectedNodeId(selectedNodeId);
    if (selectedNodeId) {
      setIsCollapsed(false);
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Helper to format Mbps
  const formatBandwidth = (bps: number | undefined): string => {
    if (bps === undefined) return '0 Mbps';
    if (bps >= 1000) {
      return `${(bps / 1000).toFixed(2)} Gbps`;
    }
    return `${bps.toFixed(1)} Mbps`;
  };

  // Helper to format Packets
  const formatPackets = (pps: number | undefined): string => {
    if (pps === undefined) return '0 pps';
    if (pps >= 1000000) {
      return `${(pps / 1000000).toFixed(1)} Mpps`;
    }
    if (pps >= 1000) {
      return `${(pps / 1000).toFixed(1)} kpps`;
    }
    return `${pps.toFixed(0)} pps`;
  };

  // Calculate global stats when no node is selected
  const getGlobalStats = () => {
    let totalIngest = 0;
    let totalEgress = 0;

    nodes.forEach((n) => {
      const metric = nodeMetrics[n.id];
      if (!metric) return;
      if (n.type === 'inputNode') {
        totalIngest += metric.txBps;
      }
      if (n.type === 'toolNode') {
        totalEgress += metric.rxBps;
      }
    });

    return { totalIngest, totalEgress };
  };

  const globalStats = getGlobalStats();

  // If no node is selected, render Dashboard & Statistics
  if (!selectedNodeId || !selectedNode) {
    const totalInput = globalStats.totalIngest;
    const totalDelivery = globalStats.totalEgress;
    const reductionRaw = Math.max(0, totalInput - totalDelivery);
    const reductionPercent = totalInput > 0 ? (reductionRaw / totalInput) * 100 : 0;

    const totalInputPackets = totalInput * 250;
    const totalDeliveryPackets = totalDelivery * 250;
    const reductionPackets = reductionRaw * 250;

    return (
      <aside
        className={`config-panel ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          width: isCollapsed ? '0px' : '320px',
          padding: '0px',
          borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
          position: 'relative',
          overflow: 'visible',
          transition: 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
          flexShrink: 0
        }}
      >
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="config-panel-toggle"
          title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
          style={{
            position: 'absolute',
            top: '50%',
            left: '-20px',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '48px',
            backgroundColor: '#161616',
            border: '1px solid var(--border-color)',
            borderRight: 'none',
            borderRadius: '6px 0 0 6px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            fontSize: '10px',
          }}
        >
          {isCollapsed ? '◀' : '▶'}
        </button>

        {!isCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '320px', height: '100%', padding: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div>
              <h2 style={{ fontSize: '13px', margin: 0, paddingBottom: '8px' }}>Global Pipeline Dashboard</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Real-time visibility into the entire network visibility fabric.
              </p>
            </div>

            {isRunning ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pipeline Flow Statistics
                </h3>
                
                {/* 1. Total Input Card */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(0, 124, 255, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(0, 124, 255, 0.15)',
                  borderLeft: '4px solid var(--color-input)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Ingest Traffic
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
                    {formatBandwidth(totalInput)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {formatPackets(totalInputPackets)} packet rate
                  </div>
                </div>

                {/* 2. Reduction due to Filters Card */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255, 145, 0, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 145, 0, 0.15)',
                  borderLeft: '4px solid var(--color-orange)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Traffic Volume Reduction
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-orange)', fontFamily: 'monospace' }}>
                      {reductionPercent.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      ({formatBandwidth(reductionRaw)} saved)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    Filtered: {formatPackets(reductionPackets)} packet reduction
                  </div>
                  
                  {/* Visual Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginTop: '6px'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${reductionPercent}%`,
                      background: 'linear-gradient(90deg, #ff9100 0%, #ff5d00 100%)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>

                {/* 3. Delivery to Tools Card */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(37, 179, 75, 0.03)',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 179, 75, 0.15)',
                  borderLeft: '4px solid var(--color-tool)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Delivered to Tools
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
                    {formatBandwidth(totalDelivery)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {formatPackets(totalDeliveryPackets)} packet rate
                  </div>
                </div>

                {/* Additional Insight Banner */}
                <div style={{
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                  marginTop: '10px'
                }}>
                  💡 <b>Security Optimization Tip:</b>
                  <p style={{ margin: '4px 0 0 0' }}>
                    Filtering out non-malicious duplicate and background protocol traffic before sending it to analysis tools reduces tool CPU utilization and prevents packet drops at high traffic volumes.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.01)',
                borderRadius: '6px',
                border: '1px dashed var(--border-color)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                lineHeight: '1.5',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px'
              }}>
                <span style={{ fontSize: '24px', marginBottom: '8px' }}>📊</span>
                <b>Simulation Offline</b>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Start the simulation in the top header to inject traffic and view real-time pipeline analytics.
                </span>
              </div>
            )}
          </div>
        )}
      </aside>
    );
  }

  // Selected node values
  const configType = (selectedNode.data?.configType as string) || (selectedNode.data?.label as string);
  const selectedNodeMetric = nodeMetrics[selectedNode.id];

  const mapCriteria = [
    { key: 'vlan', label: 'VLAN ID', placeholder: 'e.g. 100' },
    { key: 'protocol', label: 'IP Protocol', placeholder: 'e.g. tcp, udp, icmp' },
    { key: 'portdst', label: 'Destination Port', placeholder: 'e.g. 80, 443' },
    { key: 'portsrc', label: 'Source Port', placeholder: 'e.g. 1024..65535' },
    { key: 'ipdst', label: 'Destination IPv4', placeholder: 'e.g. 192.168.1.0/24' },
    { key: 'ipsrc', label: 'Source IPv4', placeholder: 'e.g. 10.0.0.5' },
    { key: 'ipver', label: 'IP Version', placeholder: 'ipv4 or ipv6' },
  ];

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(selectedNodeId, { label: e.target.value });
  };

  const handleGenericChange = (key: string, val: string) => {
    const updates: Record<string, unknown> = { [key]: val };
    if (key === 'actionType' && val === 'Deduplication' && selectedNode?.data?.dedupRate === undefined) {
      updates.dedupRate = Math.floor(Math.random() * 41) + 10;
      updates.lastDedupUpdate = Date.now();
    }
    if (key === 'erspanId') {
      updates.erspanId = parseInt(val, 10) || 10;
    }
    if (key === 'configType' && selectedNode?.type === 'inputNode') {
      const oldLabel = String(selectedNode.data?.label || '');
      const match = oldLabel.match(/(?:x|Tunnel\s+)(\d+)/i);
      const portIdx = match ? match[1] : '1';
      
      if (val === 'TAP') {
        updates.label = `TAP Device 1/1/x${portIdx}`;
      } else if (val === 'SPAN') {
        updates.label = `SPAN Port 1/1/x${portIdx}`;
      } else if (val === 'ERSPAN') {
        updates.label = `ERSPAN Tunnel ${portIdx}`;
      }
    }
    updateNodeData(selectedNodeId, updates);
  };

  // Map node condition handlers
  const handleAddCondition = () => {
    const conditions = (selectedNode.data?.conditions as MapCondition[]) || [];
    updateNodeData(selectedNodeId, { conditions: [...conditions, { logic: 'AND', field: 'vlan', value: '', action: 'pass' }] });
  };

  const handleConditionChange = (index: number, key: string, value: string) => {
    const conditions = [...((selectedNode.data?.conditions as MapCondition[]) || [])];
    conditions[index] = { ...conditions[index], [key]: value };
    
    // Default the value when switching field to 'ipver'
    if (key === 'field' && value === 'ipver') {
      if (conditions[index].value !== 'ipv4' && conditions[index].value !== 'ipv6') {
        conditions[index].value = 'ipv4';
      }
    }
    
    updateNodeData(selectedNodeId, { conditions });
  };

  const handleRemoveCondition = (index: number) => {
    const conditions = [...((selectedNode.data?.conditions as MapCondition[]) || [])];
    conditions.splice(index, 1);
    updateNodeData(selectedNodeId, { conditions });
  };

  return (
    <aside
      className={`config-panel ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        width: isCollapsed ? '0px' : '320px',
        padding: '0px',
        borderLeft: isCollapsed ? 'none' : '1px solid var(--border-color)',
        position: 'relative',
        overflow: 'visible',
        transition: 'width 0.3s ease, padding 0.3s ease, border-color 0.3s ease',
        flexShrink: 0
      }}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="config-panel-toggle"
        title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
        style={{
          position: 'absolute',
          top: '50%',
          left: '-20px',
          transform: 'translateY(-50%)',
          width: '20px',
          height: '48px',
          backgroundColor: '#161616',
          border: '1px solid var(--border-color)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          fontSize: '10px',
        }}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>

      {!isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px', height: '100%', padding: '16px', overflowY: 'auto', boxSizing: 'border-box' }}>
          <h2>Edit Node Configuration</h2>
      
      <div className="form-group">
        <label>Node Label</label>
        <input
          type="text"
          value={(selectedNode.data?.label as string) || ''}
          onChange={handleLabelChange}
        />
      </div>

      {/* Port Group specific properties */}
      {selectedNode.type === 'groupNode' && (
        <div style={{ padding: '12px', background: 'rgba(0, 229, 255, 0.05)', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.15)', fontSize: '12px', color: '#00e5ff', marginBottom: '15px' }}>
          📦 <b>Port Group Node</b>
          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            This group represents a Port Group, bundling multiple input ports together. Connecting the output handle of this group to a Traffic Map automatically maps all nested input ports to that map.
          </p>
        </div>
      )}

      {/* SPAN / TAP / ERSPAN Input specific properties */}
      {selectedNode.type === 'inputNode' && (
        <>
          <div className="form-group">
            <label>Input Port Class</label>
            <select
              value={(selectedNode.data?.configType as string) || 'SPAN'}
              onChange={(e) => handleGenericChange('configType', e.target.value)}
            >
              <option value="SPAN">SPAN Port</option>
              <option value="TAP">TAP Hardware Device</option>
              <option value="ERSPAN">ERSPAN Tunnel Source</option>
            </select>
          </div>
          {((selectedNode.data?.configType as string) === 'SPAN') && (
            <div className="form-group">
              <label>Port Speed</label>
              <select
                value={(selectedNode.data?.portSpeed as string) || '10G'}
                onChange={(e) => handleGenericChange('portSpeed', e.target.value)}
              >
                <option value="1G">1 Gbps</option>
                <option value="10G">10 Gbps</option>
                <option value="40G">40 Gbps</option>
                <option value="100G">100 Gbps</option>
              </select>
            </div>
          )}
          {((selectedNode.data?.configType as string) === 'TAP') && (
            <div className="form-group">
              <label>TAP Mode</label>
              <select
                value={(selectedNode.data?.tapMode as string) || 'Passive'}
                onChange={(e) => handleGenericChange('tapMode', e.target.value)}
              >
                <option value="Passive">Passive (Failsafe Optical)</option>
                <option value="Active">Active Bypass (Inline)</option>
              </select>
            </div>
          )}
          {((selectedNode.data?.configType as string) === 'ERSPAN') && (
            <>
              <div className="form-group">
                <label>Tunnel ID (Session ID)</label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  value={(selectedNode.data?.erspanId as number) || 10}
                  onChange={(e) => handleGenericChange('erspanId', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>ERSPAN Source IP</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.10.5"
                  value={(selectedNode.data?.erspanSrcIp as string) || '192.168.10.5'}
                  onChange={(e) => handleGenericChange('erspanSrcIp', e.target.value)}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* VLAN Filter specific properties */}
      {configType === 'VLAN Filter' && (
        <div className="form-group">
          <label>Filter VLAN IDs</label>
          <input
            type="text"
            placeholder="e.g. 100, 200"
            value={(selectedNode.data?.vlanIds as string) || ''}
            onChange={(e) => handleGenericChange('vlanIds', e.target.value)}
          />
        </div>
      )}

      {/* IP Filter specific properties */}
      {configType === 'IP Subnet Filter' && (
        <div className="form-group">
          <label>Filter IP Subnet</label>
          <input
            type="text"
            placeholder="e.g. 192.168.1.0/24"
            value={(selectedNode.data?.ipSubnet as string) || ''}
            onChange={(e) => handleGenericChange('ipSubnet', e.target.value)}
          />
        </div>
      )}

      {/* Port Filter specific properties */}
      {configType === 'Port Filter' && (
        <div className="form-group">
          <label>Filter Destination Ports</label>
          <input
            type="text"
            placeholder="e.g. 80, 443"
            value={(selectedNode.data?.ports as string) || ''}
            onChange={(e) => handleGenericChange('ports', e.target.value)}
          />
        </div>
      )}

      {/* GigaStream Load Balancer specific properties */}
      {selectedNode.type === 'gigaStreamNode' && (
        <div className="form-group">
          <label>Load Balancing Algorithm</label>
          <select
            value={(selectedNode.data?.algorithm as string) || 'Round Robin'}
            onChange={(e) => handleGenericChange('algorithm', e.target.value)}
          >
            <option value="Round Robin">Round Robin (Even Split)</option>
            <option value="L4 Hash">L4 Hash (Five-Tuple hash)</option>
          </select>
        </div>
      )}

      {/* GigaSMART specific properties */}
      {selectedNode.type === 'gigaSmartNode' && (
        <>
          <div className="form-group">
            <label>GigaSMART Engine Operation</label>
            <select
              value={(selectedNode.data?.actionType as string) || 'Deduplication'}
              onChange={(e) => handleGenericChange('actionType', e.target.value)}
            >
              <option value="Application Metadata">Application Metadata</option>
              <option value="Application Visualization">Application Visualization</option>
              <option value="5G-Cloud">5G-Cloud</option>
              <option value="Deduplication">Packet Deduplication</option>
              <option value="GVHTTP2">GVHTTP2</option>
              <option value="Header Stripping">Header Stripping (VXLAN/MPLS)</option>
              <option value="Masking">Masking</option>
              <option value="AMX">AMX</option>
              <option value="Pcapng">Pcapng</option>
              <option value="5G-SBI">5G-SBI</option>
              <option value="Sbipoe">Sbipoe</option>
              <option value="Packet Slicing">Packet Slicing (Truncate Payload)</option>
              <option value="SSL Decrypt">SSL Decrypt</option>
            </select>
          </div>
          {((selectedNode.data?.actionType as string) === 'Application Metadata' || (selectedNode.data?.actionType as string) === 'AMX' || (selectedNode.data?.actionType as string) === 'AMI') && (
            <div className="form-group">
              <label>Output Metadata Format</label>
              <select
                value={(selectedNode.data?.metadataFormat as string) || 'CEF'}
                onChange={(e) => handleGenericChange('metadataFormat', e.target.value)}
              >
                <option value="CEF">CEF (Common Event Format)</option>
                <option value="JSON">JSON format</option>
              </select>
            </div>
          )}
          {((selectedNode.data?.actionType as string) === 'Deduplication' || (selectedNode.data?.actionType as string) === 'Dedup') && (
            <div className="form-group">
              <label>Deduplication Rate</label>
              <div style={{ padding: '8px', background: 'rgba(0, 145, 234, 0.1)', borderRadius: '4px', border: '1px solid rgba(0, 145, 234, 0.2)', fontSize: '13px', fontWeight: 'bold', color: '#00e5ff' }}>
                {selectedNode.data?.dedupRate !== undefined ? `${Math.round(selectedNode.data.dedupRate as number)}%` : 'Initializing...'}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tool Node specific properties */}
      {selectedNode.type === 'toolNode' && (
        <>
          <div className="form-group">
            <label>Tool Class</label>
            <select
              value={(selectedNode.data?.configType as string) || 'Packet Tool'}
              onChange={(e) => handleGenericChange('configType', e.target.value)}
            >
              <option value="Packet Tool">Packet Consuming Tool</option>
              <option value="Metadata Tool">Metadata Consuming Tool</option>
            </select>
          </div>
          {((selectedNode.data?.configType as string) === 'Packet Tool') && (
            <div className="form-group">
              <label>Capture Buffer Size</label>
              <select
                value={(selectedNode.data?.bufferSize as string) || '256MB'}
                onChange={(e) => handleGenericChange('bufferSize', e.target.value)}
              >
                <option value="64MB">64 MB Buffer</option>
                <option value="256MB">256 MB Buffer</option>
                <option value="1GB">1 GB Circular Buffer</option>
              </select>
            </div>
          )}
          {((selectedNode.data?.configType as string) === 'Metadata Tool') && (
            <>
              <div className="form-group">
                <label>Expected Format</label>
                <select
                  value={(selectedNode.data?.expectedFormat as string) || 'CEF'}
                  onChange={(e) => handleGenericChange('expectedFormat', e.target.value)}
                >
                  <option value="CEF">CEF (Common Event Format)</option>
                  <option value="JSON">JSON Format</option>
                  <option value="Any">Any Format (Auto-Detect)</option>
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Traffic Matching Status</label>
            <div style={{
              padding: '8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              background: selectedNode.data?.status === 'warning' ? 'rgba(255, 145, 0, 0.08)' : 'rgba(76, 175, 80, 0.08)',
              border: selectedNode.data?.status === 'warning' ? '1px solid rgba(255, 145, 0, 0.2)' : '1px solid rgba(76, 175, 80, 0.2)',
              color: selectedNode.data?.status === 'warning' ? '#ff9100' : '#4caf50'
            }}>
              {selectedNode.data?.status === 'warning' 
                ? `⚠️ ${selectedNode.data?.statusMessage as string || 'Traffic Mismatch'}`
                : isRunning && selectedNodeMetric && selectedNodeMetric.rxBps > 0
                ? `✓ Receiving matching traffic (${selectedNode.data?.receivedFormat || 'Expected class'})`
                : '✓ Idle (No Traffic)'}
            </div>
          </div>
        </>
      )}

      {/* Traffic Map condition builder */}
      {configType === 'Traffic Map' && (
        <div>
          <h3>Map Criteria (OR-rules list)</h3>
          {((selectedNode.data?.conditions as MapCondition[]) || []).map((condition, index) => (
            <div key={index} className="condition-card">
              <div className="condition-card-row">
                {index > 0 && (
                  <select
                    value={condition.logic}
                    onChange={(e) => handleConditionChange(index, 'logic', e.target.value)}
                    style={{ flex: '0 0 65px', padding: '4px' }}
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                <select
                  value={condition.field}
                  onChange={(e) => handleConditionChange(index, 'field', e.target.value)}
                  style={{ flex: 1, padding: '4px' }}
                >
                  {mapCriteria.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button className="danger" onClick={() => handleRemoveCondition(index)} style={{ padding: '4px 8px' }}>
                  Remove
                </button>
              </div>
              {condition.field === 'ipver' ? (
                <select
                  value={condition.value || 'ipv4'}
                  onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', marginTop: '4px', backgroundColor: '#1a1a1a', border: '1px solid var(--border-color)', borderRadius: '3px', color: 'var(--text-primary)', fontSize: '12px' }}
                >
                  <option value="ipv4">IPv4</option>
                  <option value="ipv6">IPv6</option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={mapCriteria.find(c => c.key === condition.field)?.placeholder || ''}
                  value={condition.value}
                  onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                />
              )}
              <div className="condition-card-row" style={{ marginTop: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: '0 0 45px' }}>Action:</span>
                <select
                  value={condition.action || 'pass'}
                  onChange={(e) => handleConditionChange(index, 'action', e.target.value)}
                  style={{ 
                    flex: 1, 
                    padding: '4px 6px', 
                    fontSize: '11px',
                    backgroundColor: condition.action === 'drop' ? 'rgba(239, 83, 80, 0.15)' : 'rgba(76, 175, 80, 0.15)', 
                    border: condition.action === 'drop' ? '1px solid rgba(239, 83, 80, 0.3)' : '1px solid rgba(76, 175, 80, 0.3)', 
                    color: condition.action === 'drop' ? '#ef5350' : '#4caf50', 
                    fontWeight: 'bold', 
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="pass" style={{ backgroundColor: '#1a1a1a', color: '#4caf50' }}>🟢 PASS</option>
                  <option value="drop" style={{ backgroundColor: '#1a1a1a', color: '#ef5350' }}>🔴 DROP</option>
                </select>
              </div>
            </div>
          ))}
          <button className="secondary" onClick={handleAddCondition} style={{ width: '100%', marginTop: '5px' }}>
            + Add Match Condition
          </button>
        </div>
      )}

      {/* Node Metrics Section */}
      {isRunning && selectedNodeMetric && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
          <h3>Live Node Statistics</h3>
          <div className="form-group" style={{ gap: '8px' }}>
            {selectedNode.type !== 'inputNode' && (
              <div className="metric-badge">
                <span className="label">Rx Throughput:</span>
                <span className="value">{formatBandwidth(selectedNodeMetric.rxBps)}</span>
              </div>
            )}
            {selectedNode.type !== 'inputNode' && (
              <div className="metric-badge">
                <span className="label">Rx Packet Rate:</span>
                <span className="value">{formatPackets(selectedNodeMetric.rxPackets)}</span>
              </div>
            )}
            {selectedNode.type !== 'toolNode' && (
              <div className="metric-badge">
                <span className="label">Tx Throughput:</span>
                <span className="value" style={{ color: 'var(--color-input)' }}>
                  {formatBandwidth(selectedNodeMetric.txBps)}
                </span>
              </div>
            )}
            {selectedNode.type !== 'toolNode' && (
              <div className="metric-badge">
                <span className="label">Tx Packet Rate:</span>
                <span className="value" style={{ color: 'var(--color-input)' }}>
                  {formatPackets(selectedNodeMetric.txPackets)}
                </span>
              </div>
            )}
            {(selectedNodeMetric.droppedPackets > 0 || selectedNode.type === 'filterNode') && (
              <div className="metric-badge">
                <span className="label">Dropped Traffic:</span>
                <span className="value" style={{ color: '#ef5350' }}>
                  {formatBandwidth(selectedNodeMetric.droppedPackets)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      )}
    </aside>
  );
};

export default ConfigPanel;