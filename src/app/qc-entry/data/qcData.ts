export interface QCSubComponentDetail {
  id: string;
  component: string;
  piecesReceived: number;
  passCount: number;
  failCount: number;
  sizeBreakdown: { size: string; qty: number }[];
  defectCategories: string[];
}

export interface QCEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  stitchingEntryRef: string;
  totalPiecesReceived: number;
  totalPass: number;
  totalFail: number;
  netPassed: number;
  defectCategories: string[];
  subComponents: QCSubComponentDetail[];
  status: 'completed' | 'in_progress';
  remarks?: string;
}

export const QC_ENTRIES: QCEntry[] = [];

export const DEFECT_CATEGORIES = [
  'Stitching defect',
  'Measurement error',
  'Fabric damage',
  'Colour mismatch',
  'Pilling / Snag',
  'Broken button / snap',
  'Uneven hem',
  'Dirty / stain',
  'Thread hanging',
  'Seam open',
  'Wrong label',
  'Other',
];
