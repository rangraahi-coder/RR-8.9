'use client';
import {useEffect,useRef} from 'react';
import {createClient} from '@/lib/supabase/client';
import {toast} from 'sonner';
/** Unique channel per subscriber; focus/reconnect refresh and polling fallback. */
export function useRealtimeTable(table:string,onChange:()=>void|Promise<unknown>){
 const callback=useRef(onChange); callback.current=onChange;
 useEffect(()=>{
  const client=createClient();let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;let running=false;
  async function refresh(){if(stopped||running||document.visibilityState==='hidden')return;running=true;try{await callback.current();}catch(e){if(!stopped)toast.error(e instanceof Error?e.message:'Unable to refresh '+table,{id:'refresh-'+table});}finally{running=false;}}
  const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void refresh(),200);};
  const channel=client.channel('rt_'+table+'_'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table},schedule).subscribe(status=>{if(status==='SUBSCRIBED')schedule();});
  const interval=setInterval(()=>void refresh(),30000);
  window.addEventListener('focus',schedule);window.addEventListener('online',schedule);window.addEventListener('erp-data-changed',schedule);
  return()=>{stopped=true;if(timer)clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',schedule);window.removeEventListener('online',schedule);window.removeEventListener('erp-data-changed',schedule);void client.removeChannel(channel);};
 },[table]);
}
