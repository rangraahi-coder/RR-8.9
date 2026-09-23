'use client';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {createClient} from '@/lib/supabase/client';
import {errorReferences} from '@/lib/errorReferences';
import {VoucherDetailPanel} from './VoucherDetails';

type RecordRef={table:string;id:string;label:string};
/** Resolve only an exact, unique voucher reference, under the current user's RLS. */
export default function ErrorReferenceLinks({message,record}:{message:string;record?:RecordRef}) {
 const [selected,setSelected]=useState<RecordRef|null>(null),[busy,setBusy]=useState(''),[reason,setReason]=useState('');
 const refs=errorReferences(message);
 async function open(ref:typeof refs[number]) {
  if(busy)return;
  setBusy(ref.reference);setReason('');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try {
   const result=await createClient().from(ref.table).select('id').eq(ref.field,ref.reference).limit(2).abortSignal(controller.signal);
   if(result.error||result.data?.length!==1){setReason('This reference is not uniquely available to your account. Ask the Owner to check it.');return;}
   setSelected({table:ref.table,id:result.data[0].id,label:ref.reference});
  }catch{setReason('Could not open this reference. Check your connection and try again.');}
  finally{clearTimeout(timer);setBusy('');}
 }
 return <>
  <div className="flex flex-wrap gap-x-3 gap-y-2 mt-2">
   {refs.map(ref=><button type="button" key={ref.reference} disabled={!!busy} className="text-primary underline text-left" onClick={()=>void open(ref)}>{busy===ref.reference?'Opening…':`Open ${ref.reference}`}</button>)}
   {record&&<button type="button" className="text-primary underline text-left" onClick={()=>setSelected(record)}>View affected voucher · {record.label}</button>}
  </div>
  {reason&&<p role="status" className="text-xs mt-2">{reason}</p>}
  {selected&&typeof document!=='undefined'&&createPortal(<div className="fixed inset-0 z-[20000] bg-black/45 p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Error reference details"><section className="bg-card rounded-2xl w-full max-w-3xl max-h-[90dvh] flex flex-col"><header className="p-4 border-b flex justify-between gap-3"><strong>{selected.label}</strong><button type="button" onClick={()=>setSelected(null)}>Close</button></header><div className="p-4 overflow-auto"><VoucherDetailPanel key={`${selected.table}:${selected.id}`} table={selected.table} recordId={selected.id} onNavigate={ref=>setSelected({table:ref.table,id:ref.id,label:ref.label||'Related voucher'})}/></div></section></div>,document.body)}
 </>;
}
