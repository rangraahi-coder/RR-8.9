import { createClient } from '@/lib/supabase/client';
import { DyeingProcessingEntry, DyeingProcessType } from '@/app/dyeing-printing/data/dyeingData';
import { fabricInventoryService } from './fabricInventoryService';

function rowToEntry(row: any): DyeingProcessingEntry {
  return {
    id: row.id,
    entryNo: row.entry_no,
    date: row.date,
    grayFabricRef: row.gray_fabric_ref || '',
    jobCardRef: row.job_card_ref || undefined,
    styleName: row.style_name || undefined,
    processType: (row.process_type as DyeingProcessType) || 'dyeing',
    processorName: row.processor_name || '',
    dyeBatchNo: row.dye_batch_no || '',
    colourShade: row.colour_shade || '',
    qtyMeters: row.qty_meters != null ? parseFloat(row.qty_meters) : 0,
    piecesIn: row.pieces_in || 0,
    piecesOut: row.pieces_out || 0,
    piecesRejected: row.pieces_rejected || 0,
    netPieces: row.net_pieces || 0,
    sentDate: row.sent_date || undefined,
    expectedDate: row.expected_date || undefined,
    receivedDate: row.received_date || undefined,
    processingTimeHours: row.processing_time_hours != null ? parseFloat(row.processing_time_hours) : undefined,
    remarks: row.remarks || undefined,
    fabricInventoryPunched: row.fabric_inventory_punched || false,
    finishedFabricName: row.finished_fabric_name || undefined,
  };
}

export const dyeingProcessingService = {
  async getAll(): Promise<DyeingProcessingEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('dyeing_processing_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[dyeingProcessingService.getAll]', error);
      return [];
    }
    return (data || []).map(rowToEntry);
  },

  async create(
    entry: Omit<DyeingProcessingEntry, 'id'>,
    username?: string | null
  ): Promise<DyeingProcessingEntry | null> {
    const supabase = createClient();
    const row = {
      entry_no: entry.entryNo,
      date: entry.date,
      gray_fabric_ref: entry.grayFabricRef || null,
      job_card_ref: entry.jobCardRef || null,
      style_name: entry.styleName || null,
      process_type: entry.processType,
      processor_name: entry.processorName || null,
      dye_batch_no: entry.dyeBatchNo || null,
      colour_shade: entry.colourShade || null,
      qty_meters: entry.qtyMeters || 0,
      pieces_in: entry.piecesIn || 0,
      pieces_out: entry.piecesOut || 0,
      pieces_rejected: entry.piecesRejected || 0,
      net_pieces: entry.netPieces || 0,
      sent_date: entry.sentDate || null,
      expected_date: entry.expectedDate || null,
      received_date: entry.receivedDate || null,
      processing_time_hours: entry.processingTimeHours ?? null,
      stage_from: 'dyeing',
      stage_to: 'dyeing',
      status: 'sent',
      remarks: entry.remarks || null,
      finished_fabric_name: (entry as any).finishedFabricName || null,
      created_by: username || null,
    };
    const { data: saved, error } = await supabase
      .from('dyeing_processing_entries')
      .insert(row)
      .select()
      .single();
    if (error) {
      console.error('[dyeingProcessingService.create]', error);
      return null;
    }
    return rowToEntry(saved);
  },

  async update(
    id: string,
    entry: Omit<DyeingProcessingEntry, 'id'>,
    username?: string | null
  ): Promise<DyeingProcessingEntry | null> {
    const supabase = createClient();
    const row = {
      entry_no: entry.entryNo,
      date: entry.date,
      gray_fabric_ref: entry.grayFabricRef || null,
      job_card_ref: entry.jobCardRef || null,
      style_name: entry.styleName || null,
      process_type: entry.processType,
      processor_name: entry.processorName || null,
      dye_batch_no: entry.dyeBatchNo || null,
      colour_shade: entry.colourShade || null,
      qty_meters: entry.qtyMeters || 0,
      pieces_in: entry.piecesIn || 0,
      pieces_out: entry.piecesOut || 0,
      pieces_rejected: entry.piecesRejected || 0,
      net_pieces: entry.netPieces || 0,
      sent_date: entry.sentDate || null,
      expected_date: entry.expectedDate || null,
      received_date: entry.receivedDate || null,
      processing_time_hours: entry.processingTimeHours ?? null,
      remarks: entry.remarks || null,
      finished_fabric_name: (entry as any).finishedFabricName || null,
      updated_by: username || null,
    };
    const { data: saved, error } = await supabase
      .from('dyeing_processing_entries')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[dyeingProcessingService.update]', error);
      return null;
    }
    return rowToEntry(saved);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('dyeing_processing_entries')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('[dyeingProcessingService.delete]', error);
      return false;
    }
    return true;
  },

  async getNextEntryNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('dyeing_processing_entries')
      .select('*', { count: 'exact', head: true });
    const next = (count ?? 0) + 1;
    return `DYE-${String(next).padStart(4, '0')}`;
  },

  /** Auto-generate batch number: BATCH-YYYYMMDD-NNN */
  async getNextBatchNo(): Promise<string> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `BATCH-${today}-`;
    const { data } = await supabase
      .from('dyeing_processing_entries')
      .select('dye_batch_no')
      .like('dye_batch_no', `${prefix}%`)
      .order('dye_batch_no', { ascending: false })
      .limit(1);
    let seq = 1;
    if (data && data.length > 0) {
      const last = data[0].dye_batch_no as string;
      const parts = last.split('-');
      const lastSeq = parseInt(parts[parts.length - 1]) || 0;
      seq = lastSeq + 1;
    }
    return `${prefix}${String(seq).padStart(3, '0')}`;
  },

  /**
   * Punch received fabric back into Finished Fabric Inventory.
   * Requires a dedicated finishedFabricName — never uses the grey fabric name.
   * Idempotent: repeated calls with the same entryNo will not duplicate stock.
   */
  async punchToFabricInventory(
    entry: DyeingProcessingEntry,
    finishedFabricName?: string
  ): Promise<{ success: boolean; error?: string; alreadyPosted?: boolean }> {
    const resolvedName = (finishedFabricName || (entry as any).finishedFabricName || '').trim();

    if (!resolvedName) {
      return {
        success: false,
        error: 'Finished fabric name is required before posting to inventory.',
      };
    }

    return fabricInventoryService.postFinishedFabricReceipt({
      finishedFabricName: resolvedName,
      receivedQty: entry.qtyMeters || 0,
      category: 'OTHER',
      unit: 'Metre',
      sourceModule: 'dyeing_processing',
      sourceReceiptId: entry.entryNo,
      sourceGreyFabricRef: entry.grayFabricRef || undefined,
      processorName: entry.processorName || undefined,
      processingType: entry.processType || undefined,
      receivedDate: entry.receivedDate || undefined,
    });
  },
};
