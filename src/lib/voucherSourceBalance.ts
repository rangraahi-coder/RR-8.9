export function receiptSizeBreakdown(received: number, breakdown: {size:string;qty:number}[] | undefined) {
  const rows=(breakdown||[]).filter(r=>Number(r.qty)>0);
  if (!rows.length) return undefined;
  if (rows.length===1) return [{size:rows[0].size,qty:received}];
  const total=rows.reduce((s,r)=>s+Number(r.qty),0);
  if(total!==received) throw new Error('This partial stitching receipt contains multiple sizes without received quantity per size. Record the size-wise receipt quantities before issuing or finishing it; quantities cannot be guessed from the original issue.');
  return rows;
}
export function cuttingSourceBalance(source:any, issued:{cuttingComponentId?:string;size:string;issuedQty:number}[], size:string) {
  if(!source) return {received:0,issued:0,remaining:0};
  const lines=issued.filter(r=>r.cuttingComponentId===source.id);
  const totalUsed=lines.reduce((s,r)=>s+Number(r.issuedQty||0),0);
  const net=Number(source.net_pieces||0);
  let sizes=source.size_breakdown||[];
  if(typeof sizes==='string') {try{sizes=JSON.parse(sizes)}catch{sizes=[]}}
  const sizeRows=Array.isArray(sizes)?sizes:[];
  const limit=size && sizeRows.length ? Math.min(net,sizeRows.filter(r=>r.size===size).reduce((s,r)=>s+Number(r.qty||0),0)) : net;
  const used=size?lines.filter(r=>r.size===size||!r.size).reduce((s,r)=>s+Number(r.issuedQty||0),0):totalUsed;
  return {received:limit,issued:used,remaining:Math.max(0,Math.min(net-totalUsed,limit-used))};
}
