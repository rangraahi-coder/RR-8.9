'use client';
import {usePathname} from 'next/navigation';
import {Scissors, Truck} from 'lucide-react';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {subscribeProgress,getProgress,emptyProgress} from '@/lib/requestProgress';
export default function RequestProgress(){
 const pathname=usePathname()||'';
 const {reads,writes}=useSyncExternalStore(subscribeProgress,getProgress,()=>emptyProgress);
 const busy=reads+writes>0;const [visibleRead,setVisibleRead]=useState(false);
 useEffect(()=>{setVisibleRead(false);if(!reads)return;const timer=setTimeout(()=>setVisibleRead(true),1500);return()=>clearTimeout(timer);},[reads>0]);
 const [slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);if(!busy)return;const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[busy]);
 if(!writes&&!visibleRead)return null;
 return <div className={writes?'fixed inset-0 z-[9999] bg-black/20 flex items-center justify-center p-4':'fixed bottom-20 right-3 z-[9999] pointer-events-none max-w-[95vw] text-xs'}>
  <div role="status" aria-live="polite" className="rounded-xl border bg-white text-slate-900 shadow-lg px-5 py-3 flex gap-3 items-center">
   <span aria-hidden="true" className="erp-progress-icon text-pink-500 shrink-0">
    {writes&&pathname.includes('cutting')?<Scissors size={22} className="erp-work-motion"/>:
     writes&&pathname.includes('stitch')?<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 20h18" strokeDasharray="2 3"/><g className="erp-needle-motion"><path d="M12 2v14l-2 3V2z"/><path d="M11 5v3"/></g></svg>:
     writes&&pathname.includes('dispatch')?<Truck size={22} className="erp-work-motion"/>:
     <span className="block h-5 w-5 rounded-full border-2 border-pink-500 border-t-transparent animate-spin motion-reduce:animate-none"/>}
   </span>
   <div><div>{writes?'Processing… Please wait / कृपया प्रतीक्षा करें':'Updating… / अपडेट हो रहा है'}</div>{slow&&<p className="text-xs mt-1">{writes?'Taking longer than usual. Please do not submit again.':'Update is taking longer than usual.'}</p>}</div>
  </div>
 </div>;
}
