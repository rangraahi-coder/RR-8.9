import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StitchOperator {
  id: string;
  operatorCode: string;
  operatorName: string;
  department: string;
  process?: string;
  isActive: boolean;
  remarks?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
}

export interface StitchIssueComponent {
  id: string;
  issueVoucherId: string;
  component: string;
  issuedQty: number;
  receivedQty: number;
  pendingQty: number;
  unit: string;
  sizeBreakdown?: { size: string; qty: number }[];
  remarks?: string;
}

export interface StitchIssueVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  jobCardId?: string;
  jobCardRef: string;
  styleName?: string;
  partyName?: string;
  poNo?: string;
  operatorId?: string;
  operatorName: string;
  totalPieces: number;
  status: 'open' | 'partially_received' | 'fully_received' | 'closed';
  components: StitchIssueComponent[];
  remarks?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
}

export interface StitchReceiveComponent {
  id: string;
  receiveVoucherId: string;
  issueComponentId: string;
  component: string;
  issuedQty: number;
  receivedQty: number;
  balanceQty: number;
  unit: string;
  stitchingChargePerPc: number;
  totalStitchingCharge: number;
  remarks?: string;
}

export interface StitchReceiveVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  issueVoucherId: string;
  issueVoucherNo: string;
  jobCardRef: string;
  styleName?: string;
  partyName?: string;
  operatorId?: string;
  operatorName: string;
  totalPiecesReceived: number;
  totalStitchingCharges: number;
  components: StitchReceiveComponent[];
  remarks?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
}

export interface StitchAuditEntry {
  id: string;
  transactionType: 'issue' | 'receive';
  voucherId: string;
  voucherNo: string;
  jobCardRef: string;
  component: string;
  quantity: number;
  operatorId?: string;
  operatorName: string;
  operatorCode?: string;
  performedBy?: string;
  transactionDate: string;
  transactionTime: string;
  remarks?: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToOperator(row: any): StitchOperator {
  return {
    id: row.id,
    operatorCode: row.operator_code,
    operatorName: row.operator_name,
    department: row.department || 'Stitching',
    process: row.process || undefined,
    isActive: row.is_active ?? true,
    remarks: row.remarks || undefined,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToIssueComponent(row: any): StitchIssueComponent {
  let sizeBreakdown: { size: string; qty: number }[] | undefined;
  if (Array.isArray(row.size_breakdown)) {
    sizeBreakdown = row.size_breakdown;
  } else if (typeof row.size_breakdown === 'string' && row.size_breakdown) {
    try { sizeBreakdown = JSON.parse(row.size_breakdown); } catch { sizeBreakdown = undefined; }
  }
  return {
    id: row.id,
    issueVoucherId: row.issue_voucher_id,
    component: row.component,
    issuedQty: row.issued_qty || 0,
    receivedQty: row.received_qty || 0,
    pendingQty: row.pending_qty || 0,
    unit: row.unit || 'Pcs',
    sizeBreakdown,
    remarks: row.remarks || undefined,
  };
}

function rowToIssueVoucher(row: any): StitchIssueVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    jobCardId: row.job_card_id || undefined,
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || undefined,
    partyName: row.party_name || undefined,
    poNo: row.po_no || undefined,
    operatorId: row.operator_id || undefined,
    operatorName: row.operator_name || '',
    totalPieces: row.total_pieces || 0,
    status: (row.status as StitchIssueVoucher['status']) || 'open',
    components: Array.isArray(row.stitch_issue_components)
      ? row.stitch_issue_components.map(rowToIssueComponent)
      : [],
    remarks: row.remarks || undefined,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToReceiveComponent(row: any): StitchReceiveComponent {
  return {
    id: row.id,
    receiveVoucherId: row.receive_voucher_id,
    issueComponentId: row.issue_component_id,
    component: row.component,
    issuedQty: row.issued_qty || 0,
    receivedQty: row.received_qty || 0,
    balanceQty: row.balance_qty || 0,
    unit: row.unit || 'Pcs',
    stitchingChargePerPc: row.stitching_charge_per_pc || 0,
    totalStitchingCharge: row.total_stitching_charge || 0,
    remarks: row.remarks || undefined,
  };
}

function rowToReceiveVoucher(row: any): StitchReceiveVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    issueVoucherId: row.issue_voucher_id,
    issueVoucherNo: row.issue_voucher_no,
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || undefined,
    partyName: row.party_name || undefined,
    operatorId: row.operator_id || undefined,
    operatorName: row.operator_name || '',
    totalPiecesReceived: row.total_pieces_received || 0,
    totalStitchingCharges: row.total_stitching_charges || 0,
    components: Array.isArray(row.stitch_receive_components)
      ? row.stitch_receive_components.map(rowToReceiveComponent)
      : [],
    remarks: row.remarks || undefined,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToAuditEntry(row: any): StitchAuditEntry {
  return {
    id: row.id,
    transactionType: row.transaction_type,
    voucherId: row.voucher_id,
    voucherNo: row.voucher_no,
    jobCardRef: row.job_card_ref,
    component: row.component,
    quantity: row.quantity || 0,
    operatorId: row.operator_id || undefined,
    operatorName: row.operator_name || '',
    operatorCode: row.operator_code || undefined,
    performedBy: row.performed_by || undefined,
    transactionDate: row.transaction_date,
    transactionTime: row.transaction_time,
    remarks: row.remarks || undefined,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const stitchingVoucherService = {
  // ── Operators ──────────────────────────────────────────────────────────────

  async getOperators(): Promise<StitchOperator[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_operators')
      .select('*')
      .order('operator_name');
    if (error) { console.error('[getOperators]', error); return []; }
    return (data || []).map(rowToOperator);
  },

  async getActiveOperators(): Promise<StitchOperator[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_operators')
      .select('*')
      .eq('is_active', true)
      .order('operator_name');
    if (error) { console.error('[getActiveOperators]', error); return []; }
    return (data || []).map(rowToOperator);
  },

  async createOperator(op: Omit<StitchOperator, 'id' | 'createdAt'>, username?: string | null): Promise<StitchOperator | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_operators')
      .insert({
        operator_code: op.operatorCode,
        operator_name: op.operatorName,
        department: op.department,
        process: op.process || null,
        is_active: op.isActive,
        remarks: op.remarks || null,
        created_by: username || null,
        updated_by: username || null,
      })
      .select()
      .single();
    if (error) { console.error('[createOperator]', error); return null; }
    return rowToOperator(data);
  },

  async updateOperator(id: string, op: Partial<StitchOperator>, username?: string | null): Promise<StitchOperator | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_operators')
      .update({
        operator_code: op.operatorCode,
        operator_name: op.operatorName,
        department: op.department,
        process: op.process || null,
        is_active: op.isActive,
        remarks: op.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[updateOperator]', error); return null; }
    return rowToOperator(data);
  },

  async deleteOperator(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('stitch_operators').delete().eq('id', id);
    if (error) { console.error('[deleteOperator]', error); return false; }
    return true;
  },

  // ── Issue Vouchers ─────────────────────────────────────────────────────────

  async getNextIssueVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('stitch_issue_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `SIV-${String(num).padStart(4, '0')}`;
  },

  async getIssueVouchers(): Promise<StitchIssueVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_issue_vouchers')
      .select('*, stitch_issue_components(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getIssueVouchers]', error); return []; }
    return (data || []).map(rowToIssueVoucher);
  },

  async getIssueVoucherById(id: string): Promise<StitchIssueVoucher | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_issue_vouchers')
      .select('*, stitch_issue_components(*)')
      .eq('id', id)
      .single();
    if (error) { console.error('[getIssueVoucherById]', error); return null; }
    return rowToIssueVoucher(data);
  },

  async createIssueVoucher(
    voucher: Omit<StitchIssueVoucher, 'id' | 'createdAt' | 'components'>,
    components: Omit<StitchIssueComponent, 'id' | 'issueVoucherId' | 'receivedQty' | 'pendingQty'>[],
    username?: string | null
  ): Promise<StitchIssueVoucher | null> {
    const supabase = createClient();

    const { data: vRow, error: vErr } = await supabase
      .from('stitch_issue_vouchers')
      .insert({
        voucher_no: voucher.voucherNo,
        voucher_date: voucher.voucherDate,
        job_card_id: voucher.jobCardId || null,
        job_card_ref: voucher.jobCardRef,
        style_name: voucher.styleName || null,
        party_name: voucher.partyName || null,
        po_no: voucher.poNo || null,
        operator_id: voucher.operatorId || null,
        operator_name: voucher.operatorName,
        total_pieces: voucher.totalPieces,
        status: 'open',
        remarks: voucher.remarks || null,
        created_by: username || null,
        updated_by: username || null,
      })
      .select()
      .single();

    if (vErr || !vRow) { console.error('[createIssueVoucher]', vErr); return null; }

    if (components.length > 0) {
      const compRows = components.map((c) => ({
        issue_voucher_id: vRow.id,
        component: c.component,
        issued_qty: c.issuedQty,
        received_qty: 0,
        pending_qty: c.issuedQty,
        unit: c.unit || 'Pcs',
        size_breakdown: c.sizeBreakdown ? JSON.stringify(c.sizeBreakdown) : null,
        remarks: c.remarks || null,
      }));
      const { error: cErr } = await supabase.from('stitch_issue_components').insert(compRows);
      if (cErr) console.error('[createIssueVoucher components]', cErr);
    }

    // Audit trail
    for (const c of components) {
      await stitchingVoucherService._insertAudit({
        transactionType: 'issue',
        voucherId: vRow.id,
        voucherNo: voucher.voucherNo,
        jobCardRef: voucher.jobCardRef,
        component: c.component,
        quantity: c.issuedQty,
        operatorId: voucher.operatorId,
        operatorName: voucher.operatorName,
        performedBy: username || undefined,
      });
    }

    return stitchingVoucherService.getIssueVoucherById(vRow.id);
  },

  async updateIssueVoucher(
    id: string,
    voucher: Partial<StitchIssueVoucher>,
    components: Omit<StitchIssueComponent, 'id' | 'issueVoucherId' | 'receivedQty' | 'pendingQty'>[],
    username?: string | null
  ): Promise<StitchIssueVoucher | null> {
    const supabase = createClient();

    const { error: vErr } = await supabase
      .from('stitch_issue_vouchers')
      .update({
        voucher_date: voucher.voucherDate,
        operator_id: voucher.operatorId || null,
        operator_name: voucher.operatorName,
        total_pieces: voucher.totalPieces,
        remarks: voucher.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (vErr) { console.error('[updateIssueVoucher]', vErr); return null; }

    // Replace components
    await supabase.from('stitch_issue_components').delete().eq('issue_voucher_id', id);
    if (components.length > 0) {
      const compRows = components.map((c) => ({
        issue_voucher_id: id,
        component: c.component,
        issued_qty: c.issuedQty,
        received_qty: 0,
        pending_qty: c.issuedQty,
        unit: c.unit || 'Pcs',
        size_breakdown: c.sizeBreakdown ? JSON.stringify(c.sizeBreakdown) : null,
        remarks: c.remarks || null,
      }));
      await supabase.from('stitch_issue_components').insert(compRows);
    }

    return stitchingVoucherService.getIssueVoucherById(id);
  },

  async deleteIssueVoucher(id: string): Promise<boolean> {
    const supabase = createClient();

    // 1. Find all receive vouchers linked to this issue voucher
    const { data: receiveVouchers, error: rvFetchError } = await supabase
      .from('stitch_receive_vouchers')
      .select('id')
      .eq('issue_voucher_id', id);
    if (rvFetchError) { console.error('[deleteIssueVoucher] fetch receive vouchers', rvFetchError); return false; }

    const receiveVoucherIds = (receiveVouchers || []).map((r: any) => r.id);

    // 2. Delete receive components for those receive vouchers
    if (receiveVoucherIds.length > 0) {
      const { error: rcError } = await supabase
        .from('stitch_receive_components')
        .delete()
        .in('receive_voucher_id', receiveVoucherIds);
      if (rcError) { console.error('[deleteIssueVoucher] delete receive components', rcError); return false; }

      // 3. Delete the receive vouchers themselves
      const { error: rvError } = await supabase
        .from('stitch_receive_vouchers')
        .delete()
        .in('id', receiveVoucherIds);
      if (rvError) { console.error('[deleteIssueVoucher] delete receive vouchers', rvError); return false; }
    }

    // 4. Delete issue components
    const { error: icError } = await supabase
      .from('stitch_issue_components')
      .delete()
      .eq('issue_voucher_id', id);
    if (icError) { console.error('[deleteIssueVoucher] delete issue components', icError); return false; }

    // 5. Finally delete the issue voucher
    const { error } = await supabase.from('stitch_issue_vouchers').delete().eq('id', id);
    if (error) { console.error('[deleteIssueVoucher]', error); return false; }
    return true;
  },

  // ── Receive Vouchers ───────────────────────────────────────────────────────

  async getNextReceiveVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('stitch_receive_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `SRV-${String(num).padStart(4, '0')}`;
  },

  async getReceiveVouchers(): Promise<StitchReceiveVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_receive_vouchers')
      .select('*, stitch_receive_components(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getReceiveVouchers]', error); return []; }
    return (data || []).map(rowToReceiveVoucher);
  },

  async getReceiveVoucherById(id: string): Promise<StitchReceiveVoucher | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_receive_vouchers')
      .select('*, stitch_receive_components(*)')
      .eq('id', id)
      .single();
    if (error) { console.error('[getReceiveVoucherById]', error); return null; }
    return rowToReceiveVoucher(data);
  },

  async createReceiveVoucher(
    voucher: Omit<StitchReceiveVoucher, 'id' | 'createdAt' | 'components'>,
    components: Omit<StitchReceiveComponent, 'id' | 'receiveVoucherId'>[],
    username?: string | null
  ): Promise<StitchReceiveVoucher | null> {
    const supabase = createClient();

    const { data: vRow, error: vErr } = await supabase
      .from('stitch_receive_vouchers')
      .insert({
        voucher_no: voucher.voucherNo,
        voucher_date: voucher.voucherDate,
        issue_voucher_id: voucher.issueVoucherId,
        issue_voucher_no: voucher.issueVoucherNo,
        job_card_ref: voucher.jobCardRef,
        style_name: voucher.styleName || null,
        party_name: voucher.partyName || null,
        operator_id: voucher.operatorId || null,
        operator_name: voucher.operatorName,
        total_pieces_received: voucher.totalPiecesReceived,
        total_stitching_charges: voucher.totalStitchingCharges || 0,
        remarks: voucher.remarks || null,
        created_by: username || null,
        updated_by: username || null,
      })
      .select()
      .single();

    if (vErr || !vRow) { console.error('[createReceiveVoucher]', vErr); return null; }

    if (components.length > 0) {
      const compRows = components.map((c) => ({
        receive_voucher_id: vRow.id,
        issue_component_id: c.issueComponentId,
        component: c.component,
        issued_qty: c.issuedQty,
        received_qty: c.receivedQty,
        balance_qty: c.balanceQty,
        unit: c.unit || 'Pcs',
        stitching_charge_per_pc: c.stitchingChargePerPc || 0,
        remarks: c.remarks || null,
      }));
      const { error: cErr } = await supabase.from('stitch_receive_components').insert(compRows);
      if (cErr) console.error('[createReceiveVoucher components]', cErr);

      // Update pending qty on issue components
      for (const c of components) {
        const { data: ic } = await supabase
          .from('stitch_issue_components')
          .select('received_qty, issued_qty')
          .eq('id', c.issueComponentId)
          .single();
        if (ic) {
          const newReceived = (ic.received_qty || 0) + c.receivedQty;
          const newPending = (ic.issued_qty || 0) - newReceived;
          await supabase
            .from('stitch_issue_components')
            .update({ received_qty: newReceived, pending_qty: Math.max(0, newPending) })
            .eq('id', c.issueComponentId);
        }
      }

      // Update issue voucher status
      await stitchingVoucherService._updateIssueVoucherStatus(voucher.issueVoucherId);
    }

    // Audit trail
    for (const c of components) {
      await stitchingVoucherService._insertAudit({
        transactionType: 'receive',
        voucherId: vRow.id,
        voucherNo: voucher.voucherNo,
        jobCardRef: voucher.jobCardRef,
        component: c.component,
        quantity: c.receivedQty,
        operatorId: voucher.operatorId,
        operatorName: voucher.operatorName,
        performedBy: username || undefined,
      });
    }

    return stitchingVoucherService.getReceiveVoucherById(vRow.id);
  },

  async updateReceiveVoucher(
    id: string,
    voucher: Partial<StitchReceiveVoucher>,
    components: Omit<StitchReceiveComponent, 'id' | 'receiveVoucherId'>[],
    username?: string | null
  ): Promise<StitchReceiveVoucher | null> {
    const supabase = createClient();

    const { error: vErr } = await supabase
      .from('stitch_receive_vouchers')
      .update({
        voucher_date: voucher.voucherDate,
        operator_id: voucher.operatorId || null,
        operator_name: voucher.operatorName,
        total_pieces_received: voucher.totalPiecesReceived,
        total_stitching_charges: voucher.totalStitchingCharges || 0,
        remarks: voucher.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (vErr) { console.error('[updateReceiveVoucher]', vErr); return null; }

    // Revert old component received quantities before replacing
    const { data: oldComps } = await supabase
      .from('stitch_receive_components')
      .select('*')
      .eq('receive_voucher_id', id);

    if (oldComps) {
      for (const oc of oldComps) {
        const { data: ic } = await supabase
          .from('stitch_issue_components')
          .select('received_qty, issued_qty')
          .eq('id', oc.issue_component_id)
          .single();
        if (ic) {
          const revertedReceived = Math.max(0, (ic.received_qty || 0) - oc.received_qty);
          const revertedPending = (ic.issued_qty || 0) - revertedReceived;
          await supabase
            .from('stitch_issue_components')
            .update({ received_qty: revertedReceived, pending_qty: Math.max(0, revertedPending) })
            .eq('id', oc.issue_component_id);
        }
      }
    }

    await supabase.from('stitch_receive_components').delete().eq('receive_voucher_id', id);

    if (components.length > 0) {
      const compRows = components.map((c) => ({
        receive_voucher_id: id,
        issue_component_id: c.issueComponentId,
        component: c.component,
        issued_qty: c.issuedQty,
        received_qty: c.receivedQty,
        balance_qty: c.balanceQty,
        unit: c.unit || 'Pcs',
        stitching_charge_per_pc: c.stitchingChargePerPc || 0,
        remarks: c.remarks || null,
      }));
      await supabase.from('stitch_receive_components').insert(compRows);

      for (const c of components) {
        const { data: ic } = await supabase
          .from('stitch_issue_components')
          .select('received_qty, issued_qty')
          .eq('id', c.issueComponentId)
          .single();
        if (ic) {
          const newReceived = (ic.received_qty || 0) + c.receivedQty;
          const newPending = (ic.issued_qty || 0) - newReceived;
          await supabase
            .from('stitch_issue_components')
            .update({ received_qty: newReceived, pending_qty: Math.max(0, newPending) })
            .eq('id', c.issueComponentId);
        }
      }

      if (voucher.issueVoucherId) {
        await stitchingVoucherService._updateIssueVoucherStatus(voucher.issueVoucherId);
      }
    }

    return stitchingVoucherService.getReceiveVoucherById(id);
  },

  async deleteReceiveVoucher(id: string): Promise<boolean> {
    const supabase = createClient();

    // Revert issue component quantities
    const { data: comps } = await supabase
      .from('stitch_receive_components')
      .select('*')
      .eq('receive_voucher_id', id);

    let issueVoucherId: string | null = null;
    const { data: rv } = await supabase
      .from('stitch_receive_vouchers')
      .select('issue_voucher_id')
      .eq('id', id)
      .single();
    if (rv) issueVoucherId = rv.issue_voucher_id;

    if (comps) {
      for (const c of comps) {
        const { data: ic } = await supabase
          .from('stitch_issue_components')
          .select('received_qty, issued_qty')
          .eq('id', c.issue_component_id)
          .single();
        if (ic) {
          const revertedReceived = Math.max(0, (ic.received_qty || 0) - c.received_qty);
          const revertedPending = (ic.issued_qty || 0) - revertedReceived;
          await supabase
            .from('stitch_issue_components')
            .update({ received_qty: revertedReceived, pending_qty: Math.max(0, revertedPending) })
            .eq('id', c.issue_component_id);
        }
      }
    }

    const { error } = await supabase.from('stitch_receive_vouchers').delete().eq('id', id);
    if (error) { console.error('[deleteReceiveVoucher]', error); return false; }

    if (issueVoucherId) {
      await stitchingVoucherService._updateIssueVoucherStatus(issueVoucherId);
    }

    return true;
  },

  // ── Audit Trail ────────────────────────────────────────────────────────────

  async getAuditTrail(filters?: { operatorId?: string; jobCardRef?: string; transactionType?: string }): Promise<StitchAuditEntry[]> {
    const supabase = createClient();
    let query = supabase
      .from('stitch_audit_trail')
      .select('*')
      .order('transaction_time', { ascending: false });

    if (filters?.operatorId) query = query.eq('operator_id', filters.operatorId);
    if (filters?.jobCardRef) query = query.eq('job_card_ref', filters.jobCardRef);
    if (filters?.transactionType) query = query.eq('transaction_type', filters.transactionType);

    const { data, error } = await query;
    if (error) { console.error('[getAuditTrail]', error); return []; }
    return (data || []).map(rowToAuditEntry);
  },

  // ── Issued Qty by Job Card ─────────────────────────────────────────────────

  async getIssuedQtyByJobCard(
    jobCardRef: string,
    excludeVoucherId?: string
  ): Promise<{ component: string; size: string; issuedQty: number }[]> {
    const supabase = createClient();

    // Fetch all issue vouchers for this job card
    let voucherQuery = supabase
      .from('stitch_issue_vouchers')
      .select('id')
      .eq('job_card_ref', jobCardRef);

    const { data: vouchers, error: vErr } = await voucherQuery;
    if (vErr || !vouchers || vouchers.length === 0) return [];

    let voucherIds = vouchers.map((v: any) => v.id);
    // Exclude the current edit voucher so we don't double-count it
    if (excludeVoucherId) {
      voucherIds = voucherIds.filter((id: string) => id !== excludeVoucherId);
    }
    if (voucherIds.length === 0) return [];

    const { data: comps, error: cErr } = await supabase
      .from('stitch_issue_components').select('component, issued_qty, size_breakdown').in('issue_voucher_id', voucherIds);

    if (cErr || !comps) return [];

    // Aggregate by component + size
    const map: Record<string, number> = {};
    for (const c of comps) {
      let sizeBreakdown: { size: string; qty: number }[] | null = null;
      if (Array.isArray(c.size_breakdown)) {
        sizeBreakdown = c.size_breakdown;
      } else if (typeof c.size_breakdown === 'string' && c.size_breakdown) {
        try { sizeBreakdown = JSON.parse(c.size_breakdown); } catch { sizeBreakdown = null; }
      }

      if (sizeBreakdown && sizeBreakdown.length > 0) {
        for (const sb of sizeBreakdown) {
          const key = `${c.component}||${sb.size || ''}`;
          map[key] = (map[key] || 0) + (sb.qty || 0);
        }
      } else {
        // No size breakdown — store under empty size key
        const key = `${c.component}||`;
        map[key] = (map[key] || 0) + (c.issued_qty || 0);
      }
    }

    return Object.entries(map).map(([key, qty]) => {
      const [component, size] = key.split('||');
      return { component, size, issuedQty: qty };
    });
  },

  // ── Internal Helpers ───────────────────────────────────────────────────────

  async _insertAudit(entry: {
    transactionType: 'issue' | 'receive';
    voucherId: string;
    voucherNo: string;
    jobCardRef: string;
    component: string;
    quantity: number;
    operatorId?: string;
    operatorName: string;
    performedBy?: string;
  }): Promise<void> {
    const supabase = createClient();
    let operatorCode: string | undefined;
    if (entry.operatorId) {
      const { data: op } = await supabase
        .from('stitch_operators')
        .select('operator_code')
        .eq('id', entry.operatorId)
        .single();
      operatorCode = op?.operator_code;
    }
    await supabase.from('stitch_audit_trail').insert({
      transaction_type: entry.transactionType,
      voucher_id: entry.voucherId,
      voucher_no: entry.voucherNo,
      job_card_ref: entry.jobCardRef,
      component: entry.component,
      quantity: entry.quantity,
      operator_id: entry.operatorId || null,
      operator_name: entry.operatorName,
      operator_code: operatorCode || null,
      performed_by: entry.performedBy || null,
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_time: new Date().toISOString(),
    });
  },

  async _updateIssueVoucherStatus(issueVoucherId: string): Promise<void> {
    const supabase = createClient();
    const { data: comps } = await supabase
      .from('stitch_issue_components')
      .select('issued_qty, pending_qty')
      .eq('issue_voucher_id', issueVoucherId);

    if (!comps || comps.length === 0) return;

    const totalIssued = comps.reduce((s: number, c: any) => s + (c.issued_qty || 0), 0);
    const totalPending = comps.reduce((s: number, c: any) => s + (c.pending_qty || 0), 0);

    let status: string;
    if (totalPending === 0) status = 'fully_received';
    else if (totalPending < totalIssued) status = 'partially_received';
    else status = 'open';

    await supabase
      .from('stitch_issue_vouchers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', issueVoucherId);
  },
};
