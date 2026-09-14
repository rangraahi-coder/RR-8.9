import { createClient } from '@/lib/supabase/client';


export interface DispatchVoucher {
  id: string;
  dispatchNo: string;
  dispatchDate: string;
  partyName: string;
  jobCardRef: string;
  styleName?: string;
  finishedGoodsId?: string;
  itemName?: string;
  colour?: string;
  size?: string;
  orderedPieces: number;
  dispatchedPieces: number;
  vehicleNo?: string;
  driverName?: string;
  invoiceNo?: string;
  referencePo?: string;
  remarks?: string;
  status: string;
  createdBy?: string | null;
  createdAt?: string;
}

function rowToVoucher(row: any): DispatchVoucher {
  return {
    id: row.id,
    dispatchNo: row.dispatch_no || '',
    dispatchDate: row.dispatch_date || '',
    partyName: row.party_name || '',
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || undefined,
    finishedGoodsId: row.finished_goods_id || undefined,
    itemName: row.item_name || undefined,
    colour: row.colour || undefined,
    size: row.size || undefined,
    orderedPieces: row.ordered_pieces || 0,
    dispatchedPieces: row.dispatched_pieces || 0,
    vehicleNo: row.vehicle_no || undefined,
    driverName: row.driver_name || undefined,
    referencePo: row.reference_po || undefined,
    invoiceNo: row.invoice_no || undefined,
    remarks: row.remarks || undefined,
    status: row.status || 'dispatched',
    createdBy: row.created_by || null,
    createdAt: row.created_at || '',
  };
}

export const dispatchService = {
  async cancel(id:string,reason:string){const {error}=await createClient().rpc('erp_cancel_dispatch',{p_id:id,p_reason:reason});if(error)throw error;window.dispatchEvent(new Event('erp-data-changed'));},
  async getNextDispatchNo(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('dispatch_vouchers')
      .select('*', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    return `DISP-${String(num).padStart(4, '0')}`;
  },

  async getAll(): Promise<DispatchVoucher[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('dispatch_vouchers')
      .select('*')
      .order('created_at', { ascending: false });
    if(error)throw error;
    return (data || []).map(rowToVoucher);
  },

  async create(
    voucher: {
      dispatchDate: string;
      partyName: string;
      jobCardRef?: string;
      styleName?: string;
      finishedGoodsId?: string;
      itemName?: string;
      colour?: string;
      size?: string;
      orderedPieces: number;
      dispatchedPieces: number;
      vehicleNo?: string;
      driverName?: string;
      invoiceNo?: string;
  referencePo?: string;
      remarks?: string;
    },
    username?: string | null,
    requestId?: string
  ): Promise<DispatchVoucher | null> {
    const supabase = createClient();


    const { data, error } = await supabase
      .rpc('save_original_dispatch',{p_id:requestId||crypto.randomUUID(),p_voucher:{
        dispatch_date: voucher.dispatchDate,
        party_name: voucher.partyName,
        job_card_ref: voucher.jobCardRef || null,
        style_name: voucher.styleName || null,
        finished_goods_id: voucher.finishedGoodsId || null,
        item_name: voucher.itemName || null,
        colour: voucher.colour || null,
        size: voucher.size || null,
        ordered_pieces: voucher.orderedPieces,
        dispatched_pieces: voucher.dispatchedPieces,
        vehicle_no: voucher.vehicleNo || null,
        driver_name: voucher.driverName || null,
        reference_po: voucher.referencePo || null,
        invoice_no: voucher.invoiceNo || null,
        remarks: voucher.remarks || null,
        status: 'dispatched',
        created_by: username || null,
      }});

    if(error)throw error;
    if(!data)throw new Error('Dispatch was not saved');
    window.dispatchEvent(new Event('erp-data-changed'));

    return rowToVoucher(data);
  },
};
