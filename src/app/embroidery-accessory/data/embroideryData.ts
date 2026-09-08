export type ProcessType =
  | 'embroidery' |'yoke_embroidery' |'accessory_sorting' |'other';

export const PROCESS_TYPE_LABELS: Record<ProcessType, string> = {
  embroidery: 'Embroidery Work',
  yoke_embroidery: 'Yoke Embroidery',
  accessory_sorting: 'Accessory Sorting',
  other: 'Other Process',
};

export type EmbroideryType = 'yoke_embroidery' | 'border_embroidery';

export const EMBROIDERY_TYPE_LABELS: Record<EmbroideryType, string> = {
  yoke_embroidery: 'Yoke Embroidery',
  border_embroidery: 'Border Embroidery',
};

export interface AccessoryUsed {
  name: string;
  qty: number;
  unit: string;
}

export interface ProcessDetail {
  subComponent: string;
  piecesIn: number;
  piecesOut: number;
  rejections: number;
}

export interface FabricIssueRow {
  fabricId: string;
  fabricName: string;
  rollId: string;
  rollName: string;
  issuedQty: number;
  consumedQty: number;
  returnedQty: number;
  unit: string;
}

export interface EmbroideryAccessoryEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  processType: ProcessType;
  embroideryType?: EmbroideryType;
  operatorName: string;
  piecesReceived: number;
  piecesProcessed: number;
  piecesRejected: number;
  netPieces: number;
  finishedPieces: number;
  rejectionReason?: string;
  accessoriesUsed: AccessoryUsed[];
  processDetails: ProcessDetail[];
  fabricIssues: FabricIssueRow[];
  status: 'in_progress' | 'completed';
  remarks?: string;
  pricePerPiece?: number;
  totalAmount?: number;
}
