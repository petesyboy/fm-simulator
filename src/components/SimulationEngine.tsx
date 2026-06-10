import React, { useEffect, useRef } from 'react';
import { useStore, type TrafficStream, type NodeMetrics, type MapCondition } from '../store/store';

// Match VLAN IDs: e.g. "100" in "100, 200, 300"
const matchesVlan = (streamVlan: string, filterVlan: string | undefined): boolean => {
  if (!filterVlan) return false;
  const allowed = filterVlan.split(',').map((s) => s.trim());
  return allowed.includes(streamVlan);
};

// Match IP Subnet: simple prefix matching for demo purposes
const matchesIp = (streamIp: string, filterIp: string | undefined): boolean => {
  if (!filterIp) return false;
  const cleanFilter = filterIp.trim().toLowerCase();
  const cleanStream = streamIp.trim().toLowerCase();
  // Standard prefix matching
  if (cleanFilter.includes('/') && cleanFilter.split('/')[0]) {
    const prefix = cleanFilter.split('/')[0];
    return cleanStream.startsWith(prefix.substring(0, prefix.lastIndexOf('.')));
  }
  return cleanStream.includes(cleanFilter) || cleanFilter.includes(cleanStream);
};

// Match Ports: e.g. "80" in "80, 443"
const matchesPort = (streamPort: string, filterPort: string | undefined): boolean => {
  if (!filterPort) return false;
  const allowed = filterPort.split(',').map((s) => s.trim());
  return allowed.includes(streamPort);
};

// Evaluate map conditions sequentially with logic rules (AND / OR)
const evaluateMapConditions = (stream: TrafficStream, conditions: MapCondition[] | undefined): boolean => {
  if (!conditions || conditions.length === 0) return true; // Default: pass all
  
  let result = false;
  
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const val = String(cond.value).toLowerCase().trim();
    const field = cond.field;
    
    let streamVal = '';
    if (field === 'vlan') streamVal = stream.vlan;
    else if (field === 'ipsrc') streamVal = stream.ipSrc;
    else if (field === 'ipdst') streamVal = stream.ipDst;
    else if (field === 'portsrc') streamVal = stream.portSrc;
    else if (field === 'portdst') streamVal = stream.portDst;
    else if (field === 'protocol') streamVal = stream.protocol;
    
    const cleanStreamVal = String(streamVal).toLowerCase().trim();
    
    const isMatch = val === ''
      ? true
      : field === 'vlan'
      ? matchesVlan(cleanStreamVal, val)
      : (field === 'ipsrc' || field === 'ipdst' || field === 'ip6src' || field === 'ip6dst')
      ? matchesIp(cleanStreamVal, val)
      : (field === 'portsrc' || field === 'portdst')
      ? matchesPort(cleanStreamVal, val)
      : cleanStreamVal === val;
    
    if (i === 0) {
      result = isMatch;
    } else {
      if (cond.logic === 'AND') {
        result = result && isMatch;
      } else {
        result = result || isMatch;
      }
    }
  }
  
  return result;
};

const SimulationEngine: React.FC = () => {
  const isRunning = useStore((state) => state.isRunning);
  const simulationSpeed = useStore((state) => state.simulationSpeed);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  const trafficStreams = useStore((state) => state.trafficStreams);
  const updateSimulationTick = useStore((state) => state.updateSimulationTick);
  
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    const runSimulationStep = () => {
      // 1. Initialize metrics for all nodes
      const metrics: Record<string, NodeMetrics> = {};
      nodes.forEach((node) => {
        metrics[node.id] = {
          rxBps: 0,
          txBps: 0,
          rxPackets: 0,
          txPackets: 0,
          droppedPackets: 0,
        };
      });

      const activeEdgeSet = new Set<string>();
      const blockedEdgeSet = new Set<string>();

      // 2. Setup DFS/BFS traversal queue
      // Queue items track the nodeId, the traffic stream properties, and the path of edges traversed
      interface QueueItem {
        nodeId: string;
        stream: TrafficStream;
        edgePath: string[];
      }

      const queue: QueueItem[] = [];

      // Find starting nodes for all active traffic streams
      trafficStreams.forEach((stream) => {
        if (!stream.active) return;
        
        // Find input node
        const sourceNode = nodes.find((n) => n.id === stream.sourceNodeId);
        if (sourceNode) {
          queue.push({
            nodeId: sourceNode.id,
            stream: { ...stream },
            edgePath: [],
          });
        }
      });

      // Avoid infinite loops in cycle graphs
      let iterations = 0;
      const maxIterations = 200;

      while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const item = queue.shift()!;
        const node = nodes.find((n) => n.id === item.nodeId);
        if (!node) continue;

        const nodeMetric = metrics[node.id];
        if (!nodeMetric) continue;

        // Calculate approximate packet rates (assuming average packet size of 500 bytes)
        // 1 Mbps = 1000000 bps / (8 * 500) = 250 packets per second
        const packetsPerSecond = item.stream.bandwidth * 250;

        // If this is the start node, it just transmits
        if (node.id === item.stream.sourceNodeId && item.edgePath.length === 0) {
          nodeMetric.txBps += item.stream.bandwidth;
          nodeMetric.txPackets += packetsPerSecond;
        } else {
          // Otherwise it receives this bandwidth
          nodeMetric.rxBps += item.stream.bandwidth;
          nodeMetric.rxPackets += packetsPerSecond;
        }

        // Get outbound edges
        const outboundEdges = edges.filter((e) => e.source === node.id);

        // If it's a Tool (terminal node), stop traversing
        if (node.type === 'toolNode') {
          // Tool receives but does not transmit
          continue;
        }

        // Determine forwarding logic based on node type
        let forwardStream: TrafficStream | null = { ...item.stream };
        let dropBandwidth = 0;

        if (node.type === 'filterNode') {
          const configType = node.data?.configType as string;
          let isMatch = false;

          if (configType === 'VLAN Filter') {
            isMatch = matchesVlan(item.stream.vlan, node.data?.vlanIds as string);
          } else if (configType === 'IP Subnet Filter') {
            isMatch = matchesIp(item.stream.ipSrc, node.data?.ipSubnet as string) || 
                      matchesIp(item.stream.ipDst, node.data?.ipSubnet as string);
          } else if (configType === 'Port Filter') {
            isMatch = matchesPort(item.stream.portSrc, node.data?.ports as string) || 
                      matchesPort(item.stream.portDst, node.data?.ports as string);
          }

          if (isMatch) {
            nodeMetric.txBps += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
          } else {
            // Drop traffic
            dropBandwidth = item.stream.bandwidth;
            nodeMetric.droppedPackets += dropBandwidth;
            forwardStream = null;
          }
        } 
        else if (node.type === 'mapNode') {
          const isMatch = evaluateMapConditions(item.stream, node.data?.conditions as MapCondition[]);
          if (isMatch) {
            nodeMetric.txBps += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
          } else {
            dropBandwidth = item.stream.bandwidth;
            nodeMetric.droppedPackets += dropBandwidth;
            forwardStream = null;
          }
        }
        else if (node.type === 'gigaSmartNode') {
          const actionType = node.data?.actionType as string || 'Deduplication';
          
          if (actionType === 'Deduplication') {
            // Simulate 10% duplicate drop
            dropBandwidth = item.stream.bandwidth * 0.1;
            const validBandwidth = item.stream.bandwidth * 0.9;
            nodeMetric.droppedPackets += dropBandwidth;
            nodeMetric.txBps += validBandwidth;
            nodeMetric.txPackets += validBandwidth * 250;
            forwardStream = { ...item.stream, bandwidth: validBandwidth };
          } 
          else if (actionType === 'Packet Slicing') {
            // Slice payload: reduces bandwidth throughput by 40% (since payloads are smaller)
            const slicedBandwidth = item.stream.bandwidth * 0.6;
            nodeMetric.txBps += slicedBandwidth;
            nodeMetric.txPackets += packetsPerSecond; // packet count stays same!
            forwardStream = { ...item.stream, bandwidth: slicedBandwidth };
          } 
          else if (actionType === 'Header Stripping') {
            // Header stripping: reduces bandwidth slightly (5%)
            const strippedBandwidth = item.stream.bandwidth * 0.95;
            nodeMetric.txBps += strippedBandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: strippedBandwidth };
          }
        }
        else if (node.type === 'gigaStreamNode') {
          // Load balancer: splits incoming traffic equally among all outbound edges
          if (outboundEdges.length > 0) {
            nodeMetric.txBps += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            
            const splitBandwidth = item.stream.bandwidth / outboundEdges.length;
            
            outboundEdges.forEach((edge) => {
              activeEdgeSet.add(edge.id);
              queue.push({
                nodeId: edge.target,
                stream: { ...item.stream, bandwidth: splitBandwidth },
                edgePath: [...item.edgePath, edge.id],
              });
            });
            // We handled queueing for each edge here, so we skip standard outbound queueing below
            continue;
          }
        }
        else {
          // Default node (e.g. general pass-through): just forward everything
          nodeMetric.txBps += item.stream.bandwidth;
          nodeMetric.txPackets += packetsPerSecond;
        }

        // Propagate forwardStream to outbound links
        if (forwardStream && forwardStream.bandwidth > 0 && outboundEdges.length > 0) {
          outboundEdges.forEach((edge) => {
            activeEdgeSet.add(edge.id);
            queue.push({
              nodeId: edge.target,
              stream: { ...forwardStream! },
              edgePath: [...item.edgePath, edge.id],
            });
          });
        } else if (dropBandwidth > 0 && outboundEdges.length > 0) {
          // If traffic was dropped/blocked here, mark the outbound links as blocked
          outboundEdges.forEach((edge) => {
            blockedEdgeSet.add(edge.id);
          });
        }
      }

      // Add edge paths of all successfully propagated traffic to active edges
      // (This covers the inbound edges that successfully brought traffic to nodes)
      edges.forEach((edge) => {
        // If the source node had traffic, the connection was active
        const sourceMetric = metrics[edge.source];
        if (sourceMetric && sourceMetric.txBps > 0 && !activeEdgeSet.has(edge.id)) {
          // If it didn't successfully propagate *past* target, but reached target, mark it active
          const targetMetric = metrics[edge.target];
          if (targetMetric && targetMetric.rxBps > 0) {
            activeEdgeSet.add(edge.id);
          }
        }
      });

      // Update store state with the tick outputs
      updateSimulationTick(metrics, Array.from(activeEdgeSet), Array.from(blockedEdgeSet));
    };

    // Run first step immediately
    runSimulationStep();

    // Set interval for subsequent ticks
    const intervalTime = 800 / simulationSpeed;
    tickRef.current = window.setInterval(runSimulationStep, intervalTime);

    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
      }
    };
  }, [isRunning, simulationSpeed, nodes, edges, trafficStreams, updateSimulationTick]);

  return null;
};

export default SimulationEngine;
