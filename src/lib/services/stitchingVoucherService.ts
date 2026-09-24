import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OperatorDocument { type: string; name: string; path: string; }
export interface StitchOperator {
  documents?: OperatorDocument[];
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
  cuttingComponentId?: string;
  stitchingRate?: number;
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
    documents: row.documents || [],
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
    component: row.component, cuttingComponentId: row.cutting_component_id, stitchingRate: row.stitching_rate == null ? undefined : Number(row.stitching_rate),
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
        documents: op.documents,
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
    if (error) throw new Error(error.message);
    return rowToOperator(data);
  },

  async updateOperator(id: string, op: Partial<StitchOperator>, username?: string | null): Promise<StitchOperator | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_operators')
      .update({
        operator_code: op.operatorCode,
        documents: op.documents,
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
    if (error) throw new Error(error.message);
    return rowToOperator(data);
  },

  async deleteOperator(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error, count } = await supabase.from('stitch_operators').delete({count:'exact'}).eq('id', id);
    if (!error && count !== 1) return false;
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
    const supabase=createClient();
    const {data,error}=await supabase.rpc('erp_save_team_voucher',{p_kind:'stitch_issue',p_id:null,p_header:{
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
      },p_lines:components.map(c=>({component:c.component,cutting_component_id:c.cuttingComponentId,stitching_rate:c.stitchingRate,issued_qty:c.issuedQty,received_qty:0,pending_qty:c.issuedQty,unit:c.unit||'Pcs',size_breakdown:c.sizeBreakdown?JSON.stringify(c.sizeBreakdown):null,remarks:c.remarks||null}))});
    if(error)throw new Error(error.message);
    if(!data?.id)throw new Error('Database did not return a voucher confirmation. Check the voucher list before retrying.');
    try {
      const saved=await stitchingVoucherService.getIssueVoucherById(data.id);
      if(!saved)throw new Error('Could not reload saved voucher');
      return saved;
    }catch{
      throw Object.assign(new Error('Voucher saved, but its details could not reload. Close this form and check the voucher list; do not create it again.'),{committedId:data.id});
    }
  },

  async updateIssueVoucher(
    id: string,
    voucher: Partial<StitchIssueVoucher>,
    components: Omit<StitchIssueComponent, 'id' | 'issueVoucherId' | 'receivedQty' | 'pendingQty'>[],
    username?: string | null
  ): Promise<StitchIssueVoucher | null> {
    const supabase=createClient();
    const {data,error}=await supabase.rpc('erp_save_team_voucher',{p_kind:'stitch_issue',p_id:id,p_header:{
        voucher_date: voucher.voucherDate,
        operator_id: voucher.operatorId || null,
        operator_name: voucher.operatorName,
        total_pieces: voucher.totalPieces,
        remarks: voucher.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      },p_lines:components.map(c=>({component:c.component,cutting_component_id:c.cuttingComponentId,stitching_rate:c.stitchingRate,issued_qty:c.issuedQty,received_qty:0,pending_qty:c.issuedQty,unit:c.unit||'Pcs',size_breakdown:c.sizeBreakdown?JSON.stringify(c.sizeBreakdown):null,remarks:c.remarks||null}))});
    if(error)throw new Error(error.message);
    if(!data?.id)throw new Error('Database did not return a voucher confirmation. Check the voucher list before retrying.');
    try {
      const saved=await stitchingVoucherService.getIssueVoucherById(data.id);
      if(!saved)throw new Error('Could not reload saved voucher');
      return saved;
    }catch{
      throw Object.assign(new Error('Voucher saved, but its details could not reload. Close this form and check the voucher list; do not create it again.'),{committedId:data.id});
    }
  },

  async deleteIssueVoucher(id: string): Promise<boolean> {
 const {error, count}=await createClient().from('stitch_issue_vouchers').delete({count:'exact'}).eq('id',id);
    if (!error && count !== 1) throw new Error('Delete was not confirmed. The entry may have changed or access may be restricted. Refresh and check the voucher.');if(error)throw new Error(error.message);return true;
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
    const supabase=createClient();
    const {data,error}=await supabase.rpc('erp_save_team_voucher',{p_kind:'stitch_receive',p_id:null,p_header:{
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
      },p_lines:components.map(c=>({issue_component_id:c.issueComponentId,component:c.component,issued_qty:c.issuedQty,received_qty:c.receivedQty,balance_qty:c.balanceQty,unit:c.unit||'Pcs',stitching_charge_per_pc:c.stitchingChargePerPc||0,remarks:c.remarks||null}))});
    if(error)throw new Error(error.message);
    return stitchingVoucherService.getReceiveVoucherById(data.id);
  },

  async updateReceiveVoucher(
    id: string,
    voucher: Partial<StitchReceiveVoucher>,
    components: Omit<StitchReceiveComponent, 'id' | 'receiveVoucherId'>[],
    username?: string | null
  ): Promise<StitchReceiveVoucher | null> {
    const supabase=createClient();
    const {data,error}=await supabase.rpc('erp_save_team_voucher',{p_kind:'stitch_receive',p_id:id,p_header:{
        voucher_date: voucher.voucherDate,
        operator_id: voucher.operatorId || null,
        operator_name: voucher.operatorName,
        total_pieces_received: voucher.totalPiecesReceived,
        total_stitching_charges: voucher.totalStitchingCharges || 0,
        remarks: voucher.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      },p_lines:components.map(c=>({issue_component_id:c.issueComponentId,component:c.component,issued_qty:c.issuedQty,received_qty:c.receivedQty,balance_qty:c.balanceQty,unit:c.unit||'Pcs',stitching_charge_per_pc:c.stitchingChargePerPc||0,remarks:c.remarks||null}))});
    if(error)throw new Error(error.message);
    return stitchingVoucherService.getReceiveVoucherById(data.id);
  },

  async deleteReceiveVoucher(id: string): Promise<boolean> {
 const {error, count}=await createClient().from('stitch_receive_vouchers').delete({count:'exact'}).eq('id',id);
    if (!error && count !== 1) throw new Error('Delete was not confirmed. The entry may have changed or access may be restricted. Refresh and check the voucher.');if(error)throw new Error(error.message);return true;
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
  ): Promise<{ component: string; size: string; issuedQty: number; cuttingComponentId?: string }[]> {
    const supabase = createClient();

    // Fetch all issue vouchers for this job card
    let voucherQuery = supabase
      .from('stitch_issue_vouchers')
      .select('id')
      .eq('job_card_ref', jobCardRef);

    const { data: vouchers, error: vErr } = await voucherQuery;
    if(vErr) throw new Error(vErr.message);
    if(!vouchers?.length) return [];

    let voucherIds = vouchers.map((v: any) => v.id);
    // Exclude the current edit voucher so we don't double-count it
    if (excludeVoucherId) {
      voucherIds = voucherIds.filter((id: string) => id !== excludeVoucherId);
    }
    if (voucherIds.length === 0) return [];

    const { data: comps, error: cErr } = await supabase
      .from('stitch_issue_components').select('component, issued_qty, size_breakdown, cutting_component_id').in('issue_voucher_id', voucherIds);

    if(cErr) throw new Error(cErr.message);
    if(!comps) return [];

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
          const key = `${c.component}||${sb.size || ''}||${c.cutting_component_id || ''}`;
          map[key] = (map[key] || 0) + (sb.qty || 0);
        }
      } else {
        // No size breakdown — store under empty size key
        const key = `${c.component}||||${c.cutting_component_id || ''}`;
        map[key] = (map[key] || 0) + (c.issued_qty || 0);
      }
    }

    return Object.entries(map).map(([key, qty]) => {
      const [component, size, cuttingComponentId] = key.split('||');
      return { component, size, issuedQty: qty, cuttingComponentId };
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
