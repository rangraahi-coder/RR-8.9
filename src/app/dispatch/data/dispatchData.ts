export interface DispatchEntry {
  id: string;
  dispatchNo: string;
  date: string;
  partyName: string;
  jobCardRef: string;
  styleName: string;
  orderedPieces: number;
  dispatchedPieces: number;
  vehicleNo?: string;
  driverName?: string;
  invoiceNo?: string;
  status: 'pending' | 'dispatched' | 'delivered';
  remarks?: string;
}

export const DISPATCH_ENTRIES: DispatchEntry[] = [];
