import React, { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  useReactFlow,
  Background,
  Controls,
  type Node
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/store';
import { InputNode, FilterNode, ToolNode, MapNode, GigaStreamNode, GigaSmartNode, GroupNode } from './CustomNodes';
import { NODE_TYPES, CONFIG_TYPES } from '../constants/nodeTypes';

/**
 * nodeTypes MUST be defined outside the component.
 *
 * If it were defined inside CanvasArea, a new object would be created on every
 * render, causing ReactFlow to treat it as a brand-new type map each time and
 * re-mount every node.  By placing it at module scope the reference is stable
 * for the entire lifetime of the application.
 *
 * The keys here must match the `type` field used when adding nodes to the store.
 * We use the NODE_TYPES constants to keep them in sync.
 */
const nodeTypes = {
  [NODE_TYPES.INPUT]:      InputNode,
  [NODE_TYPES.FILTER]:     FilterNode,
  [NODE_TYPES.TOOL]:       ToolNode,
  [NODE_TYPES.MAP]:        MapNode,
  [NODE_TYPES.GIGASTREAM]: GigaStreamNode,
  [NODE_TYPES.GIGASMART]:  GigaSmartNode,
  [NODE_TYPES.GROUP]:      GroupNode,
};

const CanvasArea: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const activeEdges = useStore((state) => state.activeEdges);
  const blockedEdges = useStore((state) => state.blockedEdges);
  const isRunning = useStore((state) => state.isRunning);
  
  const onNodesChange = useStore((state) => state.onNodesChange);
  const onEdgesChange = useStore((state) => state.onEdgesChange);
  const onConnect = useStore((state) => state.onConnect);
  const addNode = useStore((state) => state.addNode);
  const addTrafficStream = useStore((state) => state.addTrafficStream);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const fitViewTrigger = useStore((state) => state.fitViewTrigger);
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    // Wait for nodes to render and layout boundaries to compute
    const timer = setTimeout(() => {
      fitView({ padding: 0.1 });
    }, 100);
    return () => clearTimeout(timer);
  }, [fitViewTrigger, fitView]);

  // Dynamically apply classes and animation flags to connections
  const styledEdges = edges.map((edge) => {
    const isActive = activeEdges.includes(edge.id);
    const isBlocked = blockedEdges.includes(edge.id);
    
    let className = '';
    let animated = false;
    
    if (isRunning) {
      if (isActive) {
        className = 'active-flow';
        animated = true;
      } else if (isBlocked) {
        className = 'blocked-flow';
      }
    }

    // Dynamic Edge Labeling for GigaSMART Application Metadata
    let label = edge.label;
    const srcNode = nodes.find((n) => n.id === edge.source);
    if (srcNode?.type === 'gigaSmartNode' && 
        (srcNode.data?.actionType === 'Application Metadata' || 
         srcNode.data?.actionType === 'AMX' || 
         srcNode.data?.actionType === 'AMI')) {
      const format = (srcNode.data?.metadataFormat as string) || 'CEF';
      label = `${format} Metadata`;
    }
    
    return {
      ...edge,
      className,
      animated,
      label,
    };
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const rawData = event.dataTransfer.getData('application/reactflow');

      if (!rawData || !reactFlowBounds) {
        return;
      }

      const { type, label, initialData } = JSON.parse(rawData);

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const mergedData = { ...initialData };
      let labelToUse = label;

      if (type === NODE_TYPES.INPUT) {
        // Auto-number new input ports by finding the highest existing index.
        // This gives a friendly label like "SPAN Port 1/1/x3" automatically.
        let maxIndex = 0;
        nodes.forEach((node) => {
          if (node.type === NODE_TYPES.INPUT) {
            const labelStr = String(node.data?.label || '');
            const match = labelStr.match(/(?:x|Tunnel\s+)(\d+)/i);
            if (match) {
              const idx = parseInt(match[1], 10);
              if (idx > maxIndex) maxIndex = idx;
            }
          }
        });
        const nextIdx = maxIndex + 1;

        if (initialData?.configType === CONFIG_TYPES.TAP) {
          labelToUse = `TAP Device 1/1/x${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.SPAN) {
          labelToUse = `SPAN Port 1/1/x${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.ERSPAN) {
          labelToUse = `ERSPAN Tunnel ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.EAST_WEST) {
          labelToUse = `East/West Traffic ${nextIdx}`;
        } else if (initialData?.configType === CONFIG_TYPES.VMWARE) {
          labelToUse = `VMWare Estate ${nextIdx}`;
        }
      }

      if (initialData?.actionType === 'Deduplication' && mergedData.dedupRate === undefined) {
        mergedData.dedupRate = Math.floor(Math.random() * 41) + 10; // random 10% to 50%
        mergedData.lastDedupUpdate = Date.now();
      }

      const newNode: Node = {
        id: uuidv4(),
        type,
        position,
        data: { label: labelToUse, configType: mergedData.configType || labelToUse, ...mergedData },
      };

      addNode(newNode);

      // Automatically generate a traffic stream whenever an input port is dropped.
      // This gives immediate feedback that the port is "live" without needing manual setup.
      if (type === NODE_TYPES.INPUT) {
        const speeds = [1, 10, 25, 40, 100];
        const randomGbps = speeds[Math.floor(Math.random() * speeds.length)];
        const randomMbps = randomGbps * 1000;
        const randomSubnet = Math.floor(Math.random() * 254) + 1;
        const randomVlan = String(Math.floor(Math.random() * 900) + 100);
        
        addTrafficStream({
          id: `t-${uuidv4()}`,
          name: `${labelToUse} Flow (${randomGbps} Gbps)`,
          sourceNodeId: newNode.id,
          vlan: randomVlan,
          ipSrc: `192.168.${randomSubnet}.10`,
          ipDst: `10.0.0.${randomSubnet}`,
          portSrc: String(Math.floor(Math.random() * 50000) + 1024),
          portDst: '80',
          protocol: 'tcp',
          bandwidth: randomMbps,
          active: true,
        });
      }
    },
    [screenToFlowPosition, addNode, addTrafficStream, nodes]
  );

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    if (nodes.length === 1) {
      setSelectedNodeId(nodes[0].id);
    } else {
      setSelectedNodeId(null);
    }
  }, [setSelectedNodeId]);

  const selectedInputNodes = nodes.filter(
    (n) => n.selected && n.type === 'inputNode'
  );

  const selectedGroupNodes = nodes.filter(
    (n) => n.selected && n.type === 'groupNode'
  );

  const handleCreateGroup = () => {
    useStore.getState().groupSelectedNodes();
  };

  const handleUngroup = () => {
    selectedGroupNodes.forEach((groupNode) => {
      useStore.getState().ungroupGroup(groupNode.id);
    });
  };

  return (
    <div className="canvas-wrapper" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={onSelectionChange}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeOrigin={[0.5, 0.5]}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {(selectedInputNodes.length >= 2 || selectedGroupNodes.length >= 1) && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(22, 22, 22, 0.95)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}>
          {selectedInputNodes.length >= 2 && (
            <>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>
                {selectedInputNodes.length} Traffic Nodes Selected
              </span>
              <button 
                onClick={handleCreateGroup}
                style={{
                  background: 'linear-gradient(135deg, #00b0ff 0%, #00e5ff 100%)',
                  color: '#121212',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 0 8px rgba(0, 229, 255, 0.4)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                📦 Group Ports Together
              </button>
            </>
          )}
          {selectedInputNodes.length >= 2 && selectedGroupNodes.length >= 1 && (
            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }} />
          )}
          {selectedGroupNodes.length >= 1 && (
            <>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}>
                {selectedGroupNodes.length} Port Group{selectedGroupNodes.length > 1 ? 's' : ''} Selected
              </span>
              <button 
                onClick={handleUngroup}
                style={{
                  background: 'linear-gradient(135deg, #ff1744 0%, #ff5252 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 0 8px rgba(255, 23, 68, 0.4)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                🔓 Ungroup Ports
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CanvasArea;