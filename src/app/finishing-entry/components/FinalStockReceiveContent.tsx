'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {useAuth} from '@/contexts/AuthContext';
import SearchableSelect from '@/components/SearchableSelect';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
type Assembly={id:string;voucher_no:string;job_card_ref:string;final_item_name:string;size:string;colour:string;total_sets_assembled:number;received_qty:number};
type Receipt={id:string;voucher_no:string;voucher_date:string;assembly_id:string;quantity:number;remarks:string;revision:number;item_name:string;job_card_ref:string;assembly_no:string;size:string;colour:string};
export default function FinalStockReceiveContent(){
 const {can}=useAuth();const [assemblies,setAssemblies]=useState<Assembly[]>([]),[receipts,setReceipts]=useState<Receipt[]>([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
 const [assembly,setAssembly]=useState(''),[qty,setQty]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[remarks,setRemarks]=useState('');
 const [edit,setEdit]=useState<Receipt|null>(null),[remove,setRemove]=useState<Receipt|null>(null);
 const lock=useRef(false),request=useRef('');const generation=useRef(0);
 async function load(){const n=++generation.current;try{const {data,error}=await createClient().rpc('erp_final_stock_options');if(error)throw error;if(n===generation.current){setAssemblies(data.assemblies||[]);setReceipts(data.receipts||[]);}}catch(e){setError((e as Error).message);}finally{if(n===generation.current)setLoading(false);}}
 useEffect(()=>{void load();return()=>{generation.current++;};},[]);
 useRealtimeTable('final_stock_receipts',load);useRealtimeTable('component_assembly_vouchers',load);
 const selected=assemblies.find(a=>a.id===assembly);
 const pending=selected?selected.total_sets_assembled-Number(selected.received_qty)+(edit?.quantity||0):0;
 function start(r?:Receipt){setError('');setEdit(r||null);setAssembly(r?.assembly_id||'');setQty(r?String(r.quantity):'');setDate(r?.voucher_date||new Date().toISOString().slice(0,10));setRemarks(r?.remarks||'');request.current=r?.id||crypto.randomUUID();setOpen(true);}
 async function save(){if(lock.current)return;if(!selected||!date||!Number.isSafeInteger(Number(qty))||Number(qty)<=0||Number(qty)>pending){setError('Select assembly, date and a positive whole quantity within the pending balance.');return;}
 lock.current=true;setBusy(true);setError('');try{const {data,error}=await createClient().rpc('erp_save_final_stock',{p_id:request.current,p_assembly:assembly,p_date:date,p_qty:Number(qty),p_remarks:remarks,p_revision:edit?.revision??null});if(error)throw error;if(!data?.id)throw Error('Database confirmation missing; check receipts before retrying.');setOpen(false);await load();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 async function deleteReceipt(){if(!remove||lock.current)return;lock.current=true;setBusy(true);setError('');try{const {error}=await createClient().rpc('erp_delete_final_stock',{p_id:remove.id,p_revision:remove.revision});if(error)throw error;setRemove(null);await load();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <div className="p-4 sm:p-6 space-y-4"><div className="flex flex-wrap gap-3 justify-between"><div><h1 className="text-xl font-bold">Final Stock Receive</h1><p className="text-sm text-muted-foreground">Receive assembled items into Ready Goods.</p></div>{can('finishing','create')&&<button className="btn-primary" onClick={()=>start()}>New Receive</button>}</div>
 <a href="/finished-goods" className="text-primary underline">View Ready Goods</a>
 {error&&!open&&!remove&&<p role="alert" className="text-danger">{error}</p>}
 {loading?<p>Loading…</p>:<><p>Pending receipt: {assemblies.reduce((n,a)=>n+Math.max(0,a.total_sets_assembled-Number(a.received_qty)),0)} items</p>
 {receipts.length===0&&<p>No final stock receipts yet. Earlier assemblies already posted to Ready Goods are not received again.</p>}
 {receipts.map(r=><article key={r.id} className="border rounded-xl p-4"><p className="font-semibold">{r.item_name} · {r.quantity} items</p><p className="text-sm">{r.voucher_no} · {r.voucher_date} · {r.assembly_no} · {r.job_card_ref} · {r.size} · {r.colour}</p><p className="whitespace-pre-wrap text-sm">{r.remarks}</p><div className="flex gap-4 mt-2">{can('finishing','edit')&&<button className="text-primary underline" onClick={()=>start(r)}>Edit</button>}{can('finishing','delete')&&<button className="text-danger underline" onClick={()=>{setError('');setRemove(r);}}>Delete</button>}</div></article>)}</>}
 {open&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"><form onInvalidCapture={e=>setError((e.target as HTMLInputElement).validationMessage)} onSubmit={e=>{e.preventDefault();void save();}} className="bg-white rounded-xl p-5 max-w-xl w-full max-h-[90vh] overflow-auto space-y-4"><h2 className="font-bold">{edit?'Edit':'New'} Final Stock Receive</h2>
 <label className="block">Assembled Item<SearchableSelect required disabled={busy||!!edit} value={assembly} onChange={e=>{setAssembly(e.target.value);setQty('');}} className="input-field w-full"><option value="">Select Assembly</option>{assemblies.filter(a=>a.total_sets_assembled>Number(a.received_qty)||a.id===edit?.assembly_id).map(a=><option key={a.id} value={a.id}>{a.final_item_name} · {a.voucher_no} · {a.job_card_ref} · {a.size} · {a.colour}</option>)}</SearchableSelect></label>
 {selected&&<p className="text-sm">Job Card: {selected.job_card_ref} · Size: {selected.size||'—'} · Colour: {selected.colour||'—'} · Pending: {pending}</p>}
 <label className="block">Receive Date<input required type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)} className="input-field w-full"/></label>
 <label className="block">Received items<input required type="number" min="1" step="1" max={pending} disabled={busy} value={qty} onChange={e=>setQty(e.target.value)} className="input-field w-full"/></label>
 <label className="block">Remarks<textarea value={remarks} disabled={busy} onChange={e=>setRemarks(e.target.value)} className="input-field w-full"/></label>
 {error&&<p role="alert" className="text-danger">{error}</p>}<div className="flex gap-3"><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="btn-secondary">Cancel</button><button disabled={busy} className="btn-primary">{busy?'Saving…':'Save Receive'}</button></div></form></div>}
 {remove&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3"><section className="bg-white rounded-xl p-5 max-w-md space-y-4"><h2>Delete {remove.voucher_no}?</h2><p>Its quantity will leave Ready Goods and return to pending assembly receipt. Dispatched stock cannot be deleted.</p>{error&&<p role="alert" className="text-danger">{error}</p>}<button disabled={busy} className="btn-secondary" onClick={()=>setRemove(null)}>Cancel</button><button disabled={busy} className="btn-primary ml-3" onClick={()=>void deleteReceipt()}>Delete</button></section></div>}
 </div>;
}
