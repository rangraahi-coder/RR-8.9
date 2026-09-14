// Ready-to-Cut Fabric Stock
// No entries — awaiting fresh import

export interface FabricStockItem {
  id: string;
  fabricName: string;
  unit: string;
  stockQty: number;
  category: 'JK' | 'MALMAL' | 'RAYON' | 'YUFTA' | 'KERI_PRINT' | 'OTHER';
  status: 'ready_to_cut';
  // Audit trail
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  // Finished-fabric identity & lineage
  inventoryStage?: string | null;
  finishedFabricName?: string | null;
  sourceModule?: string | null;
  sourceReceiptId?: string | null;
  sourceGreyFabricRef?: string | null;
  processorName?: string | null;
  processingType?: string | null;
  receivedDate?: string | null;
}

function deriveCategory(name: string): FabricStockItem['category'] {
  const upper = name.toUpperCase();
  if (upper.includes('MALMAL') || upper.includes('MAL CHANDARI')) return 'MALMAL';
  if (upper.includes('RAYON')) return 'RAYON';
  if (upper.includes('YUFTA')) return 'YUFTA';
  if (upper.includes('KERI')) return 'KERI_PRINT';
  if (upper.includes('JK')) return 'JK';
  return 'OTHER';
}

const rawData: { fabricName: string; unit: string; stockQty: number }[] = [];

export const FABRIC_STOCK: FabricStockItem[] = rawData.map((item, index) => ({
  id: `fab-${String(index + 1).padStart(3, '0')}`,
  fabricName: item.fabricName,
  unit: item.unit,
  stockQty: item.stockQty,
  category: deriveCategory(item.fabricName),
  status: 'ready_to_cut',
}));

export const FABRIC_STOCK_SUMMARY = {
  totalItems: 0,
  totalQty: 0,
  unit: 'Metre',
  source: 'Awaiting fresh import',
  period: '',
  note: 'No fabric inventory entries. Please import fresh data.',
};
