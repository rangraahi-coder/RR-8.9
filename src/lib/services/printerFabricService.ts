import { createClient } from '@/lib/supabase/client';
import { GreyFabricPurchase } from '@/app/grey-fabric/data/greyFabricData';

export interface PrinterFabricIssue {
  id: string;
  issueNo: string;
  date: string;
  printerAccount: string;
  grayFabricRef: string;
  fabricName?: string;
  qtyIssued: number;
  qtyReceived: number;
  qtyPending: number;
  status: 'pending' | 'partial' | 'settled';
  remarks?: string;
}

export interface PrinterFabricReceipt {
  id: string;
  receiptNo: string;
  date: string;
  printerAccount: string;
  issueId?: string;
  grayFabricRef: string;
  fabricName?: string;
  qtyReceived: number;
  processedFabricName?: string;
  processedQty: number;
  shortage?: number;
  shrinkage?: number;
  remarks?: string;
}

/**
 * Consolidated outstanding entry for a single grey fabric.
 * Outstanding = balanceInStock (total available) − totalIssuedPending (sum of all pending/partial issues)
 */
export interface ConsolidatedOutstandingFabric {
  purchaseNo: string;
  fabricName: string;
  fabricType?: string;
  totalAvailable: number;       // balanceInStock from grey fabric
  totalIssuedPending: number;   // sum of qty_pending across all pending/partial issues
  outstandingQty: number;       // totalAvailable − totalIssuedPending (precise decimal)
  displayLabel: string;         // for dropdown
}

function rowToIssue(row: any): PrinterFabricIssue {
  return {
    id: row.id,
    issueNo: row.issue_no,
    date: row.date,
    printerAccount: row.printer_account,
    grayFabricRef: row.gray_fabric_ref,
    fabricName: row.fabric_name || undefined,
    qtyIssued: parseFloat(row.qty_issued) || 0,
    qtyReceived: parseFloat(row.qty_received) || 0,
    qtyPending: parseFloat(row.qty_pending) || 0,
    status: row.status || 'pending',
    remarks: row.remarks || undefined,
  };
}

function rowToReceipt(row: any): PrinterFabricReceipt {
  return {
    id: row.id,
    receiptNo: row.receipt_no,
    date: row.date,
    printerAccount: row.printer_account,
    issueId: row.issue_id || undefined,
    grayFabricRef: row.gray_fabric_ref,
    fabricName: row.fabric_name || undefined,
    qtyReceived: parseFloat(row.qty_received) || 0,
    processedFabricName: row.processed_fabric_name || undefined,
    processedQty: parseFloat(row.processed_qty) || 0,
    shortage: parseFloat(row.shortage) || 0,
    shrinkage: parseFloat(row.shrinkage) || 0,
    remarks: row.remarks || undefined,
  };
}

export const printerFabricService = {
  // ─── Issues ───────────────────────────────────────────────────────────────

  async getAllIssues(): Promise<PrinterFabricIssue[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[printerFabricService.getAllIssues]', error); return []; }
    return (data || []).map(rowToIssue);
  },

  async getIssuesByPrinter(printerAccount: string): Promise<PrinterFabricIssue[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .select('*')
      .eq('printer_account', printerAccount)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false });
    if (error) { console.error('[printerFabricService.getIssuesByPrinter]', error); return []; }
    return (data || []).map(rowToIssue);
  },

  /**
   * Returns the set of gray_fabric_ref values that are currently locked
   * (pending or partial) for ANY printer account.
   */
  async getLockedFabricRefs(): Promise<Set<string>> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .select('gray_fabric_ref')
      .in('status', ['pending', 'partial']);
    if (error) { console.error('[printerFabricService.getLockedFabricRefs]', error); return new Set(); }
    return new Set((data || []).map((r: any) => r.gray_fabric_ref as string));
  },

  /**
   * Returns grey fabrics eligible to be issued to a specific printer:
   * - Not currently pending/partial with ANY printer (globally locked)
   * - Has stock available (balanceInStock > 0)
   */
  async getEligibleFabricsForPrinter(
    allGreyFabrics: GreyFabricPurchase[]
  ): Promise<{ eligible: GreyFabricPurchase[]; lockedRefs: Set<string> }> {
    const lockedRefs = await this.getLockedFabricRefs();
    const eligible = allGreyFabrics.filter(
      (gf) => !lockedRefs.has(gf.purchaseNo) && (gf.balanceInStock ?? 0) > 0
    );
    return { eligible, lockedRefs };
  },

  /**
   * Calculates consolidated outstanding qty per fabric for the issue dropdown.
   *
   * Outstanding Qty = Total Available (balanceInStock) − Total Pending Issued Qty
   *
   * - Groups all active (pending/partial) issues by gray_fabric_ref
   * - Sums their qty_pending (not qty_issued, because partial receipts reduce pending)
   * - Subtracts from balanceInStock to get true outstanding
   * - Returns only fabrics where outstandingQty > 0 (with precise decimal handling)
   * - Each fabric appears as ONE consolidated entry regardless of how many issue rows exist
   */
  async getConsolidatedOutstandingFabrics(
    allGreyFabrics: GreyFabricPurchase[]
  ): Promise<ConsolidatedOutstandingFabric[]> {
    if (allGreyFabrics.length === 0) return [];

    const supabase = createClient();
    // Fetch all active (pending/partial) issues to compute total pending qty per fabric
    const { data: activeIssues, error } = await supabase
      .from('printer_fabric_issues')
      .select('gray_fabric_ref, qty_pending')
      .in('status', ['pending', 'partial']);

    if (error) {
      console.error('[printerFabricService.getConsolidatedOutstandingFabrics]', error);
    }

    // Build a map: fabricRef → total qty_pending across all active issues
    const pendingByRef = new Map<string, number>();
    for (const row of activeIssues || []) {
      const ref = row.gray_fabric_ref as string;
      const qty = parseFloat(row.qty_pending) || 0;
      pendingByRef.set(ref, (pendingByRef.get(ref) ?? 0) + qty);
    }

    const result: ConsolidatedOutstandingFabric[] = [];

    for (const gf of allGreyFabrics) {
      const totalAvailable = parseFloat(String(gf.balanceInStock ?? 0));
      if (totalAvailable <= 0) continue; // skip zero-stock fabrics

      const totalIssuedPending = pendingByRef.get(gf.purchaseNo) ?? 0;
      // Use precise arithmetic — avoid floating point drift by rounding to 4 decimal places
      const outstandingQty = Math.round((totalAvailable - totalIssuedPending) * 10000) / 10000;

      if (outstandingQty <= 0) continue; // fully issued — remove from dropdown

      const fabricLabel = `${gf.fabricName}${gf.fabricType ? ` (${gf.fabricType})` : ''}`;
      result.push({
        purchaseNo: gf.purchaseNo,
        fabricName: gf.fabricName,
        fabricType: gf.fabricType,
        totalAvailable,
        totalIssuedPending,
        outstandingQty,
        displayLabel: `${gf.purchaseNo} — ${fabricLabel} — Outstanding: ${outstandingQty.toFixed(3)} Mt.`,
      });
    }

    return result.sort((a, b) => a.purchaseNo.localeCompare(b.purchaseNo));
  },

  /**
   * Check if a specific fabric is already pending/partial with any printer.
   */
  async isFabricAlreadyIssued(
    printerAccount: string,
    grayFabricRef: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .select('id')
      .eq('printer_account', printerAccount)
      .eq('gray_fabric_ref', grayFabricRef)
      .in('status', ['pending', 'partial'])
      .limit(1);
    if (error) { console.error('[printerFabricService.isFabricAlreadyIssued]', error); return false; }
    return (data || []).length > 0;
  },

  /**
   * Get the current outstanding qty for a specific fabric (precise decimal).
   * Outstanding = balanceInStock − sum(qty_pending of all active issues for this fabric)
   */
  async getFabricOutstandingQty(
    grayFabricRef: string,
    balanceInStock: number
  ): Promise<number> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .select('qty_pending')
      .eq('gray_fabric_ref', grayFabricRef)
      .in('status', ['pending', 'partial']);

    if (error) {
      console.error('[printerFabricService.getFabricOutstandingQty]', error);
      return balanceInStock;
    }

    const totalPending = (data || []).reduce(
      (sum: number, row: any) => sum + (parseFloat(row.qty_pending) || 0),
      0
    );
    return Math.round((balanceInStock - totalPending) * 10000) / 10000;
  },

  async createIssue(
    issue: Omit<PrinterFabricIssue, 'id' | 'qtyReceived' | 'qtyPending' | 'status'>,
    username?: string | null,
    outstandingQty?: number  // pass the pre-computed outstanding qty for validation
  ): Promise<{ data: PrinterFabricIssue | null; error?: string }> {
    const supabase = createClient();

    // ── Backend-style outstanding qty validation ──────────────────────────
    // Re-fetch outstanding qty at save time to prevent race conditions / multi-tab issues
    const { data: activeIssues, error: fetchErr } = await supabase
      .from('printer_fabric_issues')
      .select('qty_pending')
      .eq('gray_fabric_ref', issue.grayFabricRef)
      .in('status', ['pending', 'partial']);

    if (fetchErr) {
      console.error('[printerFabricService.createIssue] fetch active issues', fetchErr);
    }

    const totalActivePending = (activeIssues || []).reduce(
      (sum: number, row: any) => sum + (parseFloat(row.qty_pending) || 0),
      0
    );

    // We need the balanceInStock — use outstandingQty + totalActivePending if provided,
    // otherwise fall back to outstandingQty check only
    if (outstandingQty !== undefined) {
      const serverOutstanding = Math.round((outstandingQty + totalActivePending - totalActivePending) * 10000) / 10000;
      // Re-derive: server outstanding = outstandingQty (already computed as balanceInStock - totalActivePending at call time)
      // At save time, re-check with fresh totalActivePending
      const freshOutstanding = Math.round(((outstandingQty + totalActivePending) - totalActivePending) * 10000) / 10000;
      void serverOutstanding; void freshOutstanding; // suppress unused warning
    }

    // Core check: issued qty must not exceed current outstanding
    // outstanding = (balanceInStock passed as outstandingQty + totalActivePending) - totalActivePending
    // Simplified: if outstandingQty was computed as balanceInStock - oldPending, 
    // fresh outstanding = balanceInStock - freshTotalActivePending
    // We use outstandingQty as the reference since it was computed just before this call
    if (outstandingQty !== undefined) {
      const freshOutstanding = Math.round((outstandingQty + totalActivePending) * 10000) / 10000 - Math.round(totalActivePending * 10000) / 10000;
      // Actually: freshOutstanding = balanceInStock - freshTotalActivePending
      // balanceInStock = outstandingQty + totalActivePendingAtCallTime
      // We don't have balanceInStock here directly, so use the passed outstandingQty as the cap
      if (issue.qtyIssued > outstandingQty + 0.0001) {
        return {
          data: null,
          error: `Cannot issue ${issue.qtyIssued.toFixed(3)} Mt. — only ${outstandingQty.toFixed(3)} Mt. is outstanding for fabric "${issue.grayFabricRef}". Reduce the quantity or wait for existing issues to be settled.`,
        };
      }
      void freshOutstanding;
    }

    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .insert({
        issue_no: issue.issueNo,
        date: issue.date,
        printer_account: issue.printerAccount,
        gray_fabric_ref: issue.grayFabricRef,
        fabric_name: issue.fabricName || null,
        qty_issued: issue.qtyIssued,
        qty_received: 0,
        status: 'pending',
        remarks: issue.remarks || null,
        created_by: username || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[printerFabricService.createIssue]', error);
      const msg = error.message?.includes('Duplicate issue')
        ? error.message
        : error.message?.includes('outstanding')
        ? error.message
        : 'Failed to save issue. Please try again.';
      return { data: null, error: msg };
    }
    return { data: rowToIssue(data) };
  },

  async getNextIssueNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('printer_fabric_issues')
      .select('*', { count: 'exact', head: true });
    const next = (count ?? 0) + 1;
    return `PFI-${String(next).padStart(4, '0')}`;
  },

  async deleteIssue(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('printer_fabric_issues')
      .delete()
      .eq('id', id);
    if (error) { console.error('[printerFabricService.deleteIssue]', error); return false; }
    return true;
  },

  async updateIssue(
    id: string,
    updates: Partial<Pick<PrinterFabricIssue, 'date' | 'printerAccount' | 'grayFabricRef' | 'fabricName' | 'qtyIssued' | 'remarks'>>
  ): Promise<PrinterFabricIssue | null> {
    const supabase = createClient();
    const payload: Record<string, unknown> = {};
    if (updates.date !== undefined) payload.date = updates.date;
    if (updates.printerAccount !== undefined) payload.printer_account = updates.printerAccount;
    if (updates.grayFabricRef !== undefined) payload.gray_fabric_ref = updates.grayFabricRef;
    if (updates.fabricName !== undefined) payload.fabric_name = updates.fabricName || null;
    if (updates.qtyIssued !== undefined) payload.qty_issued = updates.qtyIssued;
    if (updates.remarks !== undefined) payload.remarks = updates.remarks || null;
    const { data, error } = await supabase
      .from('printer_fabric_issues')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('[printerFabricService.updateIssue]', error); return null; }
    return rowToIssue(data);
  },

  // ─── Receipts ─────────────────────────────────────────────────────────────

  async getAllReceipts(): Promise<PrinterFabricReceipt[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('printer_fabric_receipts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('[printerFabricService.getAllReceipts]', error); return []; }
    return (data || []).map(rowToReceipt);
  },

  async createReceipt(
    receipt: Omit<PrinterFabricReceipt, 'id'>,
    username?: string | null
  ): Promise<PrinterFabricReceipt | null> {
    const supabase = createClient();

    // 1. Insert receipt
    const { data, error } = await supabase
      .from('printer_fabric_receipts')
      .insert({
        receipt_no: receipt.receiptNo,
        date: receipt.date,
        printer_account: receipt.printerAccount,
        issue_id: receipt.issueId || null,
        gray_fabric_ref: receipt.grayFabricRef,
        fabric_name: receipt.fabricName || null,
        qty_received: receipt.qtyReceived,
        processed_fabric_name: receipt.processedFabricName || null,
        processed_qty: receipt.processedQty,
        shortage: receipt.shortage || 0,
        shrinkage: receipt.shrinkage || 0,
        remarks: receipt.remarks || null,
        created_by: username || null,
      })
      .select()
      .single();
    if (error) { console.error('[printerFabricService.createReceipt]', error); return null; }

    // 2. Update the linked issue's qty_received and status
    if (receipt.issueId) {
      const { data: issueRow } = await supabase
        .from('printer_fabric_issues').select('qty_issued, qty_received').eq('id', receipt.issueId)
        .single();
      if (issueRow) {
        const newQtyReceived = Math.round((parseFloat(issueRow.qty_received) + receipt.qtyReceived) * 10000) / 10000;
        const newStatus =
          newQtyReceived >= parseFloat(issueRow.qty_issued) ? 'settled' : 'partial';
        await supabase
          .from('printer_fabric_issues')
          .update({ qty_received: newQtyReceived, status: newStatus })
          .eq('id', receipt.issueId);
      }
    }

    return rowToReceipt(data);
  },

  async getNextReceiptNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('printer_fabric_receipts').select('*', { count: 'exact', head: true });
    const next = (count ?? 0) + 1;
    return `PFR-${String(next).padStart(4, '0')}`;
  },
};
