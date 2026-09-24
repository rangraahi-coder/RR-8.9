import {notifyCommittedWrite} from './dataInvalidation';
import {errorRequestRecord} from './errorReferences';
import {beginRequest} from './requestProgress';
import {erpErrorMessage} from './erpError';
// Preserve Supabase's response and transaction behavior; also report errors that
// older service callers turn into false/null or a generic message.
export async function erpFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 const readRpc=/\/rpc\/(erp_final_stock_options|erp_job_stitching_prices|erp_receive_stitch_rates|erp_job_approval_audit|erp_next_printer_receipt_no|erp_master_merge_options|erp_master_merge_plan|erp_component_approval_report|erp_component_approval_audit|erp_receipt_job_options|erp_order_linked_report|erp_job_reporting|erp_list_users|erp_assembly_composition|erp_pending_components|erp_stitch_rate_sources|erp_module_history|erp_pending_job_orders|erp_entry_history|erp_voucher_detail|erp_voucher_access_reason|erp_voucher_lock_reason)(?:[?]|$)/.test(url);
 const tracked=url.includes('/rest/v1/')||url.includes('/storage/v1/object/');
 const finish=typeof window!=='undefined'&&tracked?beginRequest(!['GET','HEAD'].includes(method)&&!readRpc):()=>{};
 const path=typeof window!=='undefined'?window.location.pathname:undefined;
 const report=(error:unknown)=>{if(typeof window!=='undefined'&&tracked)window.dispatchEvent(new CustomEvent('erp-request-error',{detail:{message:erpErrorMessage(error),path,record:errorRequestRecord(url)}}));};
 // Use the existing client-info header (no credentials or form contents).
 // Diagnostic only: this client-supplied value is never an authorization check.
 const deleteRequest = tracked && (method === 'DELETE' || /\/rpc\/erp_delete_sales_order(?:[?]|$)/.test(url));
 let requestInit = init;
 if (deleteRequest && typeof window !== 'undefined') {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const requestId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  headers.set('x-client-info', `rangraahi-delete-v1;screen=${encodeURIComponent(window.location.pathname)};request=${requestId}`);
  requestInit = {...init, headers};
 }
 try{
  const response=await fetch(input,requestInit);
  if(!response.ok&&tracked){
   try{report(await response.clone().json());}catch{report({message:`The server returned HTTP ${response.status} without an error explanation.`});}
  }
  // Read RPCs must never trigger a refresh loop. Only known writes invalidate data.
  const writeRpc=/\/rpc\/(erp_save_final_stock|erp_delete_final_stock|erp_set_sales_due|erp_save_sales_order_with_due|erp_set_job_stitching_prices|erp_set_user_access|erp_apply_team_profile|erp_merge_masters|erp_save_component_approval|erp_save_job_approval|erp_link_assembly_item|delete_original_item_variant|edit_original_item_variant|merge_original_item_styles|save_original_qc_entry|erp_save_dashboard_settings|erp_link_receipt_jobs|delete_original_component_assembly|save_original_component_assembly|convert_original_component_to_item|erp_delete_contractor_receive|erp_save_contractor_receive|erp_save_team_voucher|erp_cancel_dispatch|save_original_dispatch|erp_edit_manual_fabric|save_original_finishing_entry|receive_printer_fabric_with_stock|erp_delete_sales_order|erp_delete_cutting|erp_mutate_printer_receipt|recalculate_sales_order_status|save_original_sales_order|create_original_item)(?:[?]|$)/.test(url);
  const tableWrite=url.includes('/rest/v1/')&&!url.includes('/rpc/')&&['POST','PATCH','DELETE'].includes(method);
  if(response.ok&&typeof window!=='undefined'&&(tableWrite||(method==='POST'&&writeRpc)))notifyCommittedWrite();
  return response;
 }catch(error){report(error);throw error;}finally{finish();}
}
