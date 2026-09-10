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
    const {data,error}=await createClient().rpc('erp_assembly_composition',{p_job_ref:jobCardRef});if(error)throw error;
    if(!data?.length)throw new Error('Define the required sub-components in Item Master before assembly.');return data;
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
    const {data,error}=await createClient().rpc('erp_pending_components',{p_job_ref:jobCardRef});if(error)throw error;return data||[];
  },
  async getAllPendingComponents():Promise<(FinishingStockRow&{styleName?:string})[]>{
    const {data,error}=await createClient().rpc('erp_pending_components',{p_job_ref:null});if(error)throw error;return data||[];
  },

  // Get distinct job card refs that have finishing_stock entries
  async getJobCardsWithFinishingStock(): Promise<{ jobCardRef: string; styleName?: string; partyName?: string; jobCardId?: string }[]> {
    const supabase = createClient();

    // Step 1: Get all job_card_nos that actually exist in job_cards table
    const { data: validJcData, error: jcError } = await supabase
      .from('job_cards')
      .select('id, job_card_no, style_en, party_name');
    if(jcError)throw jcError;
    const validJcMap: Record<string, { id: string; style_en?: string; party_name?: string }> = {};
    for (const jc of (validJcData || [])) {
      if (jc.job_card_no) validJcMap[jc.job_card_no] = jc;
    }

    // Step 2: Get distinct job_card_refs from finishing_stock with finished_qty > 0
    const { data, error } = await supabase
      .from('finishing_stock')
      .select('job_card_ref')
      .gt('finished_qty', 0);
    if(error)throw error;

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
