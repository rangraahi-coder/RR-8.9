'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Eye,X,ArrowLeft} from 'lucide-react';
import {supabase} from '@/lib/supabase/client';
import {erpErrorMessage} from '@/lib/erpError';
import VoucherHistory,{auditTime,fieldLabel} from './VoucherHistory';
type Ref={table:string;id:string;label?:string;direction?:string};
type Detail={record:Record<string,unknown>;lines:Record<string,unknown>[];links:Ref[];lock_reason:string|null};
const hidden=new Set(['id','legacy_id','request_payload','created_at','updated_at','created_by','updated_by']);
function Value({value}:{value:unknown}){
 if(value===null||value===undefined||value==='')return <span className="text-muted-foreground">Not recorded</span>;
 if(Array.isArray(value))return value.length?<div className="space-y-2">{value.map((v,i)=><div key={i} className="border rounded p-2"><Value value={v}/></div>)}</div>:<span>None</span>;
 if(typeof value==='object')return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">{Object.entries(value as Record<string,unknown>).filter(([k])=>!hidden.has(k)).map(([k,v])=><div key={k}><dt className="text-xs text-muted-foreground">{fieldLabel(k)}</dt><dd className="break-words"><Value value={v}/></dd></div>)}</dl>;
 return <span>{typeof value==='boolean'?(value?'Yes':'No'):String(value)}</span>;
}
export function VoucherDetailPanel({table,recordId,onNavigate}:{table:string;recordId:string;onNavigate?:(ref:Ref)=>void}){
 const [data,setData]=useState<Detail|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let current=true;setLoading(true);setError('');setData(null);void (async()=>{try{const result=await supabase.rpc('erp_voucher_detail',{p_table:table,p_record_id:recordId});if(result.error)throw result.error;if(current)setData(result.data);}catch(e){if(current)setError(erpErrorMessage(e));}finally{if(current)setLoading(false);}})();return()=>{current=false};},[table,recordId,retry]);
 if(loading)return <p role="status" className="p-4">Loading voucher details… / विवरण लोड हो रहा है</p>;
 if(error)return <div role="alert" className="p-4 text-red-700">{error}<button type="button" onClick={()=>setRetry(x=>x+1)} className="underline ml-3">Retry</button></div>;
 if(!data)return null;
 const d=data.record;const ref=d.voucher_no||d.entry_no||d.vch_no||d.receipt_no||d.issue_no||d.job_card_no||d.purchase_no||d.dispatch_no;
 return <div className="space-y-4 text-sm"><div><h3 className="font-bold">{String(ref||'Entry details')}</h3><p className="text-xs text-muted-foreground">Created by {String(d.created_by||'user not recorded')} · {auditTime(d.created_at)}</p>{!!d.updated_at&&<p className="text-xs text-muted-foreground">Last updated by {String(d.updated_by||'user not recorded')} · {auditTime(d.updated_at)}</p>}</div>{data.lock_reason&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">{data.lock_reason}</p>}<Value value={d}/>{!d.job_card_id&&!d.job_card_ref&&<p className="text-muted-foreground text-xs">Job Card: not linked on this entry. Related usage, if recorded, appears below.</p>}{data.lines.length>0&&<section><h4 className="font-semibold mb-2">Components / Voucher lines</h4><Value value={data.lines}/></section>}{data.links.length>0&&<section><h4 className="font-semibold">Related vouchers</h4><div className="flex flex-wrap gap-2 mt-2">{data.links.map((l,i)=>onNavigate?<button type="button" key={i} className="text-primary underline text-left" onClick={()=>onNavigate(l)}>{l.direction}: {l.label} · {fieldLabel(l.table)}</button>:<VoucherDetails key={i} table={l.table} recordId={l.id} label={`${l.direction}: ${l.label}`}/>)}</div></section>}<VoucherHistory key={`${table}:${recordId}`} table={table} recordId={recordId}/></div>;
}
export default function VoucherDetails({table,recordId,label='View',className=''}:{table:string;recordId:string;label?:string;className?:string}){
 const [stack,setStack]=useState<Ref[]>([]);const selected=stack.at(-1);
 return <><button type="button" title="View complete voucher and entry history" className={`inline-flex items-center gap-1 text-xs text-primary hover:underline ${className}`} onClick={e=>{e.stopPropagation();setStack([{table,id:recordId}]);}}><Eye size={14}/>{label}</button>{selected&&typeof document!=='undefined'&&createPortal(<div className="erp-modal-enter fixed inset-0 z-[120] bg-black/45 p-3 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Voucher details" onClick={e=>e.stopPropagation()}><section className="bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90dvh] flex flex-col"><header className="flex items-center justify-between gap-3 border-b p-4"><div className="flex items-center gap-3">{stack.length>1&&<button type="button" aria-label="Previous voucher" onClick={()=>setStack(s=>s.slice(0,-1))}><ArrowLeft size={18}/></button>}<h2 className="font-bold">Voucher View</h2></div><button type="button" aria-label="Close voucher view" onClick={()=>setStack([])}><X size={20}/></button></header><div className="overflow-auto p-4 sm:p-6"><VoucherDetailPanel table={selected.table} recordId={selected.id} onNavigate={ref=>setStack(s=>[...s,ref])}/></div></section></div>,document.body)}</>;
}
