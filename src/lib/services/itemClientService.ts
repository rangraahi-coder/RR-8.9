'use client';

import { createClient } from '@/lib/supabase/client';

export interface ItemVariantOption {
  id: string;
  job_card_no: string;
  style_no: string;
  set_type: string;
  colour: string;
  design_code: string;
}

export async function getItemVariantsForSelect(): Promise<ItemVariantOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('item_variants')
    .select(`
      id,
      job_card_no,
      style_no,
      set_type,
      colour,
      item_styles (
        design_code
      )
    `)
    .order('job_card_no', { ascending: true });

  if (error || !data) return [];

  return data.map((v: any) => ({
    id: v.id,
    job_card_no: v.job_card_no,
    style_no: v.style_no || '',
    set_type: v.set_type || '',
    colour: v.colour || '',
    design_code: v.item_styles?.design_code || v.style_no || '',
  }));
}
