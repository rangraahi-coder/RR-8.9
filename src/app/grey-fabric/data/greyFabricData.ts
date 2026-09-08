export interface GreyFabricPurchase {
  id: string;
  purchaseNo: string;
  date: string;
  supplierName: string;
  fabricName: string;
  fabricType: string;
  orderedQty: number;
  receivedQty: number;
  unit: string;
  ratePerUnit: number;
  discount: number;
  discountType: 'amount' | 'percent';
  totalAmount: number;
  status: 'received' | 'partial' | 'pending';
  sentForDyeing: number;
  sentForPrinting: number;
  balanceInStock: number;
  thaanLengths: number[];
  // Metering variation
  lValue: number;           // Supplier's L in cm (e.g. 98 cm per metre)
  actualFabricQty: number;  // Billed Qty × L ÷ 100
  gstSlab: number;          // GST percentage slab (0, 5, 12, 18, 28)
  remarks?: string;
  // Audit trail
  createdBy?: string | null;
  createdAt?: string | null;
}

export const GREY_FABRIC_PURCHASES: GreyFabricPurchase[] = [];

export const GREY_FABRIC_SUMMARY = {
  totalPurchases: 0,
  totalReceivedQty: 0,
  totalSentForProcessing: 0,
  totalBalanceInStock: 0,
};
