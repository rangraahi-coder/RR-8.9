export type DyeingProcessType = 'dyeing' | 'printing' | 'washing' | 'bleaching' | 'other';

export const DYEING_PROCESS_TYPE_LABELS: Record<DyeingProcessType, string> = {
  dyeing: 'Dyeing',
  printing: 'Printing',
  washing: 'Washing',
  bleaching: 'Bleaching',
  other: 'Other',
};

export interface DyeingProcessingEntry {
  id: string;
  entryNo: string;
  date: string;
  grayFabricRef: string;       // required
  jobCardRef?: string;          // optional
  styleName?: string;
  processType: DyeingProcessType;
  processorName: string;
  dyeBatchNo: string;           // auto-generated
  colourShade: string;
  qtyMeters: number;            // qty in metres
  piecesIn: number;             // kept for backward compat
  piecesOut: number;
  piecesRejected: number;
  netPieces: number;
  sentDate?: string;
  expectedDate?: string;        // replaces receivedDate in form
  receivedDate?: string;        // kept for backward compat / fabric inventory punch
  processingTimeHours?: number;
  remarks?: string;
  // fabric inventory punch tracking
  fabricInventoryPunched?: boolean;
  /** Canonical finished-fabric name — required before punching to inventory */
  finishedFabricName?: string;
}

// Legacy type kept for backward compatibility (unused)
export type ProcessType = 'dyeing' | 'printing';
export interface DyeingPrintingEntry {
  id: string;
  entryNo: string;
  date: string;
  greyFabricRef: string;
  fabricName: string;
  processType: ProcessType;
  processorName: string;
  sentQty: number;
  receivedQty: number;
  unit: string;
  shrinkageLoss: number;
  processLoss: number;
  shortage: number;
  totalLoss: number;
  lossPercent: number;
  status: 'sent' | 'received' | 'partial';
  sentDate: string;
  receivedDate?: string;
  remarks?: string;
}
export const DYEING_PRINTING_ENTRIES: DyeingPrintingEntry[] = [];
