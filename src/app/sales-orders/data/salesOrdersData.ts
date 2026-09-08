// All imported sales order data has been permanently removed.
// Only manually punched entries from Supabase are used.

export interface SalesOrderItem {
  itemName: string;
  paramSize: string;
  paramColour: string;
  qty: number;
  unit: string;
  price: number;
  amount: number;
}

export interface SalesOrder {
  id: string;
  date: string;           // DD-MM-YYYY
  vchNo: string;
  partyName: string;
  partyType: 'external' | 'self'; // self = Rangraahi Creations own brand
  items: SalesOrderItem[];
  totalQty: number;
  totalAmount: number;
  jobCardNo: string;      // auto-generated job card reference
  status: 'pending' | 'in_production' | 'completed';
  // Audit trail
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const SALES_ORDERS: SalesOrder[] = [];
