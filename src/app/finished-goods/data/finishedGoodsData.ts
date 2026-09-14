export interface FinishedGoodsItem {
  id: string;
  styleName: string;
  jobCardRef: string;
  partyName: string;
  totalPieces: number;
  availableForDispatch: number;
  dispatchedPieces: number;
  dateAdded: string;
  status: 'available' | 'partial' | 'dispatched';
}

export const FINISHED_GOODS: FinishedGoodsItem[] = [];
