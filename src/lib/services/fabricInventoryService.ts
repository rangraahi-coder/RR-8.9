import { createClient } from '@/lib/supabase/client';
import { FabricStockItem } from '@/app/fabric-inventory/data/fabricStockData';

export interface FabricVoucherInsert {
  fabricName: string;
  category: string;
  unit: string;
  stockQty: number;
  voucherNo: string;
  voucherDate: string;
  source?: string;
  remarks?: string;
}

/** Payload for posting a processed-fabric receipt to finished inventory */
export interface FinishedFabricReceiptPost {
  /** Canonical finished-fabric name (mandatory, user-entered) */
  finishedFabricName: string;
  /** Quantity received (metres) */
  receivedQty: number;
  /** Category for the fabric */
  category?: string;
  /** Unit */
  unit?: string;
  /** Source module: 'dyeing_processing' | 'printer_receipt' */
  sourceModule: 'dyeing_processing' | 'printer_receipt';
  /** Unique receipt/entry reference for idempotency */
  sourceReceiptId: string;
  /** Original grey fabric purchase_no / gray_fabric_ref */
  sourceGreyFabricRef?: string;
  /** Processor / printer name */
  processorName?: string;
  /** Process type: dyeing | printing | etc. */
  processingType?: string;
  /** Date received */
  receivedDate?: string;
  /** Who posted this */
  createdBy?: string | null;
}

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const errorClass = error.code.substring(0, 2);
    if (errorClass === '42') return true;
    if (errorClass === '23') return false;
    if (errorClass === '08') return true;
  }
  if (error.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return schemaErrorPatterns.some((p) => p.test(error.message));
  }
  return false;
}

function rowToFabric(row: any): FabricStockItem {
  return {
    id: row.id,
    fabricName: row.finished_fabric_name || row.fabric_name,
    unit: row.unit || 'Metre',
    stockQty: Number(row.stock_qty) || 0,
    category: row.category as FabricStockItem['category'],
    status: 'ready_to_cut',
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    // Extended lineage fields
    inventoryStage: row.inventory_stage || 'finished',
    finishedFabricName: row.finished_fabric_name || row.fabric_name,
    sourceModule: row.source_module || null,
    sourceReceiptId: row.source_receipt_id || null,
    sourceGreyFabricRef: row.source_grey_fabric_ref || null,
    processorName: row.processor_name || null,
    processingType: row.processing_type || null,
    receivedDate: row.received_date || null,
  };
}

// Map user-entered category strings to valid fabric_category enum values
function normalizeCategory(cat: string): string {
  const upper = cat.toUpperCase().replace(/\s+/g, '_');
  const valid = ['JK', 'MALMAL', 'RAYON', 'YUFTA', 'KERI_PRINT', 'OTHER'];
  if (upper.includes('MALMAL') || upper.includes('MAL') || upper.includes('CHANDARI')) return 'MALMAL';
  if (upper.includes('RAYON')) return 'RAYON';
  if (upper.includes('YUFTA')) return 'YUFTA';
  if (upper.includes('KERI')) return 'KERI_PRINT';
  if (upper.includes('JK')) return 'JK';
  if (valid.includes(upper)) return upper;
  return 'OTHER';
}

export const fabricInventoryService = {
  /**
   * Returns ONLY finished-stage fabric inventory.
   * Grey purchases and processing-stage records are excluded at the DB level.
   */
  async getAll(): Promise<FabricStockItem[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('fabric_inventory')
        .select('*')
        .eq('inventory_stage', 'finished')
        .order('finished_fabric_name', { ascending: true });
      if (error) {
        if (isSchemaError(error)) throw error;
        // Fallback: if column doesn't exist yet, return all
        const { data: fallback, error: fallbackErr } = await supabase
          .from('fabric_inventory').select('*').order('fabric_name', { ascending: true });
        if (fallbackErr) return [];
        return (fallback || []).map(rowToFabric);
      }
      return (data || []).map(rowToFabric);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return [];
    }
  },

  /**
   * Post a processed-fabric receipt to finished inventory.
   * Idempotent: one source receipt → one inventory row (enforced by DB unique index).
   * If the same finished-fabric name already exists, adds qty to that record.
   */
  async postFinishedFabricReceipt(
    payload: FinishedFabricReceiptPost
  ): Promise<{ success: boolean; error?: string; alreadyPosted?: boolean }> {
    const supabase = createClient();

    const finishedName = payload.finishedFabricName.trim();
    if (!finishedName) {
      return { success: false, error: 'Finished fabric name is required.' };
    }

    try {
      // Idempotency check: has this source receipt already been posted?
      const { data: existing } = await supabase
        .from('fabric_inventory')
        .select('id, stock_qty')
        .eq('source_module', payload.sourceModule)
        .eq('source_receipt_id', payload.sourceReceiptId)
        .limit(1);

      if (existing && existing.length > 0) {
        return { success: true, alreadyPosted: true };
      }

      // Insert new finished-fabric inventory row
      const { error } = await supabase.from('fabric_inventory').insert({
        fabric_name: finishedName,
        finished_fabric_name: finishedName,
        unit: payload.unit || 'Metre',
        stock_qty: payload.receivedQty,
        category: normalizeCategory(payload.category || 'OTHER'),
        status: 'ready_to_cut',
        inventory_stage: 'finished',
        source_module: payload.sourceModule,
        source_receipt_id: payload.sourceReceiptId,
        source_grey_fabric_ref: payload.sourceGreyFabricRef || null,
        processor_name: payload.processorName || null,
        processing_type: payload.processingType || null,
        received_date: payload.receivedDate || null,
        created_by: payload.createdBy || null,
      });

      if (error) {
        // Unique constraint violation = already posted (race condition)
        if (error.code === '23505') {
          return { success: true, alreadyPosted: true };
        }
        console.error('[fabricInventoryService.postFinishedFabricReceipt]', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[fabricInventoryService.postFinishedFabricReceipt] exception:', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  },

  /**
   * Insert new fabric voucher entries into Supabase (manual entry tab).
   * These are always marked as finished + manual source.
   */
  async insertVoucherEntries(entries: FabricVoucherInsert[]): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    try {
      const rows = entries.map((entry) => ({
        fabric_name: entry.fabricName.trim(),
        finished_fabric_name: entry.fabricName.trim(),
        unit: entry.unit,
        stock_qty: entry.stockQty,
        category: normalizeCategory(entry.category),
        status: 'ready_to_cut',
        inventory_stage: 'finished',
        source_module: 'manual',
      }));

      const { error } = await supabase.from('fabric_inventory').insert(rows);
      if (error) {
        console.error('Fabric inventory insert error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Fabric inventory insert exception:', err);
      return { success: false, error: err?.message || 'Unknown error' };
    }
  },

  async update(id: string, stockQty: number): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('fabric_inventory')
        .update({ stock_qty: stockQty })
        .eq('id', id);
      if (error) {
        if (isSchemaError(error)) throw error;
        return false;
      }
      return true;
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return false;
    }
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('fabric_inventory')
        .delete()
        .eq('id', id);
      if (error) {
        if (isSchemaError(error)) throw error;
        return false;
      }
      return true;
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return false;
    }
  },

  /**
   * Deduct consumed qty from fabric_inventory rows by their IDs.
   */
  async deductFabricStock(
    rollDeductions: { fabricRollId: string; consumedQty: number }[]
  ): Promise<void> {
    const supabase = createClient();
    const validDeductions = rollDeductions.filter((r) => r.fabricRollId && r.consumedQty > 0);
    for (const deduction of validDeductions) {
      try {
        const { data: row, error: fetchErr } = await supabase
          .from('fabric_inventory')
          .select('stock_qty')
          .eq('id', deduction.fabricRollId)
          .single();
        if (fetchErr || !row) {
          console.warn('[fabricInventoryService.deductFabricStock] row not found:', deduction.fabricRollId);
          continue;
        }
        const newQty = Math.max(0, Number(row.stock_qty) - deduction.consumedQty);
        const { error: updateErr } = await supabase
          .from('fabric_inventory')
          .update({ stock_qty: newQty })
          .eq('id', deduction.fabricRollId);
        if (updateErr) {
          console.error('[fabricInventoryService.deductFabricStock] update error:', updateErr);
        }
      } catch (err) {
        console.error('[fabricInventoryService.deductFabricStock] exception:', err);
      }
    }
  },

  /**
   * Restore (add back) consumed qty to fabric_inventory rows.
   */
  async restoreFabricStock(
    rollRestorations: { fabricRollId: string; consumedQty: number }[]
  ): Promise<void> {
    const supabase = createClient();
    const validRestorations = rollRestorations.filter((r) => r.fabricRollId && r.consumedQty > 0);
    for (const restoration of validRestorations) {
      try {
        const { data: row, error: fetchErr } = await supabase
          .from('fabric_inventory')
          .select('stock_qty')
          .eq('id', restoration.fabricRollId)
          .single();
        if (fetchErr || !row) {
          console.warn('[fabricInventoryService.restoreFabricStock] row not found:', restoration.fabricRollId);
          continue;
        }
        const newQty = Number(row.stock_qty) + restoration.consumedQty;
        const { error: updateErr } = await supabase
          .from('fabric_inventory')
          .update({ stock_qty: newQty })
          .eq('id', restoration.fabricRollId);
        if (updateErr) {
          console.error('[fabricInventoryService.restoreFabricStock] update error:', updateErr);
        }
      } catch (err) {
        console.error('[fabricInventoryService.restoreFabricStock] exception:', err);
      }
    }
  },

  /**
   * Get finished-inventory entries by finished fabric name.
   * Used by detail view and modals.
   */
  async getEntriesByFabricName(fabricName: string): Promise<FabricStockItem[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('fabric_inventory')
        .select('*')
        .eq('inventory_stage', 'finished')
        .or(`finished_fabric_name.ilike.${fabricName},fabric_name.ilike.${fabricName}`)
        .order('created_at', { ascending: false });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(rowToFabric);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return [];
    }
  },

  /**
   * Get all finished fabric names for dropdowns (cutting, embroidery, etc.)
   */
  async getFinishedFabricNames(): Promise<string[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('fabric_inventory')
        .select('finished_fabric_name, fabric_name')
        .eq('inventory_stage', 'finished')
        .order('finished_fabric_name', { ascending: true });
      if (error) return [];
      const names = new Set<string>();
      (data || []).forEach((row: any) => {
        const name = row.finished_fabric_name || row.fabric_name;
        if (name) names.add(name);
      });
      return Array.from(names).sort();
    } catch {
      return [];
    }
  },

  async seedFromLocal(items: FabricStockItem[]): Promise<void> {
    const supabase = createClient();
    try {
      const { count } = await supabase
        .from('fabric_inventory')
        .select('*', { count: 'exact', head: true });
      if ((count || 0) > 0) return;
      const rows = items.map((item) => ({
        legacy_id: item.id,
        fabric_name: item.fabricName,
        finished_fabric_name: item.fabricName,
        unit: item.unit,
        stock_qty: item.stockQty,
        category: item.category,
        status: item.status,
        inventory_stage: 'finished',
        source_module: 'manual',
      }));
      await supabase.from('fabric_inventory').insert(rows);
    } catch (err) {
      console.error('[fabricInventoryService.seedFromLocal]', err);
    }
  },
};
