type Row=Record<string,any>;
const value=(...values:unknown[])=>values.find(v=>typeof v==='string'&&v.trim()) as string|undefined;
/** Presentation only. Each input row is retained once, with its original identity. */
export function voucherReportGroups<T extends Row>(rows:T[],jobs:Row[]=[],sources:Row[]=[]){
 const groups=new Map<string,{name:string;jobs:Map<string,{name:string;rows:{row:T;index:number}[]}>;count:number}>();
 rows.forEach((row,index)=>{
  const sourceId=value(row.issueVoucherId,row.issue_voucher_id);
  const source=sourceId?sources.find(s=>s.id===sourceId):undefined;
  const ref=value(source?.jobCardRef,source?.job_card_ref,row.jobCardRef,row.job_card_ref);
  const id=value(source?.jobCardId,source?.job_card_id,row.jobCardId,row.job_card_id);
  const matches=jobs.filter(j=>id?j.id===id:ref&&(j.jobCardNo===ref||j.job_card_no===ref));
  const job=matches.length===1?matches[0]:undefined;
  const jobKey=id?`id:${id}`:job?.id?`id:${job.id}`:ref?`ref:${ref}`:`unlinked:${row.id||index}`;
  const outputName=value(row.finalItemName,row.final_item_name,('availableForDispatch' in row?row.item:undefined));
  const item=value(outputName,job?.styleEn,job?.style_en,source?.styleName,source?.style_name,source?.styleNo,row.styleName,row.style_name,row.styleNo,row.style_no,row.itemName,row.item_name,row.fabricName,row.fabric_name);
  const name=item?.trim()||'Item not recorded';
  const itemId=value(row.newItemStyleId,row.new_item_style_id,...(outputName?[]:[job?.itemStyleId,job?.item_style_id,row.itemStyleId,row.item_style_id]));
  const itemKey=itemId?`id:${itemId}`:item?`name:${name.toLowerCase()}`:`unknown:${jobKey}`;
  if(!groups.has(itemKey))groups.set(itemKey,{name,jobs:new Map(),count:0});
  const group=groups.get(itemKey)!;group.count++;
  if(!group.jobs.has(jobKey))group.jobs.set(jobKey,{name:ref||job?.jobCardNo||job?.job_card_no||(id?`Job Card ${id}`:'Job Card not linked'),rows:[]});
  group.jobs.get(jobKey)!.rows.push({row,index});
 });
 return [...groups];
}
