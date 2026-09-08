import { createClient } from '@/lib/supabase/client';

export interface CuttingMaster {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
}

function rowToMaster(row: any): CuttingMaster {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

export const cuttingMasterService = {
  async getAll(): Promise<CuttingMaster[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cutting_masters')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) {
      console.error('[cuttingMasterService.getAll] error:', error);
      return [];
    }
    return (data || []).map(rowToMaster);
  },

  async create(name: string, username?: string | null): Promise<CuttingMaster | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('cutting_masters')
      .insert({ name: name.trim(), created_by: username || null })
      .select()
      .single();
    if (error) {
      // If duplicate, fetch existing
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('cutting_masters')
          .select('*')
          .eq('name', name.trim())
          .single();
        return existing ? rowToMaster(existing) : null;
      }
      console.error('[cuttingMasterService.create] error:', error);
      return null;
    }
    return rowToMaster(data);
  },
};
