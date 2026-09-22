'use client';
import {useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {erpErrorMessage} from '@/lib/erpError';
export type EditableReceipt={id:string;receipt_no:string;date:string;updated_at:string;processed_fabric_name:string|null;shrinkage_percent:number|null;remarks:string|null;roll_details:{qty:number;roll_no?:string;remarks?:string}[]};
export default function ReceiptEditDialog({receipt,onClose,onSaved}:{receipt:EditableReceipt;onClose:()=>void;onSaved:()=>void}){
 const [date,setDate]=useState(receipt.date),[name,setName]=useState(receipt.processed_fabric_name||''),[pct,setPct]=useState(String(receipt.shrinkage_percent??0)),[remarks,setRemarks]=useState(receipt.remarks||'');
 const [rolls,setRolls]=useState(receipt.roll_details.map(r=>({...r,qty:String(r.qty)}))),[busy,setBusy]=useState(false),[error,setError]=useState('');const active=useRef(false);
 async function save(e:React.FormEvent){e.preventDefault();if(active.current)return;active.current=true;setBusy(true);setError('');try{
  const {data,error:err}=await createClient().rpc('erp_mutate_printer_receipt',{p_id:receipt.id,p_expected_updated_at:receipt.updated_at,p_changes:{date,processed_fabric_name:name,shrinkage_percent:Number(pct),remarks,rolls:rolls.map(r=>({...r,qty:Number(r.qty)}))}});
  if(err)throw err;if(data!==receipt.id)throw new Error('Receipt update was not confirmed.');onSaved();
 }catch(e){setError(erpErrorMessage(e));}finally{active.current=false;setBusy(false)}}
 return <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-3"><form onSubmit={save} role="dialog" aria-modal="true" aria-label="Edit fabric receipt" className="bg-card border rounded-xl p-4 w-full max-w-xl max-h-[90dvh] overflow-auto space-y-3">
 <h2 className="font-bold">Edit {receipt.receipt_no}</h2><p className="text-sm">Only unused rolls can be changed. Receipt, roll stock and linked balances are saved together.</p>
 <label className="block">Date<input className="block w-full border rounded p-2" type="date" required value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
 <label className="block">Finished fabric<input className="block w-full border rounded p-2" required value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
 <label className="block">Shrinkage %<input className="block w-full border rounded p-2" type="number" min="0" max="100" step="any" required value={pct} disabled={busy} onChange={e=>setPct(e.target.value)}/></label>
 {rolls.map((r,index)=><label className="block" key={index}>{r.roll_no||`Roll ${index+1}`} · Metres<input className="block w-full border rounded p-2" type="number" min="0.001" step="0.001" required value={r.qty} disabled={busy} onChange={e=>setRolls(current=>current.map((v,i)=>i===index?{...v,qty:e.target.value}:v))}/></label>)}
 <label className="block">Remarks<textarea className="block w-full border rounded p-2" value={remarks} disabled={busy} onChange={e=>setRemarks(e.target.value)}/></label>
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className="btn-primary">{busy?'Saving…':'Save receipt'}</button></div>
 </form></div>;
}
