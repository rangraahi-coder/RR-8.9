// Production Batch — links a Job Card to stage-wise quantity tracking
// Stages: Cutting → Stitching → QC → Finishing

export type BatchStage = 'cutting' | 'stitching' | 'qc' | 'finishing' | 'done';

export interface StageRecord {
  stage: BatchStage;
  date: string;
  issuedQty: number;       // pieces sent into this stage
  completedQty: number;    // pieces that came out OK
  rejectedQty: number;     // defects / rejections
  reworkQty: number;       // sent for rework (QC only)
  lossQty: number;         // wastage / process loss
  remarks?: string;
  updatedAt?: string;
}

// Per-component record at a single stage (e.g. Kurta at Cutting)
export interface CompositionStageRecord {
  issuedQty: number;
  completedQty: number;
  rejectedQty: number;
  reworkQty: number;
  lossQty: number;
  remarks?: string;
  date?: string;
  updatedAt?: string;
}

// composition_stages[stageName][componentName] = CompositionStageRecord
export type CompositionStages = Partial<Record<BatchStage, Record<string, CompositionStageRecord>>>;

export interface ItemComposition {
  id: string;
  style_id: string;
  component_name: string;
  component_name_normalized: string;
  qty_per_set: number;
  unit: string;
  sort_order: number;
  notes: string;
}

export interface ProductionBatch {
  id: string;
  batchNo: string;
  jobCardId: string;
  jobCardNo: string;
  styleName: string;
  partyName: string;
  totalOrderedQty: number;
  currentStage: BatchStage;
  stages: Partial<Record<BatchStage, StageRecord>>;
  compositionStages: CompositionStages;  // per-component tracking
  compositions: ItemComposition[];       // loaded from item_compositions
  createdDate: string;
  status: 'active' | 'completed' | 'on_hold';
  // Audit trail
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// Derive batches from job cards — one batch per job card
// In a real app these would come from the DB; here we seed empty batches
export const PRODUCTION_BATCHES: ProductionBatch[] = [];
