import { SubComponentCutDetail } from '@/app/cutting/data/cuttingData';

export type WorkflowStage = 'stitching' | 'qc' | 'finishing';

export interface StitchingEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  contractor: string;
  piecesReceived: number;
  piecesCompleted: number;
  stitchingDefects: number;
  productionLoss: number;
  netPiecesForQC: number;
  /** Sub-component breakdown carried from cutting entry */
  subComponentDetails?: SubComponentCutDetail[];
  status: 'in_progress' | 'completed';
  remarks?: string;
}

export interface QCEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  inspector: string;
  piecesReceived: number;
  piecesPass: number;
  piecesRejected: number;
  piecesRework: number;
  rejectionReason?: string;
  reworkReason?: string;
  netPiecesForFinishing: number;
  /** Sub-component breakdown carried forward */
  subComponentDetails?: SubComponentCutDetail[];
  status: 'in_progress' | 'completed';
  remarks?: string;
}

export interface FinishingEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  contractor: string;
  piecesReceived: number;
  piecesCompleted: number;
  finishingLoss: number;
  netFinishedPieces: number;
  /** Sub-component breakdown carried forward */
  subComponentDetails?: SubComponentCutDetail[];
  status: 'in_progress' | 'completed';
  remarks?: string;
}

export const STITCHING_ENTRIES: StitchingEntry[] = [];
export const QC_ENTRIES: QCEntry[] = [];
export const FINISHING_ENTRIES: FinishingEntry[] = [];
