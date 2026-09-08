import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContractorProcess = 'Finishing' | 'Press' | 'Packing' | 'Contractor';

export interface ContractorIssueItem {
  id: string;
  issueVoucherId: string;
  item: string;
  colour: string;
  size: string;
  issuedQty: number;
  receivedQty: number;
  balanceQty: number;
}

export interface ContractorIssueVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  jobCardId?: string;
  jobCardRef: string;
  styleNo: string;
  item: string;
  colour: string;
  size: string;
  contractorName: string;
  process: ContractorProcess;
  totalIssued: number;
  stitchReceiveRef?: string;
  stitchReceiveVoucherId?: string;
  remarks?: string;
  items: ContractorIssueItem[];
  createdBy?: string | null;
  createdAt?: string;
}

export interface ContractorReceiveItem {
  id: string;
  receiveVoucherId: string;
  issueItemId: string;
  item: string;
  colour: string;
  size: string;
  issuedQty: number;
  alreadyReceived: number;
  balanceBefore: number;
  receivedToday: number;
}

export interface ContractorReceiveVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  contractorName: string;
  jobCardRef: string;
  totalReceived: number;
  remarks?: string;
  items: ContractorReceiveItem[];
  createdBy?: string | null;
  createdAt?: string;
}

// Finished goods entry created from contractor receive
export interface FinishedGoodsEntry {
  id: string;
  jobCardRef: string;
  styleName?: string;
  partyName?: string;
  item: string;
  colour: string;
  size: string;
  totalPieces: number;
  availableForDispatch: number;
  dispatchedPieces: number;
  source: string;
  sourceVoucherNo?: string;
  sourceVoucherId?: string;
  dateAdded: string;
  status: string;
  createdBy?: string | null;
  createdAt?: string;
}

// Pending item for receive entry (aggregated balance per issue item)
export interface PendingContractorItem {
  issueItemId: string;
  issueVoucherId: string;
  issueVoucherNo: string;
  jobCardRef: string;
  contractorName: string;
  process: ContractorProcess;
  item: string;
  colour: string;
  size: string;
  totalIssued: number;
  alreadyReceived: number;
  balance: number;
  receivedToday: number; // UI input field
}

// ─── NEW: Stitching Receive Reference types ───────────────────────────────────

export interface StitchReceiveRef {
  id: string;
  voucherNo: string;
  voucherDate: string;
  jobCardRef: string;
  jobCardId?: string;
  styleName?: string;
  partyName?: string;
  operatorName: string;
  totalPiecesReceived: number;
  components: StitchReceiveComponentSummary[];
}

export interface StitchReceiveComponentSummary {
  id: string;                // stitch_receive_components.id
  issueComponentId: string;
  component: string;
  receivedQty: number;
  unit: string;
  sizeBreakdown?: { size: string; qty: number }[];
}

// Per-component+size row for finishing receive
export interface FinishingComponentRow {
  tempId: string;
  stitchReceiveComponentId: string;
  component: string;
  size: string;
  colour: string;
  stitchReceivedQty: number;   // total received from stitching for this component+size
  alreadyFinishedQty: number;  // already finished in previous vouchers
  pendingQty: number;          // stitchReceivedQty - alreadyFinishedQty
  receivedQty: number;         // qty being entered in this voucher (UI input)
  error?: string;
}

// Finishing receive voucher
export interface FinishingReceiveVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  stitchReceiveRef: string;
  stitchReceiveVoucherId?: string;
  jobCardRef: string;
  jobCardId?: string;
  styleName?: string;
  partyName?: string;
  contractorName: string;
  process: ContractorProcess;
  totalComponentsReceived: number;
  totalFinishedQty: number;
  remarks?: string;
  components: FinishingReceiveComponentRecord[];
  createdBy?: string | null;
  createdAt?: string;
}

export interface FinishingReceiveComponentRecord {
  id: string;
  receiveVoucherId: string;
  stitchReceiveComponentId?: string;
  component: string;
  size: string;
  colour: string;
  stitchReceivedQty: number;
  alreadyFinishedQty: number;
  pendingQty: number;
  receivedQty: number;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToIssueItem(row: any): ContractorIssueItem {
  return {
    id: row.id,
    issueVoucherId: row.issue_voucher_id,
    item: row.item || '',
    colour: row.colour || '',
    size: row.size || '',
    issuedQty: row.issued_qty || 0,
    receivedQty: row.received_qty || 0,
    balanceQty: row.balance_qty || 0,
  };
}

function rowToIssueVoucher(row: any): ContractorIssueVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    jobCardId: row.job_card_id || undefined,
    jobCardRef: row.job_card_ref || '',
    styleNo: row.style_no || '',
    item: row.item || '',
    colour: row.colour || '',
    size: row.size || '',
    contractorName: row.contractor_name || '',
    process: row.process as ContractorProcess,
    totalIssued: row.total_issued || 0,
    stitchReceiveRef: row.stitch_receive_ref || undefined,
    stitchReceiveVoucherId: row.stitch_receive_voucher_id || undefined,
    remarks: row.remarks || undefined,
    items: Array.isArray(row.contractor_issue_items)
      ? row.contractor_issue_items.map(rowToIssueItem)
      : [],
    createdBy: row.created_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToReceiveItem(row: any): ContractorReceiveItem {
  return {
    id: row.id,
    receiveVoucherId: row.receive_voucher_id,
    issueItemId: row.issue_item_id,
    item: row.item || '',
    colour: row.colour || '',
    size: row.size || '',
    issuedQty: row.issued_qty || 0,
    alreadyReceived: row.already_received || 0,
    balanceBefore: row.balance_before || 0,
    receivedToday: row.received_today || 0,
  };
}

function rowToReceiveVoucher(row: any): ContractorReceiveVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    contractorName: row.contractor_name || '',
    jobCardRef: row.job_card_ref || '',
    totalReceived: row.total_received || 0,
    remarks: row.remarks || undefined,
    items: Array.isArray(row.contractor_receive_items)
      ? row.contractor_receive_items.map(rowToReceiveItem)
      : [],
    createdBy: row.created_by || null,
    createdAt: row.created_at || '',
  };
}

function rowToFinishingReceiveVoucher(row: any): FinishingReceiveVoucher {
  return {
    id: row.id,
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    stitchReceiveRef: row.stitch_receive_ref || '',
    stitchReceiveVoucherId: row.stitch_receive_voucher_id || undefined,
    jobCardRef: row.job_card_ref || '',
    jobCardId: row.job_card_id || undefined,
    styleName: row.style_name || undefined,
    partyName: row.party_name || undefined,
    contractorName: row.contractor_name || '',
    process: (row.process as ContractorProcess) || 'Finishing',
    totalComponentsReceived: row.total_components_received || 0,
    totalFinishedQty: row.total_finished_qty || 0,
    remarks: row.remarks || undefined,
    components: Array.isArray(row.finishing_receive_components)
      ? row.finishing_receive_components.map((c: any): FinishingReceiveComponentRecord => ({
          id: c.id,
          receiveVoucherId: c.receive_voucher_id,
          stitchReceiveComponentId: c.stitch_receive_component_id || undefined,
          component: c.component || '',
          size: c.size || '',
          colour: c.colour || '',
          stitchReceivedQty: c.stitch_received_qty || 0,
          alreadyFinishedQty: c.already_finished_qty || 0,
          pendingQty: c.pending_qty || 0,
          receivedQty: c.received_qty || 0,
        }))
      : [],
    createdBy: row.created_by || null,
    createdAt: row.created_at || '',
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const contractorFinishingService = {

  // ── Voucher Number Generation ──────────────────────────────────────────────

  async getNextIssueVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('contractor_issue_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `CIV-${String(num).padStart(4, '0')}`;
  },

  async getNextReceiveVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('contractor_receive_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `CRV-${String(num).padStart(4, '0')}`;
  },

  async getNextFinishingReceiveVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('finishing_receive_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `FRV-${String(num).padStart(4, '0')}`;
  },

  // ── Issue Vouchers ─────────────────────────────────────────────────────────

  async getIssueVouchers(): Promise<ContractorIssueVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contractor_issue_vouchers')
      .select('*, contractor_issue_items(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getIssueVouchers]', error); return []; }
    return (data || []).map(rowToIssueVoucher);
  },

  async createIssueVoucher(
    voucher: Omit<ContractorIssueVoucher, 'id' | 'createdAt' | 'items'>,
    items: { item: string; colour: string; size: string; issuedQty: number }[],
    username?: string | null
  ): Promise<ContractorIssueVoucher | null> {
    const supabase = createClient();

    const { data: vRow, error: vErr } = await supabase
      .from('contractor_issue_vouchers')
      .insert({
        voucher_no: voucher.voucherNo,
        voucher_date: voucher.voucherDate,
        job_card_id: voucher.jobCardId || null,
        job_card_ref: voucher.jobCardRef,
        style_no: voucher.styleNo || null,
        item: voucher.item || null,
        colour: voucher.colour || null,
        size: voucher.size || null,
        contractor_name: voucher.contractorName,
        process: voucher.process,
        total_issued: voucher.totalIssued,
        stitch_receive_ref: voucher.stitchReceiveRef || null,
        stitch_receive_voucher_id: voucher.stitchReceiveVoucherId || null,
        remarks: voucher.remarks || null,
        created_by: username || null,
        updated_by: username || null,
      })
      .select()
      .single();

    if (vErr || !vRow) { console.error('[createIssueVoucher]', vErr); return null; }

    if (items.length > 0) {
      const itemRows = items.map((it) => ({
        issue_voucher_id: vRow.id,
        item: it.item,
        colour: it.colour || null,
        size: it.size || null,
        issued_qty: it.issuedQty,
        received_qty: 0,
        balance_qty: it.issuedQty,
      }));
      const { error: iErr } = await supabase.from('contractor_issue_items').insert(itemRows);
      if (iErr) console.error('[createIssueVoucher items]', iErr);
    }

    // Re-fetch with items
    const { data: full, error: fErr } = await supabase
      .from('contractor_issue_vouchers')
      .select('*, contractor_issue_items(*)')
      .eq('id', vRow.id)
      .single();
    if (fErr) return null;
    return rowToIssueVoucher(full);
  },

  async deleteIssueVoucher(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('contractor_issue_vouchers').delete().eq('id', id);
    if (error) { console.error('[deleteIssueVoucher]', error); return false; }
    return true;
  },

  async updateIssueVoucher(
    id: string,
    voucher: Omit<ContractorIssueVoucher, 'id' | 'createdAt' | 'items'>,
    items: { item: string; colour: string; size: string; issuedQty: number }[],
    username?: string | null
  ): Promise<ContractorIssueVoucher | null> {
    const supabase = createClient();

    const { error: vErr } = await supabase
      .from('contractor_issue_vouchers')
      .update({
        voucher_date: voucher.voucherDate,
        job_card_id: voucher.jobCardId || null,
        job_card_ref: voucher.jobCardRef,
        style_no: voucher.styleNo || null,
        item: voucher.item || null,
        colour: voucher.colour || null,
        size: voucher.size || null,
        contractor_name: voucher.contractorName,
        process: voucher.process,
        total_issued: voucher.totalIssued,
        stitch_receive_ref: voucher.stitchReceiveRef || null,
        stitch_receive_voucher_id: voucher.stitchReceiveVoucherId || null,
        remarks: voucher.remarks || null,
        updated_by: username || null,
      })
      .eq('id', id);

    if (vErr) { console.error('[updateIssueVoucher]', vErr); return null; }

    // Delete existing items and re-insert
    await supabase.from('contractor_issue_items').delete().eq('issue_voucher_id', id);

    if (items.length > 0) {
      const itemRows = items.map((it) => ({
        issue_voucher_id: id,
        item: it.item,
        colour: it.colour || null,
        size: it.size || null,
        issued_qty: it.issuedQty,
        received_qty: 0,
        balance_qty: it.issuedQty,
      }));
      const { error: iErr } = await supabase.from('contractor_issue_items').insert(itemRows);
      if (iErr) console.error('[updateIssueVoucher items]', iErr);
    }

    const { data: full, error: fErr } = await supabase
      .from('contractor_issue_vouchers')
      .select('*, contractor_issue_items(*)')
      .eq('id', id)
      .single();
    if (fErr) return null;
    return rowToIssueVoucher(full);
  },

  // ── Pending Items for Receive ──────────────────────────────────────────────

  async getPendingItemsByContractorAndJobCard(
    contractorName: string,
    jobCardRef: string
  ): Promise<PendingContractorItem[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('contractor_issue_vouchers')
      .select('id, voucher_no, job_card_ref, contractor_name, process, contractor_issue_items(*)')
      .eq('contractor_name', contractorName)
      .eq('job_card_ref', jobCardRef);

    if (error) { console.error('[getPendingItems]', error); return []; }

    const pending: PendingContractorItem[] = [];
    for (const v of data || []) {
      for (const it of (v.contractor_issue_items || [])) {
        const balance = (it.issued_qty || 0) - (it.received_qty || 0);
        if (balance > 0) {
          pending.push({
            issueItemId: it.id,
            issueVoucherId: v.id,
            issueVoucherNo: v.voucher_no,
            jobCardRef: v.job_card_ref,
            contractorName: v.contractor_name,
            process: v.process as ContractorProcess,
            item: it.item || '',
            colour: it.colour || '',
            size: it.size || '',
            totalIssued: it.issued_qty || 0,
            alreadyReceived: it.received_qty || 0,
            balance,
            receivedToday: 0,
          });
        }
      }
    }
    return pending;
  },

  // ── Job Cards with Pending Items ───────────────────────────────────────────
  // Returns only job card refs that have at least one issue item with balance > 0
  async getJobCardsWithPendingItems(contractorName: string): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contractor_issue_vouchers')
      .select('job_card_ref, contractor_issue_items(issued_qty, received_qty)')
      .eq('contractor_name', contractorName);

    if (error) { console.error('[getJobCardsWithPendingItems]', error); return []; }

    const jobCardsWithPending = new Set<string>();
    for (const v of data || []) {
      for (const it of (v.contractor_issue_items || [])) {
        const balance = (it.issued_qty || 0) - (it.received_qty || 0);
        if (balance > 0) {
          jobCardsWithPending.add(v.job_card_ref);
          break;
        }
      }
    }
    return [...jobCardsWithPending].sort();
  },

  // ── Receive Vouchers ───────────────────────────────────────────────────────

  async getReceiveVouchers(): Promise<ContractorReceiveVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contractor_receive_vouchers')
      .select('*, contractor_receive_items(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getReceiveVouchers]', error); return []; }
    return (data || []).map(rowToReceiveVoucher);
  },

  async createReceiveVoucher(
    voucher: { voucherNo: string; voucherDate: string; contractorName: string; jobCardRef: string; remarks?: string },
    items: PendingContractorItem[],
    username?: string | null
  ): Promise<ContractorReceiveVoucher | null> {
    const supabase = createClient();

    const totalReceived = items.reduce((s, it) => s + (it.receivedToday || 0), 0);

    const { data: vRow, error: vErr } = await supabase
      .from('contractor_receive_vouchers')
      .insert({
        voucher_no: voucher.voucherNo,
        voucher_date: voucher.voucherDate,
        contractor_name: voucher.contractorName,
        job_card_ref: voucher.jobCardRef,
        total_received: totalReceived,
        remarks: voucher.remarks || null,
        created_by: username || null,
        updated_by: username || null,
      })
      .select()
      .single();

    if (vErr || !vRow) { console.error('[createReceiveVoucher]', vErr); return null; }

    // Insert receive items and update issue item balances
    for (const it of items) {
      if ((it.receivedToday || 0) <= 0) continue;

      await supabase.from('contractor_receive_items').insert({
        receive_voucher_id: vRow.id,
        issue_item_id: it.issueItemId,
        item: it.item,
        colour: it.colour || null,
        size: it.size || null,
        issued_qty: it.totalIssued,
        already_received: it.alreadyReceived,
        balance_before: it.balance,
        received_today: it.receivedToday,
      });

      const newReceived = it.alreadyReceived + it.receivedToday;
      const newBalance = it.totalIssued - newReceived;
      await supabase
        .from('contractor_issue_items')
        .update({ received_qty: newReceived, balance_qty: newBalance, updated_at: new Date().toISOString() })
        .eq('id', it.issueItemId);

      // Component stock is posted by the receive-item database trigger.

    }

    const { data: full, error: fErr } = await supabase
      .from('contractor_receive_vouchers')
      .select('*, contractor_receive_items(*)')
      .eq('id', vRow.id)
      .single();
    if (fErr) return null;
    return rowToReceiveVoucher(full);
  },

  async deleteReceiveVoucher(id: string): Promise<boolean> {
    const supabase = createClient();

    // ── Step 1: Fetch receive voucher + items BEFORE deleting to restore balances ──
    const { data: vRow } = await supabase
      .from('contractor_receive_vouchers')
      .select('*, contractor_receive_items(*)')
      .eq('id', id)
      .single();

    if (vRow) {
      // Restore each issue item's received_qty and balance_qty
      for (const item of (vRow.contractor_receive_items || [])) {
        const receivedToday = item.received_today || 0;
        if (receivedToday <= 0) continue;

        const { data: issueItem } = await supabase
          .from('contractor_issue_items').select('issued_qty, received_qty').eq('id', item.issue_item_id)
          .single();

        if (issueItem) {
          const restoredReceived = Math.max(0, (issueItem.received_qty || 0) - receivedToday);
          const restoredBalance = (issueItem.issued_qty || 0) - restoredReceived;
          await supabase
            .from('contractor_issue_items')
            .update({
              received_qty: restoredReceived,
              balance_qty: restoredBalance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.issue_item_id);
        }
      }

      // ── Step 2: Delete finished_goods entries created by this receive voucher ──
      await supabase
        .from('finished_goods').delete().eq('source_voucher_id', id);
    }

    // ── Step 3: Delete receive items then the voucher ──
    await supabase.from('contractor_receive_items').delete().eq('receive_voucher_id', id);

    const { error } = await supabase.from('contractor_receive_vouchers').delete().eq('id', id);
    if (error) { console.error('[deleteReceiveVoucher]', error); return false; }
    return true;
  },

  async updateReceiveVoucher(
    id: string,
    voucher: { voucherDate: string; contractorName: string; jobCardRef: string; remarks?: string },
    items: PendingContractorItem[],
    username?: string | null
  ): Promise<ContractorReceiveVoucher | null> {
    const supabase = createClient();

    // ── Step 1: Fetch existing receive items to reverse their impact ──
    const { data: oldVRow } = await supabase
      .from('contractor_receive_vouchers').select('*, contractor_receive_items(*)').eq('id', id)
      .single();

    if (oldVRow) {
      for (const oldItem of (oldVRow.contractor_receive_items || [])) {
        const oldReceivedToday = oldItem.received_today || 0;
        if (oldReceivedToday <= 0) continue;

        const { data: issueItem } = await supabase
          .from('contractor_issue_items').select('issued_qty, received_qty').eq('id', oldItem.issue_item_id)
          .single();

        if (issueItem) {
          const restoredReceived = Math.max(0, (issueItem.received_qty || 0) - oldReceivedToday);
          const restoredBalance = (issueItem.issued_qty || 0) - restoredReceived;
          await supabase
            .from('contractor_issue_items')
            .update({
              received_qty: restoredReceived,
              balance_qty: restoredBalance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', oldItem.issue_item_id);
        }
      }

      // Delete old finished_goods entries for this voucher
      await supabase.from('finished_goods').delete().eq('source_voucher_id', id);
    }

    // ── Step 2: Update voucher header ──
    const totalReceived = items.reduce((s, it) => s + (it.receivedToday || 0), 0);

    const { error: vErr } = await supabase
      .from('contractor_receive_vouchers')
      .update({
        voucher_date: voucher.voucherDate,
        contractor_name: voucher.contractorName,
        job_card_ref: voucher.jobCardRef,
        total_received: totalReceived,
        remarks: voucher.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (vErr) { console.error('[updateReceiveVoucher]', vErr); return null; }

    // ── Step 3: Delete old items and re-insert with new quantities ──
    await supabase.from('contractor_receive_items').delete().eq('receive_voucher_id', id);

    for (const it of items) {
      if ((it.receivedToday || 0) <= 0) continue;

      await supabase.from('contractor_receive_items').insert({
        receive_voucher_id: id,
        issue_item_id: it.issueItemId,
        item: it.item,
        colour: it.colour || null,
        size: it.size || null,
        issued_qty: it.totalIssued,
        already_received: it.alreadyReceived,
        balance_before: it.balance,
        received_today: it.receivedToday,
      });

      // Apply new received qty to issue item
      const { data: issueItem } = await supabase
        .from('contractor_issue_items').select('issued_qty, received_qty').eq('id', it.issueItemId)
        .single();

      if (issueItem) {
        const newReceived = (issueItem.received_qty || 0) + it.receivedToday;
        const newBalance = (issueItem.issued_qty || 0) - newReceived;
        await supabase
          .from('contractor_issue_items')
          .update({
            received_qty: newReceived,
            balance_qty: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', it.issueItemId);
      }

      // Re-create finished_goods entry
      const { data: voucherRow } = await supabase
        .from('contractor_receive_vouchers').select('voucher_no').eq('id', id)
        .single();

      // Component stock is posted by the receive-item database trigger.

    }

    const { data: full, error: fErr } = await supabase
      .from('contractor_receive_vouchers').select('*, contractor_receive_items(*)').eq('id', id)
      .single();
    if (fErr) return null;
    return rowToReceiveVoucher(full);
  },

  // ── NEW: Stitching Receive References ─────────────────────────────────────
  // Fetch all stitching receive vouchers that can be used as source for finishing
  async getStitchReceiveRefs(): Promise<StitchReceiveRef[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stitch_receive_vouchers').select('id, voucher_no, voucher_date, job_card_ref, style_name, party_name, operator_name, total_pieces_received, stitch_receive_components(*)').order('created_at', { ascending: false });
    if (error) { console.error('[getStitchReceiveRefs]', error); return []; }

    return (data || []).map((row: any): StitchReceiveRef => ({
      id: row.id,
      voucherNo: row.voucher_no,
      voucherDate: row.voucher_date,
      jobCardRef: row.job_card_ref || '',jobCardId: undefined,styleName: row.style_name || undefined,partyName: row.party_name || undefined,operatorName: row.operator_name || '',
      totalPiecesReceived: row.total_pieces_received || 0,
      components: (row.stitch_receive_components || []).map((c: any): StitchReceiveComponentSummary => {
        let sizeBreakdown: { size: string; qty: number }[] | undefined;
        // Try to get size breakdown from the linked issue component
        return {
          id: c.id,
          issueComponentId: c.issue_component_id,
          component: c.component || '',receivedQty: c.received_qty || 0,unit: c.unit || 'Pcs',
          sizeBreakdown,
        };
      }),
    }));
  },

  // Get stitch receive ref with full size breakdown from issue components
  async getStitchReceiveRefWithSizes(stitchReceiveVoucherId: string): Promise<StitchReceiveRef | null> {
    const supabase = createClient();

    const { data: rv, error: rvErr } = await supabase
      .from('stitch_receive_vouchers')
      .select('id, voucher_no, voucher_date, job_card_ref, style_name, party_name, operator_name, total_pieces_received, stitch_receive_components(*)')
      .eq('id', stitchReceiveVoucherId)
      .single();

    if (rvErr || !rv) { console.error('[getStitchReceiveRefWithSizes]', rvErr); return null; }

    // For each receive component, fetch the issue component to get size_breakdown
    const components: StitchReceiveComponentSummary[] = [];
    for (const rc of (rv.stitch_receive_components || [])) {
      let sizeBreakdown: { size: string; qty: number }[] | undefined;
      if (rc.issue_component_id) {
        const { data: ic } = await supabase
          .from('stitch_issue_components')
          .select('size_breakdown')
          .eq('id', rc.issue_component_id)
          .single();
        if (ic?.size_breakdown) {
          try {
            sizeBreakdown = typeof ic.size_breakdown === 'string'
              ? JSON.parse(ic.size_breakdown)
              : ic.size_breakdown;
          } catch { sizeBreakdown = undefined; }
        }
      }
      components.push({
        id: rc.id,
        issueComponentId: rc.issue_component_id,
        component: rc.component || '',
        receivedQty: rc.received_qty || 0,
        unit: rc.unit || 'Pcs',
        sizeBreakdown,
      });
    }

    return {
      id: rv.id,
      voucherNo: rv.voucher_no,
      voucherDate: rv.voucher_date,
      jobCardRef: rv.job_card_ref || '',
      jobCardId: undefined,
      styleName: rv.style_name || undefined,
      partyName: rv.party_name || undefined,
      operatorName: rv.operator_name || '',
      totalPiecesReceived: rv.total_pieces_received || 0,
      components,
    };
  },

  // ── NEW: Finishing Receive Vouchers ───────────────────────────────────────

  async getFinishingReceiveVouchers(): Promise<FinishingReceiveVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finishing_receive_vouchers')
      .select('*, finishing_receive_components(*)')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getFinishingReceiveVouchers]', error); return []; }
    return (data || []).map(rowToFinishingReceiveVoucher);
  },

  async createFinishingReceiveVoucher(
    voucher: {
      voucherNo: string;
      voucherDate: string;
      stitchReceiveRef: string;
      stitchReceiveVoucherId: string;
      jobCardRef: string;
      jobCardId?: string;
      styleName?: string;
      partyName?: string;
      contractorName: string;
      process: ContractorProcess;
      remarks?: string;
    },
    components: FinishingComponentRow[],
    username?: string | null
  ): Promise<FinishingReceiveVoucher | null> {
    const supabase = createClient();

    const activeComponents = components.filter((c) => (c.receivedQty || 0) > 0);
    const totalFinishedQty = activeComponents.reduce((s, c) => s + c.receivedQty, 0);

    const { data: vRow, error: vErr } = await supabase
      .from('finishing_receive_vouchers')
      .insert({
        voucher_no: voucher.voucherNo,
        voucher_date: voucher.voucherDate,
        stitch_receive_ref: voucher.stitchReceiveRef,
        stitch_receive_voucher_id: voucher.stitchReceiveVoucherId,
        job_card_ref: voucher.jobCardRef,
        job_card_id: voucher.jobCardId || null,
        style_name: voucher.styleName || null,
        party_name: voucher.partyName || null,
        contractor_name: voucher.contractorName,
        process: voucher.process,
        total_components_received: activeComponents.length,
        total_finished_qty: totalFinishedQty,
        remarks: voucher.remarks || null,
        created_by: username || null,
        updated_by: username || null,
      })
      .select()
      .single();

    if (vErr || !vRow) { console.error('[createFinishingReceiveVoucher]', vErr); return null; }

    // Insert component records and update finishing_stock
    for (const comp of activeComponents) {
      await supabase.from('finishing_receive_components').insert({
        receive_voucher_id: vRow.id,
        stitch_receive_component_id: comp.stitchReceiveComponentId || null,
        component: comp.component,
        size: comp.size || null,
        colour: comp.colour || null,
        stitch_received_qty: comp.stitchReceivedQty,
        already_finished_qty: comp.alreadyFinishedQty,
        pending_qty: comp.pendingQty,
        received_qty: comp.receivedQty,
      });

      // Upsert finishing_stock
      const { data: existing } = await supabase
        .from('finishing_stock')
        .select('id, finished_qty, stitch_received_qty')
        .eq('job_card_ref', voucher.jobCardRef)
        .eq('stitch_receive_ref', voucher.stitchReceiveRef)
        .eq('component', comp.component)
        .eq('size', comp.size || '')
        .eq('colour', comp.colour || '')
        .maybeSingle();

      if (existing) {
        const newFinished = (existing.finished_qty || 0) + comp.receivedQty;
        const newPending = (existing.stitch_received_qty || comp.stitchReceivedQty) - newFinished;
        await supabase
          .from('finishing_stock')
          .update({
            finished_qty: newFinished,
            pending_qty: Math.max(0, newPending),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('finishing_stock').insert({
          job_card_ref: voucher.jobCardRef,
          stitch_receive_ref: voucher.stitchReceiveRef,
          component: comp.component,
          size: comp.size || '',
          colour: comp.colour || '',
          stitch_received_qty: comp.stitchReceivedQty,
          finished_qty: comp.receivedQty,
          pending_qty: Math.max(0, comp.stitchReceivedQty - comp.receivedQty),
        });
      }
    }

    // Components remain in finishing_stock until a complete assembly is saved.

    const { data: full, error: fErr } = await supabase
      .from('finishing_receive_vouchers')
      .select('*, finishing_receive_components(*)')
      .eq('id', vRow.id)
      .single();
    if (fErr) return null;
    return rowToFinishingReceiveVoucher(full);
  },

  async deleteFinishingReceiveVoucher(id: string): Promise<boolean> {
    const supabase = createClient();

    // ── Step 1: Fetch voucher + components BEFORE deleting to reverse finishing_stock ──
    const { data: vRow } = await supabase
      .from('finishing_receive_vouchers')
      .select('*, finishing_receive_components(*)')
      .eq('id', id)
      .single();

    if (vRow) {
      const jobCardRef = vRow.job_card_ref || '';
      const stitchReceiveRef = vRow.stitch_receive_ref || '';

      for (const comp of (vRow.finishing_receive_components || [])) {
        const receivedQty = comp.received_qty || 0;
        if (receivedQty <= 0) continue;

        // Reverse finishing_stock
        const { data: stockRow } = await supabase
          .from('finishing_stock')
          .select('id, finished_qty, stitch_received_qty')
          .eq('job_card_ref', jobCardRef)
          .eq('stitch_receive_ref', stitchReceiveRef)
          .eq('component', comp.component || '')
          .eq('size', comp.size || '')
          .eq('colour', comp.colour || '')
          .maybeSingle();

        if (stockRow) {
          const restoredFinished = Math.max(0, (stockRow.finished_qty || 0) - receivedQty);
          const restoredPending = (stockRow.stitch_received_qty || 0) - restoredFinished;
          await supabase
            .from('finishing_stock')
            .update({
              finished_qty: restoredFinished,
              pending_qty: Math.max(0, restoredPending),
              updated_at: new Date().toISOString(),
            })
            .eq('id', stockRow.id);
        }
      }

      // ── Step 2: Delete finished_goods entries created by this voucher ──
      await supabase.from('finished_goods').delete().eq('source_voucher_id', id);
    }

    // ── Step 3: Delete components then the voucher ──
    await supabase.from('finishing_receive_components').delete().eq('receive_voucher_id', id);

    const { error } = await supabase.from('finishing_receive_vouchers').delete().eq('id', id);
    if (error) { console.error('[deleteFinishingReceiveVoucher]', error); return false; }
    return true;
  },

  async updateFinishingReceiveVoucher(
    id: string,
    voucher: {
      voucherDate: string;
      stitchReceiveRef: string;
      stitchReceiveVoucherId: string;
      jobCardRef: string;
      jobCardId?: string;
      styleName?: string;
      partyName?: string;
      contractorName: string;
      process: ContractorProcess;
      remarks?: string;
    },
    components: FinishingComponentRow[],
    username?: string | null
  ): Promise<FinishingReceiveVoucher | null> {
    const supabase = createClient();

    // ── Step 1: Fetch existing components to reverse their finishing_stock impact ──
    const { data: oldVRow } = await supabase
      .from('finishing_receive_vouchers')
      .select('*, finishing_receive_components(*)')
      .eq('id', id)
      .single();

    if (oldVRow) {
      const oldJobCardRef = oldVRow.job_card_ref || '';
      const oldStitchReceiveRef = oldVRow.stitch_receive_ref || '';

      for (const oldComp of (oldVRow.finishing_receive_components || [])) {
        const oldReceivedQty = oldComp.received_qty || 0;
        if (oldReceivedQty <= 0) continue;

        // Reverse finishing_stock for old component
        const { data: stockRow } = await supabase
          .from('finishing_stock')
          .select('id, finished_qty, stitch_received_qty')
          .eq('job_card_ref', oldJobCardRef)
          .eq('stitch_receive_ref', oldStitchReceiveRef)
          .eq('component', oldComp.component || '')
          .eq('size', oldComp.size || '')
          .eq('colour', oldComp.colour || '')
          .maybeSingle();

        if (stockRow) {
          const restoredFinished = Math.max(0, (stockRow.finished_qty || 0) - oldReceivedQty);
          const restoredPending = (stockRow.stitch_received_qty || 0) - restoredFinished;
          await supabase
            .from('finishing_stock')
            .update({
              finished_qty: restoredFinished,
              pending_qty: Math.max(0, restoredPending),
              updated_at: new Date().toISOString(),
            })
            .eq('id', stockRow.id);
        }
      }

      // Delete old finished_goods entries for this voucher
      await supabase.from('finished_goods').delete().eq('source_voucher_id', id);
    }

    // ── Step 2: Update voucher header ──
    const activeComponents = components.filter((c) => (c.receivedQty || 0) > 0);
    const totalFinishedQty = activeComponents.reduce((s, c) => s + c.receivedQty, 0);

    const { error: vErr } = await supabase
      .from('finishing_receive_vouchers')
      .update({
        voucher_date: voucher.voucherDate,
        stitch_receive_ref: voucher.stitchReceiveRef,
        stitch_receive_voucher_id: voucher.stitchReceiveVoucherId,
        job_card_ref: voucher.jobCardRef,
        job_card_id: voucher.jobCardId || null,
        style_name: voucher.styleName || null,
        party_name: voucher.partyName || null,
        contractor_name: voucher.contractorName,
        process: voucher.process,
        total_components_received: activeComponents.length,
        total_finished_qty: totalFinishedQty,
        remarks: voucher.remarks || null,
        updated_by: username || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (vErr) { console.error('[updateFinishingReceiveVoucher]', vErr); return null; }

    // ── Step 3: Delete old components and re-insert ──
    await supabase.from('finishing_receive_components').delete().eq('receive_voucher_id', id);

    // ── Step 4: Insert new components and apply finishing_stock ──
    for (const comp of activeComponents) {
      await supabase.from('finishing_receive_components').insert({
        receive_voucher_id: id,
        stitch_receive_component_id: comp.stitchReceiveComponentId || null,
        component: comp.component,
        size: comp.size || null,
        colour: comp.colour || null,
        stitch_received_qty: comp.stitchReceivedQty,
        already_finished_qty: comp.alreadyFinishedQty,
        pending_qty: comp.pendingQty,
        received_qty: comp.receivedQty,
      });

      // Upsert finishing_stock with new quantities
      const { data: existing } = await supabase
        .from('finishing_stock')
        .select('id, finished_qty, stitch_received_qty')
        .eq('job_card_ref', voucher.jobCardRef)
        .eq('stitch_receive_ref', voucher.stitchReceiveRef)
        .eq('component', comp.component)
        .eq('size', comp.size || '')
        .eq('colour', comp.colour || '')
        .maybeSingle();

      if (existing) {
        const newFinished = (existing.finished_qty || 0) + comp.receivedQty;
        const newPending = (existing.stitch_received_qty || comp.stitchReceivedQty) - newFinished;
        await supabase
          .from('finishing_stock')
          .update({
            finished_qty: newFinished,
            pending_qty: Math.max(0, newPending),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('finishing_stock').insert({
          job_card_ref: voucher.jobCardRef,
          stitch_receive_ref: voucher.stitchReceiveRef,
          component: comp.component,
          size: comp.size || '',
          colour: comp.colour || '',
          stitch_received_qty: comp.stitchReceivedQty,
          finished_qty: comp.receivedQty,
          pending_qty: Math.max(0, comp.stitchReceivedQty - comp.receivedQty),
        });
      }
    }

    // Components remain in finishing_stock until a complete assembly is saved.

    const { data: full, error: fErr } = await supabase
      .from('finishing_receive_vouchers')
      .select('*, finishing_receive_components(*)')
      .eq('id', id)
      .single();
    if (fErr) return null;
    return rowToFinishingReceiveVoucher(full);
  },

  // Get already-finished qty per component+size for a stitch receive ref
  async getAlreadyFinishedQty(
    jobCardRef: string,
    stitchReceiveRef: string,
    excludeVoucherId?: string
  ): Promise<Record<string, number>> {
    const supabase = createClient();

    let query = supabase
      .from('finishing_receive_vouchers')
      .select('id, finishing_receive_components(component, size, colour, received_qty)')
      .eq('job_card_ref', jobCardRef)
      .eq('stitch_receive_ref', stitchReceiveRef);

    const { data, error } = await query;
    if (error) { console.error('[getAlreadyFinishedQty]', error); return {}; }

    const map: Record<string, number> = {};
    for (const v of data || []) {
      if (excludeVoucherId && v.id === excludeVoucherId) continue;
      for (const c of (v.finishing_receive_components || [])) {
        const key = `${(c.component || '').toLowerCase()}||${(c.size || '').toLowerCase()}||${(c.colour || '').toLowerCase()}`;
        map[key] = (map[key] || 0) + (c.received_qty || 0);
      }
    }
    return map;
  },

  // ── Contractor Balance Summary ─────────────────────────────────────────────

  async getContractorBalance(contractorName: string): Promise<{
    totalIssued: number;
    totalReceived: number;
    balance: number;
  }> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contractor_issue_items')
      .select('issued_qty, received_qty, contractor_issue_vouchers!inner(contractor_name)')
      .eq('contractor_issue_vouchers.contractor_name', contractorName);

    if (error) { console.error('[getContractorBalance]', error); return { totalIssued: 0, totalReceived: 0, balance: 0 }; }

    const totalIssued = (data || []).reduce((s: number, r: any) => s + (r.issued_qty || 0), 0);
    const totalReceived = (data || []).reduce((s: number, r: any) => s + (r.received_qty || 0), 0);
    return { totalIssued, totalReceived, balance: totalIssued - totalReceived };
  },

  // ── Finished Goods ─────────────────────────────────────────────────────────

  async getFinishedGoods(): Promise<FinishedGoodsEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finished_goods')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[getFinishedGoods]', error); return []; }
    return (data || []).map((row: any): FinishedGoodsEntry => ({
      id: row.id,
      jobCardRef: row.job_card_ref || '',
      styleName: row.style_name || undefined,
      partyName: row.party_name || undefined,
      item: row.item || '',
      colour: row.colour || '',
      size: row.size || '',
      totalPieces: row.total_pieces || 0,
      availableForDispatch: row.available_for_dispatch || 0,
      dispatchedPieces: row.dispatched_pieces || 0,
      source: row.source || 'contractor_finishing',
      sourceVoucherNo: row.source_voucher_no || undefined,
      sourceVoucherId: row.source_voucher_id || undefined,
      dateAdded: row.date_added || '',
      status: row.status || 'available',
      createdBy: row.created_by || null,
      createdAt: row.created_at || '',
    }));
  },

  // Get only finished goods created by Component Assembly
  async getFinishedGoodsByComponentAssembly(): Promise<FinishedGoodsEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('finished_goods')
      .select('*')
      .in('source', ['component_assembly', 'component_conversion'])
      .order('created_at', { ascending: false });
    if (error) { console.error('[getFinishedGoodsByComponentAssembly]', error); return []; }
    return (data || []).map((row: any): FinishedGoodsEntry => ({
      id: row.id,
      jobCardRef: row.job_card_ref || '',
      styleName: row.style_name || undefined,
      partyName: row.party_name || undefined,
      item: row.item || '',
      colour: row.colour || '',
      size: row.size || '',
      totalPieces: row.total_pieces || 0,
      availableForDispatch: row.available_for_dispatch || 0,
      dispatchedPieces: row.dispatched_pieces || 0,
      source: row.source || 'component_assembly',
      sourceVoucherNo: row.source_voucher_no || undefined,
      sourceVoucherId: row.source_voucher_id || undefined,
      dateAdded: row.date_added || '',
      status: row.status || 'available',
      createdBy: row.created_by || null,
      createdAt: row.created_at || '',
    }));
  },

  // Deduct dispatched qty from finished_goods entry
  async deductDispatchFromFinishedGoods(
    finishedGoodsId: string,
    dispatchedQty: number
  ): Promise<boolean> {
    const supabase = createClient();
    // Fetch current values
    const { data: row, error: fetchErr } = await supabase
      .from('finished_goods')
      .select('available_for_dispatch, dispatched_pieces, total_pieces')
      .eq('id', finishedGoodsId)
      .single();
    if (fetchErr || !row) { console.error('[deductDispatchFromFinishedGoods fetch]', fetchErr); return false; }

    const newDispatched = (row.dispatched_pieces || 0) + dispatchedQty;
    const newAvailable = Math.max(0, (row.available_for_dispatch || 0) - dispatchedQty);
    const newStatus = newAvailable === 0 ? 'dispatched' : newAvailable < (row.total_pieces || 0) ? 'partial' : 'available';

    const { error: updateErr } = await supabase
      .from('finished_goods')
      .update({
        dispatched_pieces: newDispatched,
        available_for_dispatch: newAvailable,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', finishedGoodsId);
    if (updateErr) { console.error('[deductDispatchFromFinishedGoods update]', updateErr); return false; }
    return true;
  },

  // ── Distinct contractors from issue vouchers ───────────────────────────────
  async getContractors(): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contractor_issue_vouchers')
      .select('contractor_name')
      .order('contractor_name');
    if (error) return [];
    const names = [...new Set((data || []).map((r: any) => r.contractor_name as string))];
    return names;
  },

  // ── Already-issued qty per item+colour+size for a job card ─────────────────
  async getIssuedQtyByJobCard(
    jobCardRef: string,
    excludeVoucherId?: string
  ): Promise<Record<string, number>> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('contractor_issue_vouchers')
      .select('id, contractor_issue_items(item, colour, size, issued_qty)')
      .eq('job_card_ref', jobCardRef);

    if (error) { console.error('[getIssuedQtyByJobCard]', error); return {}; }

    const map: Record<string, number> = {};
    for (const v of data || []) {
      if (excludeVoucherId && v.id === excludeVoucherId) continue;
      for (const it of (v.contractor_issue_items || [])) {
        const key = `${(it.item || '').toLowerCase()}|${(it.colour || '').toLowerCase()}|${(it.size || '').toLowerCase()}`;
        map[key] = (map[key] || 0) + (it.issued_qty || 0);
      }
    }
    return map;
  },

  // ── Stitching received qty per component+size for a job card ──────────────
  async getStitchingReceivedQtyByJobCard(
    jobCardRef: string
  ): Promise<Record<string, number>> {
    const supabase = createClient();

    const { data: receiveVouchers, error: rvErr } = await supabase
      .from('stitch_receive_vouchers')
      .select('id')
      .eq('job_card_ref', jobCardRef);

    if (rvErr || !receiveVouchers || receiveVouchers.length === 0) return {};

    const receiveVoucherIds = receiveVouchers.map((v: any) => v.id);

    const { data: comps, error: cErr } = await supabase
      .from('stitch_receive_components')
      .select('component, received_qty')
      .in('receive_voucher_id', receiveVoucherIds);

    if (cErr || !comps) return {};

    const map: Record<string, number> = {};
    for (const c of comps) {
      const key = (c.component || '').toLowerCase();
      map[key] = (map[key] || 0) + (c.received_qty || 0);
    }
    return map;
  },

  // ── Total issued qty per stitch receive voucher ID ─────────────────────────
  // Returns { [stitchReceiveVoucherId]: totalIssuedQty }
  async getIssuedTotalsByStitchRef(): Promise<Record<string, number>> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('contractor_issue_vouchers')
      .select('stitch_receive_voucher_id, total_issued')
      .not('stitch_receive_voucher_id', 'is', null);
    if (error) { console.error('[getIssuedTotalsByStitchRef]', error); return {}; }
    const map: Record<string, number> = {};
    for (const row of data || []) {
      const id = row.stitch_receive_voucher_id as string;
      map[id] = (map[id] || 0) + (row.total_issued || 0);
    }
    return map;
  },
};
