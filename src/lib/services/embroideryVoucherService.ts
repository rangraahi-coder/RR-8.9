import { createClient } from '@/lib/supabase/client';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IssueFabricItem {
  fabricId: string;
  fabricName: string;
  rollId: string;
  rollName: string;
  issuedQty: number;
  unit: string;
}

export interface IssueAccessoryItem {
  name: string;
  qty: number;
  unit: string;
}

export interface IssueCuttingItem {
  component: string;
  description?: string;
  pieces: number;
  unit: string;
}

export type IssueSource = 'fresh_cutting' | 'processed_cutting';

export interface EmbIssueVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  jobCardRef: string;
  jobCardId: string;
  styleName: string;
  partyName: string;
  poNo: string;
  designCode: string;
  totalPieces: number;
  colors: string[];
  sizes: string[];
  operatorId: string;
  operatorName: string;
  issueType: 'fabric' | 'accessory' | 'both' | 'cutting' | 'part_component';
  issueSource: IssueSource;
  processType: string;
  issuedToName: string;
  issuedToType: string;
  cuttingStockId: string;
  fabricItems: IssueFabricItem[];
  accessoryItems: IssueAccessoryItem[];
  cuttingItems: IssueCuttingItem[];
  status: 'open' | 'partially_received' | 'fully_received' | 'closed';
  remarks: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
}

export interface ReceiveFabricItem {
  fabricId: string;
  fabricName: string;
  rollId: string;
  rollName: string;
  issuedQty: number;
  receivedQty: number;
  balanceQty: number;
  unit: string;           // issue unit (from issue voucher)
  receiveUnit?: string;   // actual unit used when receiving (can differ from issue unit)
}

export interface ReceiveAccessoryItem {
  name: string;
  issuedQty: number;
  receivedQty: number;
  balanceQty: number;
  unit: string;           // issue unit
  receiveUnit?: string;   // actual unit used when receiving
}

export interface ReceiveCuttingItem {
  component: string;
  description?: string;
  issuedPieces: number;
  receivedPieces: number;
  balancePieces: number;
  unit: string;           // issue unit
  receiveUnit?: string;   // actual unit used when receiving (e.g. Yoke, Pcs, Metre)
  cuttingCharge?: number; // cutting charge amount for this component
}

export interface EmbReceiveVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  issueVoucherId: string;
  issueVoucherNo: string;
  jobCardRef: string;
  styleName: string;
  partyName: string;
  operatorName: string;         // issue operator (who the material was issued to)
  receiveOperatorName?: string; // receive operator (who returned the material)
  fabricItems: ReceiveFabricItem[];
  accessoryItems: ReceiveAccessoryItem[];
  cuttingItems: ReceiveCuttingItem[];
  totalPiecesReceived: number;
  remarks: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
}

// ─── Cutting Stock Types ──────────────────────────────────────────────────────

export interface CuttingStockItem {
  id: string;
  cuttingEntryId?: string;
  receiveVoucherId?: string;
  receiveVoucherNo?: string;
  issueVoucherId?: string;
  issueVoucherNo?: string;
  jobCardRef: string;
  jobCardId?: string;
  styleName: string;
  partyName: string;
  component: string;
  description?: string;
  totalPieces: number;
  availablePieces: number;
  issuedPieces: number;
  unit: string;
  status: 'available' | 'partially_issued' | 'fully_issued' | 'depleted';
  remarks?: string;
  createdAt?: string;
}

export type MovementType =
  | 'received_from_cutting' |'issued_for_embroidery' |'issued_for_handwork' |'issued_for_recutting' |'issued_for_matching' |'issued_for_verification' |'issued_to_cutting_master' |'issued_to_employee' |'issued_to_department' |'received_back' |'other';

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  received_from_cutting: 'Received from Cutting',
  issued_for_embroidery: 'Issued for Embroidery',
  issued_for_handwork: 'Issued for Handwork',
  issued_for_recutting: 'Issued for Re-Cutting',
  issued_for_matching: 'Issued for Matching',
  issued_for_verification: 'Issued for Verification',
  issued_to_cutting_master: 'Issued to Cutting Master',
  issued_to_employee: 'Issued to Employee',
  issued_to_department: 'Issued to Department',
  received_back: 'Received Back',
  other: 'Other',
};

export interface CuttingMovement {
  id: string;
  cuttingStockId: string;
  movementType: MovementType;
  voucherType?: string;
  voucherId?: string;
  voucherNo?: string;
  fromEntity?: string;
  toEntity?: string;
  toEntityType?: string;
  pieces: number;
  jobCardRef?: string;
  styleName?: string;
  component?: string;
  processType?: string;
  remarks?: string;
  movementDate: string;
  createdBy?: string;
  createdAt?: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToIssueVoucher(row: any): EmbIssueVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    jobCardRef: row.job_card_ref || '',
    jobCardId: row.job_card_id || '',
    styleName: row.style_name || '',
    partyName: row.party_name || '',
    poNo: row.po_no || '',
    designCode: row.design_code || '',
    totalPieces: row.total_pieces || 0,
    colors: Array.isArray(row.colors) ? row.colors : [],
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    operatorId: row.operator_id || '',
    operatorName: row.operator_name || '',
    issueType: (row.issue_type as EmbIssueVoucher['issueType']) || 'fabric',
    issueSource: (row.issue_source as IssueSource) || 'fresh_cutting',
    processType: row.process_type || 'embroidery',
    issuedToName: row.issued_to_name || row.operator_name || '',
    issuedToType: row.issued_to_type || 'operator',
    cuttingStockId: row.cutting_stock_id || '',
    fabricItems: Array.isArray(row.fabric_items) ? row.fabric_items : [],
    accessoryItems: Array.isArray(row.accessory_items) ? row.accessory_items : [],
    cuttingItems: Array.isArray(row.cutting_items) ? row.cutting_items : [],
    status: (row.status as EmbIssueVoucher['status']) || 'open',
    remarks: row.remarks || '',
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToReceiveVoucher(row: any): EmbReceiveVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    issueVoucherId: row.issue_voucher_id,
    issueVoucherNo: row.issue_voucher_no,
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || '',
    partyName: row.party_name || '',
    operatorName: row.operator_name || '',
    receiveOperatorName: row.receive_operator_name || '',
    fabricItems: Array.isArray(row.fabric_items) ? row.fabric_items : [],
    accessoryItems: Array.isArray(row.accessory_items) ? row.accessory_items : [],
    cuttingItems: Array.isArray(row.cutting_items) ? row.cutting_items : [],
    totalPiecesReceived: row.total_pieces_received || 0,
    remarks: row.remarks || '',
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToCuttingStock(row: any): CuttingStockItem {
  return {
    id: row.id,
    cuttingEntryId: row.cutting_entry_id || undefined,
    receiveVoucherId: row.receive_voucher_id || undefined,
    receiveVoucherNo: row.receive_voucher_no || undefined,
    issueVoucherId: row.issue_voucher_id || undefined,
    issueVoucherNo: row.issue_voucher_no || undefined,
    jobCardRef: row.job_card_ref || '',
    jobCardId: row.job_card_id || undefined,
    styleName: row.style_name || '',
    partyName: row.party_name || '',
    component: row.component || '',
    description: row.description || undefined,
    totalPieces: row.total_pieces || 0,
    availablePieces: row.available_pieces || 0,
    issuedPieces: row.issued_pieces || 0,
    unit: row.unit || 'Pcs',
    status: row.status || 'available',
    remarks: row.remarks || undefined,
    createdAt: row.created_at || '',
  };
}

function rowToMovement(row: any): CuttingMovement {
  return {
    id: row.id,
    cuttingStockId: row.cutting_stock_id,
    movementType: row.movement_type as MovementType,
    voucherType: row.voucher_type || undefined,
    voucherId: row.voucher_id || undefined,
    voucherNo: row.voucher_no || undefined,
    fromEntity: row.from_entity || undefined,
    toEntity: row.to_entity || undefined,
    toEntityType: row.to_entity_type || undefined,
    pieces: row.pieces || 0,
    jobCardRef: row.job_card_ref || undefined,
    styleName: row.style_name || undefined,
    component: row.component || undefined,
    processType: row.process_type || undefined,
    remarks: row.remarks || undefined,
    movementDate: row.movement_date || '',
    createdBy: row.created_by || undefined,
    createdAt: row.created_at || '',
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const embroideryVoucherService = {
  // ── Issue Vouchers ──────────────────────────────────────────────────────────

  async getAllIssueVouchers(): Promise<EmbIssueVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('emb_issue_vouchers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getAllIssue]', error); return []; }
    return (data || []).map(rowToIssueVoucher);
  },

  async getIssueVoucherById(id: string): Promise<EmbIssueVoucher | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('emb_issue_vouchers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) { console.error('[embVoucher.getIssueById]', error); return null; }
    return rowToIssueVoucher(data);
  },

  async createIssueVoucher(
    v: Omit<EmbIssueVoucher, 'id' | 'createdAt'>,
    username?: string | null
  ): Promise<EmbIssueVoucher | null> {
    const supabase = createClient();
    const row = {
      voucher_no: v.voucherNo,
      voucher_date: v.voucherDate,
      job_card_ref: v.jobCardRef || null,
      job_card_id: v.jobCardId || null,
      style_name: v.styleName || null,
      party_name: v.partyName || null,
      po_no: v.poNo || null,
      design_code: v.designCode || null,
      total_pieces: v.totalPieces || null,
      colors: v.colors || [],
      sizes: v.sizes || [],
      operator_id: v.operatorId || null,
      operator_name: v.operatorName || null,
      issue_type: v.issueType,
      issue_source: v.issueSource || 'fresh_cutting',
      process_type: v.processType || 'embroidery',
      issued_to_name: v.issuedToName || v.operatorName || null,
      issued_to_type: v.issuedToType || 'operator',
      cutting_stock_id: (v.cuttingStockId && !v.cuttingStockId.startsWith('rv-')) ? v.cuttingStockId : null,
      fabric_items: v.fabricItems || [],
      accessory_items: v.accessoryItems || [],
      cutting_items: v.cuttingItems || [],
      status: v.status || 'open',
      remarks: v.remarks || null,
      created_by: username || null,
    };
    const { data, error } = await supabase
      .from('emb_issue_vouchers')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[embVoucher.createIssue]', error); return null; }

    const saved = rowToIssueVoucher(data);

    // Deduct fabric stock for each issued fabric roll
    if (v.fabricItems && v.fabricItems.length > 0) {
      await fabricInventoryService.deductFabricStock(
        v.fabricItems
          .filter((f) => f.rollId && f.issuedQty > 0)
          .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.issuedQty }))
      );
    }

    // If issuing from cutting stock, deduct available pieces and log movement
    if (v.issueSource === 'processed_cutting' && v.cuttingStockId && v.cuttingItems.length > 0) {
      const totalPieces = v.cuttingItems.reduce((s, c) => s + c.pieces, 0);
      await this.deductCuttingStock(v.cuttingStockId, totalPieces, username);
      // Log movement
      for (const ci of v.cuttingItems) {
        await this.logMovement({
          cuttingStockId: v.cuttingStockId,
          movementType: this._processTypeToMovementType(v.processType),
          voucherType: 'issue_voucher',
          voucherId: saved.id,
          voucherNo: saved.voucherNo,
          fromEntity: 'Cutting Stock',
          toEntity: v.issuedToName || v.operatorName,
          toEntityType: v.issuedToType || 'operator',
          pieces: ci.pieces,
          jobCardRef: v.jobCardRef,
          styleName: v.styleName,
          component: ci.component,
          processType: v.processType,
          remarks: v.remarks,
          movementDate: v.voucherDate,
          createdBy: username || undefined,
        });
      }
    }

    return saved;
  },

  _processTypeToMovementType(processType: string): MovementType {
    const map: Record<string, MovementType> = {
      embroidery: 'issued_for_embroidery',
      yoke_embroidery: 'issued_for_embroidery',
      handwork: 'issued_for_handwork',
      recutting: 'issued_for_recutting',
      matching: 'issued_for_matching',
      verification: 'issued_for_verification',
      cutting_master: 'issued_to_cutting_master',
    };
    return map[processType] || 'other';
  },

  async updateIssueVoucherStatus(
    id: string,
    status: EmbIssueVoucher['status'],
    username?: string | null
  ): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('emb_issue_vouchers')
      .update({ status, updated_by: username || null })
      .eq('id', id);
    if (error) { console.error('[embVoucher.updateStatus]', error); return false; }
    return true;
  },

  async updateIssueVoucher(
    id: string,
    v: Partial<Pick<EmbIssueVoucher, 'voucherDate' | 'operatorId' | 'operatorName' | 'issuedToName' | 'issuedToType' | 'processType' | 'remarks' | 'fabricItems' | 'accessoryItems' | 'cuttingItems'>>,
    username?: string | null
  ): Promise<boolean> {
    const supabase = createClient();
    const updates: Record<string, unknown> = { updated_by: username || null };
    if (v.voucherDate !== undefined) updates.voucher_date = v.voucherDate;
    if (v.operatorId !== undefined) updates.operator_id = v.operatorId || null;
    if (v.operatorName !== undefined) updates.operator_name = v.operatorName || null;
    if (v.issuedToName !== undefined) updates.issued_to_name = v.issuedToName || null;
    if (v.issuedToType !== undefined) updates.issued_to_type = v.issuedToType || null;
    if (v.processType !== undefined) updates.process_type = v.processType || null;
    if (v.remarks !== undefined) updates.remarks = v.remarks || null;
    if (v.fabricItems !== undefined) updates.fabric_items = v.fabricItems;
    if (v.accessoryItems !== undefined) updates.accessory_items = v.accessoryItems;
    if (v.cuttingItems !== undefined) updates.cutting_items = v.cuttingItems;
    const { error } = await supabase
      .from('emb_issue_vouchers')
      .update(updates)
      .eq('id', id);
    if (error) { console.error('[embVoucher.updateIssue]', error); return false; }
    return true;
  },

  /**
   * Update an issue voucher with full quantity recalculation.
   * Reverses old fabric/cutting stock impacts and applies new ones.
   */
  async updateIssueVoucherWithRecalc(
    id: string,
    oldVoucher: EmbIssueVoucher,
    newData: Partial<Pick<EmbIssueVoucher, 'voucherDate' | 'operatorId' | 'operatorName' | 'issuedToName' | 'issuedToType' | 'processType' | 'remarks' | 'fabricItems' | 'accessoryItems' | 'cuttingItems'>>,
    username?: string | null
  ): Promise<boolean> {
    const supabase = createClient();

    // ── 1. Reverse OLD fabric stock impacts ──────────────────────────────────
    const oldFabricItems = oldVoucher.fabricItems || [];
    if (oldFabricItems.length > 0) {
      // Restore what was previously deducted
      await fabricInventoryService.restoreFabricStock(
        oldFabricItems
          .filter((f) => f.rollId && f.issuedQty > 0)
          .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.issuedQty }))
      );
    }

    // ── 2. Reverse OLD cutting stock impacts ─────────────────────────────────
    if (
      oldVoucher.issueSource === 'processed_cutting' &&
      oldVoucher.cuttingStockId &&
      !oldVoucher.cuttingStockId.startsWith('rv-') &&
      oldVoucher.cuttingItems.length > 0
    ) {
      const oldTotalPieces = oldVoucher.cuttingItems.reduce((s, c) => s + c.pieces, 0);
      await this.restoreCuttingStock(oldVoucher.cuttingStockId, oldTotalPieces, username);
      // Remove old movement history entries for this voucher
      await supabase
        .from('cutting_movement_history')
        .delete()
        .eq('voucher_id', id);
    }

    // ── 3. Apply NEW fabric stock impacts ────────────────────────────────────
    const newFabricItems = newData.fabricItems || [];
    if (newFabricItems.length > 0) {
      await fabricInventoryService.deductFabricStock(
        newFabricItems
          .filter((f) => f.rollId && f.issuedQty > 0)
          .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.issuedQty }))
      );
    }

    // ── 4. Apply NEW cutting stock impacts ───────────────────────────────────
    const newCuttingItems = newData.cuttingItems || [];
    if (
      oldVoucher.issueSource === 'processed_cutting' &&
      oldVoucher.cuttingStockId &&
      !oldVoucher.cuttingStockId.startsWith('rv-') &&
      newCuttingItems.length > 0
    ) {
      const newTotalPieces = newCuttingItems.reduce((s, c) => s + c.pieces, 0);
      await this.deductCuttingStock(oldVoucher.cuttingStockId, newTotalPieces, username);
      // Log new movement entries
      for (const ci of newCuttingItems) {
        await this.logMovement({
          cuttingStockId: oldVoucher.cuttingStockId,
          movementType: this._processTypeToMovementType(newData.processType || oldVoucher.processType),
          voucherType: 'issue_voucher',
          voucherId: id,
          voucherNo: oldVoucher.voucherNo,
          fromEntity: 'Cutting Stock',
          toEntity: newData.issuedToName || newData.operatorName || oldVoucher.operatorName,
          toEntityType: newData.issuedToType || oldVoucher.issuedToType,
          pieces: ci.pieces,
          jobCardRef: oldVoucher.jobCardRef,
          styleName: oldVoucher.styleName,
          component: ci.component,
          processType: newData.processType || oldVoucher.processType,
          remarks: newData.remarks || oldVoucher.remarks,
          movementDate: newData.voucherDate || oldVoucher.voucherDate,
          createdBy: username || undefined,
        });
      }
    }

    // ── 5. Persist updated voucher fields ────────────────────────────────────
    const updates: Record<string, unknown> = { updated_by: username || null };
    if (newData.voucherDate !== undefined) updates.voucher_date = newData.voucherDate;
    if (newData.operatorId !== undefined) updates.operator_id = newData.operatorId || null;
    if (newData.operatorName !== undefined) updates.operator_name = newData.operatorName || null;
    if (newData.issuedToName !== undefined) updates.issued_to_name = newData.issuedToName || null;
    if (newData.issuedToType !== undefined) updates.issued_to_type = newData.issuedToType || null;
    if (newData.processType !== undefined) updates.process_type = newData.processType || null;
    if (newData.remarks !== undefined) updates.remarks = newData.remarks || null;
    if (newData.fabricItems !== undefined) updates.fabric_items = newData.fabricItems;
    if (newData.accessoryItems !== undefined) updates.accessory_items = newData.accessoryItems;
    if (newData.cuttingItems !== undefined) updates.cutting_items = newData.cuttingItems;

    const { error } = await supabase
      .from('emb_issue_vouchers')
      .update(updates)
      .eq('id', id);
    if (error) { console.error('[embVoucher.updateIssueVoucherWithRecalc]', error); return false; }

    // ── 6. Recalculate issue voucher status based on active receive vouchers ─
    await this._updateIssueVoucherStatusAfterReceive(id, username);

    return true;
  },

  async deleteIssueVoucher(id: string): Promise<boolean> {
    const supabase = createClient();

    // Step 0: Fetch the issue voucher BEFORE deleting so we can reverse its impacts
    const { data: issueRow } = await supabase
      .from('emb_issue_vouchers')
      .select('*')
      .eq('id', id)
      .single();

    if (issueRow) {
      const issueVoucher = rowToIssueVoucher(issueRow);

      // Reverse fabric stock deductions made when this voucher was created
      if (issueVoucher.fabricItems && issueVoucher.fabricItems.length > 0) {
        await fabricInventoryService.restoreFabricStock(
          issueVoucher.fabricItems
            .filter((f) => f.rollId && f.issuedQty > 0)
            .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.issuedQty }))
        );
      }

      // Reverse cutting stock deductions made when this voucher was created
      if (
        issueVoucher.issueSource === 'processed_cutting' &&
        issueVoucher.cuttingStockId &&
        issueVoucher.cuttingItems.length > 0
      ) {
        const totalPieces = issueVoucher.cuttingItems.reduce((s, c) => s + c.pieces, 0);
        if (!issueVoucher.cuttingStockId.startsWith('rv-')) {
          await this.restoreCuttingStock(issueVoucher.cuttingStockId, totalPieces, null);
        }
        // Delete movement history entries linked to this voucher
        await supabase
          .from('cutting_movement_history')
          .delete()
          .eq('voucher_id', id);
      }

      // Also reverse fabric stock that was restored by linked receive vouchers
      // (when we delete the issue, we also delete receives — so we must re-deduct what receives restored)
      const { data: linkedReceives } = await supabase
        .from('emb_receive_vouchers')
        .select('*')
        .eq('issue_voucher_id', id);

      for (const rvRow of (linkedReceives || [])) {
        const rv = rowToReceiveVoucher(rvRow);
        // Receives restored fabric stock — we need to re-deduct it
        if (rv.fabricItems && rv.fabricItems.length > 0) {
          await fabricInventoryService.deductFabricStock(
            rv.fabricItems
              .filter((f) => f.rollId && (f.receivedQty || 0) > 0)
              .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.receivedQty }))
          );
        }
        // Receives may have created cutting_stock rows — delete them
        if (rv.cuttingItems && rv.cuttingItems.length > 0) {
          const { data: stockRows } = await supabase
            .from('cutting_stock')
            .select('id')
            .eq('receive_voucher_id', rvRow.id);
          for (const sr of (stockRows || [])) {
            await supabase.from('cutting_stock').delete().eq('id', sr.id);
          }
        }
        // Delete movement history for receive voucher
        await supabase
          .from('cutting_movement_history')
          .delete()
          .eq('voucher_id', rvRow.id);
      }
    }

    // Step 1: Delete all receive vouchers linked to this issue voucher first
    const { error: receiveDeleteError } = await supabase
      .from('emb_receive_vouchers')
      .delete()
      .eq('issue_voucher_id', id);

    if (receiveDeleteError) {
      console.error('[embVoucher.deleteIssueVoucher] Failed to delete linked receive vouchers', receiveDeleteError);
      return false;
    }

    // Step 2: Now delete the issue voucher itself
    const { error } = await supabase
      .from('emb_issue_vouchers')
      .delete()
      .eq('id', id);

    if (error) { console.error('[embVoucher.deleteIssueVoucher]', error); return false; }
    return true;
  },

  async getNextIssueVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { data } = await supabase
      .from('emb_issue_vouchers')
      .select('voucher_no')
      .order('created_at', { ascending: false });
    let maxNum = 0;
    for (const row of (data || [])) {
      const match = (row.voucher_no || '').match(/EIV-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `EIV-${String(maxNum + 1).padStart(4, '0')}`;
  },

  // ── Receive Vouchers ────────────────────────────────────────────────────────

  async getAllReceiveVouchers(): Promise<EmbReceiveVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('emb_receive_vouchers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getAllReceive]', error); return []; }
    return (data || []).map(rowToReceiveVoucher);
  },

  async getReceiveVouchersByIssueId(issueVoucherId: string): Promise<EmbReceiveVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('emb_receive_vouchers')
      .select('*')
      .eq('issue_voucher_id', issueVoucherId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getReceiveByIssue]', error); return []; }
    return (data || []).map(rowToReceiveVoucher);
  },

  async createReceiveVoucher(
    v: Omit<EmbReceiveVoucher, 'id' | 'createdAt'>,
    username?: string | null
  ): Promise<EmbReceiveVoucher | null> {
    const supabase = createClient();
    const totalPiecesReceived = (v.cuttingItems || []).reduce((s, c) => s + (c.receivedPieces || 0), 0);
    const row = {
      voucher_no: v.voucherNo,
      voucher_date: v.voucherDate,
      issue_voucher_id: v.issueVoucherId,
      issue_voucher_no: v.issueVoucherNo,
      job_card_ref: v.jobCardRef || null,
      style_name: v.styleName || null,
      party_name: v.partyName || null,
      operator_name: v.operatorName || null,
      receive_operator_name: v.receiveOperatorName || null,
      fabric_items: v.fabricItems || [],
      accessory_items: v.accessoryItems || [],
      cutting_items: v.cuttingItems || [],
      total_pieces_received: totalPiecesReceived,
      remarks: v.remarks || null,
      created_by: username || null,
    };
    const { data, error } = await supabase
      .from('emb_receive_vouchers')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[embVoucher.createReceive]', error); return null; }

    const saved = rowToReceiveVoucher(data);

    // Restore fabric stock for received fabric items
    if (v.fabricItems && v.fabricItems.length > 0) {
      await fabricInventoryService.restoreFabricStock(
        v.fabricItems
          .filter((f) => f.rollId && f.receivedQty > 0)
          .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.receivedQty }))
      );
    }

    // If cutting items received, create cutting stock entries and log movement
    if (v.cuttingItems && v.cuttingItems.length > 0) {
      // Get the issue voucher to find cutting_stock_id and job_card_ref
      const issueVoucher = await this.getIssueVoucherById(v.issueVoucherId);

      // Resolve job_card_ref: prefer receive voucher's, fall back to issue voucher's
      const resolvedJobCardRef = v.jobCardRef || issueVoucher?.jobCardRef || '';
      const resolvedStyleName = v.styleName || issueVoucher?.styleName || '';
      const resolvedPartyName = v.partyName || issueVoucher?.partyName || '';

      for (const ci of v.cuttingItems) {
        if (ci.receivedPieces <= 0) continue;

        if (issueVoucher?.cuttingStockId) {
          // Restore pieces to existing cutting stock
          await this.restoreCuttingStock(issueVoucher.cuttingStockId, ci.receivedPieces, username);
          // Log movement
          await this.logMovement({
            cuttingStockId: issueVoucher.cuttingStockId,
            movementType: 'received_back',
            voucherType: 'receive_voucher',
            voucherId: saved.id,
            voucherNo: saved.voucherNo,
            fromEntity: v.operatorName,
            toEntity: 'Cutting Stock',
            pieces: ci.receivedPieces,
            jobCardRef: resolvedJobCardRef,
            styleName: resolvedStyleName,
            component: ci.component,
            remarks: v.remarks,
            movementDate: v.voucherDate,
            createdBy: username || undefined,
          });
        } else {
          // Create new cutting stock entry from received pieces
          const stockItem = await this.createCuttingStock({
            receiveVoucherId: saved.id,
            receiveVoucherNo: saved.voucherNo,
            issueVoucherId: v.issueVoucherId,
            issueVoucherNo: v.issueVoucherNo,
            jobCardRef: resolvedJobCardRef,
            jobCardId: issueVoucher?.jobCardId || undefined,
            styleName: resolvedStyleName,
            partyName: resolvedPartyName,
            component: ci.component,
            description: ci.description,
            totalPieces: ci.receivedPieces,
            availablePieces: ci.receivedPieces,
            issuedPieces: 0,
            unit: ci.receiveUnit || ci.unit || 'Pcs',
            status: 'available',
          }, username);

          if (stockItem) {
            // Log initial receipt movement
            await this.logMovement({
              cuttingStockId: stockItem.id,
              movementType: 'received_from_cutting',
              voucherType: 'receive_voucher',
              voucherId: saved.id,
              voucherNo: saved.voucherNo,
              fromEntity: v.operatorName,
              toEntity: 'Cutting Stock',
              pieces: ci.receivedPieces,
              jobCardRef: resolvedJobCardRef,
              styleName: resolvedStyleName,
              component: ci.component,
              remarks: v.remarks,
              movementDate: v.voucherDate,
              createdBy: username || undefined,
            });
          }
        }
      }
    }

    // Update issue voucher status
    await this._updateIssueVoucherStatusAfterReceive(v.issueVoucherId, username);

    return saved;
  },

  async deleteReceiveVoucher(id: string): Promise<boolean> {
    const supabase = createClient();

    // First, fetch the receive voucher to restore cutting stock
    const { data: rvRow } = await supabase
      .from('emb_receive_vouchers')
      .select('*')
      .eq('id', id)
      .single();

    if (rvRow) {
      const rv = rowToReceiveVoucher(rvRow);

      // Restore fabric stock
      if (rv.fabricItems && rv.fabricItems.length > 0) {
        await fabricInventoryService.deductFabricStock(
          rv.fabricItems
            .filter((f) => f.rollId && f.receivedQty > 0)
            .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.receivedQty }))
        );
      }

      // Restore cutting stock: reduce available_pieces for each cutting item received
      if (rv.cuttingItems && rv.cuttingItems.length > 0) {
        // Find cutting_stock entries linked to this receive voucher
        const { data: stockRows } = await supabase
          .from('cutting_stock')
          .select('*')
          .eq('receive_voucher_id', id);

        for (const ci of rv.cuttingItems) {
          if ((ci.receivedPieces || 0) <= 0) continue;
          const stockRow = (stockRows || []).find((s: any) => s.component === ci.component);
          if (stockRow) {
            // Delete the cutting_stock row entirely (it was created by this receive voucher)
            await supabase.from('cutting_stock').delete().eq('id', stockRow.id);
          }
        }
      }

      // Update issue voucher status back
      if (rv.issueVoucherId) {
        await this._updateIssueVoucherStatusAfterReceive(rv.issueVoucherId, null);
      }
    }

    const { error } = await supabase
      .from('emb_receive_vouchers')
      .delete()
      .eq('id', id);
    if (error) { console.error('[embVoucher.deleteReceiveVoucher]', error); return false; }
    return true;
  },

  async getNextReceiveVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { data } = await supabase
      .from('emb_receive_vouchers')
      .select('voucher_no')
      .order('created_at', { ascending: false });
    let maxNum = 0;
    for (const row of (data || [])) {
      const match = (row.voucher_no || '').match(/ERV-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `ERV-${String(maxNum + 1).padStart(4, '0')}`;
  },

  async updateReceiveVoucher(
    id: string,
    v: Partial<Pick<EmbReceiveVoucher, 'voucherDate' | 'operatorName' | 'receiveOperatorName' | 'remarks' | 'fabricItems' | 'accessoryItems' | 'cuttingItems' | 'totalPiecesReceived'>>,
    username?: string | null
  ): Promise<boolean> {
    const supabase = createClient();
    const updates: Record<string, unknown> = { updated_by: username || null };
    if (v.voucherDate !== undefined) updates.voucher_date = v.voucherDate;
    if (v.operatorName !== undefined) updates.operator_name = v.operatorName || null;
    if (v.receiveOperatorName !== undefined) updates.receive_operator_name = v.receiveOperatorName || null;
    if (v.remarks !== undefined) updates.remarks = v.remarks || null;
    if (v.fabricItems !== undefined) updates.fabric_items = v.fabricItems;
    if (v.accessoryItems !== undefined) updates.accessory_items = v.accessoryItems;
    if (v.cuttingItems !== undefined) updates.cutting_items = v.cuttingItems;
    if (v.totalPiecesReceived !== undefined) updates.total_pieces_received = v.totalPiecesReceived;
    const { error } = await supabase
      .from('emb_receive_vouchers')
      .update(updates)
      .eq('id', id);
    if (error) { console.error('[embVoucher.updateReceive]', error); return false; }

    // Recalculate issue voucher status from DB totals every time a receive voucher is updated
    const { data: rvRow } = await supabase
      .from('emb_receive_vouchers')
      .select('issue_voucher_id')
      .eq('id', id)
      .single();
    if (rvRow?.issue_voucher_id) {
      await this._updateIssueVoucherStatusAfterReceive(rvRow.issue_voucher_id, username);
    }

    return true;
  },

  // ── Cutting Stock ───────────────────────────────────────────────────────────

  async getAllCuttingStock(): Promise<CuttingStockItem[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cutting_stock')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getAllCuttingStock]', error); return []; }
    return (data || []).map(rowToCuttingStock);
  },

  async getAvailableCuttingStock(jobCardRef?: string): Promise<CuttingStockItem[]> {
    const supabase = createClient();
    let query = supabase
      .from('cutting_stock')
      .select('*')
      .gt('available_pieces', 0)
      .in('status', ['available', 'partially_issued']);
    if (jobCardRef) {
      query = query.eq('job_card_ref', jobCardRef);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getAvailableCuttingStock]', error); return []; }
    return (data || []).map(rowToCuttingStock);
  },

  async getAllCuttingStockByJobCard(jobCardRef: string): Promise<CuttingStockItem[]> {
    if (!jobCardRef) return [];
    const supabase = createClient();

    // Primary query: direct job_card_ref match in cutting_stock
    const { data: directItems, error: directError } = await supabase
      .from('cutting_stock')
      .select('*')
      .eq('job_card_ref', jobCardRef)
      .order('created_at', { ascending: false });
    if (directError) { console.error('[embVoucher.getAllCuttingStockByJobCard] direct:', directError); }

    // Secondary query: find cutting_stock items linked via receive_voucher_id
    // where the receive voucher's issue voucher has this job_card_ref
    const { data: issueVouchers } = await supabase
      .from('emb_issue_vouchers')
      .select('id')
      .eq('job_card_ref', jobCardRef);

    let linkedItems: any[] = [];
    let receiveVouchersFull: any[] = [];
    if (issueVouchers && issueVouchers.length > 0) {
      const issueIds = issueVouchers.map((iv: any) => iv.id);
      const { data: receiveVouchers } = await supabase
        .from('emb_receive_vouchers')
        .select('*')
        .in('issue_voucher_id', issueIds);

      receiveVouchersFull = receiveVouchers || [];

      if (receiveVouchers && receiveVouchers.length > 0) {
        const receiveIds = receiveVouchers.map((rv: any) => rv.id);
        const { data: linked, error: linkedError } = await supabase
          .from('cutting_stock')
          .select('*')
          .in('receive_voucher_id', receiveIds)
          .order('created_at', { ascending: false });
        if (linkedError) { console.error('[embVoucher.getAllCuttingStockByJobCard] linked:', linkedError); }
        linkedItems = linked || [];
      }
    }

    // Also fetch receive vouchers directly linked to this job_card_ref
    const { data: directReceiveVouchers } = await supabase
      .from('emb_receive_vouchers')
      .select('*')
      .eq('job_card_ref', jobCardRef);
    for (const rv of directReceiveVouchers || []) {
      if (!receiveVouchersFull.find((r: any) => r.id === rv.id)) {
        receiveVouchersFull.push(rv);
      }
    }

    // Merge cutting_stock: combine direct + linked, deduplicate by id
    const directData = directItems || [];
    const allStockItems = [...directData];
    for (const item of linkedItems) {
      if (!allStockItems.find((d: any) => d.id === item.id)) {
        allStockItems.push(item);
      }
    }

    // Build a set of receive_voucher_id+component keys already covered by cutting_stock
    const coveredKeys = new Set<string>();
    for (const s of allStockItems) {
      if (s.receive_voucher_id && s.component) {
        coveredKeys.add(`${s.receive_voucher_id}::${s.component}`);
      }
    }

    // Fetch emb_cutting_entries to compute already-issued pieces from synthesized items
    // (for real cutting_stock rows, available_pieces is already correct in DB)
    const { data: embCuttingRows } = await supabase
      .from('emb_cutting_entries')
      .select('components')
      .eq('job_card_ref', jobCardRef);

    // Also fetch cutting_entries.emb_receive_items for this job card
    // (regular cutting entries that consumed embroidery-received stock)
    const { data: regularCuttingRows } = await supabase
      .from('cutting_entries')
      .select('emb_receive_items')
      .eq('job_card_ref', jobCardRef);

    // Build a map of receiveVoucherId+component -> total pieces already issued
    // Sources: emb_cutting_entries (legacy) + cutting_entries.emb_receive_items (current)
    const embCuttingIssuedMap: Record<string, number> = {};

    // From emb_cutting_entries (legacy path)
    for (const ecRow of embCuttingRows || []) {
      const components: any[] = Array.isArray(ecRow.components) ? ecRow.components : [];
      for (const comp of components) {
        // stockItemId for synthesized items is like "rv-{rvId}-{component}"
        const stockItemId: string = comp.stockItemId || '';
        if (stockItemId.startsWith('rv-')) {
          const key = stockItemId.replace(/^rv-/, '').replace(/-([^-]+)$/, '::$1');
          embCuttingIssuedMap[key] = (embCuttingIssuedMap[key] || 0) + (comp.piecesIssued || 0);
        }
      }
    }

    // From cutting_entries.emb_receive_items (current path — regular cutting issue workflow)
    // These items may have synthesized IDs (rv-...) that were NOT yet materialized,
    // or real UUIDs that are already tracked in cutting_stock.available_pieces.
    // We only need to count synthesized IDs here; real UUIDs are handled by cutting_stock.
    for (const ceRow of regularCuttingRows || []) {
      const embItems: any[] = Array.isArray(ceRow.emb_receive_items) ? ceRow.emb_receive_items : [];
      for (const item of embItems) {
        const stockItemId: string = item.cuttingStockId || '';
        if (stockItemId.startsWith('rv-')) {
          // Parse "rv-{uuid}-{component}" → key = "{uuid}::{component}"
          const withoutPrefix = stockItemId.slice(3); // remove "rv-"
          const uuidPart = withoutPrefix.substring(0, 36);
          const componentPart = withoutPrefix.substring(37);
          if (uuidPart && componentPart) {
            const key = `${uuidPart}::${componentPart}`;
            embCuttingIssuedMap[key] = (embCuttingIssuedMap[key] || 0) + (item.piecesUsed || 0);
          }
        }
      }
    }

    // Always synthesize from emb_receive_vouchers for items NOT already in cutting_stock
    const synthesized: CuttingStockItem[] = [];
    for (const rv of receiveVouchersFull) {
      const cuttingItems: any[] = Array.isArray(rv.cutting_items) ? rv.cutting_items : [];
      for (const ci of cuttingItems) {
        const receivedPieces = ci.receivedPieces || ci.received_pieces || 0;
        if (receivedPieces <= 0) continue;
        const key = `${rv.id}::${ci.component || 'item'}`;
        // Skip if already represented in cutting_stock
        if (coveredKeys.has(key)) continue;

        // Compute available pieces: received - already issued via emb_cutting_entries + cutting_entries
        let alreadyIssued = embCuttingIssuedMap[key] || 0;
        const availablePieces = Math.max(0, receivedPieces - alreadyIssued);
        const status: CuttingStockItem['status'] = availablePieces === 0
          ? 'fully_issued'
          : alreadyIssued > 0
            ? 'partially_issued' :'available';

        synthesized.push({
          id: `rv-${rv.id}-${ci.component || 'item'}`,
          receiveVoucherId: rv.id,
          receiveVoucherNo: rv.voucher_no || '',
          issueVoucherId: rv.issue_voucher_id || undefined,
          issueVoucherNo: rv.issue_voucher_no || undefined,
          jobCardRef: rv.job_card_ref || jobCardRef,
          jobCardId: rv.job_card_id || undefined,
          styleName: rv.style_name || '',
          partyName: rv.party_name || '',
          component: ci.component || '',
          description: ci.description || undefined,
          totalPieces: receivedPieces,
          availablePieces,
          issuedPieces: alreadyIssued,
          unit: ci.receiveUnit || ci.unit || 'Pcs',
          status,
          createdAt: rv.created_at || '',
        });
      }
    }

    // Return cutting_stock items + synthesized items not yet in cutting_stock
    return [...allStockItems.map(rowToCuttingStock), ...synthesized];
  },

  /**
   * Materialize a synthesized cutting stock item (id starts with "rv-") into a real
   * cutting_stock DB row. Returns the real DB row's ID.
   * If the item already exists in DB, returns its existing ID.
   */
  async getOrCreateRealCuttingStockId(
    synthesizedId: string,
    jobCardRef: string,
    username?: string | null
  ): Promise<string | null> {
    // Parse synthesized ID: "rv-{receiveVoucherId}-{component}"
    const match = synthesizedId.match(/^rv-([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)-(.+)$/);
    if (!match) {
      // Try simpler UUID pattern
      const parts = synthesizedId.replace(/^rv-/, '');
      // UUID is 36 chars, then "-", then component
      const uuidPart = parts.substring(0, 36);
      const componentPart = parts.substring(37);
      if (!uuidPart || !componentPart) return null;
      return this._materializeSynthesizedStock(uuidPart, componentPart, jobCardRef, username);
    }
    return this._materializeSynthesizedStock(match[1], match[2], jobCardRef, username);
  },

  async _materializeSynthesizedStock(
    receiveVoucherId: string,
    component: string,
    jobCardRef: string,
    username?: string | null
  ): Promise<string | null> {
    const supabase = createClient();

    // Check if already exists in cutting_stock
    const { data: existing } = await supabase
      .from('cutting_stock')
      .select('id, available_pieces, issued_pieces, total_pieces')
      .eq('receive_voucher_id', receiveVoucherId)
      .eq('component', component)
      .maybeSingle();

    if (existing) return existing.id;

    // Fetch the receive voucher to get details
    const { data: rvRow } = await supabase
      .from('emb_receive_vouchers')
      .select('*')
      .eq('id', receiveVoucherId)
      .single();

    if (!rvRow) return null;

    const cuttingItems: any[] = Array.isArray(rvRow.cutting_items) ? rvRow.cutting_items : [];
    const ci = cuttingItems.find((c: any) => c.component === component);
    if (!ci) return null;

    const receivedPieces = ci.receivedPieces || ci.received_pieces || 0;
    if (receivedPieces <= 0) return null;

    // Compute already-issued pieces from emb_cutting_entries
    const synthesizedId = `rv-${receiveVoucherId}-${component}`;
    const { data: embCuttingRows } = await supabase
      .from('emb_cutting_entries')
      .select('components')
      .eq('job_card_ref', jobCardRef);

    let alreadyIssued = 0;
    for (const ecRow of embCuttingRows || []) {
      const components: any[] = Array.isArray(ecRow.components) ? ecRow.components : [];
      for (const comp of components) {
        if (comp.stockItemId === synthesizedId) {
          alreadyIssued += comp.piecesIssued || 0;
        }
      }
    }

    const availablePieces = Math.max(0, receivedPieces - alreadyIssued);
    const status = availablePieces === 0 ? 'fully_issued' : alreadyIssued > 0 ? 'partially_issued' : 'available';

    // Create the real cutting_stock row
    const stockItem = await this.createCuttingStock({
      receiveVoucherId,
      receiveVoucherNo: rvRow.voucher_no || '',
      issueVoucherId: rvRow.issue_voucher_id || undefined,
      issueVoucherNo: rvRow.issue_voucher_no || undefined,
      jobCardRef: rvRow.job_card_ref || jobCardRef,
      jobCardId: rvRow.job_card_id || undefined,
      styleName: rvRow.style_name || '',
      partyName: rvRow.party_name || '',
      component,
      description: ci.description || undefined,
      totalPieces: receivedPieces,
      availablePieces,
      issuedPieces: alreadyIssued,
      unit: ci.receiveUnit || ci.unit || 'Pcs',
      status,
    }, username);

    return stockItem?.id || null;
  },

  async createCuttingStock(
    item: Omit<CuttingStockItem, 'id' | 'createdAt'>,
    username?: string | null
  ): Promise<CuttingStockItem | null> {
    const supabase = createClient();
    const row = {
      cutting_entry_id: item.cuttingEntryId || null,
      receive_voucher_id: item.receiveVoucherId || null,
      receive_voucher_no: item.receiveVoucherNo || null,
      issue_voucher_id: item.issueVoucherId || null,
      issue_voucher_no: item.issueVoucherNo || null,
      job_card_ref: item.jobCardRef || null,
      job_card_id: item.jobCardId || null,
      style_name: item.styleName || null,
      party_name: item.partyName || null,
      component: item.component || null,
      description: item.description || null,
      total_pieces: item.totalPieces,
      available_pieces: item.availablePieces,
      issued_pieces: item.issuedPieces,
      unit: item.unit || 'Pcs',
      status: item.status || 'available',
      remarks: item.remarks || null,
      created_by: username || null,
    };
    const { data, error } = await supabase
      .from('cutting_stock')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[embVoucher.createCuttingStock]', error); return null; }
    return rowToCuttingStock(data);
  },

  async deductCuttingStock(
    stockId: string,
    pieces: number,
    username?: string | null
  ): Promise<boolean> {
    // If this is a synthesized ID (starts with "rv-"), we cannot deduct from DB directly.
    // The deduction is tracked via emb_cutting_entries.components[].piecesIssued.
    // The availablePieces for synthesized items is computed dynamically in getAllCuttingStockByJobCard.
    if (stockId.startsWith('rv-')) {
      // No DB operation needed — the dynamic computation in getAllCuttingStockByJobCard
      // will subtract emb_cutting_entries pieces from the received total.
      return true;
    }

    const supabase = createClient();
    const { data: current } = await supabase
      .from('cutting_stock')
      .select('available_pieces, issued_pieces, total_pieces')
      .eq('id', stockId)
      .single();
    if (!current) return false;

    const newAvailable = Math.max(0, (current.available_pieces || 0) - pieces);
    const newIssued = (current.issued_pieces || 0) + pieces;
    let newStatus = newAvailable === 0 ? 'fully_issued' : 'partially_issued';

    const { error } = await supabase
      .from('cutting_stock')
      .update({
        available_pieces: newAvailable,
        issued_pieces: newIssued,
        status: newStatus,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockId);
    if (error) { console.error('[embVoucher.deductCuttingStock]', error); return false; }
    return true;
  },

  async restoreCuttingStock(
    stockId: string,
    pieces: number,
    username?: string | null
  ): Promise<boolean> {
    // Synthesized IDs are tracked dynamically — no DB restore needed
    if (stockId.startsWith('rv-')) return true;

    const supabase = createClient();
    const { data: current } = await supabase
      .from('cutting_stock')
      .select('available_pieces, issued_pieces, total_pieces')
      .eq('id', stockId)
      .single();
    if (!current) return false;

    const newAvailable = (current.available_pieces || 0) + pieces;
    const newIssued = Math.max(0, (current.issued_pieces || 0) - pieces);
    let newStatus = newAvailable >= (current.total_pieces || 0) ? 'available' : 'partially_issued';

    const { error } = await supabase
      .from('cutting_stock')
      .update({
        available_pieces: newAvailable,
        issued_pieces: newIssued,
        status: newStatus,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockId);
    if (error) { console.error('[embVoucher.restoreCuttingStock]', error); return false; }
    return true;
  },

  // ── Real-Time Stats for Dashboard ──────────────────────────────────────────

  async getRealTimeEmbroideryStats(): Promise<{
    totalIssued: number;
    totalReceived: number;
    pendingFromEmbroidery: number;
    embroideryReceived: number;
    readyForCutting: number;
    issuedToCutting: number;
    balanceAvailable: number;
  }> {
    const supabase = createClient();

    // Total pieces issued (sum of cutting_items.pieces across all issue vouchers)
    const { data: issueRows } = await supabase
      .from('emb_issue_vouchers')
      .select('cutting_items, fabric_items');

    let totalIssued = 0;
    for (const row of issueRows || []) {
      const cuttingItems: any[] = Array.isArray(row.cutting_items) ? row.cutting_items : [];
      for (const ci of cuttingItems) {
        totalIssued += ci.pieces || 0;
      }
    }

    // Total pieces received (sum of cutting_items.receivedPieces across all receive vouchers)
    const { data: receiveRows } = await supabase
      .from('emb_receive_vouchers')
      .select('cutting_items, total_pieces_received');

    let totalReceived = 0;
    for (const row of receiveRows || []) {
      totalReceived += row.total_pieces_received || 0;
    }

    // Pending = issued - received
    const pendingFromEmbroidery = Math.max(0, totalIssued - totalReceived);

    // Embroidery received = totalReceived (same as above)
    const embroideryReceived = totalReceived;

    // Available in cutting_stock (ready for cutting)
    const { data: stockRows } = await supabase
      .from('cutting_stock')
      .select('available_pieces, issued_pieces, total_pieces')
      .in('status', ['available', 'partially_issued']);

    let readyForCutting = 0;
    let issuedToCutting = 0;
    for (const row of stockRows || []) {
      readyForCutting += row.available_pieces || 0;
      issuedToCutting += row.issued_pieces || 0;
    }

    // Also count from emb_cutting_entries (for synthesized stock items)
    const { data: embCuttingRows } = await supabase
      .from('emb_cutting_entries')
      .select('total_pieces_cut');
    for (const row of embCuttingRows || []) {
      // Only count if not already in cutting_stock issued_pieces
      // (synthesized items are tracked here)
    }

    const balanceAvailable = readyForCutting;

    return {
      totalIssued,
      totalReceived,
      pendingFromEmbroidery,
      embroideryReceived,
      readyForCutting,
      issuedToCutting,
      balanceAvailable,
    };
  },

  // ── Movement History ────────────────────────────────────────────────────────

  async logMovement(m: Omit<CuttingMovement, 'id' | 'createdAt'>): Promise<CuttingMovement | null> {
    const supabase = createClient();
    // Synthesized IDs (starting with 'rv-') are not real UUIDs — store null to avoid DB type error
    const realCuttingStockId = m.cuttingStockId && !m.cuttingStockId.startsWith('rv-') ? m.cuttingStockId : null;
    const row = {
      cutting_stock_id: realCuttingStockId,
      movement_type: m.movementType,
      voucher_type: m.voucherType || null,
      voucher_id: m.voucherId || null,
      voucher_no: m.voucherNo || null,
      from_entity: m.fromEntity || null,
      to_entity: m.toEntity || null,
      to_entity_type: m.toEntityType || null,
      pieces: m.pieces,
      job_card_ref: m.jobCardRef || null,
      style_name: m.styleName || null,
      component: m.component || null,
      process_type: m.processType || null,
      remarks: m.remarks || null,
      movement_date: m.movementDate,
      created_by: m.createdBy || null,
    };
    const { data, error } = await supabase
      .from('cutting_movement_history')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('[embVoucher.logMovement]', error); return null; }
    return rowToMovement(data);
  },

  async getMovementHistory(cuttingStockId?: string, jobCardRef?: string): Promise<CuttingMovement[]> {
    const supabase = createClient();
    let query = supabase
      .from('cutting_movement_history')
      .select('*');
    if (cuttingStockId) query = query.eq('cutting_stock_id', cuttingStockId);
    if (jobCardRef) query = query.eq('job_card_ref', jobCardRef);
    const { data, error } = await query.order('movement_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getMovementHistory]', error); return []; }
    return (data || []).map(rowToMovement);
  },

  async getAllMovementHistory(): Promise<CuttingMovement[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cutting_movement_history')
      .select('*')
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) { console.error('[embVoucher.getAllMovementHistory]', error); return []; }
    return (data || []).map(rowToMovement);
  },

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Compute total received quantities for an issue voucher across all receive vouchers,
   * then update the issue voucher status accordingly.
   * When receive unit differs from issue unit, we cannot compare quantities directly —
   * in that case we treat the item as "partially received" (not fully received).
   */
  async _updateIssueVoucherStatusAfterReceive(
    issueVoucherId: string,
    username?: string | null
  ): Promise<void> {
    const supabase = createClient();

    const { data: issueRow } = await supabase
      .from('emb_issue_vouchers')
      .select('fabric_items, accessory_items, cutting_items, issue_type')
      .eq('id', issueVoucherId)
      .single();
    if (!issueRow) return;

    const { data: receiveRows } = await supabase
      .from('emb_receive_vouchers')
      .select('fabric_items, accessory_items, cutting_items')
      .eq('issue_voucher_id', issueVoucherId);

    const fabricIssued: IssueFabricItem[] = Array.isArray(issueRow.fabric_items) ? issueRow.fabric_items : [];
    const accIssued: IssueAccessoryItem[] = Array.isArray(issueRow.accessory_items) ? issueRow.accessory_items : [];
    const cuttingIssued: IssueCuttingItem[] = Array.isArray(issueRow.cutting_items) ? issueRow.cutting_items : [];

    // Accumulate received + rejected totals per item key
    const fabricReceivedMap: Record<string, { qty: number; rejected: number; unitMismatch: boolean }> = {};
    const accReceivedMap: Record<string, { qty: number; rejected: number; unitMismatch: boolean }> = {};
    const cuttingReceivedMap: Record<string, { qty: number; rejected: number; unitMismatch: boolean }> = {};

    for (const rv of (receiveRows || [])) {
      for (const fi of (Array.isArray(rv.fabric_items) ? rv.fabric_items : [])) {
        const issueItem = fabricIssued.find((f) => f.rollId === fi.rollId);
        const issueUnit = issueItem?.unit || fi.unit;
        const receiveUnit = fi.receiveUnit || fi.unit;
        const prev = fabricReceivedMap[fi.rollId] || { qty: 0, rejected: 0, unitMismatch: false };
        fabricReceivedMap[fi.rollId] = {
          qty: prev.qty + (fi.receivedQty || 0),
          rejected: prev.rejected + (fi.rejectedQty || 0),
          unitMismatch: prev.unitMismatch || (receiveUnit !== issueUnit),
        };
      }
      for (const ai of (Array.isArray(rv.accessory_items) ? rv.accessory_items : [])) {
        const issueItem = accIssued.find((a) => a.name === ai.name);
        const issueUnit = issueItem?.unit || ai.unit;
        const receiveUnit = ai.receiveUnit || ai.unit;
        const prev = accReceivedMap[ai.name] || { qty: 0, rejected: 0, unitMismatch: false };
        accReceivedMap[ai.name] = {
          qty: prev.qty + (ai.receivedQty || 0),
          rejected: prev.rejected + (ai.rejectedQty || 0),
          unitMismatch: prev.unitMismatch || (receiveUnit !== issueUnit),
        };
      }
      for (const ci of (Array.isArray(rv.cutting_items) ? rv.cutting_items : [])) {
        const issueItem = cuttingIssued.find((c) => c.component === ci.component);
        const issueUnit = issueItem?.unit || ci.unit || 'Pcs';
        const receiveUnit = ci.receiveUnit || ci.unit || 'Pcs';
        const prev = cuttingReceivedMap[ci.component] || { qty: 0, rejected: 0, unitMismatch: false };
        cuttingReceivedMap[ci.component] = {
          qty: prev.qty + (ci.receivedPieces || 0),
          rejected: prev.rejected + (ci.rejectedPieces || 0),
          unitMismatch: prev.unitMismatch || (receiveUnit !== issueUnit),
        };
      }
    }

    // Fully received: every issued item has (received + rejected) >= issued qty
    // If units differ, we cannot confirm fully received by qty — treat as partial
    const fabricFullyReceived = fabricIssued.length === 0 || fabricIssued.every((f) => {
      const received = fabricReceivedMap[f.rollId];
      if (!received) return false;
      if (received.unitMismatch) return false;
      return (received.qty + received.rejected) >= f.issuedQty;
    });
    const accFullyReceived = accIssued.length === 0 || accIssued.every((a) => {
      const received = accReceivedMap[a.name];
      if (!received) return false;
      if (received.unitMismatch) return false;
      return (received.qty + received.rejected) >= a.qty;
    });
    const cuttingFullyReceived = cuttingIssued.length === 0 || cuttingIssued.every((c) => {
      const received = cuttingReceivedMap[c.component];
      if (!received) return false;
      if (received.unitMismatch) return false;
      return (received.qty + received.rejected) >= c.pieces;
    });

    // anyReceived: at least one item has qty > 0 across all receive vouchers
    const anyReceived =
      Object.values(fabricReceivedMap).some((v) => v.qty > 0 || v.rejected > 0) ||
      Object.values(accReceivedMap).some((v) => v.qty > 0 || v.rejected > 0) ||
      Object.values(cuttingReceivedMap).some((v) => v.qty > 0 || v.rejected > 0);

    const hasItems = fabricIssued.length > 0 || accIssued.length > 0 || cuttingIssued.length > 0;

    let newStatus: EmbIssueVoucher['status'] = 'open';
    if (fabricFullyReceived && accFullyReceived && cuttingFullyReceived && hasItems && anyReceived) {
      newStatus = 'fully_received';
    } else if (anyReceived) {
      newStatus = 'partially_received';
    }

    await supabase
      .from('emb_issue_vouchers')
      .update({ status: newStatus, updated_by: username || null })
      .eq('id', issueVoucherId);
  },

  /**
   * Build receive fabric items pre-populated from an issue voucher,
   * accounting for already-received quantities from previous receive vouchers.
   */
  async buildReceiveFabricItems(issueVoucher: EmbIssueVoucher): Promise<ReceiveFabricItem[]> {
    const supabase = createClient();

    const { data: prevReceives } = await supabase
      .from('emb_receive_vouchers')
      .select('fabric_items')
      .eq('issue_voucher_id', issueVoucher.id);

    const receivedMap: Record<string, number> = {};
    for (const rv of (prevReceives || [])) {
      for (const fi of (Array.isArray(rv.fabric_items) ? rv.fabric_items : [])) {
        receivedMap[fi.rollId] = (receivedMap[fi.rollId] || 0) + (fi.receivedQty || 0);
      }
    }

    return issueVoucher.fabricItems.map((f) => {
      const alreadyReceived = receivedMap[f.rollId] || 0;
      const balance = Math.max(0, f.issuedQty - alreadyReceived);
      return {
        fabricId: f.fabricId,
        fabricName: f.fabricName,
        rollId: f.rollId,
        rollName: f.rollName,
        issuedQty: f.issuedQty,
        receivedQty: balance,
        balanceQty: balance,
        unit: f.unit,
        receiveUnit: f.unit, // default to same as issue unit; user can change
      };
    });
  },

  async buildReceiveAccessoryItems(issueVoucher: EmbIssueVoucher): Promise<ReceiveAccessoryItem[]> {
    const supabase = createClient();

    const { data: prevReceives } = await supabase
      .from('emb_receive_vouchers')
      .select('accessory_items')
      .eq('issue_voucher_id', issueVoucher.id);

    const receivedMap: Record<string, number> = {};
    for (const rv of (prevReceives || [])) {
      for (const ai of (Array.isArray(rv.accessory_items) ? rv.accessory_items : [])) {
        receivedMap[ai.name] = (receivedMap[ai.name] || 0) + (ai.receivedQty || 0);
      }
    }

    return issueVoucher.accessoryItems.map((a) => {
      const alreadyReceived = receivedMap[a.name] || 0;
      const balance = Math.max(0, a.qty - alreadyReceived);
      return {
        name: a.name,
        issuedQty: a.qty,
        receivedQty: balance,
        balanceQty: balance,
        unit: a.unit,
        receiveUnit: a.unit, // default to same as issue unit; user can change
      };
    });
  },

  async buildReceiveCuttingItems(issueVoucher: EmbIssueVoucher): Promise<ReceiveCuttingItem[]> {
    const supabase = createClient();

    const { data: prevReceives } = await supabase
      .from('emb_receive_vouchers')
      .select('cutting_items')
      .eq('issue_voucher_id', issueVoucher.id);

    const receivedMap: Record<string, number> = {};
    for (const rv of (prevReceives || [])) {
      for (const ci of (Array.isArray(rv.cutting_items) ? rv.cutting_items : [])) {
        receivedMap[ci.component] = (receivedMap[ci.component] || 0) + (ci.receivedPieces || 0);
      }
    }

    return issueVoucher.cuttingItems.map((c) => {
      const alreadyReceived = receivedMap[c.component] || 0;
      const balance = Math.max(0, c.pieces - alreadyReceived);
      return {
        component: c.component,
        description: c.description,
        issuedPieces: c.pieces,
        receivedPieces: balance,
        balancePieces: balance,
        unit: c.unit || 'Pcs',
        receiveUnit: c.unit || 'Pcs', // default to same as issue unit; user can change
      };
    });
  },
};
