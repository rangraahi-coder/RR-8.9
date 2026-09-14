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
 const [rows,setRows]=useState<(FinishingStockRow&{styleName?:string})[]>([]),[ratios,setRatios]=useState<Record<string,number>>({}),[search,setSearch]=useState('');
 const [name,setName]=useState(''),[code,setCode]=useState(''),[colour,setColour]=useState(''),[size,setSize]=useState('');
 const [qty,setQty]=useState(''),[remarks,setRemarks]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const refresh=useCallback(async()=>{setLoading(true);try{setRows(await componentAssemblyService.getAllPendingComponents());setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);useRealtimeTable('finishing_stock',refresh);useRealtimeTable('component_assembly_items',refresh);
 const selected=rows.filter(r=>ratios[r.id]>0);
 const maxReady=selected.length?Math.min(...selected.map(r=>Math.floor(r.pendingQty/ratios[r.id]))):0;
 async function save(recover=false){if(inFlight.current)return;setError('');inFlight.current=true;setSaving(true);try{
  if(!recover){if(Object.entries(ratios).some(([id,ratio])=>ratio>0&&!rows.some(r=>r.id===id)))throw new Error('Selected stock has changed. Clear unavailable selections and retry.');
   if(!selected.length||!Number.isInteger(Number(qty))||Number(qty)<=0||Number(qty)>maxReady||selected.some(r=>!Number.isInteger(ratios[r.id])))throw new Error('Select components and whole quantities within their available balances.');}
  const result=recover?await recoverComponentConversion():await convertComponentToItem({components:selected.map(r=>({jobCardRef:r.jobCardRef,component:r.component,size:r.size,colour:r.colour,qtyPerItem:ratios[r.id]})),size:size.trim(),targetColour:colour.trim(),itemName:name.trim(),itemCode:code.trim(),quantity:Number(qty),date,remarks:remarks.trim(),createdBy:username||null});
  toast.success(`${result.voucher_no}: ${result.quantity} ready items saved.`);onSaved();
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{inFlight.current=false;setSaving(false);}}
 return <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><form onSubmit={e=>{e.preventDefault();void save();}} className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-auto">
 <div className="p-5 border-b border-border flex justify-between"><div><h2 className="font-700 text-lg flex gap-2"><PackagePlus/>New Item from Pending Sub-components</h2><p className="text-sm text-muted-foreground">One voucher creates one final item using available components from any source item.</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="Close"><X/></button></div>
 <fieldset disabled={saving} className="p-5 space-y-4">
 <div className="grid sm:grid-cols-2 gap-3"><label>New Item Name *<input required className="input-field w-full" value={name} onChange={e=>setName(e.target.value)}/></label><label>New Item Code *<input required className="input-field w-full" value={code} onChange={e=>setCode(e.target.value)}/></label></div>
 <div className="grid sm:grid-cols-4 gap-3"><label>Ready quantity *<input required type="number" min="1" step="1" max={maxReady||undefined} className="input-field w-full" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Final colour / combination *<input required className="input-field w-full" value={colour} onChange={e=>setColour(e.target.value)}/></label><label>Final size *<input required className="input-field w-full" value={size} onChange={e=>setSize(e.target.value)}/></label><label>Date *<input required type="date" className="input-field w-full" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 <input className="input-field w-full" placeholder="Search source item, Job Card, component, colour or size" value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="overflow-auto max-h-80"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Source item / Job Card</th><th>Sub-component</th><th>Colour / Size</th><th>Available</th><th>Per ready item</th><th>Use / Remaining</th></tr></thead><tbody>{rows.filter(r=>`${r.styleName} ${r.jobCardRef} ${r.component} ${r.colour} ${r.size}`.toLowerCase().includes(search.toLowerCase())).map(r=><tr className="border-t" key={r.id}><td className="p-2">{r.styleName}<br/>{r.jobCardRef}</td><td>{r.component}</td><td>{r.colour} / {r.size}</td><td className="text-center">{r.pendingQty}</td><td><input aria-label={`${r.jobCardRef} ${r.component} ${r.size} ${r.colour} per ready item`} type="number" min="0" step="1" className="input-field w-20" value={ratios[r.id]||''} onChange={e=>setRatios({...ratios,[r.id]:Number(e.target.value)})}/></td><td className={r.pendingQty-(ratios[r.id]||0)*Number(qty)<0?'text-red-600':''}>{(ratios[r.id]||0)*Number(qty)} / {r.pendingQty-(ratios[r.id]||0)*Number(qty)}</td></tr>)}</tbody></table>{loading?<p>Loading stock…</p>:!rows.length&&!error&&<p>No pending received sub-components.</p>}</div>
 <p className="text-sm">Maximum ready quantity with this selection: <strong>{maxReady}</strong>. Enter 0 to leave a component unused.</p><button type="button" className="btn-secondary" onClick={()=>setRatios({})}>Clear selection</button>
 <label className="block">Remarks<textarea className="input-field w-full" value={remarks} onChange={e=>setRemarks(e.target.value)}/></label>{error&&<p role="alert" className="text-red-600">{error}</p>}
 </fieldset><div className="p-5 border-t flex justify-between gap-3"><button type="button" disabled={saving} onClick={()=>void save(true)} className="btn-secondary">Recover last voucher</button><button type="submit" disabled={saving||loading} className="btn-primary">{saving?'Saving…':'Create ready item'}</button></div>
 </form></div>;
}
