// Fabric Stock Tracker — Party-wise, Color-wise tracking
// Inbound receipts, shortage flags, PO reconciliation

export interface FabricParty {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  city: string;
  type: 'supplier' | 'processor';
}

export interface FabricColor {
  id: string;
  colorName: string;
  colorCode?: string; // hex
  category: string;
}

export interface FabricStockLedger {
  id: string;
  partyId: string;
  partyName: string;
  fabricName: string;
  colorId: string;
  colorName: string;
  category: string;
  currentStock: number;
  unit: string;
  minStockLevel: number;
  reservedForJobCards: number;
  availableStock: number;
}

export interface InboundReceipt {
  id: string;
  receiptNo: string;
  date: string;
  partyId: string;
  partyName: string;
  fabricName: string;
  colorName: string;
  category: string;
  poReference?: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  ratePerUnit: number;
  totalAmount: number;
  status: 'full' | 'partial' | 'excess';
  remarks?: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  date: string;
  partyId: string;
  partyName: string;
  fabricName: string;
  colorName: string;
  category: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  unit: string;
  ratePerUnit: number;
  expectedDate: string;
  status: 'open' | 'partial' | 'closed' | 'overdue';
}

export interface ShortageAlert {
  id: string;
  fabricName: string;
  colorName: string;
  partyName: string;
  category: string;
  currentStock: number;
  requiredQty: number;
  shortageQty: number;
  unit: string;
  blockedJobCards: string[];
  severity: 'critical' | 'warning';
}

// --- Parties ---
export const FABRIC_PARTIES: FabricParty[] = [];

// --- Stock Ledger ---
export const FABRIC_STOCK_LEDGER: FabricStockLedger[] = [];

// --- Inbound Receipts ---
export const INBOUND_RECEIPTS: InboundReceipt[] = [];

// --- Purchase Orders ---
export const PURCHASE_ORDERS: PurchaseOrder[] = [];

// --- Shortage Alerts ---
export const SHORTAGE_ALERTS: ShortageAlert[] = [];
