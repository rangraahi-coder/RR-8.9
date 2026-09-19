import { createClient } from '@/lib/supabase/client';
import { GreyFabricPurchase } from '@/app/grey-fabric/data/greyFabricData';

/** Ensure discount_type is always a valid enum value */
function sanitizeDiscountType(value: any): 'amount' | 'percent' {
  if (value === 'percent') return 'percent';
  return 'amount';
}

function rowToPurchase(row: any): GreyFabricPurchase {
  return {
    id: row.id,
    purchaseNo: row.purchase_no,
    date: row.date,
    supplierName: row.supplier_name,
    fabricName: row.fabric_name,
    fabricType: row.fabric_type,
    orderedQty: Number(row.ordered_qty) || 0,
    receivedQty: Number(row.received_qty) || 0,
    unit: row.unit,
    ratePerUnit: Number(row.rate_per_unit) || 0,
    discount: Number(row.discount) || 0,
    discountType: (row.discount_type as 'amount' | 'percent') || 'amount',
    totalAmount: Number(row.total_amount) || 0,
    status: row.status as GreyFabricPurchase['status'],
    sentForDyeing: Number(row.sent_for_dyeing) || 0,
    sentForPrinting: Number(row.sent_for_printing) || 0,
    balanceInStock: Number(row.balance_in_stock) || 0,
    thaanLengths: Array.isArray(row.thaan_lengths) ? row.thaan_lengths.map(Number) : [],
    lValue: Number(row.l_value) || 100,
    actualFabricQty: Number(row.actual_fabric_qty) || Number(row.received_qty) || 0,
    gstSlab: Number(row.gst_slab) || 0,
    remarks: row.remarks || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
  };
}

export const greyFabricService = {
  async getAll(): Promise<GreyFabricPurchase[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('grey_fabric_purchases')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('greyFabricService.getAll error:', error.message);
      return [];
    }
    return (data || []).map(rowToPurchase);
  },

  async insert(entry: Omit<GreyFabricPurchase, 'id'>): Promise<{ success: boolean; error?: string; data?: GreyFabricPurchase }> {
    const supabase = createClient();
    const row = {
      purchase_no: entry.purchaseNo,
      date: entry.date,
      supplier_name: entry.supplierName,
      fabric_name: entry.fabricName,
      fabric_type: entry.fabricType,
      ordered_qty: entry.orderedQty,
      received_qty: entry.receivedQty,
      unit: entry.unit,
      rate_per_unit: entry.ratePerUnit,
      discount: entry.discount ?? 0,
      discount_type: sanitizeDiscountType(entry.discountType),
      total_amount: entry.totalAmount,
      status: entry.status,
      sent_for_dyeing: entry.sentForDyeing,
      sent_for_printing: entry.sentForPrinting,
      balance_in_stock: entry.balanceInStock,
      thaan_lengths: entry.thaanLengths ?? [],
      l_value: entry.lValue ?? 100,
      actual_fabric_qty: entry.actualFabricQty ?? entry.receivedQty,
      gst_slab: entry.gstSlab ?? 0,
      remarks: entry.remarks || '',
      created_by: entry.createdBy || null,
    };
    const { data, error } = await supabase
      .from('grey_fabric_purchases')
      .insert(row)
      .select()
      .single();
    if (error) {
      console.error('greyFabricService.insert error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data: rowToPurchase(data) };
  },

  async update(id: string, updates: Partial<GreyFabricPurchase>): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    const row: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updates.purchaseNo !== undefined) row.purchase_no = updates.purchaseNo;
    if (updates.date !== undefined) row.date = updates.date;
    if (updates.supplierName !== undefined) row.supplier_name = updates.supplierName;
    if (updates.fabricName !== undefined) row.fabric_name = updates.fabricName;
    if (updates.fabricType !== undefined) row.fabric_type = updates.fabricType;
    if (updates.orderedQty !== undefined) row.ordered_qty = updates.orderedQty;
    if (updates.receivedQty !== undefined) row.received_qty = updates.receivedQty;
    if (updates.unit !== undefined) row.unit = updates.unit;
    if (updates.ratePerUnit !== undefined) row.rate_per_unit = updates.ratePerUnit;
    if (updates.discount !== undefined) row.discount = updates.discount;
    if (updates.discountType !== undefined) row.discount_type = sanitizeDiscountType(updates.discountType);
    if (updates.totalAmount !== undefined) row.total_amount = updates.totalAmount;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.sentForDyeing !== undefined) row.sent_for_dyeing = updates.sentForDyeing;
    if (updates.sentForPrinting !== undefined) row.sent_for_printing = updates.sentForPrinting;
    if (updates.balanceInStock !== undefined) row.balance_in_stock = updates.balanceInStock;
    if (updates.thaanLengths !== undefined) row.thaan_lengths = updates.thaanLengths;
    if (updates.lValue !== undefined) row.l_value = updates.lValue;
    if (updates.actualFabricQty !== undefined) row.actual_fabric_qty = updates.actualFabricQty;
    if (updates.gstSlab !== undefined) row.gst_slab = updates.gstSlab;
    if (updates.remarks !== undefined) row.remarks = updates.remarks;

    const { error } = await supabase
      .from('grey_fabric_purchases')
      .update(row)
      .eq('id', id);
    if (error) {
      console.error('greyFabricService.update error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    const { error } = await supabase
      .from('grey_fabric_purchases')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('greyFabricService.delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /** Get next purchase number based on current count */
  async getNextPurchaseNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('grey_fabric_purchases')
      .select('*', { count: 'exact', head: true });
    return `GF-${String((count || 0) + 1).padStart(4, '0')}`;
  },
};
