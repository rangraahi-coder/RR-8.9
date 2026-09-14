import { createClient } from '@/lib/supabase/client';
import { EmbroideryAccessoryEntry, ProcessType, EmbroideryType, FabricIssueRow } from '@/app/embroidery-accessory/data/embroideryData';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';

function rowToEntry(row: any): EmbroideryAccessoryEntry {
  return {
    id: row.id,
    entryNo: row.entry_no,
    date: row.date,
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || '',
    processType: (row.process_type as ProcessType) || 'embroidery',
    embroideryType: (row.embroidery_type as EmbroideryType) || undefined,
    operatorName: row.operator_name || '',
    piecesReceived: row.pieces_received || 0,
    piecesProcessed: row.pieces_processed || 0,
    piecesRejected: row.pieces_rejected || 0,
    netPieces: row.net_pieces || 0,
    finishedPieces: row.finished_pieces || 0,
    rejectionReason: row.rejection_reason || undefined,
    accessoriesUsed: Array.isArray(row.accessories_used) ? row.accessories_used : [],
    processDetails: Array.isArray(row.process_details) ? row.process_details : [],
    fabricIssues: Array.isArray(row.fabric_issues) ? row.fabric_issues : [],
    status: row.status || 'completed',
    remarks: row.remarks || undefined,
    pricePerPiece: row.price_per_piece != null ? parseFloat(row.price_per_piece) : undefined,
    totalAmount: row.total_amount != null ? parseFloat(row.total_amount) : undefined,
  };
}

export const embroideryService = {
  async getAll(): Promise<EmbroideryAccessoryEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('embroidery_accessory_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[embroideryService.getAll] error:', error);
      return [];
    }
    return (data || []).map(rowToEntry);
  },

  async create(
    entry: Omit<EmbroideryAccessoryEntry, 'id'>,
    username?: string | null
  ): Promise<EmbroideryAccessoryEntry | null> {
    const supabase = createClient();

    const row = {
      entry_no: entry.entryNo,
      date: entry.date,
      job_card_ref: entry.jobCardRef || null,
      style_name: entry.styleName || null,
      process_type: entry.processType,
      embroidery_type: entry.embroideryType || null,
      operator_name: entry.operatorName || null,
      pieces_received: entry.piecesReceived,
      pieces_processed: entry.piecesProcessed,
      pieces_rejected: entry.piecesRejected,
      net_pieces: entry.netPieces,
      finished_pieces: entry.finishedPieces || 0,
      rejection_reason: entry.rejectionReason || null,
      accessories_used: entry.accessoriesUsed,
      process_details: entry.processDetails,
      fabric_issues: entry.fabricIssues || [],
      status: entry.status,
      remarks: entry.remarks || null,
      price_per_piece: entry.pricePerPiece ?? null,
      total_amount: entry.totalAmount ?? null,
      created_by: username || null,
    };

    const { data: saved, error } = await supabase
      .from('embroidery_accessory_entries')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[embroideryService.create] error:', error);
      return null;
    }

    // Deduct fabric stock for each fabric issue row
    if (entry.fabricIssues && entry.fabricIssues.length > 0) {
      await this._deductFabricForIssues(entry.fabricIssues, saved.entry_no);
    }

    return rowToEntry(saved);
  },

  async update(
    id: string,
    entry: Omit<EmbroideryAccessoryEntry, 'id'>,
    oldFabricIssues: FabricIssueRow[],
    username?: string | null
  ): Promise<EmbroideryAccessoryEntry | null> {
    const supabase = createClient();

    const row = {
      entry_no: entry.entryNo,
      date: entry.date,
      job_card_ref: entry.jobCardRef || null,
      style_name: entry.styleName || null,
      process_type: entry.processType,
      embroidery_type: entry.embroideryType || null,
      operator_name: entry.operatorName || null,
      pieces_received: entry.piecesReceived,
      pieces_processed: entry.piecesProcessed,
      pieces_rejected: entry.piecesRejected,
      net_pieces: entry.netPieces,
      finished_pieces: entry.finishedPieces || 0,
      rejection_reason: entry.rejectionReason || null,
      accessories_used: entry.accessoriesUsed,
      process_details: entry.processDetails,
      fabric_issues: entry.fabricIssues || [],
      status: entry.status,
      remarks: entry.remarks || null,
      price_per_piece: entry.pricePerPiece ?? null,
      total_amount: entry.totalAmount ?? null,
      updated_by: username || null,
    };

    const { data: saved, error } = await supabase
      .from('embroidery_accessory_entries')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[embroideryService.update] error:', error);
      return null;
    }

    // Restore old fabric stock, then deduct new
    if (oldFabricIssues && oldFabricIssues.length > 0) {
      await fabricInventoryService.restoreFabricStock(
        oldFabricIssues
          .filter((f) => f.rollId && f.consumedQty > 0)
          .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.consumedQty }))
      );
    }
    if (entry.fabricIssues && entry.fabricIssues.length > 0) {
      await this._deductFabricForIssues(entry.fabricIssues, entry.entryNo);
    }

    return rowToEntry(saved);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();

    // Fetch entry first to restore fabric stock
    const { data: existing } = await supabase
      .from('embroidery_accessory_entries')
      .select('fabric_issues')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('embroidery_accessory_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[embroideryService.delete] error:', error);
      return false;
    }

    // Restore fabric stock on delete
    const fabricIssues: FabricIssueRow[] = Array.isArray(existing?.fabric_issues) ? existing.fabric_issues : [];
    if (fabricIssues.length > 0) {
      await fabricInventoryService.restoreFabricStock(
        fabricIssues
          .filter((f) => f.rollId && f.consumedQty > 0)
          .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.consumedQty }))
      );
    }

    return true;
  },

  async getNextEntryNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('embroidery_accessory_entries')
      .select('*', { count: 'exact', head: true });

    const next = (count ?? 0) + 1;
    return `EMB-${String(next).padStart(4, '0')}`;
  },

  async _deductFabricForIssues(fabricIssues: FabricIssueRow[], _entryRef: string): Promise<void> {
    const deductions = fabricIssues
      .filter((f) => f.rollId && f.consumedQty > 0)
      .map((f) => ({ fabricRollId: f.rollId, consumedQty: f.consumedQty }));
    if (deductions.length > 0) {
      await fabricInventoryService.deductFabricStock(deductions);
    }
  },
};
