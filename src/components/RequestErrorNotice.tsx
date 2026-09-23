'use client';
import {useEffect,useState} from 'react';
import ErrorReferenceLinks from './ErrorReferenceLinks';
import {focusIssue,NavigableIssue} from '@/lib/issueNavigation';
import {useAuth} from '@/contexts/AuthContext';
export default function RequestErrorNotice(){
 const {verifiedUser}=useAuth();
 const [messages,setMessages]=useState<NavigableIssue[]>([]);
 useEffect(()=>setMessages([]),[verifiedUser?.id]);
 useEffect(()=>{const onError=(event:Event)=>{const issue=(event as CustomEvent<NavigableIssue>).detail;setMessages(old=>old.some(x=>x.message===issue.message&&x.target===issue.target&&x.record?.id===issue.record?.id)?old:[...old,issue].slice(0,10));};window.addEventListener('erp-request-error',onError);return()=>window.removeEventListener('erp-request-error',onError);},[]);
 useEffect(()=>{const invalid=(e:Event)=>{const target=e.target;if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement){setMessages(old=>[...old.filter(x=>x.target!==target),{message:target.validationMessage,target,path:window.location.pathname}].slice(-10));}};document.addEventListener('invalid',invalid,true);return()=>document.removeEventListener('invalid',invalid,true);},[]);
 if(!messages.length)return null;
 return <aside role="alert" translate="no" className="fixed bottom-24 md:bottom-5 right-3 left-3 md:left-auto md:w-[480px] z-[10000] bg-red-50 border border-red-300 rounded-xl p-4 shadow-lg max-h-[45dvh] overflow-auto">
  <div className="flex justify-between gap-3"><strong>Issue details / समस्या का कारण</strong><button aria-label="Dismiss error details" onClick={()=>setMessages([])}>✕</button></div>
  <ol className="list-decimal pl-5 mt-2 space-y-2 text-sm break-words">{messages.map((issue,i)=><li key={i}>{issue.target?.isConnected&&issue.path===window.location.pathname?<button type="button" className="text-left underline underline-offset-2" onClick={()=>{if(issue.target?.isConnected)focusIssue(issue.target);}}>{issue.message} — Go to issue / यहाँ जाएँ</button>:issue.message}<ErrorReferenceLinks message={issue.message} record={issue.record}/></li>)}</ol>
 </aside>;
}
