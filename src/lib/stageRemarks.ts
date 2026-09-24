export type RemarkEntry = {source:string; path:string; text:string; date:string; actor:string};
export function collectStageRemarks(rows:Record<string,any>[]):RemarkEntry[]{
 const result:RemarkEntry[]=[];
 for(const row of rows){
  const source=String(row.voucher_no||row.entry_no||row.receipt_no||row.component_name||row.job_card_no||'Stage entry');
  const date=String(row.changed_at||row.updated_at||row.created_at||row.voucher_date||row.date||'');
  const actor=String(row.actor_name||row.created_by_name||row.updated_by_name||'');
  function walk(value:any,path:string){
   if(!value||typeof value!=='object')return;
   if(Array.isArray(value)){value.forEach((v,i)=>walk(v,`${path} ${v?.component||v?.fabricName||v?.name||i+1}`));return;}
   for(const [key,v] of Object.entries(value)){
    if(/^(remarks?|notes?|rejection_reason|rejectionReason|blockage_reason_en)$/i.test(key)&&typeof v==='string'&&v.trim())result.push({source,path:[path,key.replaceAll('_',' ')].filter(Boolean).join(' · '),text:v.trim(),date,actor});
    else if(v&&typeof v==='object')walk(v,[path,key.replaceAll('_',' ')].filter(Boolean).join(' · '));
   }
  }
  walk(row,String(row.stage||row.component_name||row.component||''));
 }
 return result;
}
