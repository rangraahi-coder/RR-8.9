'use client';
import {useEffect,useState,useRef,useCallback} from 'react';
import {X,PackagePlus} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '@/contexts/AuthContext';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import {componentAssemblyService,type FinishingStockRow} from '@/lib/services/componentAssemblyService';
import {convertComponentToItem,recoverComponentConversion} from '@/lib/services/componentConversionService';
export default function ComponentConversionModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
 const {username}=useAuth();const inFlight=useRef(false);
 const [cards,setCards]=useState<{jobCardRef:string;styleName?:string}[]>([]);
 const [job,setJob]=useState('');const [rows,setRows]=useState<FinishingStockRow[]>([]);const [rowId,setRowId]=useState('');
 const [name,setName]=useState('');const [code,setCode]=useState('');const [colour,setColour]=useState('');
 const [qty,setQty]=useState('');const [remarks,setRemarks]=useState('');const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);
 const selected=rows.find(r=>r.id===rowId);
 const refresh=useCallback(async()=>{const available=await componentAssemblyService.getJobCardsWithFinishingStock();setCards(available);if(job)setRows(await componentAssemblyService.getFinishingStockByJobCard(job));},[job]);
 useEffect(()=>{let active=true;setLoading(true);componentAssemblyService.getJobCardsWithFinishingStock().then(r=>{if(active)setCards(r);}).catch(e=>{if(active)setError(e.message||String(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setRows([]);setRowId('');if(!job)return;setLoading(true);componentAssemblyService.getFinishingStockByJobCard(job).then(r=>{if(active)setRows(r);}).catch(e=>{if(active)setError(e.message||String(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[job]);
 useRealtimeTable('finishing_stock',refresh);useRealtimeTable('component_assembly_items',refresh);
 async function save(recover=false){if(inFlight.current)return;setError('');inFlight.current=true;setSaving(true);try{
  if(!recover&&(!selected||!Number.isInteger(Number(qty))||Number(qty)<=0||Number(qty)>selected.pendingQty))throw new Error('Select available component stock and a positive whole quantity within its balance.');
  const result=recover?await recoverComponentConversion():await convertComponentToItem({jobCardRef:job,component:selected!.component,size:selected!.size,sourceColour:selected!.colour,targetColour:(selected!.colour||colour).trim(),itemName:name.trim(),itemCode:code.trim(),quantity:Number(qty),date,remarks:remarks.trim(),createdBy:username||null});
  toast.success(`${result.voucher_no}: ${result.quantity} new ready items saved.`);onSaved();
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{inFlight.current=false;setSaving(false);}}
 return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><form onSubmit={e=>{e.preventDefault();void save();}} className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-auto">
 <div className="p-5 border-b border-border flex items-center justify-between"><div><h2 className="font-display font-700 text-lg flex gap-2 items-center"><PackagePlus size={20}/>New Item from Remaining Component</h2><p className="text-xs text-muted-foreground mt-1">One component becomes one separate ready item. Original stock history stays linked.</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="Close"><X size={20}/></button></div>
 <fieldset disabled={saving} className="p-5 space-y-4">
 <div><label className="text-xs font-600">Source Job Card *</label><select required className="input-field w-full mt-1" value={job} onChange={e=>{setJob(e.target.value);setError('');}}><option value="">Select Job Card</option>{cards.map(c=><option key={c.jobCardRef} value={c.jobCardRef}>{c.jobCardRef} — {c.styleName}</option>)}</select></div>
 <div><label className="text-xs font-600">Remaining Component *</label><select required disabled={loading} className="input-field w-full mt-1" value={rowId} onChange={e=>{setRowId(e.target.value);const r=rows.find(r=>r.id===e.target.value);setColour(r?.colour||'');setQty('');}}><option value="">{loading?'Loading stock…':'Select component, size and colour'}</option>{rows.map(r=><option key={r.id} value={r.id}>{r.component} / {r.size||'Unspecified size'} / {r.colour||'Unspecified colour'} — {r.pendingQty} available</option>)}</select></div>
 <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-600">New Item Name *</label><input required maxLength={160} className="input-field w-full mt-1" value={name} onChange={e=>setName(e.target.value)}/></div><div><label className="text-xs font-600">New Item / Style Code *</label><input required maxLength={80} className="input-field w-full mt-1" value={code} onChange={e=>setCode(e.target.value)}/></div></div>
 <div className="grid grid-cols-3 gap-3"><div><label className="text-xs font-600">Quantity *</label><input required type="number" min="1" step="1" max={selected?.pendingQty} className="input-field w-full mt-1" value={qty} onChange={e=>setQty(e.target.value)}/></div><div><label className="text-xs font-600">Colour *</label><input required readOnly={!!selected?.colour} className="input-field w-full mt-1" value={selected?.colour||colour} onChange={e=>setColour(e.target.value)}/></div><div><label className="text-xs font-600">Date *</label><input required type="date" className="input-field w-full mt-1" value={date} onChange={e=>setDate(e.target.value)}/></div></div>
 <div><label className="text-xs font-600">Remarks</label><textarea className="input-field w-full mt-1" value={remarks} onChange={e=>setRemarks(e.target.value)}/></div>
 {selected&&Number(qty)>0&&<p className="rounded-xl bg-primary/5 p-3 text-sm">{qty} {selected.component} → {qty} {name||'new ready items'} (1PC). Component balance after conversion: {selected.pendingQty-Number(qty)}. Size: {selected.size||'unspecified'}.</p>}
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 </fieldset><div className="p-5 border-t border-border flex flex-wrap justify-between gap-2"><button type="button" disabled={saving} onClick={()=>void save(true)} className="btn-secondary text-xs">Recover last conversion</button><button type="submit" disabled={saving||loading} className="btn-primary">{saving?'Saving…':'Create New Item & Convert Stock'}</button></div>
 </form></div>;
}
