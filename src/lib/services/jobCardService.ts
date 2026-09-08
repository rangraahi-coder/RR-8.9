import { createClient } from '@/lib/supabase/client';
import { JobCard } from '@/app/job-card-management/components/JobCardContent';

function rowToJobCard(row: any): JobCard {
  return {
    id: row.id,
    jobCardNo: row.job_card_no,
    styleEn: row.style_en || '',
    styleHi: row.style_hi || '',
    designCode: row.design_code || '',
    partyName: row.party_name,
    contractor: row.contractor || 'Unassigned',
    stage: row.stage,
    totalPieces: row.total_pieces || 0,
    completedPieces: row.completed_pieces || 0,
    isBlocked: row.is_blocked || false,
    blockageReasonEn: row.blockage_reason_en || undefined,
    blockageReasonHi: row.blockage_reason_hi || undefined,
    blockageDays: row.blockage_days || undefined,
    dueDate: row.due_date || '',
    poNo: row.po_no || '',
    createdDate: row.created_date || '',
    colors: row.colors || [],
    sizes: row.sizes || [],
    sizeRatios: row.size_ratios || undefined,
    salesOrderId: row.sales_order_id || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function jobCardToRow(jc: Partial<JobCard>) {
  return {
    job_card_no: jc.jobCardNo,
    style_en: jc.styleEn || '',
    style_hi: jc.styleHi || '',
    design_code: jc.designCode || '',
    party_name: jc.partyName,
    contractor: jc.contractor || 'Unassigned',
    stage: jc.stage || 'cutting',
    total_pieces: jc.totalPieces || 0,
    completed_pieces: jc.completedPieces || 0,
    is_blocked: jc.isBlocked || false,
    blockage_reason_en: jc.blockageReasonEn || null,
    blockage_reason_hi: jc.blockageReasonHi || null,
    blockage_days: jc.blockageDays || null,
    due_date: jc.dueDate || '',
    po_no: jc.poNo || '',
    created_date: jc.createdDate || '',
    colors: jc.colors || [],
    sizes: jc.sizes || [],
    size_ratios: jc.sizeRatios || null,
    sales_order_id: jc.salesOrderId || null,
  };
}

export const jobCardService = {
  async getAll(): Promise<JobCard[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('job_cards')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[jobCardService.getAll] error:', error);
      return [];
    }
    return (data || []).map(rowToJobCard);
  },

  async create(jc: Omit<JobCard, 'id'>, username?: string | null): Promise<JobCard | null> {
    const supabase = createClient();
    const row: Record<string, any> = { ...jobCardToRow(jc) };

    // Only include audit fields if username is provided
    if (username) {
      row.created_by = username;
      row.updated_by = username;
    }

    const { data, error } = await supabase
      .from('job_cards')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[jobCardService.create] error:', error);
      return null;
    }
    // DB trigger automatically recalculates the sales order status
    return rowToJobCard(data);
  },

  async update(id: string, jc: Partial<JobCard>, username?: string | null): Promise<JobCard | null> {
    const supabase = createClient();
    const row: Record<string, any> = { ...jobCardToRow(jc) };
    // A stage-only edit must not overwrite the other job-card fields with defaults.
    const fieldMap:Record<string,string>={job_card_no:'jobCardNo',style_en:'styleEn',style_hi:'styleHi',design_code:'designCode',party_name:'partyName',contractor:'contractor',stage:'stage',total_pieces:'totalPieces',completed_pieces:'completedPieces',is_blocked:'isBlocked',blockage_reason_en:'blockageReasonEn',blockage_reason_hi:'blockageReasonHi',blockage_days:'blockageDays',due_date:'dueDate',po_no:'poNo',created_date:'createdDate',colors:'colors',sizes:'sizes',size_ratios:'sizeRatios',sales_order_id:'salesOrderId'};
    for(const [column,field]of Object.entries(fieldMap))if(!Object.prototype.hasOwnProperty.call(jc,field))delete row[column];


    if (username) {
      row.updated_by = username;
    }

    const { data, error } = await supabase
      .from('job_cards')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[jobCardService.update] error:', error);
      return null;
    }
    // DB trigger automatically recalculates the sales order status
    return rowToJobCard(data);
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('job_cards').delete().eq('id', id);
    if (error) {
      console.error('[jobCardService.delete] error:', error);
      return false;
    }
    // DB trigger automatically reverses the sales order impact
    return true;
  },

  async deleteMany(ids: string[]): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('job_cards').delete().in('id', ids);
    if (error) {
      console.error('[jobCardService.deleteMany] error:', error);
      return false;
    }
    // DB trigger automatically reverses the sales order impact for each deleted job card
    return true;
  },
};
