'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,AlertTriangle} from 'lucide-react';
import {useAuth} from '@/contexts/AuthContext';
import {createClient} from '@/lib/supabase/client';
import {MODULES} from '@/lib/moduleAccess';
type Metric={key:string;title:string;value:number;unit:string;href:string;error?:string};
export default function DashboardContent({lang='en'}:{lang?:'en'|'hi'}){
 const {can,isAdmin,accessProfile}=useAuth();
 const [metrics,setMetrics]=useState<Metric[]>([]),[jobs,setJobs]=useState<any[]>([]),[loading,setLoading]=useState(true),[lastLoaded,setLastLoaded]=useState('');
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const current=++generation.current;setLoading(true);const db=createClient();
  const definitions:{module:string;key:string;title:string;table:string;select:string;unit:string;sum?:string;filter?:(r:any)=>boolean;href:string}[]=[
   {module:'jobs',key:'jobs',title:'Job Cards',table:'job_cards',select:'*',unit:'job cards',href:'/job-card-management'},
   {module:'jobs',key:'pieces',title:'Total Pieces',table:'job_cards',select:'total_pieces',unit:'main pieces',sum:'total_pieces',href:'/job-card-management'},
   {module:'sales',key:'sales',title:'Sales Orders',table:'sales_orders',select:'id,total_qty',unit:'orders',href:'/sales-orders'},
   {module:'cutting',key:'components',title:'Sub-components',table:'cutting_sub_components',select:'total_pieces',unit:'produced sub-components',sum:'total_pieces',href:'/cutting'},
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
    let rows:any[]=[];for(let offset=0;;offset+=500){const {data,error}=await db.from(d.table).select(d.select).order('id').range(offset,offset+499);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)break;}
    if(d.key==='jobs'&&current===generation.current)setJobs(rows);
    const included=d.filter?rows.filter(d.filter):rows;metric.value=d.sum?included.reduce((sum,r)=>sum+Number(r[d.sum!]||0),0):included.length;
   }catch(e){const detail=e as {message?:string;code?:string};metric.error=[detail.code,detail.message||'Could not refresh'].filter(Boolean).join(': ');if(d.key==='jobs'&&current===generation.current)setJobs([]);}
   return metric;
  }));
  if(current!==generation.current)return;setMetrics(result);setLoading(false);setLastLoaded(new Date().toLocaleTimeString());
 },[can]);
 useEffect(()=>{setMetrics([]);setJobs([]);void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('erp-data-changed',refresh);return()=>{++generation.current;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('erp-data-changed',refresh);};},[load]);
 const failed=metrics.filter(m=>m.error),today=new Date().toLocaleDateString('en-CA');
 const overdue=jobs.filter(j=>j.due_date&&String(j.due_date).slice(0,10)<today&&!['dispatched','completed','cancelled'].includes(j.stage));
 const blocked=jobs.filter(j=>j.is_blocked);
 const labels:Record<string,string>={jobs:'जॉब कार्ड',pieces:'कुल पीस',sales:'सेल्स ऑर्डर',components:'सब-कंपोनेंट्स',ready:'रेडी आइटम',dispatch:'डिस्पैच',cutting:'कटिंग',stitching:'सिलाई रिसीव',qc:'QC पास',embroidery:'एम्ब्रॉयडरी',handwork:'हैंडवर्क',contractor:'कॉन्ट्रैक्टर फिनिशिंग रिसीव',finishing:'फिनिशिंग',dyeing:'डाइंग / प्रिंटिंग',fabric:'फैब्रिक इन्वेंटरी'};
 return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-xl font-700">ERP Dashboard</h1><p className="text-sm text-muted-foreground">{loading?(lang==='hi'?'रिफ्रेश हो रहा है…':'Refreshing…'):failed.length?(lang==='hi'?'कुछ डेटा उपलब्ध नहीं है':'Some data unavailable'):`${lang==='hi'?'अपडेट':'Updated'} ${lastLoaded}`}</p></div><button className="btn-secondary" onClick={()=>void load()} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={18} className={loading?'animate-spin':''}/></button></div>
 {failed.length>0&&<details className="card-surface p-4 border border-amber-300"><summary className="text-amber-700">{lang==='hi'?'रिफ्रेश त्रुटि का विवरण':'Refresh error details'}</summary><ul>{failed.map(m=><li key={m.key}>{m.title}: {m.error}</li>)}</ul></details>}
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{metrics.map(m=><Link key={m.key} href={m.href} className="card-surface p-5"><p className="section-label">{lang==='hi'?labels[m.key]:m.title}</p><p className={`text-3xl font-800 mt-4 ${m.error?'text-amber-700':''}`}>{loading||m.error?'—':m.value.toLocaleString('en-IN')}</p><p className="text-sm text-muted-foreground mt-2">{m.error?(lang==='hi'?'डेटा उपलब्ध नहीं है': 'Data unavailable'):m.unit}</p></Link>)}</div>
 {!loading&&!metrics.length&&<p>No dashboard totals are assigned to this account. Use your available modules below.</p>}
 {can('jobs')&&<><div className="card-surface p-5"><h2 className="font-700 flex gap-2"><AlertTriangle size={18}/>{lang==='hi'?'ध्यान देना जरूरी':'Action Required'}</h2>{metrics.find(m=>m.key==='jobs')?.error?<p>Job Card data unavailable.</p>:<div className="flex gap-6 mt-3"><span>{overdue.length} overdue Job Cards</span><span>{blocked.length} blocked Job Cards</span></div>}</div>
 <div className="card-surface p-5 overflow-auto"><h2 className="font-700 mb-3">Job Card Progress</h2><table className="w-full text-sm"><thead><tr><th className="text-left">Job Card / Item</th><th>Stage</th><th>Main Pieces</th><th>Due Date</th></tr></thead><tbody>{[...jobs].sort((a,b)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))).slice(0,15).map(j=><tr key={j.id} className="border-t"><td className="py-3"><Link href="/job-card-management">{j.job_card_no} — {j.style_en}</Link></td><td className="text-center">{j.stage}</td><td className="text-center">{j.total_pieces}</td><td className="text-center">{j.due_date||'—'}</td></tr>)}</tbody></table></div></>}
 <div><h2 className="font-700 mb-3">{lang==='hi'?'आपके मॉड्यूल':'Your Modules'}</h2><div className="flex flex-wrap gap-3">{MODULES.filter(([key])=>can(key)).map(([key,title,href])=><Link key={key} href={href} className="btn-secondary">{title}</Link>)}{isAdmin&&<Link href="/users" className="btn-secondary">Users & Access</Link>}</div></div></div>;
}
