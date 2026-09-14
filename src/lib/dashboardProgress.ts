// Completion is checked per component: surplus in one component never covers another.
export type ProgressState = 'complete'|'active'|'stalled'|'empty'|'unknown';
export function progressState(required: Record<string,number>, received: Record<string,number>, started:boolean, lastActivity:string, now=Date.now(), days=3):ProgressState {
 const keys=Object.keys(required);
 if(keys.length && keys.every(k=>required[k]>0 && (received[k]||0)>=required[k]))return 'complete';
 if(!started)return 'empty';
 const time=Date.parse(lastActivity);
 if(Number.isFinite(time)&&now-time>=days*86400000)return 'stalled';
 return keys.length?'active':'unknown';
}
export const componentKey=(s:unknown)=>String(s||'').trim().toLowerCase();

type Voucher=Record<string,any>;
// Match receipts to their own issue voucher, process and unit. Never offset one issue's deficit with another's surplus.
export function processProgress(issues:Voucher[],receipts:Voucher[],job:{id:string;job_card_no:string},process:string){
 const issued=issues.filter(v=>(v.job_card_ref===job.job_card_no||v.job_card_id===job.id)&&(v.process_type||'embroidery')===process&&v.status!=='cancelled');
 const byId=new Map(issued.map(v=>[v.id,v]));
 const receivedVouchers=receipts.filter(v=>byId.has(v.issue_voucher_id)&&v.status!=='cancelled');
 const required:Record<string,number>={},received:Record<string,number>={},rows:Voucher[]=[];
 let problem='';
 const groups=[['cutting_items','pieces','receivedPieces','component'],['fabric_items','issuedQty','receivedQty','fabricName'],['accessory_items','qty','receivedQty','name']];
 const unit=(v:unknown)=>{const s=componentKey(v||'pcs');return ['pcs','pc','pieces','piece'].includes(s)?'pcs':['m','mtr','metre','meter','meters','metres'].includes(s)?'m':s;};
 function add(v:Voucher,issue:Voucher,isReceipt:boolean){
  for(const [group,issuedField,receivedField,nameField]of groups){
   for(const item of Array.isArray(v[group])?v[group]:[]){
    const u=unit(item.unit),actual=unit(item.receiveUnit||item.unit);
    if(isReceipt&&actual!==u){problem='Issue and receive units differ. Review unit conversion before marking this stage complete.';continue;}
    const name=componentKey(item[nameField]);
    const identity=group==='fabric_items'?`${item.fabricId||name}/${item.rollId||item.rollName||''}`:name;
    const key=`${issue.voucher_no||issue.id} · ${group==='cutting_items'?'Component':group==='fabric_items'?'Fabric':'Accessory'}: ${identity} (${u})`;
    const amount=Number(item[isReceipt?receivedField:issuedField]||0);
    if(!Number.isFinite(amount)||amount<0){problem='Invalid source quantity. Review this voucher.';continue;}
    if(!isReceipt&&amount>0)required[key]=(required[key]||0)+amount;
    if(isReceipt){received[key]=(received[key]||0)+amount;rows.push({voucher_no:v.voucher_no,issue_voucher:issue.voucher_no,voucher_date:v.voucher_date,component:item[nameField],quantity:amount,unit:u});}
   }
  }
 }
 issued.forEach(v=>add(v,v,false));receivedVouchers.forEach(v=>add(v,byId.get(v.issue_voucher_id)!,true));
 if(Object.keys(received).some(k=>!(k in required)))problem='A receipt does not match its issue lines. Review the linked voucher.';
 const activity=[...issued,...receivedVouchers];
 const last=activity.map(r=>r.updated_at||r.created_at||r.voucher_date||'').filter(Boolean).sort().at(-1)||'';
 return {required,received,rows,issues:issued,last,started:activity.length>0,problem};
}
