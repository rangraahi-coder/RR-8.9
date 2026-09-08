import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinishingStockRow {
  id: string;
  jobCardRef: string;
  stitchReceiveRef: string;
  component: string;
  size: string;
  colour: string;
  stitchReceivedQty: number;
  finishedQty: number;
  pendingQty: number;
}

export interface AssemblyComponentRow {
  component: string;
  size: string;
  colour: string;
  availableFinishedQty: number;
  qtyUsed: number; // UI input
}

export interface ComponentAssemblyVoucher {
  assemblyKind: 'set_assembly' | 'component_conversion';
  id: string;
  voucherNo: string;
  voucherDate: string;
  jobCardRef: string;
  jobCardId?: string;
  styleName?: string;
  partyName?: string;
  finalItemName: string;
  colour: string;
  size: string;
  totalSetsAssembled: number;
  totalComponentsUsed: number;
  remarks?: string;
  items: ComponentAssemblyItem[];
  createdBy?: string | null;
  createdAt?: string;
}

export interface ComponentAssemblyItem {
  id: string;
  assemblyVoucherId: string;
  component: string;
  size: string;
  colour: string;
  availableFinishedQty: number;
  qtyUsed: number;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function rowToVoucher(row: any): ComponentAssemblyVoucher {
  return {
    id: row.id,
    assemblyKind: row.assembly_kind || 'set_assembly',
    voucherNo: row.voucher_no,
    voucherDate: row.voucher_date,
    jobCardRef: row.job_card_ref || '',
    jobCardId: row.job_card_id || undefined,
    styleName: row.style_name || undefined,
    partyName: row.party_name || undefined,
    finalItemName: row.final_item_name || '',
    colour: row.colour || '',
    size: row.size || '',
    totalSetsAssembled: row.total_sets_assembled || 0,
    totalComponentsUsed: row.total_components_used || 0,
    remarks: row.remarks || undefined,
    items: Array.isArray(row.component_assembly_items)
      ? row.component_assembly_items.map((i: any): ComponentAssemblyItem => ({
          id: i.id,
          assemblyVoucherId: i.assembly_voucher_id,
          component: i.component || '',
          size: i.size || '',
          colour: i.colour || '',
          availableFinishedQty: i.available_finished_qty || 0,
          qtyUsed: i.qty_used || 0,
        }))
      : [],
    createdBy: row.created_by || null,
    createdAt: row.created_at || '',
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const componentAssemblyService = {

  async getComposition(jobCardRef: string): Promise<{ component: string; qtyPerSet: number }[]> {
    const client = createClient();
    const { data: style, error } = await client.from('item_styles').select('id').eq('job_card_no', jobCardRef).single();
    if (error) throw new Error('Link exactly one Item Master style to this job card before assembly.');
    const { data, error: compError } = await client.from('item_compositions').select('component_name, qty_per_set').eq('style_id', style.id);
    if (compError) throw compError;
    if (!data?.length) throw new Error('Define the required sub-components in Item Master before assembly.');
    return data.map(c => ({ component: c.component_name, qtyPerSet: c.qty_per_set }));
  },

  async getNextVoucherNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('component_assembly_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `CAV-${String(num).padStart(4, '0')}`;
  },

  async getAll(): Promise<ComponentAssemblyVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('component_assembly_vouchers')
      .select('*, component_assembly_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToVoucher);
  },

  // Get finishing_stock rows for a job card — these are the finished sub-components
  async getFinishingStockByJobCard(jobCardRef: string): Promise<FinishingStockRow[]> {
    const supabase = createClient();

    // Step 1: Fetch all finishing_stock rows for this job card
    const { data, error } = await supabase
      .from('finishing_stock')
      .select('*')
      .eq('job_card_ref', jobCardRef)
      .gt('finished_qty', 0)
      .order('component');
    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) return [];

    // Step 3: Aggregate finishing_stock by component+size+colour
    // (there may be multiple rows for the same component+size across different stitch_receive_refs)
    const aggregated: Record<string, {
      component: string;
      size: string;
      colour: string;
      finishedQty: number;
      stitchReceivedQty: number;
      ids: string[];
      stitchReceiveRef: string;
    }> = {};

    for (const row of rows) {
      const component = row.component || '';
      const size = row.size || '';
      const colour = row.colour || '';

      const aggKey = `${component.trim().toLowerCase()}|${size.trim().toLowerCase()}|${colour.trim().toLowerCase()}`;
      if (!aggregated[aggKey]) {
        aggregated[aggKey] = {
          component,
          size,
          colour,
          finishedQty: 0,
          stitchReceivedQty: 0,
          ids: [],
          stitchReceiveRef: row.stitch_receive_ref || '',
        };
      }
      aggregated[aggKey].finishedQty += row.finished_qty || 0;
      aggregated[aggKey].stitchReceivedQty += row.stitch_received_qty || 0;
      aggregated[aggKey].ids.push(row.id);
    }

    // Step 4: Subtract already-assembled qty from component_assembly_items for this job card
    const { data: vouchers, error: voucherError } = await supabase.from('component_assembly_vouchers').select('id').eq('job_card_ref', jobCardRef);
    if (voucherError) throw voucherError;
    const ids = (vouchers || []).map(v => v.id);
    const { data: assembledItems, error: itemError } = ids.length
      ? await supabase.from('component_assembly_items').select('component, size, colour, qty_used').in('assembly_voucher_id', ids)
      : { data: [], error: null };
    if (itemError) throw itemError;

    const assembledMap: Record<string, number> = {};
    if (assembledItems) {
      for (const item of assembledItems) {
        const component = item.component || '';
        const size = item.size || '';
        let colour = item.colour || '';
        const key = `${component.trim().toLowerCase()}|${size.trim().toLowerCase()}|${colour.trim().toLowerCase()}`;
        assembledMap[key] = (assembledMap[key] || 0) + (item.qty_used || 0);
      }
    }

    // Step 5: Build final rows with correct available qty
    return Object.values(aggregated).map((agg): FinishingStockRow => {
      const key = `${agg.component.trim().toLowerCase()}|${agg.size.trim().toLowerCase()}|${agg.colour.trim().toLowerCase()}`;
      const alreadyAssembled = assembledMap[key] || 0;
      const availableQty = Math.max(0, agg.finishedQty - alreadyAssembled);
      return {
        id: agg.ids[0],
        jobCardRef,
        stitchReceiveRef: agg.stitchReceiveRef,
        component: agg.component,
        size: agg.size,
        colour: agg.colour,
        stitchReceivedQty: agg.stitchReceivedQty,
        finishedQty: agg.finishedQty,
        pendingQty: availableQty,
      };
    }).filter((r) => r.pendingQty > 0);
  },

  // Get distinct job card refs that have finishing_stock entries
  async getJobCardsWithFinishingStock(): Promise<{ jobCardRef: string; styleName?: string; partyName?: string; jobCardId?: string }[]> {
    const supabase = createClient();

    // Step 1: Get all job_card_nos that actually exist in job_cards table
    const { data: validJcData } = await supabase
      .from('job_cards')
      .select('id, job_card_no, style_en, party_name');
    const validJcMap: Record<string, { id: string; style_en?: string; party_name?: string }> = {};
    for (const jc of (validJcData || [])) {
      if (jc.job_card_no) validJcMap[jc.job_card_no] = jc;
    }

    // Step 2: Get distinct job_card_refs from finishing_stock with finished_qty > 0
    const { data, error } = await supabase
      .from('finishing_stock')
      .select('job_card_ref')
      .gt('finished_qty', 0);
    if (error) { console.error('[getJobCardsWithFinishingStock]', error); return []; }

    // Step 3: Filter to only refs that exist in job_cards
    const uniqueRefs = [...new Set((data || []).map((r: any) => r.job_card_ref as string))]
      .filter((ref) => ref && validJcMap[ref]) // ← exclude phantom refs not in job_cards
      .sort();

    // Step 4: For each valid ref, check if there's still available (unassembled) stock
    const result: { jobCardRef: string; styleName?: string; partyName?: string; jobCardId?: string }[] = [];
    for (const ref of uniqueRefs) {
      const availableStock = await this.getFinishingStockByJobCard(ref);
      if (availableStock.length === 0) continue; // Skip fully assembled job cards

      const jc = validJcMap[ref];
      result.push({
        jobCardRef: ref,
        styleName: jc?.style_en || undefined,
        partyName: jc?.party_name || undefined,
        jobCardId: jc?.id || undefined,
      });
    }
    return result;
  },

  async create(
    voucher: {
      voucherNo: string;
      voucherDate: string;
      jobCardRef: string;
      jobCardId?: string;
      styleName?: string;
      partyName?: string;
      finalItemName: string;
      colour: string;
      size: string;
      remarks?: string;
    },
    components: AssemblyComponentRow[],
    username?: string | null,
    requestId?: string
  ): Promise<ComponentAssemblyVoucher | null> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('save_original_component_assembly', {
      p_id: requestId || crypto.randomUUID(),
      p_header: { ...voucher, createdBy: username || null },
      p_items: components.filter(c => c.qtyUsed > 0),
    });
    if (error) throw error;
    window.dispatchEvent(new Event('erp-data-changed'));
    return rowToVoucher(data);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.rpc('delete_original_component_assembly', { p_id: id });
    if (error) throw error;
    window.dispatchEvent(new Event('erp-data-changed'));
    return true;
  },
};
