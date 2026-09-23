'use client';
import React,{useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {erpErrorMessage} from '@/lib/erpError';
import {JobCard} from './JobCardContent';

export default function JobStitchingRatesModal({job,onClose}:{job:JobCard;onClose:()=>void}) {
 const [rows,setRows]=useState<{component:string;rate:string}[]>([]);
 const [revision,setRevision]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  createClient().rpc('erp_job_stitching_prices',{p_job_id:job.id}).abortSignal(controller.signal).then(({data,error})=>{if(!active)return;if(error){setError(erpErrorMessage(error));return;}setRows(Object.entries(data.rates||{}).map(([component,rate])=>({component,rate:String(rate)})));setRevision(Number(data.revision));}).then(()=>clearTimeout(timer),e=>{clearTimeout(timer);if(active)setError(erpErrorMessage(e));});
  return()=>{active=false;clearTimeout(timer);controller.abort();};},[job.id]);
 async function save(){if(busy||revision===null)return;setBusy(true);setError('');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try{const rates:Record<string,number>={};for(const r of rows){const key=r.component.trim();if(!key||!r.rate.trim()||!Number.isFinite(Number(r.rate))||Number(r.rate)<=0)throw new Error('Enter a component name and positive rate for every row.');if(Object.keys(rates).some(k=>k.toLowerCase()===key.toLowerCase()))throw new Error('Duplicate component name.');rates[key]=Number(r.rate);}
   const {data,error}=await createClient().rpc('erp_set_job_stitching_prices',{p_job_id:job.id,p_rates:rates,p_revision:revision}).abortSignal(controller.signal);if(error)throw error;if(!data||data.revision===revision)throw new Error('Rate save was not confirmed. Reopen to verify.');onClose();
  }catch(e){setError(controller.signal.aborted?'Save confirmation timed out. Close and reopen to check the saved rates before retrying.':erpErrorMessage(e));}finally{clearTimeout(timer);setBusy(false);}
 }
 return <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-label="Edit Stitching Rates" className="bg-card rounded-xl p-5 w-full max-w-xl max-h-[85vh] overflow-auto space-y-4">
  <h2 className="font-semibold">{job.jobCardNo} · Edit Stitching Rates</h2>
  <p className="text-sm">Rates apply to future Stitching vouchers. Saved vouchers keep their agreed rates. Locked Job Card quantities and details stay protected.</p>
  {revision===null&&!error&&<p>Loading rates…</p>}
  {rows.map((r,i)=><div key={i} className="flex flex-wrap gap-2"><input aria-label={`Component ${i+1}`} className="input-field flex-1 min-w-0" value={r.component} placeholder="Component (Kurta / Pant / Dupatta)" disabled={busy} onChange={e=>setRows(x=>x.map((r,j)=>j===i?{...r,component:e.target.value}:r))}/><input aria-label={`Rate ${i+1}`} className="input-field w-28" type="number" min="0.01" step="0.01" value={r.rate} disabled={busy} onChange={e=>setRows(x=>x.map((r,j)=>j===i?{...r,rate:e.target.value}:r))}/><button disabled={busy} className="text-danger text-xs" onClick={()=>setRows(x=>x.filter((_,j)=>j!==i))}>Remove</button></div>)}
  <button className="btn-secondary" disabled={busy||revision===null} onClick={()=>setRows(x=>[...x,{component:'',rate:''}])}>+ Add component rate</button>
  <p className="text-xs text-muted-foreground">Use the exact component names from Cutting. Missing rates block new Stitching issues for those components.</p>
  {error&&<p role="alert" className="text-danger text-sm">{error}</p>}
  <div className="flex gap-3 justify-end"><button className="btn-secondary" disabled={busy} onClick={onClose}>Close</button><button className="btn-primary" disabled={busy||revision===null} onClick={save}>{busy?'Saving…':'Save rates'}</button></div>
 </section></div>;
}
