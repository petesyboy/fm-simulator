import { create } from 'zustand';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

export interface TrafficStream {
  id: string;
  name: string;
  sourceNodeId: string;
  vlan: string;
  ipSrc: string;
  ipDst: string;
  portSrc: string;
  portDst: string;
  protocol: string;
  bandwidth: number; // in Mbps
  active: boolean;
}

export interface NodeMetrics {
  rxBps: number;
  txBps: number;
  rxPackets: number;
  txPackets: number;
  droppedPackets: number;
}

export interface MapCondition {
  logic?: 'AND' | 'OR';
  field: string;
  value: string;
}

export type RFState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  simulationSpeed: number; // multiplier, e.g. 1
  trafficStreams: TrafficStream[];
  nodeMetrics: Record<string, NodeMetrics>;
  activeEdges: string[];
  blockedEdges: string[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  restoreState: (nodes: Node[], edges: Edge[]) => void;
  toggleSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  addTrafficStream: (stream: TrafficStream) => void;
  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => void;
  deleteTrafficStream: (id: string) => void;
  resetMetrics: () => void;
  updateSimulationTick: (metrics: Record<string, NodeMetrics>, activeEdges: string[], blockedEdges: string[]) => void;
  clearCanvas: () => void;
  loadDemo: () => void;
};

// Create a default topology
const defaultInputId = 'node-input-1';
const defaultMapId = 'node-map-1';
const defaultVlanFilterId = 'node-filter-1';
const defaultPortFilterId = 'node-filter-2';
const defaultToolHopId = 'node-tool-1';
const defaultToolVectraId = 'node-tool-2';

const initialNodes: Node[] = [
  {
    id: defaultInputId,
    type: 'inputNode',
    position: { x: 80, y: 180 },
    data: { label: 'SPAN Port 1/1/x1', configType: 'SPAN Port' },
  },
  {
    id: defaultMapId,
    type: 'mapNode',
    position: { x: 300, y: 180 },
    data: { 
      label: 'Core Traffic Map', 
      configType: 'Traffic Map',
      conditions: [
        { logic: 'AND', field: 'protocol', value: 'tcp' }
      ]
    },
  },
  {
    id: defaultVlanFilterId,
    type: 'filterNode',
    position: { x: 550, y: 100 },
    data: { label: 'VLAN 100 Filter', configType: 'VLAN Filter', vlanIds: '100' },
  },
  {
    id: defaultPortFilterId,
    type: 'filterNode',
    position: { x: 550, y: 260 },
    data: { label: 'Port 80 Filter', configType: 'Port Filter', ports: '80' },
  },
  {
    id: defaultToolHopId,
    type: 'toolNode',
    position: { x: 800, y: 100 },
    data: { label: 'ExtraHop Tool', configType: 'ExtraHop' },
  },
  {
    id: defaultToolVectraId,
    type: 'toolNode',
    position: { x: 800, y: 260 },
    data: { label: 'Vectra AI Tool', configType: 'Vectra' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: defaultInputId, target: defaultMapId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e2', source: defaultMapId, target: defaultVlanFilterId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e3', source: defaultMapId, target: defaultPortFilterId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e4', source: defaultVlanFilterId, target: defaultToolHopId, sourceHandle: 'out', targetHandle: 'in' },
  { id: 'e5', source: defaultPortFilterId, target: defaultToolVectraId, sourceHandle: 'out', targetHandle: 'in' },
];

const initialTraffic: TrafficStream[] = [
  {
    id: 't-1',
    name: 'Web Prod Traffic',
    sourceNodeId: defaultInputId,
    vlan: '100',
    ipSrc: '192.168.1.0/24',
    ipDst: '10.0.0.5',
    portSrc: '49152',
    portDst: '80',
    protocol: 'tcp',
    bandwidth: 150, // 150 Mbps
    active: true,
  },
  {
    id: 't-2',
    name: 'DB Sync Traffic',
    sourceNodeId: defaultInputId,
    vlan: '200',
    ipSrc: '192.168.2.11',
    ipDst: '10.0.0.10',
    portSrc: '5432',
    portDst: '5432',
    protocol: 'tcp',
    bandwidth: 80, // 80 Mbps
    active: true,
  },
  {
    id: 't-3',
    name: 'DNS Query Flood',
    sourceNodeId: defaultInputId,
    vlan: '100',
    ipSrc: '192.168.1.15',
    ipDst: '8.8.8.8',
    portSrc: '60124',
    portDst: '53',
    protocol: 'udp',
    bandwidth: 35, // 35 Mbps
    active: true,
  }
];

export const useStore = create<RFState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  isRunning: false,
  simulationSpeed: 1,
  trafficStreams: initialTraffic,
  nodeMetrics: {},
  activeEdges: [],
  blockedEdges: [],
  
  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  
  onConnect: (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${uuidv4()}`,
    };
    set({ edges: addEdge(newEdge, get().edges) });
  },
  
  addNode: (node: Node) => {
    set({ nodes: get().nodes.concat(node) });
  },
  
  setSelectedNodeId: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },
  
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => {
    set({
      nodes: get().nodes.map((node) => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
  },
  
  restoreState: (nodes: Node[], edges: Edge[]) => {
    set({ nodes, edges });
  },
  
  toggleSimulation: () => {
    const nextRunning = !get().isRunning;
    if (!nextRunning) {
      // If stopping, reset active/blocked edge styles
      set({ isRunning: false, activeEdges: [], blockedEdges: [] });
    } else {
      set({ isRunning: true });
    }
  },

  setSimulationSpeed: (speed: number) => {
    set({ simulationSpeed: speed });
  },

  addTrafficStream: (stream: TrafficStream) => {
    set({ trafficStreams: [...get().trafficStreams, stream] });
  },

  updateTrafficStream: (id: string, stream: Partial<TrafficStream>) => {
    set({
      trafficStreams: get().trafficStreams.map((s) =>
        s.id === id ? { ...s, ...stream } : s
      ),
    });
  },

  deleteTrafficStream: (id: string) => {
    set({
      trafficStreams: get().trafficStreams.filter((s) => s.id !== id),
    });
  },

  resetMetrics: () => {
    set({ nodeMetrics: {}, activeEdges: [], blockedEdges: [] });
  },

  updateSimulationTick: (metrics: Record<string, NodeMetrics>, activeEdges: string[], blockedEdges: string[]) => {
    set({
      nodeMetrics: metrics,
      activeEdges,
      blockedEdges,
    });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, isRunning: false, activeEdges: [], blockedEdges: [], trafficStreams: [] });
  },

  loadDemo: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      isRunning: false,
      activeEdges: [],
      blockedEdges: [],
      trafficStreams: initialTraffic,
    });
  },
}));