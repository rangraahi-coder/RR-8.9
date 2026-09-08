export interface StitchingSubComponentDetail {
  id: string;
  component: string;
  operatorName: string;
  piecesReceived: number;
  piecesStitched: number;
  rejections: number;
  netPieces: number;
  sizeBreakdown: { size: string; qty: number }[];
}

export interface StitchingEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  cuttingEntryRef: string;
  totalPiecesReceived: number;
  totalPiecesStitched: number;
  totalRejections: number;
  netPiecesPassed: number;
  rejectionReason?: string;
  subComponents: StitchingSubComponentDetail[];
  status: 'completed' | 'in_progress';
  remarks?: string;
}

export const STITCHING_ENTRIES: StitchingEntry[] = [];
