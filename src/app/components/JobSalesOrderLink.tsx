'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {createClient} from '@/lib/supabase/client';
import {VoucherDetailPanel} from '@/components/VoucherDetails';

export default function JobSalesOrderLink({job}:{job:Record<string,any>}){
 const [open,setOpen]=useState(false),[orderId,setOrderId]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!open)return;
  let alive=true;setError('');setOrderId('');setLoading(true);
  async function resolve(){
   try{
    // An explicit source identity wins. Never substitute a similarly named order.
    if(job.sales_order_id){if(alive)setOrderId(String(job.sales_order_id));return;}
    if(!job.job_card_no)throw Error('No Sales Order is linked to this Job Card.');
    const {data,error}=await createClient().from('sales_orders').select('id').eq('job_card_no',job.job_card_no).limit(2);
    if(error)throw error;
    if(data?.length!==1)throw Error(data?.length?'Multiple Sales Orders reference this Job Card. Review the source link.':'No accessible Sales Order is linked to this Job Card.');
    if(alive)setOrderId(data[0].id);
   }catch(e){if(alive)setError((e as Error).message);}finally{if(alive)setLoading(false);}
  }
  void resolve();return()=>{alive=false;};
 },[open,job.sales_order_id,job.job_card_no]);
 return <><button type="button" className="text-xs text-primary underline mt-1" onClick={()=>setOpen(true)}>View Sales Order</button>{open&&typeof document!=='undefined'&&createPortal(<div className="fixed inset-0 z-[120] bg-black/45 p-3 flex items-center justify-center" onClick={()=>setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Sales Order" className="bg-card rounded-xl p-4 w-full max-w-3xl max-h-[90dvh] overflow-auto" onClick={e=>e.stopPropagation()}><button autoFocus type="button" className="btn-secondary float-right" onClick={()=>setOpen(false)}>Close</button><h2 className="font-semibold mb-4">Sales Order · {job.job_card_no}</h2>{loading?<p role="status">Loading Sales Order…</p>:error?<p role="alert" className="text-red-600">{error}</p>:orderId?<VoucherDetailPanel table="sales_orders" recordId={orderId}/>:null}</section></div>,document.body)}</>;
}
