'use client';
import SearchableSelect from '@/components/SearchableSelect';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase/client';
import {useAuth} from '@/contexts/AuthContext';
import {erpErrorMessage} from '@/lib/erpError';
type JobRef={id:string;job_card_no:string};
export function ReceiptJobSelect({value,onChange,disabled=false}:{value:string[];onChange:(v:string[])=>void;disabled?:boolean}){
 const [jobs,setJobs]=useState<any[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setBusy(true);setError('');void(async()=>{try{const rows:any[]=[];for(let offset=0;;offset+=200){const {data,error}=await supabase.rpc('erp_receipt_job_options',{p_offset:offset});if(error)throw error;rows.push(...data||[]);if(!data||data.length<200)break;}if(live)setJobs(rows);}catch(e){if(live)setError(erpErrorMessage(e));}finally{if(live)setBusy(false);}})();return()=>{live=false};},[retry]);
 const rows=value.length?value:[''];
 return <fieldset disabled={disabled||busy} className="border rounded-lg p-3 space-y-3"><legend className="text-sm font-semibold">Job Card reference (optional)</legend>{busy&&<p role="status">Loading Job Cards…</p>}{rows.map((id,index)=><div key={index} className="flex gap-2 items-center"><label className="flex-1 text-xs">Job Card {index+1}<SearchableSelect className="input-field w-full mt-1" value={id} disabled={!!error} onChange={e=>onChange(rows.map((v,i)=>i===index?e.target.value:v))}><option value="">Not linked / Select Job Card</option>{id&&!jobs.some(j=>j.id===id)&&<option value={id}>Current linked Job Card</option>}{jobs.map(j=><option key={j.id} value={j.id} disabled={j.id!==id&&rows.includes(j.id)}>{j.job_card_no} · {j.style_en||'—'} · {j.party_name||'—'}</option>)}</SearchableSelect></label>{rows.length>1&&<button type="button" className="text-red-600 text-sm" aria-label={`Remove Job Card ${index+1}`} onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>Remove</button>}</div>)}<button type="button" className="text-primary underline text-sm" disabled={!!error||rows.some(id=>!id)||rows.length>=100} onClick={()=>onChange([...rows,''])}>+ Add another Job Card</button><p className="text-xs text-muted-foreground">Leave empty for general stock. Linking additional Job Cards does not multiply the received quantity.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}<button type="button" className="text-xs underline" onClick={()=>setRetry(v=>v+1)}>Reload Job Cards</button></fieldset>;

}
export function FabricItemJobSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [item, setItem] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    setBusy(true);
    setError('');
    void (async () => {
      try {
        const rows: any[] = [];
        for (let offset = 0; ; offset += 200) {
          const { data, error } = await supabase.rpc('erp_receipt_job_options', { p_offset: offset });
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < 200) break;
        }
        if (live) setJobs(rows);
      } catch (e) {
        if (live) setError(erpErrorMessage(e));
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => { live = false; };
  }, [retry]);

  const itemKey = (j: any) => String(j.style_en || j.design_code || j.style_no || '').trim();
  const items = Array.from(
    new Map(
      jobs
        .map((j) => [itemKey(j).toLowerCase(), { key: itemKey(j), label: itemKey(j) }])
        .filter(([key, item]) => Boolean(key) && Boolean((item as any).label))
    ).values()
  );

  const itemJobs = item
    ? jobs.filter((j) => itemKey(j).toLowerCase() === item.toLowerCase())
    : [];

  useEffect(() => {
    if (!item) {
      if (value.length) onChange([]);
      return;
    }
    if (itemJobs.length === 1) {
      if (value[0] !== itemJobs[0].id || value.length !== 1) onChange([itemJobs[0].id]);
    } else if (value.length && !itemJobs.some((j) => j.id === value[0])) {
      onChange([]);
    }
  }, [item, itemJobs.length, jobs.length]);

  const selectedJob = value[0] ? jobs.find((j) => j.id === value[0]) : null;

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-600">
          Item *
          <SearchableSelect
            className="input-field w-full"
            value={item}
            disabled={disabled || busy || !!error}
            onChange={(e) => {
              setItem(e.target.value);
              onChange([]);
            }}
          >
            <option value="">{busy ? 'Loading Items…' : 'Select Item'}</option>
            {items.map((x: any) => (
              <option key={x.key} value={x.key}>{x.label}</option>
            ))}
          </SearchableSelect>
        </label>

        {itemJobs.length > 1 && (
          <label className="flex flex-col gap-1 text-xs font-600">
            Job Card *
            <SearchableSelect
              className="input-field w-full"
              value={value[0] || ''}
              disabled={disabled || busy || !!error}
              onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
            >
              <option value="">Select Job Card</option>
              {itemJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_card_no} · {j.party_name || '—'}
                </option>
              ))}
            </SearchableSelect>
          </label>
        )}
      </div>

      {item && itemJobs.length === 1 && selectedJob && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="px-2.5 py-2 rounded-lg bg-muted/30 border border-border">
            <span className="block text-[11px] text-muted-foreground">Job Card</span>
            <span className="text-xs font-700">{selectedJob.job_card_no}</span>
          </div>
          <div className="px-2.5 py-2 rounded-lg bg-muted/30 border border-border">
            <span className="block text-[11px] text-muted-foreground">Style</span>
            <span className="text-xs font-700">{selectedJob.style_no || selectedJob.design_code || '—'}</span>
          </div>
          <div className="px-2.5 py-2 rounded-lg bg-muted/30 border border-border">
            <span className="block text-[11px] text-muted-foreground">Party</span>
            <span className="text-xs font-700">{selectedJob.party_name || '—'}</span>
          </div>
          <div className="px-2.5 py-2 rounded-lg bg-muted/30 border border-border">
            <span className="block text-[11px] text-muted-foreground">Colour</span>
            <span className="text-xs font-700">{selectedJob.colour || selectedJob.colors?.join(', ') || '—'}</span>
          </div>
        </div>
      )}

      {item && itemJobs.length > 1 && !value.length && (
        <p className="text-xs text-amber-700">This Item has multiple Job Cards. Select the Job Card to complete the link.</p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" className="underline" onClick={() => setRetry((v) => v + 1)}>Reload</button>
        </div>
      )}
    </div>
  );
}

export default function ReceiptJobLink({receiptId,jobs,version,onSaved}:{receiptId:string;jobs:JobRef[];version:number;onSaved:()=>void}){
 const {can}=useAuth();const [editing,setEditing]=useState(false),[selected,setSelected]=useState(jobs.map(j=>j.id)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="border rounded-lg p-3 space-y-3"><p className="font-semibold">Linked Job Cards</p>{jobs.length?jobs.map(j=><p key={j.id}>{can('jobs')?<Link className="text-primary underline" href={`/production-batch/${j.id}`}>{j.job_card_no}</Link>:j.job_card_no}</p>):<p>Not linked / General stock</p>}{can('receive','edit')&&!editing&&<button type="button" className="text-primary underline" onClick={()=>{setSelected(jobs.map(j=>j.id));setEditing(true);}}>Link / Change Job Cards</button>}{editing&&<><ReceiptJobSelect value={selected} onChange={setSelected} disabled={busy}/><p className="text-xs text-muted-foreground">Reference only. Received stock is counted once, not once per Job Card.</p><button type="button" className="btn-primary" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError('');try{const r=await supabase.rpc('erp_link_receipt_jobs',{p_receipt_id:receiptId,p_job_card_ids:selected.filter(Boolean),p_version:version});if(r.error)throw r.error;window.dispatchEvent(new Event('erp-data-changed'));setEditing(false);onSaved();}catch(e){setError(erpErrorMessage(e));}finally{setBusy(false);}}}>{busy?'Saving…':'Save Job Card links'}</button><button type="button" className="btn-secondary ml-2" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></>}{error&&<p role="alert" className="text-red-700">{error}</p>}</section>;
}
