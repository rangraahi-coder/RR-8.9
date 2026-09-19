type Row=Record<string,any>;
const norm=(v:unknown)=>String(v??'').trim().toLowerCase();
// Group size lines by order/item/colour. Never allocate the same Job Card across different items or colours.
export function automaticOrderOverview(snapshots:Row[]):Row[]{
 const output:Row[]=[];
 for(const snapshot of snapshots){
  const {order,lines,styles,compositions,cuts,fabric_jobs:fab}=snapshot;
  if(!lines.length){output.push({id:order.id,order_no:order.vch_no,item:'Order items unavailable',quantity:Number(order.total_qty||0),pending:null,components:null,pendingComponents:null,problem:'Sales Order has no item lines.',jobs:[],vouchers:[]});continue;}
  const groups=new Map<string,Row[]>();
  for(const line of lines){const key=norm(line.item_name)+'|'+norm(line.param_colour);groups.set(key,[...groups.get(key)||[],line]);}
  const rows=Array.from(groups.entries()).map(([key,group])=>{
   const matches=styles.filter((s:Row)=>[s.style_no,s.item_name,s.design_code].some(n=>norm(n)&&norm(n)===norm(group[0].item_name)));
   const style=matches.length===1?matches[0]:null;
   const parts=style?compositions.filter((c:Row)=>c.style_id===style.id):[];
   const ratios:Record<string,number>={};for(const p of parts)ratios[norm(p.component_name)]=(ratios[norm(p.component_name)]||0)+Number(p.qty_per_set);
   const validParts=parts.length>0&&parts.every((p:Row)=>norm(p.component_name)&&Number.isFinite(Number(p.qty_per_set))&&Number(p.qty_per_set)>0);
   const ratio=validParts?Object.values(ratios).reduce((a,b)=>a+b,0):null;
   const quantity=group.reduce((n,l)=>n+Number(l.qty),0);
   return {id:order.id+'|'+key,order_no:order.vch_no,party:order.party_name,item:group[0].item_name,colour:group[0].param_colour,quantity,ratio,ratios,styleId:style?.id,style,components:ratio==null?null:quantity*ratio,problem:group.some(l=>!Number.isInteger(Number(l.qty))||Number(l.qty)<0)?'Invalid Sales Order quantity.':matches.length!==1?'Item Master link missing or ambiguous.':!validParts?'Item Master component composition missing.':'',jobs:[] as Row[],vouchers:[] as string[],ready:0 as number|null,pending:null as number|null,pendingComponents:null as number|null};
  });
  for(const job of snapshot.jobs){
   const candidates=rows.filter(r=>job.item_style_id?r.styleId===job.item_style_id:[job.design_code,job.style_en].some(n=>norm(n)&&[r.item,r.style?.style_no,r.style?.design_code].some(k=>norm(k)&&norm(k)===norm(n))));
   const colours=(Array.isArray(job.colors)?job.colors:[]).map(norm).filter(Boolean);
   const matched=candidates.filter(r=>!norm(r.colour)||(colours.length===1&&colours[0]===norm(r.colour)));
   if(matched.length===1&&candidates.length===1){matched[0].jobs.push(job);continue;}
   // Exact single-colour allocation can disambiguate repeated styles on this order.
   if(matched.length===1&&colours.length===1){matched[0].jobs.push(job);continue;}
   for(const r of candidates.length?candidates:rows)r.problem='Job Card '+job.job_card_no+' has an ambiguous item / colour link. Correct its source link.';
  }
  for(const r of rows){
   let hasUnquantifiedFabric=false;let completeSets=0;
   for(const job of r.jobs){
    const totals:Record<string,number>={};const linked=cuts.filter((c:Row)=>c.job_id===job.id);
    if(linked.some((c:Row)=>c.invalid||!Number.isFinite(Number(c.qty))||Number(c.qty)<0))r.problem='Invalid cutting component quantity on '+job.job_card_no;
    for(const c of linked){totals[norm(c.component)]=(totals[norm(c.component)]||0)+Number(c.qty);r.vouchers.push(...c.vouchers||[]);}
    const keys=Object.keys(r.ratios);const supported=keys.length?Math.min(...keys.map(k=>Math.floor((totals[k]||0)/r.ratios[k]))):0;
    if(!Number.isFinite(Number(job.total_pieces))||Number(job.total_pieces)<0)r.problem='Invalid Job Card quantity.';
    completeSets+=Math.min(supported,Math.max(0,Number(job.total_pieces)||0));
    if(fab.includes(job.id)&&supported<Number(job.total_pieces||0))hasUnquantifiedFabric=true;
   }
   r.ready=Math.min(r.quantity,completeSets);
   if(hasUnquantifiedFabric&&r.ready<r.quantity&&!r.problem)r.problem='Fabric is linked, but its remaining metres cannot be converted to ready pieces without a per-item consumption / allocation quantity.';
   r.vouchers=Array.from(new Set(r.vouchers));
   if(r.problem){r.pending=null;r.pendingComponents=null;}
   else{r.pending=Math.max(0,r.quantity-r.ready);r.pendingComponents=r.ratio==null?null:r.pending*r.ratio;}
   output.push(r);
  }
 }
 return output;
}
