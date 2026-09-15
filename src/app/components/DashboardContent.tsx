'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,AlertTriangle} from 'lucide-react';
import {useAuth} from '@/contexts/AuthContext';
import {createClient} from '@/lib/supabase/client';
import ProductionJourney from './ProductionJourney';
import OrderQuantityOverview from './OrderQuantityOverview';
type Metric={key:string;title:string;value:number;unit:string;href:string;error?:string;rows?:any[];sum?:string};
export default function DashboardContent({lang='en'}:{lang?:'en'|'hi'}){
 const {can,accessProfile}=useAuth();
 const [metrics,setMetrics]=useState<Metric[]>([]),[jobs,setJobs]=useState<any[]>([]),[loading,setLoading]=useState(true),[lastLoaded,setLastLoaded]=useState('');
 const [breakdown,setBreakdown]=useState<Metric|null>(null);
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const current=++generation.current;setLoading(true);const db=createClient();
  const definitions:{module:string;key:string;title:string;table:string;select:string;unit:string;sum?:string;filter?:(r:any)=>boolean;href:string}[]=[
   {module:'jobs',key:'jobs',title:'Job Cards',table:'job_cards',select:'*',unit:'job cards',href:'/job-card-management'},
   {module:'jobs',key:'pieces',title:'Total Pieces',table:'job_cards',select:'total_pieces',unit:'main pieces',sum:'total_pieces',href:'/job-card-management'},
   {module:'sales',key:'sales',title:'Sales Orders',table:'sales_orders',select:'id,total_qty',unit:'orders',href:'/sales-orders'},
   {module:'cutting',key:'components',title:'Produced Sub-components (Net)',table:'cutting_sub_components',select:'total_pieces',unit:'produced sub-components',sum:'net_pieces',href:'/cutting'},
   {module:'ready',key:'ready',title:'Ready Items',table:'finished_goods',select:'source,available_for_dispatch',filter:r=>['component_assembly','component_conversion'].includes(r.source),sum:'available_for_dispatch',unit:'ready pieces / sets',href:'/finished-goods'},
   {module:'dispatch',key:'dispatch',title:'Dispatched',table:'dispatch_vouchers',select:'status,dispatched_pieces',filter:r=>r.status!=='cancelled',sum:'dispatched_pieces',unit:'ready pieces / sets',href:'/dispatch'},
   {module:'cutting',key:'cutting',title:'Cutting',table:'cutting_entries',select:'id',unit:'vouchers',href:'/cutting'},
   {module:'stitching',key:'stitching',title:'Stitching Received',table:'stitch_receive_vouchers',select:'total_pieces_received',sum:'total_pieces_received',unit:'sub-components',href:'/stitching'},
   {module:'qc',key:'qc',title:'QC Passed',table:'qc_entries',select:'total_pass',sum:'total_pass',unit:'sub-components',href:'/qc-entry'},
   {module:'embroidery',key:'embroidery',title:'Embroidery',table:'emb_issue_vouchers',select:'id,process_type',filter:r=>r.process_type!=='handwork',unit:'issue vouchers',href:'/embroidery-accessory'},
   {module:'handwork',key:'handwork',title:'Handwork',table:'emb_issue_vouchers',select:'id,process_type',filter:r=>r.process_type==='handwork',unit:'issue vouchers',href:'/handwork'},
   {module:'contractor',key:'contractor',title:'Contractor Finishing Received',table:'contractor_receive_items',select:'received_today',sum:'received_today',unit:'sub-components',href:'/contractor-finishing'},
   {module:'finishing',key:'finishing',title:'Finishing',table:'finishing_entries',select:'id',unit:'vouchers',href:'/finishing-entry'},
   {module:'dyeing',key:'dyeing',title:'Dyeing / Printing',table:'dyeing_processing_entries',select:'id',unit:'entries',href:'/dyeing-printing'},
   {module:'fabric',key:'fabric',title:'Fabric Inventory',table:'fabric_inventory',select:'stock_qty,unit',sum:'stock_qty',filter:r=>['m','mtr','mtrs','meter','meters','metre','metres'].includes(String(r.unit||'').trim().toLowerCase()),unit:'metres',href:'/fabric-inventory'},
  ];
  const result=await Promise.all(definitions.filter(d=>can(d.module)).map(async d=>{
   const metric:Metric={key:d.key,title:d.title,value:0,unit:d.unit,href:d.href};
   try{
    // Page through stock/transaction tables so totals do not stop at the API row limit.
    let rows:any[]=[];for(let offset=0;;offset+=500){const {data,error}=await db.from(d.table).select('*').order('id').range(offset,offset+499);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)break;}
    if(d.key==='jobs'&&current===generation.current)setJobs(rows);
    let included=d.filter?rows.filter(d.filter):rows;
    if(d.key==='components'){const parents:any[]=[];for(let off=0;;off+=500){const {data,error}=await db.from('cutting_entries').select('id,status').order('id').range(off,off+499);if(error)throw error;parents.push(...data||[]);if(!data||data.length<500)break;}const valid=new Set((parents||[]).filter(p=>p.status!=='cancelled').map(p=>p.id));included=Array.from(new Map(included.filter(r=>valid.has(r.cutting_entry_id)).map(r=>[r.id,r])).values()).map(r=>({...r,net_pieces:Number(r.net_pieces??Math.max(0,Number(r.total_pieces||0)-Number(r.rejections||0)))}));}
    metric.rows=included;metric.sum=d.sum;metric.value=d.sum?included.reduce((sum,r)=>sum+Number(r[d.sum!]||0),0):included.length;
   }catch(e){const detail=e as {message?:string;code?:string};metric.error=[detail.code,detail.message||'Could not refresh'].filter(Boolean).join(': ');if(d.key==='jobs'&&current===generation.current)setJobs([]);}
   return metric;
  }));
  if(current!==generation.current)return;setMetrics(result);setLoading(false);setLastLoaded(new Date().toLocaleTimeString());
 },[can]);
 useEffect(()=>{setMetrics([]);setJobs([]);setBreakdown(null);void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('erp-data-changed',refresh);return()=>{++generation.current;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('erp-data-changed',refresh);};},[load]);
 const failed=metrics.filter(m=>m.error),today=new Date().toLocaleDateString('en-CA');
 const overdue=jobs.filter(j=>j.due_date&&String(j.due_date).slice(0,10)<today&&!['dispatched','completed','cancelled'].includes(j.stage));
 const blocked=jobs.filter(j=>j.is_blocked);
 const labels:Record<string,string>={jobs:'जॉब कार्ड',pieces:'कुल पीस',sales:'सेल्स ऑर्डर',components:'तैयार कटिंग सब-कंपोनेंट्स (नेट)',ready:'रेडी आइटम',dispatch:'डिस्पैच',cutting:'कटिंग',stitching:'सिलाई रिसीव',qc:'QC पास',embroidery:'एम्ब्रॉयडरी',handwork:'हैंडवर्क',contractor:'कॉन्ट्रैक्टर फिनिशिंग रिसीव',finishing:'फिनिशिंग',dyeing:'डाइंग / प्रिंटिंग',fabric:'फैब्रिक इन्वेंटरी'};
 return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-xl font-700">ERP Dashboard</h1><p className="text-sm text-muted-foreground">{loading?(lang==='hi'?'रिफ्रेश हो रहा है…':'Refreshing…'):failed.length?(lang==='hi'?'कुछ डेटा उपलब्ध नहीं है':'Some data unavailable'):`${lang==='hi'?'अपडेट':'Updated'} ${lastLoaded}`}</p></div><button className="btn-secondary" onClick={()=>void load()} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={18} className={loading?'animate-spin':''}/></button></div>
 {failed.length>0&&<details className="card-surface p-4 border border-amber-300"><summary className="text-amber-700">{lang==='hi'?'रिफ्रेश त्रुटि का विवरण':'Refresh error details'}</summary><ul>{failed.map(m=><li key={m.key}>{m.title}: {m.error}</li>)}</ul></details>}
 <OrderQuantityOverview key={JSON.stringify(accessProfile)} refresh={lastLoaded}/>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{metrics.filter(m=>['jobs','ready','dispatch'].includes(m.key)).map(m=><button key={m.key} onClick={()=>setBreakdown(m)} className="card-surface p-5 text-left hover:shadow-md"><p className="section-label">{lang==='hi'?labels[m.key]:m.title}</p><p className={`text-3xl font-800 mt-4 ${m.error?'text-amber-700':''}`}>{loading||m.error?'—':m.value.toLocaleString('en-IN')}</p><p className="text-sm text-muted-foreground mt-2">{m.error?(lang==='hi'?'डेटा उपलब्ध नहीं है': 'Data unavailable'):m.unit}</p></button>)}</div>
 {!loading&&!metrics.length&&<p>No dashboard totals are assigned to this account. Use the sidebar to open your assigned modules.</p>}
 {can('jobs')&&<><div className="card-surface p-5"><h2 className="font-700 flex gap-2"><AlertTriangle size={18}/>{lang==='hi'?'ध्यान देना जरूरी':'Action Required'}</h2>{metrics.find(m=>m.key==='jobs')?.error?<p>Job Card data unavailable.</p>:<div className="flex gap-6 mt-3"><button className="text-primary hover:underline" onClick={()=>setBreakdown({key:"overdue",title:"Overdue Job Cards",value:overdue.length,unit:"Job Cards",href:"/job-card-management",rows:overdue})}>{overdue.length} overdue Job Cards</button><button className="text-primary hover:underline" onClick={()=>setBreakdown({key:"blocked",title:"Blocked Job Cards",value:blocked.length,unit:"Job Cards",href:"/job-card-management",rows:blocked})}>{blocked.length} blocked Job Cards</button></div>}</div>
 <ProductionJourney key={JSON.stringify(accessProfile)} jobs={jobs} refresh={lastLoaded}/></>}
 <details className="card-surface p-5"><summary className="cursor-pointer font-700">Department totals</summary><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{metrics.filter(m=>!['jobs','pieces','ready','dispatch'].includes(m.key)).map(m=><button key={m.key} onClick={()=>setBreakdown(m)} className="border rounded-xl p-4 text-left hover:bg-muted"><p className="text-sm">{lang==='hi'?labels[m.key]:m.title}</p><p className="font-700 text-xl">{loading||m.error?'—':m.value.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">{m.unit}</p></button>)}</div></details>
 {breakdown&&<div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center" onClick={()=>setBreakdown(null)}><section role="dialog" aria-modal="true" aria-label="Total breakdown" className="bg-white rounded-xl p-5 max-w-3xl w-full max-h-[85vh] overflow-auto" onClick={e=>e.stopPropagation()}><button autoFocus className="float-right btn-secondary" onClick={()=>setBreakdown(null)}>Close</button><h2 className="font-700">{breakdown.title}</h2><p className="text-sm my-3">{breakdown.error||`${breakdown.value.toLocaleString('en-IN')} ${breakdown.unit} · ${(breakdown.rows||[]).length} source entries`}</p>{(breakdown.rows||[]).map((r,i)=><details key={r.id||i} className="border rounded-lg p-3 my-2"><summary className="cursor-pointer">{r.job_card_no||r.voucher_no||r.dispatch_no||r.order_no||r.entry_no||r.item_name||r.style_name||r.fabric_name||`Entry ${i+1}`} {breakdown.sum?`· ${r[breakdown.sum]||0}`:''}</summary><dl className="grid grid-cols-2 gap-3 text-sm mt-3">{Object.entries(r).filter(([k,v])=>v!=null&&k!=='id'&&!k.endsWith('_id')).map(([k,v])=><div key={k}><dt className="text-muted-foreground">{k.replaceAll('_',' ')}</dt><dd className="break-words">{typeof v==='object'?JSON.stringify(v):String(v)}</dd></div>)}</dl>{can('jobs')&&r.job_card_no&&<Link className="text-primary" href={`/production-batch/${r.id}`}>Open Job Card →</Link>}</details>)}{!breakdown.error&&!breakdown.rows?.length&&<p>No entries.</p>}</section></div>}

 </div>;
}
