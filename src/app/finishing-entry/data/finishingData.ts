export interface FinishingSubComponentDetail {
  id: string;
  component: string;
  qcPassCount: number;
  finalCount: number;
  packagingStatus: 'packed' | 'unpacked' | 'partial';
  sizeBreakdown: { size: string; qty: number }[];
  remarks: string;
}

export interface FinishingEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  qcEntryRef: string;
  totalQcPassed: number;
  totalFinished: number;
  packagingStatus: 'packed' | 'unpacked' | 'partial';
  qualitySignOff: boolean;
  qualitySignOffBy: string;
  subComponents: FinishingSubComponentDetail[];
  status: 'completed' | 'in_progress';
  remarks?: string;
}

export const FINISHING_ENTRIES: FinishingEntry[] = [];

export const PACKAGING_STATUS_OPTIONS = [
  { value: 'packed', label: 'Packed', color: 'text-success' },
  { value: 'partial', label: 'Partial', color: 'text-warning' },
  { value: 'unpacked', label: 'Unpacked', color: 'text-danger' },
] as const;
