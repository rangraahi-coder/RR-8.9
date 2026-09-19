export function salesTotals(items: {qty:number;price:number}[], gstPercent:number) {
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) throw new Error('GST must be between 0 and 100%.');
  const subtotal = Math.round(items.reduce((sum,i)=>sum+Math.round(i.qty*i.price*100)/100,0)*100)/100;
  const gstAmount = Math.round(subtotal*gstPercent)/100;
  return {subtotal,gstAmount,totalAmount:Math.round((subtotal+gstAmount)*100)/100};
}
export function sizeBreakupError(text:string, qty:number):string|null {
  if (!text.trim()) return 'Enter size-wise quantities (for example S/50, M/50).';
  const seen=new Set<string>(); let sum=0;
  for (const part of text.split(',')) {
    const fields=part.trim().split('/');
    if(fields.length!==2 || !fields[0].trim() || !/^(?:\d+)(?:\.\d+)?$/.test(fields[1].trim())) return 'Use Size/Qty for every size (for example S/50, M/50).';
    const key=fields[0].trim().toLowerCase(); const amount=Number(fields[1]);
    if(seen.has(key))return 'A size cannot be entered twice in the same item.';
    if(!Number.isFinite(amount)||amount<=0)return 'Each size quantity must be greater than zero.';
    seen.add(key);sum+=amount;
  }
  return Math.abs(sum-qty)>0.000001?`Size total ${sum} must equal item quantity ${qty}.`:null;
}
