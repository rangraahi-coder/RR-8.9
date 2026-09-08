export interface SubComponentSizeDetail {
  size: string;
  qty: number;
}

export interface SubComponentCutDetail {
  component: string; // e.g. Kurta, Pant, Dupatta
  fabricName?: string; // per-component fabric (optional, falls back to entry-level fabricName)
  sizes: SubComponentSizeDetail[];
  totalPieces: number;
  rejections: number;
  netPieces: number;
}

export interface RollDetail {
  rollNo: string;
  fabricRollId: string;
  fabricIssuedQty: number;
  fabricConsumedQty: number;
  wastageQty: number;
}

export interface CuttingEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  cuttingMaster: string;
  fabricName: string;
  fabricIssuedQty: number;
  fabricConsumedQty: number;
  fabricLeftover: number;
  unit: string;
  totalPiecesCut: number;
  wastageQty: number;
  cuttingRejections: number;
  rejectionReason?: string;
  netPiecesForStitching: number;
  subComponentDetails: SubComponentCutDetail[];
  rollDetails: RollDetail[];
  status: 'in_progress' | 'completed';
  remarks?: string;
  cuttingPrice?: number;
  /** Embroidery-received cutting stock items consumed in this cutting entry */
  embReceiveItems?: import('@/lib/services/cuttingService').EmbReceiveItem[];
}

export const CUTTING_ENTRIES: CuttingEntry[] = [];
