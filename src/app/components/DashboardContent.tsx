'use client';
import {isoDate} from '@/lib/dueDates';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import VoucherDetails from '@/components/VoucherDetails';
import {RefreshCw,AlertTriangle} from 'lucide-react';
import {useAuth} from '@/contexts/AuthContext';
import {createClient} from '@/lib/supabase/client';
import ProductionJourney from './ProductionJourney';
import AssemblyOverview from './AssemblyOverview';
import OrderQuantityOverview from './OrderQuantityOverview';
type Metric={table?:string;key:string;title:string;value:number;unit:string;href:string;error?:string;rows?:any[];sum?:string};
export default function DashboardContent({lang='en'}:{lang?:'en'|'hi'}){
 const {can,accessProfile}=useAuth();
 const [metrics,setMetrics]=useState<Metric[]>([]),[jobs,setJobs]=useState<any[]>([]),[loading,setLoading]=useState(true),[lastLoaded,setLastLoaded]=useState(''),[refreshVersion,setRefreshVersion]=useState(0);
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
   {module:'cutting',key:'cutting',title:'Cutting',table:'cutting_entries',select:'id',filter:r=>r.status!=='cancelled',unit:'vouchers',href:'/cutting'},
   {module:'stitching',key:'stitching',title:'Stitching Received',table:'stitch_receive_vouchers',select:'total_pieces_received',sum:'total_pieces_received',unit:'sub-components',href:'/stitching'},
   {module:'qc',key:'qc',title:'QC Passed',table:'qc_entries',select:'total_pass',sum:'total_pass',unit:'sub-components',href:'/qc-entry'},
   {module:'embroidery',key:'embroidery',title:'Embroidery',table:'emb_issue_vouchers',select:'id,process_type',filter:r=>r.process_type!=='handwork',unit:'issue vouchers',href:'/embroidery-accessory'},
   {module:'handwork',key:'handwork',title:'Handwork',table:'emb_issue_vouchers',select:'id,process_type',filter:r=>r.process_type==='handwork',unit:'issue vouchers',href:'/handwork'},
   {module:'contractor',key:'contractor',title:'Contractor Finishing Received',table:'contractor_receive_items',select:'received_today',sum:'received_today',unit:'sub-components',href:'/contractor-finishing'},
   {module:'finishing',key:'finishing',title:'Finishing',table:'finishing_entries',select:'id',unit:'vouchers',href:'/finishing-entry'},
   {module:'dyeing',key:'dyeing',title:'Dyeing / Printing',table:'dyeing_processing_entries',select:'id',unit:'entries',href:'/dyeing-printing'},
   {module:'fabric',key:'fabric',title:'Fabric Inventory',table:'fabric_inventory',select:'stock_qty,unit',sum:'stock_qty',filter:r=>['m','mtr','mtrs','meter','meters','metre','metres'].includes(String(r.unit||'').trim().toLowerCase()),unit:'metres',href:'/fabric-inventory'},
   {"module": "items", "key": "items", "title": "Items", "table": "item_styles", "select": "*", "unit": "items", "href": "/item-master"},
   {"module": "operators", "key": "operators", "title": "Operators", "table": "stitch_operators", "select": "*", "unit": "operators", "href": "/operator-master"},
   {"module": "accounts", "key": "accounts", "title": "Accounts", "table": "accounts", "select": "*", "unit": "accounts", "href": "/account-master"},
   {"module": "grey", "key": "grey", "title": "Grey stock", "table": "grey_fabric_purchases", "select": "*", "unit": "metres", "href": "/grey-fabric", "sum": "balance_in_stock",filter:r=>["m","mtr","mtrs","meter","meters","metre","metres"].includes(String(r.unit||"").trim().toLowerCase())},
   {"module": "receive", "key": "receive_pending", "title": "Fabric with printer", "table": "printer_fabric_issues", "select": "*", "unit": "metres", "href": "/fabric-inventory", "sum": "qty_pending",filter:r=>r.status!=='cancelled'},
   {"module": "receive", "key": "received_fabric", "title": "Fabric received", "table": "printer_fabric_receipts", "select": "*", "unit": "metres", "href": "/fabric-inventory", "sum": "qty_received"},
   {"module": "receive", "key": "grey_consumed", "title": "Grey consumed on receipts", "table": "printer_fabric_receipts", "select": "*", "unit": "metres", "href": "/fabric-inventory", "sum": "grey_consumed"},
   {"module": "ledger", "key": "printer_balance", "title": "Printer balance", "table": "printer_fabric_issues", "select": "*", "unit": "metres", "href": "/printer-ledger", "sum": "qty_pending",filter:r=>r.status!=='cancelled'},
   {"module": "stitching", "key": "stitch_pending", "title": "Stitching pending", "table": "stitch_issue_components", "select": "*", "unit": "sub-components", "href": "/stitching", "sum": "pending_qty"},
   {"module": "contractor", "key": "contractor_pending", "title": "Contractor finishing pending", "table": "contractor_issue_items", "select": "*", "unit": "sub-components", "href": "/contractor-finishing", "sum": "balance_qty"},
   {"module": "qc", "key": "qc_rejected", "title": "QC rejected", "table": "qc_entries", "select": "*", "unit": "sub-components", "href": "/qc-entry", "sum": "total_fail"},
   {"module": "assembly", "key": "assembled", "title": "Assembled", "table": "component_assembly_vouchers", "select": "*", "unit": "sets", "href": "/contractor-finishing", "sum": "total_sets_assembled",filter:r=>r.assembly_kind!=='component_conversion'},
   {"module": "conversion", "key": "converted", "title": "New items from pending components", "table": "component_assembly_vouchers", "select": "*", "unit": "items", "href": "/contractor-finishing", "sum": "total_sets_assembled",filter:r=>r.assembly_kind==='component_conversion'},
   {"module": "finishing", "key": "finish_pending", "title": "Finishing pending", "table": "finishing_entries", "select": "*", "unit": "pieces", "href": "/finishing-entry", "sum": "pending_derived"},
   {"module": "cutting", "key": "cut_fabric", "title": "Cutting fabric consumed", "table": "cutting_entries", "select": "*", "unit": "metres", "href": "/cutting", "sum": "fabric_consumed_qty",filter:r=>r.status!=='cancelled'&&['metre','metres','meter','meters','m','mtr','mtrs'].includes(String(r.unit).trim().toLowerCase())},
   {"module": "embroidery", "key": "emb_pending", "title": "Embroidery open vouchers", "table": "emb_issue_vouchers", "select": "*", "unit": "vouchers", "href": "/embroidery-accessory",filter:r=>r.process_type!=='handwork'&&!['fully_received','completed','closed','cancelled'].includes(r.status)},
   {"module": "handwork", "key": "hand_pending", "title": "Handwork open vouchers", "table": "emb_issue_vouchers", "select": "*", "unit": "vouchers", "href": "/handwork",filter:r=>r.process_type==='handwork'&&!['fully_received','completed','closed','cancelled'].includes(r.status)},
   {module:'cutting',key:'cut_average',title:'Cutting table average',table:'cutting_entries',select:'*',unit:'metres / cut piece',href:'/cutting',filter:r=>r.status!=='cancelled'&&['metre','metres','meter','meters','m','mtr','mtrs'].includes(String(r.unit).trim().toLowerCase())},
  ];
  const result=await Promise.all(definitions.filter(d=>can(d.module)).map(async d=>{
   const metric:Metric={table:d.table,key:d.key,title:d.title,value:0,unit:d.unit,href:d.href};
   try{
    // Page through stock/transaction tables so totals do not stop at the API row limit.
    let rows:any[]=[];for(let offset=0;;offset+=500){const {data,error}=await db.from(d.table).select('*').order('id').range(offset,offset+499);if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)break;}
    if(d.key==='jobs'&&current===generation.current)setJobs(rows);
    let included=d.filter?rows.filter(d.filter):rows;
    if(d.key==='components'){const parents:any[]=[];for(let off=0;;off+=500){const {data,error}=await db.from('cutting_entries').select('id,status').order('id').range(off,off+499);if(error)throw error;parents.push(...data||[]);if(!data||data.length<500)break;}const valid=new Set((parents||[]).filter(p=>p.status!=='cancelled').map(p=>p.id));included=Array.from(new Map(included.filter(r=>valid.has(r.cutting_entry_id)).map(r=>[r.id,r])).values()).map(r=>({...r,net_pieces:Number(r.net_pieces??Math.max(0,Number(r.total_pieces||0)-Number(r.rejections||0)))}));}
    if(d.key==='finish_pending')included=included.map(r=>({...r,pending_derived:Math.max(0,Number(r.total_qc_passed||0)-Number(r.total_finished||0))}));
    metric.rows=included;metric.sum=d.sum;metric.value=d.sum?included.reduce((sum,r)=>sum+Number(r[d.sum!]||0),0):included.length;
    if(d.key==='cut_average'){const pcs=included.reduce((n,r)=>n+Number(r.total_pieces_cut||0),0);metric.value=pcs?included.reduce((n,r)=>n+Number(r.fabric_consumed_qty||0),0)/pcs:0;metric.rows=included.map(r=>({...r,table_average:Number(r.total_pieces_cut)>0?Number(r.fabric_consumed_qty)/Number(r.total_pieces_cut):null}));}
   }catch(e){const detail=e as {message?:string;code?:string};metric.error=[detail.code,detail.message||'Could not refresh'].filter(Boolean).join(': ');if(d.key==='jobs'&&current===generation.current)setJobs([]);}
   return metric;
  }));
  if(current!==generation.current)return;setMetrics(result);setLoading(false);setLastLoaded(new Date().toLocaleTimeString());setRefreshVersion(v=>v+1);
 },[can]);
 useEffect(()=>{setMetrics([]);setJobs([]);setBreakdown(null);void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('erp-data-changed',refresh);return()=>{++generation.current;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('erp-data-changed',refresh);};},[load]);
 const priorities:Record<string,string[]>={sheetal:['emb_pending','hand_pending','items','jobs'],babulal:['components','stitch_pending','qc_rejected','contractor_pending','operators'],lalu:['receive_pending','fabric','stitch_pending','contractor_pending','ready','dispatch'],aashish:['receive_pending','fabric','stitch_pending','qc','ready','dispatch'],pramod:['assembled'],cuttingmaster:['components','cut_fabric','cut_average','cutting'],vishnu:['finish_pending','ready','dispatch'],ishu:['sales','grey','printer_balance','emb_pending','hand_pending','ready']};
 const username=String(accessProfile?.display_name||'').toLowerCase().replaceAll(' ','');
 const priority=accessProfile?.is_owner?['jobs','ready','dispatch','stitch_pending','receive_pending','contractor_pending']:(priorities[username]||['jobs','ready','dispatch']);
 const featured=priority.map(key=>metrics.find(m=>m.key===key)).filter((m):m is Metric=>!!m);
 const failed=metrics.filter(m=>m.error),today=new Date().toLocaleDateString('en-CA');
 const overdue=jobs.filter(j=>j.due_date&&isoDate(String(j.due_date))&&isoDate(String(j.due_date))<today&&!['dispatched','completed','cancelled'].includes(j.stage));
 const blocked=jobs.filter(j=>j.is_blocked);
 const labels:Record<string,string>={jobs:'जॉब कार्ड',pieces:'कुल पीस',sales:'सेल्स ऑर्डर',components:'तैयार कटिंग सब-कंपोनेंट्स (नेट)',ready:'रेडी आइटम',dispatch:'डिस्पैच',cutting:'कटिंग',stitching:'सिलाई रिसीव',qc:'QC पास',embroidery:'एम्ब्रॉयडरी',handwork:'हैंडवर्क',contractor:'कॉन्ट्रैक्टर फिनिशिंग रिसीव',finishing:'फिनिशिंग',dyeing:'डाइंग / प्रिंटिंग',fabric:'फैब्रिक इन्वेंटरी'};
 return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-xl font-700">ERP Dashboard</h1><p className="text-sm text-muted-foreground">{loading?(lang==='hi'?'रिफ्रेश हो रहा है…':'Refreshing…'):failed.length?(lang==='hi'?'कुछ डेटा उपलब्ध नहीं है':'Some data unavailable'):`${lang==='hi'?'अपडेट':'Updated'} ${lastLoaded}`}</p></div><button className="btn-secondary" onClick={()=>void load()} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={18} className={loading?'animate-spin':''}/></button></div>
 {failed.length>0&&<details className="card-surface p-4 border border-amber-300"><summary className="text-amber-700">{lang==='hi'?'रिफ्रेश त्रुटि का विवरण':'Refresh error details'}</summary><ul>{failed.map(m=><li key={m.key}>{m.title}: {m.error}</li>)}</ul></details>}
 <OrderQuantityOverview key={JSON.stringify(accessProfile)} refresh={lastLoaded}/>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{featured.map(m=><button key={m.key} onClick={()=>setBreakdown(m)} className="card-surface p-5 text-left hover:shadow-md"><p className="section-label">{lang==='hi'?(labels[m.key]||m.title):m.title}</p><p className={`text-3xl font-800 mt-4 ${m.error?'text-amber-700':''}`}>{m.error?'—':m.value.toLocaleString('en-IN')}</p><p className="text-sm text-muted-foreground mt-2">{m.error?(lang==='hi'?'डेटा उपलब्ध नहीं है': 'Data unavailable'):m.unit}</p></button>)}</div>
 {!loading&&!metrics.length&&<p>No dashboard totals are assigned to this account. Use the sidebar to open your assigned modules.</p>}
 {can('jobs')&&<><div className="card-surface p-5"><h2 className="font-700 flex gap-2"><AlertTriangle size={18}/>{lang==='hi'?'ध्यान देना जरूरी':'Action Required'}</h2>{metrics.find(m=>m.key==='jobs')?.error?<p>Job Card data unavailable.</p>:<div className="flex gap-6 mt-3"><button className="text-primary hover:underline" onClick={()=>setBreakdown({key:"overdue",title:"Overdue Job Cards",value:overdue.length,unit:"Job Cards",href:"/job-card-management",rows:overdue})}>{overdue.length} overdue Job Cards</button><button className="text-primary hover:underline" onClick={()=>setBreakdown({key:"blocked",title:"Blocked Job Cards",value:blocked.length,unit:"Job Cards",href:"/job-card-management",rows:blocked})}>{blocked.length} blocked Job Cards</button></div>}</div>
 <ProductionJourney key={JSON.stringify(accessProfile)} jobs={jobs} refresh={String(refreshVersion)}/></>}
 <AssemblyOverview refresh={lastLoaded}/>
 <section className="card-surface p-4"><h2 className="font-semibold mb-3">Recent work</h2>{Array.from(new Map(metrics.flatMap(m=>(m.rows||[]).filter(r=>r.created_at&&(r.voucher_no||r.entry_no||r.receipt_no||r.issue_no||r.order_no||r.vch_no||r.dispatch_no||r.purchase_no)).map(r=>[m.href+':'+r.id,{r,href:m.href} as const] as const))).values()).sort((a,b)=>String(b.r.created_at).localeCompare(String(a.r.created_at))).slice(0,8).map(({r,href})=><Link key={href+r.id} href={href} className="block border-t py-3"><span>{r.voucher_no||r.entry_no||r.receipt_no||r.issue_no||r.order_no||r.vch_no||r.dispatch_no||r.purchase_no}</span><small className="block text-muted-foreground">{r.created_by||'User not recorded'} · {new Date(r.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</small></Link>)}</section>
 <details open className="card-surface p-5"><summary className="cursor-pointer font-700">Department totals</summary><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{metrics.filter(m=>!['pieces',...featured.map(f=>f.key)].includes(m.key)).map(m=><button key={m.key} onClick={()=>setBreakdown(m)} className="border rounded-xl p-4 text-left hover:bg-muted"><p className="text-sm">{lang==='hi'?(labels[m.key]||m.title):m.title}</p><p className="font-700 text-xl">{m.error?'—':m.value.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">{m.unit}</p></button>)}</div></details>
 {breakdown&&<div className="erp-modal-enter fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center" onClick={()=>setBreakdown(null)}><section role="dialog" aria-modal="true" aria-label="Total breakdown" className="bg-white rounded-xl p-5 max-w-3xl w-full max-h-[85vh] overflow-auto" onClick={e=>e.stopPropagation()}><button autoFocus className="float-right btn-secondary" onClick={()=>setBreakdown(null)}>Close</button><h2 className="font-700">{breakdown.title}</h2><p className="text-sm my-3">{breakdown.error||`${breakdown.value.toLocaleString('en-IN')} ${breakdown.unit} · ${(breakdown.rows||[]).length} source entries`}</p>{(breakdown.rows||[]).map((r,i)=><details key={r.id||i} className="border rounded-lg p-3 my-2"><summary className="cursor-pointer">{r.job_card_no||r.voucher_no||r.dispatch_no||r.order_no||r.entry_no||r.item_name||r.style_name||r.fabric_name||`Entry ${i+1}`} {breakdown.sum?`· ${r[breakdown.sum]||0}`:''}</summary><dl className="grid grid-cols-2 gap-3 text-sm mt-3">{Object.entries(r).filter(([k,v])=>v!=null&&k!=='id'&&!k.endsWith('_id')).map(([k,v])=><div key={k}><dt className="text-muted-foreground">{k.replaceAll('_',' ')}</dt><dd className="break-words">{typeof v==='object'?JSON.stringify(v):String(v)}</dd></div>)}</dl>{breakdown.table&&r.id&&!['cutting_sub_components','stitch_issue_components','contractor_issue_items','contractor_receive_items','finishing_stock'].includes(breakdown.table)&&<VoucherDetails table={breakdown.table} recordId={r.id}/>}
{can('jobs')&&r.job_card_no&&<Link className="text-primary" href={`/production-batch/${r.id}`}>Open Job Card →</Link>}</details>)}{!breakdown.error&&!breakdown.rows?.length&&<p>No entries.</p>}</section></div>}

 </div>;
}
