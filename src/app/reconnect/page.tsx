'use client';
import {useEffect,useState} from 'react';
import {safeReturnPath} from '@/lib/accessRecovery';
export default function Page(){
 const [message,setMessage]=useState('Reconnecting to your account…');
 function retry(){const target=safeReturnPath(new URLSearchParams(window.location.search).get('next'));window.location.replace(target);}
 useEffect(()=>{
  let count=0;try{const old=JSON.parse(sessionStorage.getItem('erp-reconnect')||'null');count=old&&Date.now()-old.time<60000?old.count:0;}catch{}
  let timer:ReturnType<typeof setTimeout>|undefined;
  const schedule=()=>{if(!navigator.onLine){setMessage('You are offline. Reconnecting when the connection returns…');return;}if(count>=3){setMessage('Connection could not be restored yet. Please try again.');return;}setMessage('Reconnecting to your account…');timer=setTimeout(()=>{try{sessionStorage.setItem('erp-reconnect',JSON.stringify({count:count+1,time:Date.now()}));}catch{}retry();},1500*(count+1));};
  const online=()=>{if(timer)clearTimeout(timer);schedule();};schedule();window.addEventListener('online',online);return()=>{if(timer)clearTimeout(timer);window.removeEventListener('online',online);};
 },[]);
 return <main className="min-h-screen bg-background flex items-center justify-center p-6"><section className="card-surface p-6 max-w-md"><h1 className="text-xl font-semibold">Restoring connection</h1><p role="status" className="my-4">{message}</p><p className="text-sm text-muted-foreground mb-4">We will check your session and module access again before opening the page.</p><button className="btn-primary" onClick={retry}>Retry now</button></section></main>;
}
