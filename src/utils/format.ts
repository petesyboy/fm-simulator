/**
 * format.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared formatting utilities used across the simulator UI.
 *
 * Previously `formatBandwidth` was copy-pasted in both CustomNodes.tsx and
 * ConfigPanel.tsx (with slightly different precision), and `formatPackets` was
 * only in ConfigPanel.tsx.  Centralising them here means:
 *   • One place to update formatting rules.
 *   • Consistent output across every component.
 *   • Easier to unit-test independently of React.
 */

/**
 * Convert a raw Mbps value into a human-readable string.
 *
 * Examples:
 *   formatBandwidth(500)    → "500.0 Mbps"
 *   formatBandwidth(1500)   → "1.50 Gbps"
 *   formatBandwidth(10000)  → "10.00 Gbps"
 *
 * @param bps  Traffic rate in Mbps (the simulator stores everything in Mbps).
 * @param precision  Decimal places for the Gbps value (default: 2).
 */
export const formatBandwidth = (bps: number | undefined, precision = 2): string => {
  if (bps === undefined) return '0 Mbps';
  if (bps >= 1000) {
    return `${(bps / 1000).toFixed(precision)} Gbps`;
  }
  return `${bps.toFixed(1)} Mbps`;
};

/**
 * Format a packets-per-second value into a human-readable string.
 *
 * Examples:
 *   formatPackets(500)        → "500 pps"
 *   formatPackets(3500)       → "3.5 kpps"
 *   formatPackets(2500000)    → "2.5 Mpps"
 *
 * @param pps  Raw packet-per-second count.
 */
export const formatPackets = (pps: number | undefined): string => {
  if (pps === undefined) return '0 pps';
  if (pps >= 1_000_000) {
    return `${(pps / 1_000_000).toFixed(1)} Mpps`;
  }
  if (pps >= 1_000) {
    return `${(pps / 1_000).toFixed(1)} kpps`;
  }
  return `${pps.toFixed(0)} pps`;
};
