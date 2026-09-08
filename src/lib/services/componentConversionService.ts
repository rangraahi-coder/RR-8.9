import {supabase} from '@/lib/supabase/client';
export interface ComponentConversionRequest {
 jobCardRef:string;component:string;size:string;sourceColour:string;targetColour:string;
 itemName:string;itemCode:string;quantity:number;date:string;remarks:string;createdBy:string|null;
}
interface Pending {id:string;request:ComponentConversionRequest}
let busy=false;
async function convert(request?:ComponentConversionRequest){
 if(busy)throw new Error('A conversion is already in progress.');busy=true;
 try{
  const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw new Error('Sign in before converting stock.');
  const key='kurtierp:component-conversion:'+data.user.id;
  const storage=window.sessionStorage;
  const saved=storage.getItem(key);let pending:Pending|null=saved?JSON.parse(saved):null;
  if(pending&&(!pending.id||!pending.request))throw new Error('Pending conversion record is unreadable. Check its voucher before retrying.');
  if(pending&&request&&JSON.stringify(pending.request)!==JSON.stringify(request))throw new Error('Recover the previous conversion before submitting changed details.');
  if(!pending){if(!request)throw new Error('No pending conversion was found.');pending={id:crypto.randomUUID(),request};storage.setItem(key,JSON.stringify(pending));}
  const result=await Promise.resolve(supabase.rpc('convert_original_component_to_item',{p_id:pending.id,p_request:pending.request})).catch(()=>{throw new Error('Connection interrupted. Use Recover last conversion before making another item.');});
  if(result.error){
   if(/^(22|23|28|40|42)/.test(result.error.code||'')||['P0001','PGRST202','P0002'].includes(result.error.code||'')){storage.removeItem(key);throw new Error(result.error.message);}
   throw new Error('Conversion confirmation was not received. Use Recover last conversion before trying another save.');
  }
  if(!result.data?.voucher_id)throw new Error('Conversion response was incomplete. Use Recover last conversion.');
  storage.removeItem(key);window.dispatchEvent(new Event('erp-data-changed'));return result.data as {voucher_id:string;voucher_no:string;style_id:string;variant_id:string;quantity:number};
 }finally{busy=false;}
}
export const convertComponentToItem=(request:ComponentConversionRequest)=>convert(request);
export const recoverComponentConversion=()=>convert();
