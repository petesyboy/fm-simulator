/**
 * SimulationEngine.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Headless (renders null) component that drives the traffic simulation loop.
 * It runs on a setInterval whose period is controlled by `simulationSpeed`.
 *
 * CHANGES (refactor/code-quality-improvements)
 * ─────────────────────────────────────────────
 * 1. BATCHED NODE WRITES
 *    Previously, per-node state updates (dedupRate drift, trafficStream drift)
 *    were written back to the Zustand store *inside* the simulation loop via
 *    individual `updateNodeData()` / `updateTrafficStream()` calls.  Each call
 *    triggers a React re-render.  With many nodes this could cause dozens of
 *    re-renders per tick.
 *
 *    Now the loop computes ALL desired state changes in plain JS objects, then
 *    a single `updateSimulationTick` call (which is one Zustand `set()`) applies
 *    them all atomically.  The store's `updateSimulationTick` action has been
 *    extended to also accept node-data patches and traffic-stream patches so
 *    everything lands in one render cycle.
 *
 * 2. PROPER CIDR SUBNET MATCHING
 *    The old `matchesIp` used simple string prefix comparison, which gave false
 *    positives.  For example, a filter of "192.168.1.0/24" would incorrectly
 *    match "192.168.10.5" because "192.168.1" is a prefix of "192.168.10".
 *
 *    The new implementation converts both the filter CIDR and the stream IP to
 *    32-bit unsigned integers (IPv4 only) and applies a bitmask.  IPv6 falls
 *    back to an exact-string comparison.
 *
 * 3. CONSTANTS
 *    All magic strings replaced with NODE_TYPES / ACTION_TYPES constants.
 */

import React, { useEffect, useRef } from 'react';
import { useStore, type TrafficStream, type NodeMetrics, type MapCondition } from '../store/store';
import { NODE_TYPES, ACTION_TYPES, isMetadataAction, isDedupAction } from '../constants/nodeTypes';

// ─── Extended stream type used only inside the simulation loop ────────────────

interface TrajectoryStream extends TrafficStream {
  trafficType?: 'packet' | 'metadata';
  metadataFormat?: 'CEF' | 'JSON';
}

// ─── IP matching helpers ──────────────────────────────────────────────────────

/**
 * Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer.
 * Returns NaN if the input is not a valid IPv4 address.
 */
const ipv4ToInt = (ip: string): number => {
  const parts = ip.split('.');
  if (parts.length !== 4) return NaN;
  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return NaN;
    result = (result << 8) | num;
  }
  // >>> 0 converts to unsigned 32-bit
  return result >>> 0;
};

/**
 * CIDR-aware IP subnet matching (IPv4).
 *
 * OLD approach (buggy):
 *   cleanStream.startsWith(prefix.substring(0, prefix.lastIndexOf('.')))
 *   → "192.168.10.5" incorrectly matched "192.168.1.0/24"
 *
 * NEW approach:
 *   Convert both addresses to 32-bit ints, apply a /prefix-length bitmask,
 *   and compare.  This is mathematically correct for any /0–/32 prefix.
 *
 * Falls back to a case-insensitive string equality check for IPv6 addresses
 * (full CIDR for IPv6 is out of scope for this simulator).
 */
const matchesIp = (streamIp: string | undefined, filterIp: string | undefined): boolean => {
  if (!filterIp || !streamIp) return false;

  const cleanFilter = filterIp.trim().toLowerCase();
  const cleanStream = streamIp.trim().toLowerCase();

  if (!cleanFilter.includes('/')) {
    // Exact IP match (no CIDR notation)
    return cleanStream === cleanFilter;
  }

  const [networkStr, prefixStr] = cleanFilter.split('/');
  const prefixLen = parseInt(prefixStr, 10);

  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

  // IPv6 fallback — just check if the stream IP starts with the network address
  if (networkStr.includes(':')) {
    return cleanStream.startsWith(networkStr.split(':').slice(0, 3).join(':'));
  }

  const networkInt = ipv4ToInt(networkStr);
  const streamInt  = ipv4ToInt(cleanStream.split('/')[0]); // handle CIDR in stream too

  if (isNaN(networkInt) || isNaN(streamInt)) return false;

  // Build the bitmask: /24 → 0xFFFFFF00, /16 → 0xFFFF0000, etc.
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;

  return (networkInt & mask) === (streamInt & mask);
};

/** Match VLAN IDs: filter value is comma-separated, e.g. "100, 200, 300" */
const matchesVlan = (streamVlan: string | undefined, filterVlan: string | undefined): boolean => {
  if (!filterVlan) return false;
  const allowed = filterVlan.split(',').map((s) => s.trim());
  return allowed.includes(String(streamVlan || '').trim());
};

/** Match destination/source ports: filter value is comma-separated, e.g. "80, 443" */
const matchesPort = (streamPort: string | undefined, filterPort: string | undefined): boolean => {
  if (!filterPort) return false;
  const allowed = filterPort.split(',').map((s) => s.trim());
  return allowed.includes(String(streamPort || '').trim());
};

// ─── Map condition evaluation ─────────────────────────────────────────────────

/**
 * Evaluate a flat list of conditions with AND/OR chaining.
 *
 * Conditions are evaluated left-to-right.  The first condition sets the initial
 * result; subsequent conditions combine with the previous result using their
 * `logic` value ('AND' | 'OR').
 */
const evaluateConditionGroup = (stream: TrafficStream, conditions: MapCondition[]): boolean => {
  let result = false;

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const val = String(cond.value || '').toLowerCase().trim();
    const field = cond.field;

    // Extract the relevant field from the stream
    let streamVal = '';
    if (field === 'vlan')    streamVal = stream.vlan;
    else if (field === 'ipsrc')   streamVal = stream.ipSrc;
    else if (field === 'ipdst')   streamVal = stream.ipDst;
    else if (field === 'portsrc') streamVal = stream.portSrc;
    else if (field === 'portdst') streamVal = stream.portDst;
    else if (field === 'protocol') streamVal = stream.protocol;

    const cleanStreamVal = String(streamVal || '').toLowerCase().trim();

    // Determine if this individual condition is matched
    let isMatch: boolean;
    if (val === '') {
      // Empty value → wildcard match
      isMatch = true;
    } else if (field === 'ipver') {
      const isIPv6 = !!(stream.ipSrc?.includes(':') || stream.ipDst?.includes(':'));
      isMatch = (val === 'ipv6') ? isIPv6 : (val === 'ipv4') ? !isIPv6 : false;
    } else if (field === 'vlan') {
      isMatch = matchesVlan(cleanStreamVal, val);
    } else if (['ipsrc', 'ipdst', 'ip6src', 'ip6dst'].includes(field)) {
      isMatch = matchesIp(cleanStreamVal, val);
    } else if (['portsrc', 'portdst'].includes(field)) {
      isMatch = matchesPort(cleanStreamVal, val);
    } else {
      isMatch = cleanStreamVal === val;
    }

    // Chain with previous result
    if (i === 0) {
      result = isMatch;
    } else if (cond.logic === 'AND') {
      result = result && isMatch;
    } else {
      result = result || isMatch;
    }
  }

  return result;
};

/**
 * Determine whether a traffic stream passes a Traffic Map node.
 *
 * Rules:
 *  1. Drop rules are evaluated first.  If matched → drop (return false).
 *  2. Pass rules: if any exist and the stream matches → forward (return true).
 *  3. No conditions → pass all traffic.
 */
const evaluateMapConditions = (stream: TrafficStream, conditions: MapCondition[] | undefined): boolean => {
  if (!conditions || conditions.length === 0) return true;

  const passConditions = conditions.filter((c) => !c.action || c.action === 'pass');
  const dropConditions = conditions.filter((c) => c.action === 'drop');

  if (dropConditions.length > 0 && evaluateConditionGroup(stream, dropConditions)) {
    return false; // Matched a drop rule → drop immediately
  }

  if (passConditions.length > 0) {
    return evaluateConditionGroup(stream, passConditions);
  }

  return true; // No pass rules, didn't match drop → forward
};

// ─── SimulationEngine component ───────────────────────────────────────────────

const SimulationEngine: React.FC = () => {
  const isRunning          = useStore((state) => state.isRunning);
  const simulationSpeed    = useStore((state) => state.simulationSpeed);
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
      // Always read state directly rather than using the closed-over hook values.
      // If we captured isRunning/nodes etc. via the useEffect closure they would
      // be stale after state changes that don't re-run this effect.
      const currentNodes   = useStore.getState().nodes;
      const currentEdges   = useStore.getState().edges;
      const currentTraffic = useStore.getState().trafficStreams;

      const now = Date.now();

      // ── 1. Compute deduplication rate drift (accumulated, not yet written) ──
      //
      // Previously each node was written individually:
      //   useStore.getState().updateNodeData(node.id, { dedupRate: ... })
      //
      // Now we collect patches into a plain object and flush them in one store
      // update at the end of the tick, avoiding N separate React re-renders.
      const nodeDataPatches: Record<string, Record<string, unknown>> = {};

      currentNodes.forEach((node) => {
        if (
          node.type === NODE_TYPES.GIGASMART &&
          isDedupAction(node.data?.actionType as string || '')
        ) {
          const lastUpdate  = (node.data?.lastDedupUpdate as number) || 0;
          const currentRate = node.data?.dedupRate as number;

          if (!currentRate) {
            // First time: assign a random initial rate in [10, 50]
            nodeDataPatches[node.id] = {
              ...nodeDataPatches[node.id],
              dedupRate: Math.floor(Math.random() * 41) + 10,
              lastDedupUpdate: now,
            };
          } else if (now - lastUpdate >= 2000) {
            // Drift by ±5 percentage points every 2 seconds
            const delta   = Math.floor(Math.random() * 11) - 5;
            const newRate = Math.min(50, Math.max(10, currentRate + delta));
            nodeDataPatches[node.id] = {
              ...nodeDataPatches[node.id],
              dedupRate: newRate,
              lastDedupUpdate: now,
            };
          }
        }
      });

      // ── 2. Compute traffic stream bandwidth drift (accumulated) ──
      //
      // Same batching approach: collect into a plain object, flush once.
      const streamPatches: Record<string, Partial<TrafficStream>> = {};

      currentTraffic.forEach((stream) => {
        if (!stream.active) return;

        const lastUpdate   = (stream.lastDriftUpdate as number) || 0;
        const currentDrift = stream.drift ?? 1.0;

        if (stream.drift === undefined) {
          // Initialise drift for this stream
          streamPatches[stream.id] = { drift: 1.0, lastDriftUpdate: now };
        } else if (now - lastUpdate >= 2000) {
          // Drift by ±1.5% every 2 seconds, clamped to [0.95, 1.05]
          const delta    = (Math.random() * 3 - 1.5) / 100;
          const newDrift = Math.min(1.05, Math.max(0.95, currentDrift + delta));
          streamPatches[stream.id] = { drift: newDrift, lastDriftUpdate: now };
        }
      });

      // ── 3. Initialise per-node metric accumulators ──

      const metrics: Record<string, NodeMetrics> = {};
      currentNodes.forEach((node) => {
        metrics[node.id] = { rxBps: 0, txBps: 0, rxPackets: 0, txPackets: 0, droppedPackets: 0 };
      });

      const activeEdgeSet   = new Set<string>();
      const blockedEdgeSet  = new Set<string>();

      // ── 4. BFS traversal: propagate each traffic stream through the graph ──

      interface QueueItem {
        nodeId: string;
        stream: TrajectoryStream;
        edgePath: string[];
      }

      const queue: QueueItem[]                                         = [];
      const toolReceivedStreams: Record<string, TrajectoryStream[]>     = {};
      const deliveredStreamIds                                          = new Set<string>();

      // Seed the queue with each active traffic stream at its source node.
      // Group by source node first to enforce physical link speeds (if configured).
      const streamsBySource: Record<string, TrajectoryStream[]> = {};

      currentTraffic.forEach((stream) => {
        if (!stream.active) return;

        const sourceNode = currentNodes.find((n) => n.id === stream.sourceNodeId);
        if (!sourceNode) return;

        // Use the freshly-computed drift if we have a patch, otherwise use stored value
        const effectiveDrift = streamPatches[stream.id]?.drift ?? stream.drift ?? 1.0;
        const driftedBandwidth = stream.bandwidth * effectiveDrift;

        if (!streamsBySource[sourceNode.id]) streamsBySource[sourceNode.id] = [];
        streamsBySource[sourceNode.id].push({ ...stream, bandwidth: driftedBandwidth, trafficType: 'packet' });
      });

      Object.entries(streamsBySource).forEach(([nodeId, nodeStreams]) => {
        const sourceNode = currentNodes.find(n => n.id === nodeId);
        const linkSpeed = (sourceNode?.data?.linkSpeed as number) || Infinity;
        
        const totalRequested = nodeStreams.reduce((sum, s) => sum + s.bandwidth, 0);
        
        if (totalRequested > linkSpeed) {
          // Traffic exceeds physical port capacity. Cap it and record ingress drops.
          const droppedBps = totalRequested - linkSpeed;
          if (metrics[nodeId]) {
            metrics[nodeId].droppedPackets += droppedBps * 250; // Approximated packet rate
          }

          // Scale down each stream proportionally so the sum equals linkSpeed
          nodeStreams.forEach(stream => {
            const scale = linkSpeed / totalRequested;
            stream.bandwidth *= scale;
            queue.push({ nodeId, stream, edgePath: [] });
          });
        } else {
          // Link capacity is sufficient; enqueue streams unmodified
          nodeStreams.forEach(stream => {
            queue.push({ nodeId, stream, edgePath: [] });
          });
        }
      });

      // Safety valve: in a misconfigured graph (e.g. a cycle) the queue could
      // grow unboundedly.  Cap at 200 iterations.
      let iterations = 0;
      const maxIterations = 200;

      while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const item = queue.shift()!;
        const node = currentNodes.find((n) => n.id === item.nodeId);
        if (!node) continue;

        const nodeMetric = metrics[node.id];
        if (!nodeMetric) continue;

        const packetsPerSecond = item.stream.bandwidth * 250;

        // Count traffic hitting the node
        if (node.id === item.stream.sourceNodeId && item.edgePath.length === 0) {
          // This is the originating source node — count as Tx (it's emitting traffic)
          nodeMetric.txBps     += item.stream.bandwidth;
          nodeMetric.txPackets += packetsPerSecond;
        } else {
          nodeMetric.rxBps     += item.stream.bandwidth;
          nodeMetric.rxPackets += packetsPerSecond;
        }

        // Gather outbound edges, merging parent-group edges for grouped input ports
        let outboundEdges = currentEdges.filter((e) => e.source === node.id);
        if (node.parentId) {
          const parentEdges = currentEdges.filter((e) => e.source === node.parentId);
          outboundEdges = [...outboundEdges, ...parentEdges];
        }
        // De-duplicate by target to avoid sending the same stream twice
        const seenTargets = new Set<string>();
        outboundEdges = outboundEdges.filter((edge) => {
          if (seenTargets.has(edge.target)) return false;
          seenTargets.add(edge.target);
          return true;
        });

        // ── Tool nodes are terminal: record receipt and stop forwarding ──
        if (node.type === NODE_TYPES.TOOL) {
          if (!toolReceivedStreams[node.id]) toolReceivedStreams[node.id] = [];
          toolReceivedStreams[node.id].push(item.stream);
          deliveredStreamIds.add(item.stream.id);
          continue;
        }

        // ── Determine what (if anything) gets forwarded ──
        let forwardStream: TrajectoryStream | null = { ...item.stream };
        let dropBandwidth = 0;

        if (node.type === NODE_TYPES.FILTER) {
          // Filter nodes: pass or drop based on VLAN/IP/Port criteria
          const configType = node.data?.configType as string;
          let isMatch = false;

          if (configType === 'VLAN Filter') {
            isMatch = matchesVlan(item.stream.vlan, node.data?.vlanIds as string);
          } else if (configType === 'IP Subnet Filter') {
            // Proper CIDR matching (fixed — see matchesIp above)
            isMatch = matchesIp(item.stream.ipSrc, node.data?.ipSubnet as string) ||
                      matchesIp(item.stream.ipDst, node.data?.ipSubnet as string);
          } else if (configType === 'Port Filter') {
            isMatch = matchesPort(item.stream.portSrc, node.data?.ports as string) ||
                      matchesPort(item.stream.portDst, node.data?.ports as string);
          }

          if (isMatch) {
            nodeMetric.txBps     += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
          } else {
            dropBandwidth           = item.stream.bandwidth;
            nodeMetric.droppedPackets += dropBandwidth;
            forwardStream = null;
          }
        } else if (node.type === NODE_TYPES.MAP) {
          const isMatch = evaluateMapConditions(item.stream, node.data?.conditions as MapCondition[]);
          if (isMatch) {
            nodeMetric.txBps     += item.stream.bandwidth;
            nodeMetric.txPackets += packetsPerSecond;
          } else {
            dropBandwidth           = item.stream.bandwidth;
            nodeMetric.droppedPackets += dropBandwidth;
            forwardStream = null;
          }
        } else if (node.type === NODE_TYPES.GIGASMART) {
          const actionType = (node.data?.actionType as string) || ACTION_TYPES.DEDUPLICATION;

          if (isDedupAction(actionType)) {
            // Use the freshly-computed dedupRate from nodeDataPatches if available,
            // otherwise fall back to what's currently in node.data
            const dedupRate    = (nodeDataPatches[node.id]?.dedupRate as number) ?? (node.data?.dedupRate as number) ?? 20;
            const dropFraction = dedupRate / 100;
            const validBandwidth = item.stream.bandwidth * (1 - dropFraction);

            dropBandwidth              = item.stream.bandwidth * dropFraction;
            nodeMetric.droppedPackets += dropBandwidth;
            nodeMetric.txBps          += validBandwidth;
            nodeMetric.txPackets      += validBandwidth * 250;
            forwardStream = { ...item.stream, bandwidth: validBandwidth };

          } else if (isMetadataAction(actionType)) {
            // AMI/AMX/App Metadata: converts packets to metadata (1.5% of original volume)
            const format          = (node.data?.metadataFormat as string) || 'CEF';
            const scale           = 0.015;
            const metadataBandwidth = item.stream.bandwidth * scale;

            dropBandwidth              = item.stream.bandwidth * (1 - scale);
            nodeMetric.droppedPackets += dropBandwidth;
            nodeMetric.txBps          += metadataBandwidth;
            nodeMetric.txPackets      += metadataBandwidth * 250;
            forwardStream = {
              ...item.stream,
              bandwidth: metadataBandwidth,
              trafficType: 'metadata',
              metadataFormat: format as 'CEF' | 'JSON',
            };

          } else if (actionType === ACTION_TYPES.APP_METADATA) {
            // "Application Metadata" (10% scale, contrast with AMX/AMI at 1.5%)
            const format = (node.data?.metadataFormat as string) || 'CEF';
            const scale  = 0.1;
            const metadataBandwidth = item.stream.bandwidth * scale;

            dropBandwidth              = item.stream.bandwidth * (1 - scale);
            nodeMetric.droppedPackets += dropBandwidth;
            nodeMetric.txBps          += metadataBandwidth;
            nodeMetric.txPackets      += metadataBandwidth * 250;
            forwardStream = {
              ...item.stream,
              bandwidth: metadataBandwidth,
              trafficType: 'metadata',
              metadataFormat: format as 'CEF' | 'JSON',
            };

          } else if (actionType === ACTION_TYPES.PACKET_SLICING) {
            const slicedBandwidth = item.stream.bandwidth * 0.6;
            nodeMetric.txBps     += slicedBandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: slicedBandwidth };

          } else if (actionType === ACTION_TYPES.HEADER_STRIP) {
            const strippedBandwidth = item.stream.bandwidth * 0.95;
            nodeMetric.txBps       += strippedBandwidth;
            nodeMetric.txPackets   += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: strippedBandwidth };

          } else {
            // All other GigaSMART operations (SSL Decrypt, Masking, etc.)
            // apply a small overhead reduction; the default is pass-through.
            let scale = 1.0;
            if (actionType === ACTION_TYPES.SSL_DECRYPT || actionType === ACTION_TYPES.MASKING) {
              scale = 0.95;
            }
            const outputBandwidth = item.stream.bandwidth * scale;
            if (scale < 1.0) {
              dropBandwidth              = item.stream.bandwidth * (1 - scale);
              nodeMetric.droppedPackets += dropBandwidth;
            }
            nodeMetric.txBps     += outputBandwidth;
            nodeMetric.txPackets += packetsPerSecond;
            forwardStream = { ...item.stream, bandwidth: outputBandwidth };
          }

        } else if (node.type === NODE_TYPES.GIGASTREAM) {
          // GigaStream load balancer: splits bandwidth evenly across all outputs
          if (outboundEdges.length > 0) {
            nodeMetric.txBps     += item.stream.bandwidth;
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
            continue; // Handled above — don't fall through to the generic forwarder
          }

        } else if (node.type === NODE_TYPES.INPUT) {
          // Input node: txBps was already counted at the top of the loop
        } else {
          // Catch-all for any future node types: pass traffic unchanged
          nodeMetric.txBps     += item.stream.bandwidth;
          nodeMetric.txPackets += packetsPerSecond;
        }

        // ── Forward or block ──
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
          outboundEdges.forEach((edge) => blockedEdgeSet.add(edge.id));
        }
      }

      // Mark edges that carry traffic from source nodes to their first hop
      // (handles cases where the BFS didn't explicitly set the edge active)
      currentEdges.forEach((edge) => {
        const sourceMetric = metrics[edge.source];
        if (sourceMetric && sourceMetric.txBps > 0 && !activeEdgeSet.has(edge.id)) {
          const targetMetric = metrics[edge.target];
          if (targetMetric && targetMetric.rxBps > 0) {
            activeEdgeSet.add(edge.id);
          }
        }
      });

      // ── 5. Validate tool traffic types and formats ──
      //
      // For each Tool node, check whether the streams it received match its
      // expected traffic type (packet vs metadata) and format (CEF vs JSON).
      // Status is written via nodeDataPatches so it's included in the single
      // batched store update below.
      currentNodes.forEach((node) => {
        if (node.type !== NODE_TYPES.TOOL) return;

        const configType     = (node.data?.configType as string) || '';
        const expectedFormat = (node.data?.expectedFormat as string) || 'CEF';
        const isPacketTool   = configType === 'Packet Tool';
        const isMetadataTool = configType === 'Metadata Tool';

        const received = toolReceivedStreams[node.id] || [];

        let nextStatus: 'warning' | 'optimal' | undefined;
        let nextStatusMessage = '';
        let receivedFormat = '';

        if (received.length > 0) {
          for (const rStream of received) {
            const rType   = rStream.trafficType || 'packet';
            const rFormat = rStream.metadataFormat;

            if (isPacketTool && rType !== 'packet') {
              nextStatus = 'warning';
              nextStatusMessage = 'Expected packets, got metadata';
              break;
            } else if (isMetadataTool) {
              if (rType !== 'metadata') {
                nextStatus = 'warning';
                nextStatusMessage = 'Expected metadata, got packets';
                break;
              } else if (expectedFormat !== 'Any' && rFormat !== expectedFormat) {
                nextStatus = 'warning';
                nextStatusMessage = `Format mismatch: got ${rFormat}, expected ${expectedFormat}`;
                break;
              }
              receivedFormat = rFormat || 'Metadata';
            }
          }

          if (!nextStatus) {
            nextStatus = 'optimal';
            nextStatusMessage = isPacketTool
              ? 'Receiving packet traffic'
              : `Receiving ${receivedFormat} metadata`;
          }
        } else {
          nextStatus = undefined;
          nextStatusMessage = 'No active traffic streams';
        }

        // Only patch if something actually changed (avoids unnecessary re-renders)
        if (
          node.data?.status !== nextStatus ||
          node.data?.statusMessage !== nextStatusMessage ||
          node.data?.receivedFormat !== receivedFormat
        ) {
          nodeDataPatches[node.id] = {
            ...nodeDataPatches[node.id],
            status: nextStatus,
            statusMessage: nextStatusMessage,
            receivedFormat,
          };
        }
      });

      // ── 6. Single batched store update ──
      //
      // All computed state for this tick is submitted in ONE Zustand `set()`
      // call, which causes ONE React re-render instead of potentially dozens.
      updateSimulationTick(
        metrics,
        Array.from(activeEdgeSet),
        Array.from(blockedEdgeSet),
        Array.from(deliveredStreamIds),
        nodeDataPatches,
        streamPatches,
      );
    };

    // Run immediately so the first tick isn't delayed
    runSimulationStep();

    const intervalTime = 800 / simulationSpeed;
    tickRef.current = window.setInterval(runSimulationStep, intervalTime);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [isRunning, simulationSpeed, updateSimulationTick]);

  // This component has no visual output — it exists purely as a side-effect hook.
  return null;
};

export default SimulationEngine;
