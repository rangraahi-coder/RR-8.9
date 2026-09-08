import { createClient } from '@/lib/supabase/client';
import { CuttingEntry, SubComponentCutDetail } from '@/app/cutting/data/cuttingData';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { embroideryVoucherService, CuttingStockItem } from '@/lib/services/embroideryVoucherService';

// Represents a single emb-received cutting stock item consumed in a cutting entry
export interface EmbReceiveItem {
  cuttingStockId: string;
  receiveVoucherNo: string;
  issueVoucherNo: string;
  component: string;
  piecesUsed: number;
  unit: string;
}

function rowToCuttingEntry(row: any, subComponents: any[]): CuttingEntry {
  return {
    id: row.id,
    entryNo: row.entry_no,
    date: row.date,
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || '',
    cuttingMaster: row.cutting_master || '',
    fabricName: row.fabric_name || '',
    fabricIssuedQty: parseFloat(row.fabric_issued_qty) || 0,
    fabricConsumedQty: parseFloat(row.fabric_consumed_qty) || 0,
    fabricLeftover: parseFloat(row.fabric_leftover) || 0,
    unit: row.unit || 'Metres',
    totalPiecesCut: row.total_pieces_cut || 0,
    wastageQty: parseFloat(row.wastage_qty) || 0,
    cuttingRejections: row.cutting_rejections || 0,
    rejectionReason: row.rejection_reason || undefined,
    netPiecesForStitching: row.net_pieces_for_stitching || 0,
    subComponentDetails: subComponents.map((sc: any): SubComponentCutDetail => ({
      component: sc.component,
      sizes: Array.isArray(sc.size_breakdown) ? sc.size_breakdown : [],
      totalPieces: sc.total_pieces || 0,
      rejections: sc.rejections || 0,
      netPieces: sc.net_pieces || 0,
    })),
    rollDetails: Array.isArray(row.roll_details) ? row.roll_details : [],
    status: row.status || 'completed',
    remarks: row.remarks || undefined,
    cuttingPrice: row.cutting_price != null ? parseFloat(row.cutting_price) : undefined,
    embReceiveItems: Array.isArray(row.emb_receive_items) ? row.emb_receive_items : [],
  };
}

/**
 * Resolve a cutting stock ID: if it's a synthesized "rv-..." ID, materialize it
 * into a real cutting_stock DB row and return the real UUID. Otherwise return as-is.
 */
async function resolveRealStockId(
  stockId: string,
  jobCardRef: string,
  username?: string | null
): Promise<string> {
  if (!stockId.startsWith('rv-')) return stockId;
  const realId = await embroideryVoucherService.getOrCreateRealCuttingStockId(stockId, jobCardRef, username);
  return realId || stockId;
}

export const cuttingService = {
  /**
   * Fetch available embroidery-received cutting stock for a given job card.
   * These are items that came back from Embroidery Receive and are pending for cutting.
   * Uses multi-path lookup: direct job_card_ref match + issue voucher → receive voucher chain.
   */
  async getEmbReceivePendingByJobCard(jobCardRef: string): Promise<CuttingStockItem[]> {
    if (!jobCardRef) return [];
    const allItems = await embroideryVoucherService.getAllCuttingStockByJobCard(jobCardRef);
    // Filter to only available/partially_issued items with pieces remaining
    return allItems.filter(
      (item) =>
        item.availablePieces > 0 &&
        (item.status === 'available' || item.status === 'partially_issued')
    );
  },

  /**
   * Fetch ALL embroidery-received cutting stock for a given job card (regardless of status).
   */
  async getEmbReceiveAllByJobCard(jobCardRef: string): Promise<CuttingStockItem[]> {
    if (!jobCardRef) return [];
    return embroideryVoucherService.getAllCuttingStockByJobCard(jobCardRef);
  },

  /**
   * Get a summary of embroidery flow for a job card:
   * Issued → Received → Issued to Cutting → Balance Pending
   * Grouped by component (and optionally colour/size from the cutting items).
   */
  async getEmbCuttingSummaryByJobCard(jobCardRef: string): Promise<{
    component: string;
    embIssued: number;
    embReceived: number;
    issuedToCutting: number;
    pendingForCutting: number;
    unit: string;
  }[]> {
    if (!jobCardRef) return [];
    const supabase = createClient();

    // 1. Get all issue vouchers for this job card
    const { data: issueVouchers } = await supabase
      .from('emb_issue_vouchers')
      .select('id, cutting_items')
      .eq('job_card_ref', jobCardRef);

    // 2. Get all receive vouchers for those issue vouchers
    const issueIds = (issueVouchers || []).map((iv: any) => iv.id);
    let receiveVouchers: any[] = [];
    if (issueIds.length > 0) {
      const { data: rvs } = await supabase
        .from('emb_receive_vouchers')
        .select('cutting_items')
        .in('issue_voucher_id', issueIds);
      receiveVouchers = rvs || [];
    }
    // Also get receive vouchers directly linked to job card
    const { data: directRvs } = await supabase
      .from('emb_receive_vouchers')
      .select('cutting_items')
      .eq('job_card_ref', jobCardRef);
    for (const rv of directRvs || []) {
      receiveVouchers.push(rv);
    }

    // 3. Get cutting_entries.emb_receive_items for this job card
    const { data: cuttingEntries } = await supabase
      .from('cutting_entries')
      .select('emb_receive_items')
      .eq('job_card_ref', jobCardRef);

    // Build maps by component
    const issuedMap: Record<string, { qty: number; unit: string }> = {};
    const receivedMap: Record<string, { qty: number; unit: string }> = {};
    const issuedToCuttingMap: Record<string, { qty: number; unit: string }> = {};

    for (const iv of issueVouchers || []) {
      for (const ci of (Array.isArray(iv.cutting_items) ? iv.cutting_items : [])) {
        const comp = ci.component || 'Item';
        const prev = issuedMap[comp] || { qty: 0, unit: ci.unit || 'Pcs' };
        issuedMap[comp] = { qty: prev.qty + (ci.pieces || 0), unit: ci.unit || 'Pcs' };
      }
    }

    for (const rv of receiveVouchers) {
      for (const ci of (Array.isArray(rv.cutting_items) ? rv.cutting_items : [])) {
        const comp = ci.component || 'Item';
        const prev = receivedMap[comp] || { qty: 0, unit: ci.receiveUnit || ci.unit || 'Pcs' };
        receivedMap[comp] = { qty: prev.qty + (ci.receivedPieces || 0), unit: ci.receiveUnit || ci.unit || 'Pcs' };
      }
    }

    for (const ce of cuttingEntries || []) {
      for (const item of (Array.isArray(ce.emb_receive_items) ? ce.emb_receive_items : [])) {
        const comp = item.component || 'Item';
        const prev = issuedToCuttingMap[comp] || { qty: 0, unit: item.unit || 'Pcs' };
        issuedToCuttingMap[comp] = { qty: prev.qty + (item.piecesUsed || 0), unit: item.unit || 'Pcs' };
      }
    }

    // Also check cutting_stock for real DB rows (issued_pieces)
    const { data: stockRows } = await supabase
      .from('cutting_stock')
      .select('component, issued_pieces, unit')
      .eq('job_card_ref', jobCardRef)
      .gt('issued_pieces', 0);

    for (const sr of stockRows || []) {
      const comp = sr.component || 'Item';
      // Only add if not already counted via cutting_entries
      if (!issuedToCuttingMap[comp]) {
        issuedToCuttingMap[comp] = { qty: sr.issued_pieces || 0, unit: sr.unit || 'Pcs' };
      }
    }

    // Build summary from all components seen
    const allComponents = new Set([
      ...Object.keys(issuedMap),
      ...Object.keys(receivedMap),
      ...Object.keys(issuedToCuttingMap),
    ]);

    return Array.from(allComponents).map((comp) => {
      const issued = issuedMap[comp]?.qty || 0;
      const received = receivedMap[comp]?.qty || 0;
      const issuedToCutting = issuedToCuttingMap[comp]?.qty || 0;
      const unit = receivedMap[comp]?.unit || issuedMap[comp]?.unit || issuedToCuttingMap[comp]?.unit || 'Pcs';
      return {
        component: comp,
        embIssued: issued,
        embReceived: received,
        issuedToCutting,
        pendingForCutting: Math.max(0, received - issuedToCutting),
        unit,
      };
    }).filter((s) => s.embReceived > 0 || s.issuedToCutting > 0);
  },

  async getAll(): Promise<CuttingEntry[]> {
    const supabase = createClient();
    const { data: entries, error } = await supabase
      .from('cutting_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[cuttingService.getAll] error:', error);
      return [];
    }

    if (!entries || entries.length === 0) return [];

    const entryIds = entries.map((e: any) => e.id);
    const { data: subComps, error: scError } = await supabase
      .from('cutting_sub_components')
      .select('*')
      .in('cutting_entry_id', entryIds);

    if (scError) {
      console.error('[cuttingService.getAll] sub_components error:', scError);
    }

    const subCompsByEntry: Record<string, any[]> = {};
    (subComps || []).forEach((sc: any) => {
      if (!subCompsByEntry[sc.cutting_entry_id]) subCompsByEntry[sc.cutting_entry_id] = [];
      subCompsByEntry[sc.cutting_entry_id].push(sc);
    });

    return entries.map((row: any) => rowToCuttingEntry(row, subCompsByEntry[row.id] || []));
  },

  async create(
    entry: Omit<CuttingEntry, 'id'>,
    username?: string | null
  ): Promise<CuttingEntry | null> {
    const supabase = createClient();

    // Resolve synthesized stock IDs to real DB IDs before saving
    const resolvedEmbItems = entry.embReceiveItems ? await Promise.all(
      entry.embReceiveItems.map(async (item) => ({
        ...item,
        cuttingStockId: await resolveRealStockId(item.cuttingStockId, entry.jobCardRef || '', username),
      }))
    ) : [];

    const row: Record<string, any> = {
      entry_no: entry.entryNo,
      date: entry.date,
      job_card_ref: entry.jobCardRef || null,
      style_name: entry.styleName,
      cutting_master: entry.cuttingMaster,
      fabric_name: entry.fabricName,
      fabric_issued_qty: entry.fabricIssuedQty,
      fabric_consumed_qty: entry.fabricConsumedQty,
      fabric_leftover: entry.fabricLeftover,
      unit: entry.unit,
      total_pieces_cut: entry.totalPiecesCut,
      wastage_qty: entry.wastageQty,
      cutting_rejections: entry.cuttingRejections,
      rejection_reason: entry.rejectionReason || null,
      net_pieces_for_stitching: entry.netPiecesForStitching,
      status: entry.status,
      remarks: entry.remarks || null,
      cutting_price: entry.cuttingPrice ?? null,
      roll_details: entry.rollDetails ?? [],
      emb_receive_items: resolvedEmbItems,
      created_by: username || null,
    };

    const { data: savedEntry, error } = await supabase
      .from('cutting_entries')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[cuttingService.create] error:', error);
      return null;
    }

    // Insert sub-components
    if (entry.subComponentDetails.length > 0) {
      const scRows = entry.subComponentDetails.map((sc) => ({
        cutting_entry_id: savedEntry.id,
        component: sc.component,
        total_pieces: sc.totalPieces,
        rejections: sc.rejections,
        net_pieces: sc.netPieces,
        size_breakdown: sc.sizes,
      }));

      const { error: scError } = await supabase
        .from('cutting_sub_components')
        .insert(scRows);

      if (scError) {
        console.error('[cuttingService.create] sub_components error:', scError);
      }
    }

    // Deduct consumed qty from fabric inventory for each roll
    if (entry.rollDetails && entry.rollDetails.length > 0) {
      await fabricInventoryService.deductFabricStock(
        entry.rollDetails.map((r) => ({
          fabricRollId: r.fabricRollId,
          consumedQty: r.fabricConsumedQty,
        }))
      );
    }

    // Deduct pieces from cutting_stock for each emb-received item used
    if (resolvedEmbItems.length > 0) {
      for (const item of resolvedEmbItems) {
        if (item.piecesUsed > 0) {
          await embroideryVoucherService.deductCuttingStock(item.cuttingStockId, item.piecesUsed, username);
          // Log movement for traceability
          await embroideryVoucherService.logMovement({
            cuttingStockId: item.cuttingStockId,
            movementType: 'issued_to_cutting_master',
            voucherType: 'cutting_entry',
            voucherId: savedEntry.id,
            voucherNo: savedEntry.entry_no,
            fromEntity: 'Embroidery Receive Stock',
            toEntity: entry.cuttingMaster || 'Cutting',
            toEntityType: 'cutting_master',
            pieces: item.piecesUsed,
            jobCardRef: entry.jobCardRef,
            styleName: entry.styleName,
            component: item.component,
            processType: 'cutting',
            remarks: `Issued for cutting via ${savedEntry.entry_no}`,
            movementDate: entry.date,
            createdBy: username || undefined,
          });
        }
      }
    }

    return rowToCuttingEntry(savedEntry, entry.subComponentDetails.map((sc) => ({
      component: sc.component,
      total_pieces: sc.totalPieces,
      rejections: sc.rejections,
      net_pieces: sc.netPieces,
      size_breakdown: sc.sizes,
    })));
  },

  async update(
    id: string,
    entry: Omit<CuttingEntry, 'id'>,
    username?: string | null
  ): Promise<CuttingEntry | null> {
    const supabase = createClient();

    // Fetch the existing entry's rollDetails and embReceiveItems so we can reverse old deductions
    const { data: existingRow } = await supabase
      .from('cutting_entries')
      .select('roll_details, emb_receive_items')
      .eq('id', id)
      .single();

    // Resolve synthesized stock IDs to real DB IDs before saving
    const resolvedEmbItems = entry.embReceiveItems ? await Promise.all(
      entry.embReceiveItems.map(async (item) => ({
        ...item,
        cuttingStockId: await resolveRealStockId(item.cuttingStockId, entry.jobCardRef || '', username),
      }))
    ) : [];

    const row: Record<string, any> = {
      entry_no: entry.entryNo,
      date: entry.date,
      job_card_ref: entry.jobCardRef || null,
      style_name: entry.styleName,
      cutting_master: entry.cuttingMaster,
      fabric_name: entry.fabricName,
      fabric_issued_qty: entry.fabricIssuedQty,
      fabric_consumed_qty: entry.fabricConsumedQty,
      fabric_leftover: entry.fabricLeftover,
      unit: entry.unit,
      total_pieces_cut: entry.totalPiecesCut,
      wastage_qty: entry.wastageQty,
      cutting_rejections: entry.cuttingRejections,
      rejection_reason: entry.rejectionReason || null,
      net_pieces_for_stitching: entry.netPiecesForStitching,
      status: entry.status,
      remarks: entry.remarks || null,
      cutting_price: entry.cuttingPrice ?? null,
      roll_details: entry.rollDetails ?? [],
      emb_receive_items: resolvedEmbItems,
      updated_by: username || null,
    };

    const { data: savedEntry, error } = await supabase
      .from('cutting_entries')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[cuttingService.update] error:', error);
      return null;
    }

    // Delete existing sub-components and re-insert
    await supabase.from('cutting_sub_components').delete().eq('cutting_entry_id', id);

    if (entry.subComponentDetails.length > 0) {
      const scRows = entry.subComponentDetails.map((sc) => ({
        cutting_entry_id: id,
        component: sc.component,
        total_pieces: sc.totalPieces,
        rejections: sc.rejections,
        net_pieces: sc.netPieces,
        size_breakdown: sc.sizes,
      }));

      const { error: scError } = await supabase
        .from('cutting_sub_components')
        .insert(scRows);

      if (scError) {
        console.error('[cuttingService.update] sub_components error:', scError);
      }
    }

    // Restore old consumed qty back to fabric inventory, then deduct new consumed qty
    const oldRollDetails: Array<{ fabricRollId: string; fabricConsumedQty: number }> =
      Array.isArray(existingRow?.roll_details) ? existingRow.roll_details : [];

    if (oldRollDetails.length > 0) {
      await fabricInventoryService.restoreFabricStock(
        oldRollDetails.map((r) => ({
          fabricRollId: r.fabricRollId,
          consumedQty: r.fabricConsumedQty,
        }))
      );
    }

    if (entry.rollDetails && entry.rollDetails.length > 0) {
      await fabricInventoryService.deductFabricStock(
        entry.rollDetails.map((r) => ({
          fabricRollId: r.fabricRollId,
          consumedQty: r.fabricConsumedQty,
        }))
      );
    }

    // Restore old emb-received cutting stock, then deduct new
    const oldEmbReceiveItems: EmbReceiveItem[] =
      Array.isArray(existingRow?.emb_receive_items) ? existingRow.emb_receive_items : [];

    for (const item of oldEmbReceiveItems) {
      if (item.piecesUsed > 0) {
        await embroideryVoucherService.restoreCuttingStock(item.cuttingStockId, item.piecesUsed, username);
      }
    }

    if (resolvedEmbItems.length > 0) {
      for (const item of resolvedEmbItems) {
        if (item.piecesUsed > 0) {
          await embroideryVoucherService.deductCuttingStock(item.cuttingStockId, item.piecesUsed, username);
          await embroideryVoucherService.logMovement({
            cuttingStockId: item.cuttingStockId,
            movementType: 'issued_to_cutting_master',
            voucherType: 'cutting_entry',
            voucherId: id,
            voucherNo: entry.entryNo,
            fromEntity: 'Embroidery Receive Stock',
            toEntity: entry.cuttingMaster || 'Cutting',
            toEntityType: 'cutting_master',
            pieces: item.piecesUsed,
            jobCardRef: entry.jobCardRef,
            styleName: entry.styleName,
            component: item.component,
            processType: 'cutting',
            remarks: `Updated cutting entry ${entry.entryNo}`,
            movementDate: entry.date,
            createdBy: username || undefined,
          });
        }
      }
    }

    return rowToCuttingEntry(savedEntry, entry.subComponentDetails.map((sc) => ({
      component: sc.component,
      total_pieces: sc.totalPieces,
      rejections: sc.rejections,
      net_pieces: sc.netPieces,
      size_breakdown: sc.sizes,
    })));
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();

    // Fetch roll details AND emb_receive_items before deleting so we can restore stock
    const { data: existingRow } = await supabase
      .from('cutting_entries')
      .select('roll_details, emb_receive_items')
      .eq('id', id)
      .single();

    // Delete sub-components first (foreign key)
    await supabase.from('cutting_sub_components').delete().eq('cutting_entry_id', id);

    const { error } = await supabase
      .from('cutting_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[cuttingService.delete] error:', error);
      return false;
    }

    // Restore consumed qty back to fabric inventory
    const oldRollDetails: Array<{ fabricRollId: string; fabricConsumedQty: number }> =
      Array.isArray(existingRow?.roll_details) ? existingRow.roll_details : [];

    if (oldRollDetails.length > 0) {
      await fabricInventoryService.restoreFabricStock(
        oldRollDetails.map((r) => ({
          fabricRollId: r.fabricRollId,
          consumedQty: r.fabricConsumedQty,
        }))
      );
    }

    // Restore cutting_stock pieces for each emb-received item that was used
    const oldEmbReceiveItems: EmbReceiveItem[] =
      Array.isArray(existingRow?.emb_receive_items) ? existingRow.emb_receive_items : [];

    for (const item of oldEmbReceiveItems) {
      if (item.piecesUsed > 0) {
        await embroideryVoucherService.restoreCuttingStock(item.cuttingStockId, item.piecesUsed);
      }
    }

    return true;
  },

  /**
   * Fetch actual cutting quantities grouped by component + size for a given job card.
   * This is the source of truth for True Quantity in stitching issue.
   * True Quantity = Component-wise + Size-wise Cutting Quantity (net_pieces after rejections).
   */
  async getCuttingQtyByComponentSize(jobCardRef: string): Promise<{
    component: string;
    size: string; // empty string means "all sizes" / no size breakdown
    netPieces: number;
  }[]> {
    if (!jobCardRef) return [];
    const supabase = createClient();

    // Fetch all cutting entries for this job card
    const { data: entries, error: entryError } = await supabase
      .from('cutting_entries')
      .select('id')
      .eq('job_card_ref', jobCardRef);

    if (entryError || !entries || entries.length === 0) return [];

    const entryIds = entries.map((e: any) => e.id);

    // Fetch all sub-components for those entries
    const { data: subComps, error: scError } = await supabase
      .from('cutting_sub_components')
      .select('component, size_breakdown, net_pieces')
      .in('cutting_entry_id', entryIds);

    if (scError || !subComps || subComps.length === 0) return [];

    // Aggregate net_pieces by component + size
    const map: Record<string, number> = {};

    for (const sc of subComps) {
      const component = sc.component || '';
      const sizeBreakdown: { size: string; qty: number }[] = Array.isArray(sc.size_breakdown)
        ? sc.size_breakdown
        : [];

      if (sizeBreakdown.length > 0) {
        // Has size breakdown — aggregate per size
        for (const sb of sizeBreakdown) {
          const key = `${component}||${sb.size || ''}`;
          map[key] = (map[key] || 0) + (sb.qty || 0);
        }
      } else {
        // No size breakdown — aggregate under empty size key
        const key = `${component}||`;
        map[key] = (map[key] || 0) + (sc.net_pieces || 0);
      }
    }

    return Object.entries(map).map(([key, netPieces]) => {
      const [component, size] = key.split('||');
      return { component, size, netPieces };
    });
  },
};
