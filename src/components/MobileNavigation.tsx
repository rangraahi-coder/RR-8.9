'use client';
import {useState,useEffect} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Home,Grid2X2,MoreHorizontal,X,BriefcaseBusiness} from 'lucide-react';
import {useAuth} from '@/contexts/AuthContext';
import {MODULES} from '@/lib/moduleAccess';
export default function MobileNavigation(){
 const {can,canAccessRoute,signOut}=useAuth();const path=usePathname();const [panel,setPanel]=useState<'work'|'more'|null>(null);
 useEffect(()=>setPanel(null),[path]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setPanel(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[]);
 const allowed=MODULES.filter(([key])=>can(key));
 const quick=allowed.filter(([key])=>can(key,'create')&&!['items','accounts','operators','audit','ledger'].includes(key)).filter((m,i,all)=>all.findIndex(a=>a[2]===m[2])===i).slice(0,2);
 return <div className="md:hidden">{panel&&<div className="fixed inset-0 z-40 bg-black/40" onClick={()=>setPanel(null)}><section role="dialog" aria-modal="true" aria-label={panel==='work'?'My work':'More'} className="absolute bottom-20 left-2 right-2 rounded-2xl bg-white p-4 max-h-[70dvh] overflow-auto" onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h2 className="font-semibold">{panel==='work'?'मेरे काम / My work':'More'}</h2><button aria-label="Close menu" onClick={()=>setPanel(null)} className="p-3"><X size={20}/></button></div>{panel==='work'?<div className="grid grid-cols-2 gap-2">{allowed.map(([key,title,href])=><Link key={key} onClick={()=>setPanel(null)} href={href} className="border rounded-xl p-3 text-sm min-h-14">{title}</Link>)}</div>:<div className="grid gap-3"><Link href="/profile" onClick={()=>setPanel(null)}>My profile / मेरी प्रोफाइल</Link>{canAccessRoute('/users')&&<Link href="/users" onClick={()=>setPanel(null)}>Users & Access</Link>}{canAccessRoute('/settings')&&<Link href="/settings" onClick={()=>setPanel(null)}>Settings</Link>}<button className="text-left text-red-600 py-3" onClick={()=>void signOut()}>Sign out</button></div>}</section></div>}
 <nav aria-label="Mobile navigation" className="fixed bottom-0 inset-x-0 z-40 bg-white border-t flex justify-around gap-1 px-1 pt-2" style={{paddingBottom:'max(8px, env(safe-area-inset-bottom))'}}><Link href="/" onClick={()=>setPanel(null)} className={`flex-1 flex flex-col items-center text-[10px] p-2 ${path==='/'?'text-primary':''}`}><Home size={20}/>Dashboard</Link>{quick.map(([key,title,href])=><Link key={key} href={href} onClick={()=>setPanel(null)} className={`flex-1 min-w-0 text-center text-[10px] p-2 ${path===href?'text-primary':''}`}><BriefcaseBusiness size={20} className="mx-auto"/><span className="block truncate">{title}</span></Link>)}<button onClick={()=>setPanel(panel==='work'?null:'work')} className="flex-1 text-[10px] p-2"><Grid2X2 size={20} className="mx-auto"/>मेरे काम</button><button onClick={()=>setPanel(panel==='more'?null:'more')} className="flex-1 text-[10px] p-2"><MoreHorizontal size={20} className="mx-auto"/>More</button></nav></div>;
}
