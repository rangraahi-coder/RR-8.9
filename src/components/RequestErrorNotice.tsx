'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
export default function RequestErrorNotice(){
 const {verifiedUser}=useAuth();
 const [messages,setMessages]=useState<string[]>([]);
 useEffect(()=>setMessages([]),[verifiedUser?.id]);
 useEffect(()=>{const onError=(event:Event)=>{const message=(event as CustomEvent<{message:string}>).detail.message;setMessages(old=>old.includes(message)?old:[...old,message].slice(0,10));};window.addEventListener('erp-request-error',onError);return()=>window.removeEventListener('erp-request-error',onError);},[]);
 if(!messages.length)return null;
 return <aside role="alert" translate="no" className="fixed bottom-24 md:bottom-5 right-3 left-3 md:left-auto md:w-[480px] z-[10000] bg-red-50 border border-red-300 rounded-xl p-4 shadow-lg max-h-[45dvh] overflow-auto">
  <div className="flex justify-between gap-3"><strong>Issue details / समस्या का कारण</strong><button aria-label="Dismiss error details" onClick={()=>setMessages([])}>✕</button></div>
  <ol className="list-decimal pl-5 mt-2 space-y-2 text-sm break-words">{messages.map(message=><li key={message}>{message}</li>)}</ol>
 </aside>;
}
