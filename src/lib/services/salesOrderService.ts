import { createClient } from '@/lib/supabase/client';
import { SalesOrder, SalesOrderItem } from '@/app/sales-orders/data/salesOrdersData';


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

function rowToOrder(row: any, items: SalesOrderItem[] = []): SalesOrder {
  // Format date from ISO (YYYY-MM-DD) to DD-MM-YYYY for display consistency
  let displayDate = row.order_date || '';
  if (displayDate && displayDate.includes('-') && displayDate.length === 10) {
    const parts = displayDate.split('-');
    if (parts[0].length === 4) {
      // ISO format YYYY-MM-DD → DD-MM-YYYY
      displayDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return {
    id: row.id,
    date: displayDate,
    vchNo: row.vch_no,
    partyName: row.party_name,
    partyType: row.party_type as 'external' | 'self',
    items,
    totalQty: row.total_qty || 0,
    totalAmount: Number(row.total_amount) || 0,
    jobCardNo: row.job_card_no || '',
    status: row.status as 'pending' | 'in_production' | 'completed',
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function itemRowToItem(row: any): SalesOrderItem {
  return {
    itemName: row.item_name,
    paramSize: row.param_size || '',
    paramColour: row.param_colour || '',
    qty: row.qty || 0,
    unit: row.unit || 'Pcs.',
    price: Number(row.price) || 0,
    amount: Number(row.amount) || 0,
  };
}

export const salesOrderService = {
  async getAll(): Promise<SalesOrder[]> {
    const supabase = createClient();
    try {
      const { data: orders, error } = await supabase
        .from('sales_orders')
        .select('*, sales_order_items(*)')
        .order('created_at', { ascending: false });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (orders || []).map((row) =>
        rowToOrder(row, (row.sales_order_items || []).map(itemRowToItem))
      );
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return [];
    }
  },

  async create(order: Omit<SalesOrder, 'id'>, username?: string | null): Promise<SalesOrder | null> {
    const supabase = createClient();
    try {
      // Ensure date is stored as ISO YYYY-MM-DD in Supabase
      // If date comes in as DD-MM-YYYY, convert it; if already ISO, keep it
      let isoDate = order.date;
      if (isoDate && isoDate.includes('-') && isoDate.length === 10) {
        const parts = isoDate.split('-');
        if (parts[0].length === 2) {
          // DD-MM-YYYY → YYYY-MM-DD
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      const {data:orderRow,error}=await supabase.rpc('save_original_sales_order',{
        p_id:null,p_header:{order_date:isoDate,vch_no:order.vchNo,party_name:order.partyName,party_type:order.partyType,total_qty:order.totalQty,total_amount:order.totalAmount,job_card_no:order.jobCardNo,status:order.status,created_by:username||null,updated_by:username||null},
        p_lines:order.items.map(item=>({item_name:item.itemName,param_size:item.paramSize,param_colour:item.paramColour||'',qty:item.qty,unit:item.unit,price:item.price,amount:item.amount}))
      });
      if(error)throw error;
      return rowToOrder(orderRow, order.items);
    } catch (error: any) {
      console.error('Sales order create exception:', error);
      throw error;
    }
  },

  async updateStatus(id: string, status: SalesOrder['status'], username?: string | null): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ status, updated_at: new Date().toISOString(), updated_by: username || null })
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
   * Recalculate a sales order's status based on its active job cards.
   * Calls the DB function directly — useful when you need to force a sync
   * from the application layer (e.g. after a bulk operation).
   * In normal flow the DB trigger handles this automatically.
   */
  async recalculateStatus(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc('recalculate_sales_order_status', {
        p_sales_order_id: id,
      });
      if (error) {
        console.error('[salesOrderService.recalculateStatus] error:', error);
        return false;
      }
      return true;
    } catch (error: any) {
      console.error('[salesOrderService.recalculateStatus] exception:', error);
      return false;
    }
  },

  async update(id: string, order: Omit<SalesOrder, 'id'>, username?: string | null): Promise<SalesOrder | null> {
    const supabase = createClient();
    try {
      let isoDate = order.date;
      if (isoDate && isoDate.includes('-') && isoDate.length === 10) {
        const parts = isoDate.split('-');
        if (parts[0].length === 2) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
      const {data:orderRow,error}=await supabase.rpc('save_original_sales_order',{
        p_id:id,p_header:{order_date:isoDate,vch_no:order.vchNo,party_name:order.partyName,party_type:order.partyType,total_qty:order.totalQty,total_amount:order.totalAmount,job_card_no:order.jobCardNo,status:order.status,updated_by:username||null},
        p_lines:order.items.map(item=>({item_name:item.itemName,param_size:item.paramSize,param_colour:item.paramColour||'',qty:item.qty,unit:item.unit,price:item.price,amount:item.amount}))
      });
      if(error)throw error;
      return rowToOrder(orderRow, order.items);
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      // Delete items first (foreign key)
      await supabase.from('sales_order_items').delete().eq('sales_order_id', id);
      const { error } = await supabase.from('sales_orders').delete().eq('id', id);
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

  async seedFromLocal(orders: SalesOrder[]): Promise<void> {
    const supabase = createClient();
    try {
      const { count } = await supabase
        .from('sales_orders').select('*', { count: 'exact', head: true });
      if ((count || 0) > 0) return;
      for (const order of orders) {
        const { data: orderRow, error } = await supabase
          .from('sales_orders')
          .insert({
            legacy_id: order.id,
            order_date: order.date,
            vch_no: order.vchNo,
            party_name: order.partyName,
            party_type: order.partyType,
            total_qty: order.totalQty,
            total_amount: order.totalAmount,
            job_card_no: order.jobCardNo,
            status: order.status,
          })
          .select()
          .single();
        if (!error && orderRow && order.items?.length) {
          const itemRows = order.items.map((item) => ({
            sales_order_id: orderRow.id,
            item_name: item.itemName,
            param_size: item.paramSize,
            param_colour: item.paramColour || '',
            qty: item.qty,
            unit: item.unit,
            price: item.price,
            amount: item.amount,
          }));
          await supabase.from('sales_order_items').insert(itemRows);
        }
      }
    } catch (error: any) {
      console.log('Sales order seed error:', error.message);
    }
  },
};
