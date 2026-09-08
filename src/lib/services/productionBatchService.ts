import { createClient } from '@/lib/supabase/client';
import { ProductionBatch } from '@/app/production-batch/data/productionBatchData';
import { getCreateAudit, getUpdateAudit } from '@/lib/auditTrail';

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

function rowToBatch(row: any): ProductionBatch {
  return {
    id: row.id,
    batchNo: row.batch_no,
    jobCardId: row.job_card_id,
    jobCardNo: row.job_card_no,
    styleName: row.style_name || '',
    partyName: row.party_name || '',
    totalOrderedQty: row.total_ordered_qty || 0,
    currentStage: row.current_stage,
    stages: row.stages || {},
    compositionStages: row.composition_stages || {},
    compositions: row.compositions || [],
    createdDate: row.created_date || '',
    status: row.status,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function batchToRow(batch: Partial<ProductionBatch>) {
  return {
    batch_no: batch.batchNo,
    job_card_id: batch.jobCardId,
    job_card_no: batch.jobCardNo,
    style_name: batch.styleName || '',
    party_name: batch.partyName || '',
    total_ordered_qty: batch.totalOrderedQty || 0,
    current_stage: batch.currentStage || 'cutting',
    stages: batch.stages || {},
    composition_stages: batch.compositionStages || {},
    created_date: batch.createdDate || '',
    status: batch.status || 'active',
  };
}

export const productionBatchService = {
  async getAll(): Promise<ProductionBatch[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(rowToBatch);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return [];
    }
  },

  async getByJobCardId(jobCardId: string): Promise<ProductionBatch | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select('*')
        .eq('job_card_id', jobCardId)
        .maybeSingle();
      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      return data ? rowToBatch(data) : null;
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return null;
    }
  },

  async upsert(batch: ProductionBatch, username?: string | null): Promise<ProductionBatch | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .upsert({ id: batch.id, ...batchToRow(batch), ...getUpdateAudit(username ?? null) }, { onConflict: 'id' })
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      return rowToBatch(data);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return null;
    }
  },

  async create(batch: Omit<ProductionBatch, 'id'>, username?: string | null): Promise<ProductionBatch | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .insert({ ...batchToRow(batch), ...getCreateAudit(username ?? null) })
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      return rowToBatch(data);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return null;
    }
  },

  async update(id: string, batch: Partial<ProductionBatch>, username?: string | null): Promise<ProductionBatch | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .update({ ...batchToRow(batch), ...getUpdateAudit(username ?? null) })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      return rowToBatch(data);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return null;
    }
  },
};
