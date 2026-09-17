import {beginRequest} from './requestProgress';
import {erpErrorMessage} from './erpError';
// Preserve Supabase's response and transaction behavior; also report errors that
// older service callers turn into false/null or a generic message.
export async function erpFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 const readRpc=/\/rpc\/(erp_assembly_composition|erp_pending_components|erp_stitch_rate_sources|erp_module_history)(?:[?]|$)/.test(url);
 const finish=typeof window!=='undefined'&&url.includes('/rest/v1/')?beginRequest(!['GET','HEAD'].includes(method)&&!readRpc):()=>{};
 const origin=typeof document!=='undefined'?(document.activeElement?.closest('[data-erp-error-anchor],form,[role="dialog"]') as HTMLElement|null):null;
 const path=typeof window!=='undefined'?window.location.pathname:undefined;
 const report=(error:unknown)=>{if(typeof window!=='undefined'&&url.includes('/rest/v1/'))window.dispatchEvent(new CustomEvent('erp-request-error',{detail:{message:erpErrorMessage(error),target:origin||undefined,path}}));};
 try{
  const response=await fetch(input,init);
  if(!response.ok&&url.includes('/rest/v1/')){
   try{report(await response.clone().json());}catch{report({message:`The server returned HTTP ${response.status} without an error explanation.`});}
  }
  return response;
 }catch(error){report(error);throw error;}finally{finish();}
}
