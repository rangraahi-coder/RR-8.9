'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {createClient} from '@/lib/supabase/client';
import {erpErrorMessage} from '@/lib/erpError';
import VoucherDetails from '@/components/VoucherDetails';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import {printerReceiptTotals} from '@/lib/printerReceiptTotals';

type Receipt={id:string;receipt_no:string;date:string;qty_received:number;grey_consumed:number|null;shrinkage:number|null;shortage:number|null;processed_fabric_name:string|null};
type Issue={id:string;issue_no:string;printer_account:string;fabric_name:string;qty_issued:number;qty_received:number;qty_actual_received:number|null;qty_pending:number};
const qty=(n:number)=>n.toLocaleString('en-IN',{minimumFractionDigits:3,maximumFractionDigits:3});
export default function PrinterQuantityDetails({issueId,onClose}:{issueId:string;onClose:()=>void}){
 const [data,setData]=useState<{issue:Issue;receipts:Receipt[]}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const version=useRef(0);
 const refresh=useCallback(async()=>{
  const run=++version.current;setLoading(true);setError('');
  try{
   const db=createClient();
   const result=await db.from('printer_fabric_issues').select('id,issue_no,printer_account,fabric_name,qty_issued,qty_received,qty_actual_received,qty_pending').eq('id',issueId).single();
   if(result.error)throw result.error;
   const receipts:Receipt[]=[];
   for(let from=0;;from+=1000){
    const page=await db.from('printer_fabric_receipts').select('id,receipt_no,date,qty_received,grey_consumed,shrinkage,shortage,processed_fabric_name').eq('issue_id',issueId).order('id').range(from,from+999);
    if(page.error)throw page.error;
    receipts.push(...(page.data||[]));if((page.data||[]).length<1000)break;
   }
   if(run===version.current)setData({issue:result.data,receipts});
  }catch(e){if(run===version.current)setError(erpErrorMessage(e));}
  finally{if(run===version.current)setLoading(false);}
 },[issueId]);
 useEffect(()=>{void refresh();return()=>{++version.current}},[refresh]);
 useRealtimeTable('printer_fabric_receipts',refresh);useRealtimeTable('printer_fabric_issues',refresh);
 const totals=printerReceiptTotals(data?.receipts||[]);
 const mismatch=data&&(Math.abs(totals.received-Number(data.issue.qty_actual_received??data.issue.qty_received))>0.001||Math.abs(totals.consumed-Number(data.issue.qty_received))>0.001);
 return createPortal(<div role="dialog" aria-modal="true" aria-label="Printer quantity voucher breakdown" className="fixed inset-0 z-[100] bg-black/50 p-3 flex items-center justify-center">
  <section className="bg-card rounded-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col shadow-xl">
   <header className="p-4 border-b flex justify-between gap-3"><h2 className="font-bold">Issued / Received — Voucher breakdown</h2><button type="button" onClick={onClose}>Close</button></header>
   <div className="p-4 overflow-auto space-y-4">
    {loading&&<p role="status">Refreshing voucher quantities…</p>}
    {error&&<p role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={()=>void refresh()}>Retry</button></p>}
    {data&&<>
     <p className="font-semibold">{data.issue.issue_no} · {data.issue.printer_account} · {data.issue.fabric_name}</p>
     <div className="rounded-lg border p-3"><p>Issued: <VoucherDetails table="printer_fabric_issues" recordId={issueId} label={`${qty(Number(data.issue.qty_issued))} Mt. — ${data.issue.issue_no}`}/></p></div>
     {mismatch&&<p role="alert" className="bg-amber-50 text-amber-900 rounded-lg p-3">The linked receipt totals do not match the stored ledger counters. Refresh once; if this remains, the records need reconciliation. No quantity has been automatically changed.</p>}
     <p className="text-sm">Only receipts linked to this exact issue are listed. Received is physical fabric; grey consumed includes the receipt's recorded shrinkage/shortage. Pending = issued − grey consumed.</p>
     {data.receipts.length===0?<p>No linked receipt vouchers found.</p>:data.receipts.map(r=><article key={r.id} className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><VoucherDetails table="printer_fabric_receipts" recordId={r.id} label={r.receipt_no}/><span>{r.date}</span></div>
      <p className="text-sm">{r.processed_fabric_name||'Finished fabric'}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm"><div><dt>Received</dt><dd>{qty(Number(r.qty_received))} Mt.</dd></div><div><dt>Recorded shrinkage / shortage</dt><dd>{qty(Number(r.shrinkage||0)+Number(r.shortage||0))} Mt.</dd></div><div><dt>Grey consumed</dt><dd>{qty(printerReceiptTotals([r]).consumed)} Mt.</dd></div></dl>
     </article>)}
     <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 font-semibold"><p>Receipt total: {qty(totals.received)} Mt.</p><p>Grey consumed: {qty(totals.consumed)} Mt.</p><p>Calculated pending: {qty(Number(data.issue.qty_issued)-totals.consumed)} Mt.</p></div>
     <p className="text-xs text-muted-foreground">Stored ledger: Received {qty(Number(data.issue.qty_actual_received??data.issue.qty_received))} Mt. · Pending {qty(Number(data.issue.qty_pending))} Mt.</p>
    </>}
   </div>
  </section>
 </div>,document.body);
}
