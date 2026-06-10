import React from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import { useStore, type MapCondition } from '../store/store';

// Helper to format bps/Mbps
const formatBandwidth = (bps: number | undefined): string => {
  if (bps === undefined) return '0 Mbps';
  if (bps >= 1000) {
    return `${(bps / 1000).toFixed(1)} Gbps`;
  }
  return `${bps.toFixed(0)} Mbps`;
};

export const InputNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={80} isVisible={selected} />
      <div className={`custom-node input-node ${selected ? 'selected-node' : ''}`}>
        <div className="node-header">
          <span>📥 {data.label as string}</span>
        </div>
        <div className="node-type-label">Network Input</div>
        <div className="node-meta">Source: {data.configType as string}</div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

export const MapNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const conditions = (data.conditions as MapCondition[]) || [];

  return (
    <>
      <NodeResizer minWidth={170} minHeight={80} isVisible={selected} />
      <div className={`custom-node map-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <span>🗺️ {data.label as string}</span>
        </div>
        <div className="node-type-label">Traffic Map</div>
        <div className="node-meta">
          Rules: {conditions.length > 0 ? `${conditions.length} condition(s)` : 'Pass All'}
        </div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

export const FilterNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={80} isVisible={selected} />
      <div className={`custom-node filter-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <span>🔍 {data.label as string}</span>
        </div>
        <div className="node-type-label">Transformation / Filter</div>
        
        <div className="node-meta">
          {data.configType === 'VLAN Filter' && <span>VLANs: {data.vlanIds as string || 'None'}</span>}
          {data.configType === 'IP Subnet Filter' && <span>IP Subnet: {data.ipSubnet as string || 'None'}</span>}
          {data.configType === 'Port Filter' && <span>Ports: {data.ports as string || 'None'}</span>}
        </div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
            <span className="drop">Drop: {formatBandwidth(metrics?.droppedPackets)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

export const ToolNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);

  return (
    <>
      <NodeResizer minWidth={170} minHeight={80} isVisible={selected} />
      <div className={`custom-node tool-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <span>🛡️ {data.label as string}</span>
        </div>
        <div className="node-type-label">Destination Tool</div>
        <div className="node-meta">Type: {data.configType as string}</div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
          </div>
        )}
      </div>
    </>
  );
};

// New Load Balancer Node (GigaStream)
export const GigaStreamNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const algorithm = (data.algorithm as string) || 'Round Robin';

  return (
    <>
      <NodeResizer minWidth={170} minHeight={80} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <span>⚖️ {data.label as string}</span>
        </div>
        <div className="node-type-label">GigaStream Load Balancer</div>
        <div className="node-meta">Method: {algorithm}</div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
            <span>Tx: {formatBandwidth(metrics?.txBps)}</span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};

// New GigaSMART Packet Transformation Node (Deduplication / Slicing)
export const GigaSmartNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const isRunning = useStore((state) => state.isRunning);
  const metrics = useStore((state) => state.nodeMetrics[id]);
  const actionType = (data.actionType as string) || 'Deduplication';

  return (
    <>
      <NodeResizer minWidth={170} minHeight={80} isVisible={selected} />
      <div className={`custom-node gigasmart-node ${selected ? 'selected-node' : ''}`}>
        <Handle type="target" position={Position.Left} id="in" />
        <div className="node-header">
          <span>🧠 {data.label as string}</span>
        </div>
        <div className="node-type-label">GigaSMART Engine</div>
        
        <div className="node-meta">
          {actionType === 'Deduplication' && <span>Deduplication (10% Match)</span>}
          {actionType === 'Header Stripping' && <span>Strip VXLAN/MPLS</span>}
          {actionType === 'Packet Slicing' && <span>Slice payload to 64B</span>}
        </div>
        
        {isRunning && (
          <div className="node-metrics">
            <span>Rx: {formatBandwidth(metrics?.rxBps)}</span>
            <span className={actionType === 'Deduplication' ? 'drop' : ''}>
              {actionType === 'Deduplication' ? `Dedup: ${formatBandwidth(metrics?.droppedPackets)}` : `Tx: ${formatBandwidth(metrics?.txBps)}`}
            </span>
          </div>
        )}
        <Handle type="source" position={Position.Right} id="out" />
      </div>
    </>
  );
};