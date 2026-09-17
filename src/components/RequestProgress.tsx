'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {subscribeProgress,getProgress,emptyProgress} from '@/lib/requestProgress';
export default function RequestProgress(){
 const {reads,writes}=useSyncExternalStore(subscribeProgress,getProgress,()=>emptyProgress);
 const busy=reads+writes>0;const [slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);if(!busy)return;const timer=setTimeout(()=>setSlow(true),15000);return()=>clearTimeout(timer);},[busy]);
 if(!busy)return null;
 return <div className={writes?'fixed inset-0 z-[9999] bg-black/20 flex items-center justify-center p-4':'fixed top-2 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none max-w-[95vw]'}>
  <div role="status" aria-live="polite" className="rounded-xl border bg-white text-slate-900 shadow-lg px-5 py-3 flex gap-3 items-center">
   <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-pink-500 border-t-transparent animate-spin"/>
   <div><div>{writes?'Processing… Please wait / कृपया प्रतीक्षा करें':'Loading… / लोड हो रहा है'}</div>{slow&&<p className="text-xs mt-1">Taking longer than usual. Please do not submit again.</p>}</div>
  </div>
 </div>;
}
