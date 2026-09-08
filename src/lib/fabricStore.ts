/**
 * Centralized Fabric Store
 * Single source of truth for all fabric names and inventory entries across the ERP.
 * Fabric added via Fabric Entry (voucher) is automatically available in all modules.
 */

export interface FabricEntry {
  id: string;
  fabricName: string;
  category: string;
  unit: string;
  stockQty: number;
  source: string;
  voucherNo: string;
  date: string;
  remarks?: string;
}

// In-memory store — persists for the entire browser session
let _fabricEntries: FabricEntry[] = [];

// Listeners for reactive updates
type Listener = () => void;
const _listeners: Set<Listener> = new Set();

function notify() {
  _listeners.forEach((fn) => fn());
}

export const fabricStore = {
  /** Subscribe to store changes. Returns unsubscribe function. */
  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  /** Get all fabric entries */
  getEntries(): FabricEntry[] {
    return [..._fabricEntries];
  },

  /** Get unique fabric names (sorted) */
  getFabricNames(): string[] {
    const names = new Set(_fabricEntries.map((e) => e.fabricName).filter(Boolean));
    return Array.from(names).sort();
  },

  /** Add a single fabric entry */
  addEntry(entry: FabricEntry) {
    _fabricEntries = [..._fabricEntries, entry];
    notify();
  },

  /** Add multiple fabric entries at once (from a voucher) */
  addEntries(entries: FabricEntry[]) {
    _fabricEntries = [..._fabricEntries, ...entries];
    notify();
  },

  /** Add a fabric name only (without full entry — for quick additions from dropdowns) */
  addFabricName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = _fabricEntries.some(
      (e) => e.fabricName.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      const entry: FabricEntry = {
        id: `fab-quick-${Date.now()}`,
        fabricName: trimmed,
        category: 'OTHER',
        unit: 'Metre',
        stockQty: 0,
        source: 'Manual Entry',
        voucherNo: '-',
        date: new Date().toISOString().slice(0, 10),
      };
      _fabricEntries = [..._fabricEntries, entry];
      notify();
    }
  },

  /** Clear all entries (for reset/testing) */
  clear() {
    _fabricEntries = [];
    notify();
  },
};
