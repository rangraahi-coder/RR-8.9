type Row=Record<string,any>;
const norm=(x:unknown)=>String(x||'').trim().toLowerCase();
export function orderOverview(orders:Row[],lines:Row[],styles:Row[],compositions:Row[],readiness:Row[]){
 const included=orders.filter(o=>!['cancelled','canceled'].includes(norm(o.status)));
 const result:Row[]=[];
 for(const order of included){
  const items=lines.filter(l=>l.sales_order_id===order.id);
  for(const line of items){
   const qty=Number(line.qty);const matches=styles.filter(s=>line.item_style_id?s.id===line.item_style_id:[s.style_no,s.item_name,s.design_code].some(n=>norm(n)&&norm(n)===norm(line.item_name)));
   const parts=matches.length===1?compositions.filter(c=>c.style_id===matches[0].id):[];
   const ratio=parts.length&&parts.every(c=>Number(c.qty_per_set)>0)?parts.reduce((s,c)=>s+Number(c.qty_per_set),0):null;
   const saved=readiness.find(r=>r.order_item_id===line.id);const ready=saved?Number(saved.ready_qty):null;
   const valid=ready!==null&&Number.isFinite(ready)&&ready>=0&&ready<=qty;
   result.push({id:line.id,order_no:order.vch_no,party:order.party_name,item:line.item_name,quantity:qty,ready:valid?ready:null,pending:valid?qty-ready:null,ratio,components:ratio===null?null:qty*ratio,pendingComponents:valid&&ratio!==null?(qty-ready!)*ratio:null,styleId:matches.length===1?matches[0].id:null,composition:parts.map(c=>`${c.component_name} × ${c.qty_per_set}`).join(', '),problem:!Number.isFinite(qty)||qty<0?'Invalid order quantity':matches.length!==1?'Item linkage missing or ambiguous':ratio===null?'Composition missing':saved&&!valid?'Readiness exceeds current order quantity':''});
  }
  if(!items.length)result.push({id:order.id,order_no:order.vch_no,item:'Order lines missing',quantity:Number(order.total_qty||0),ready:null,pending:null,ratio:null,components:null,pendingComponents:null,problem:'Order lines missing',uneditable:true});
 }
 return result;
}
