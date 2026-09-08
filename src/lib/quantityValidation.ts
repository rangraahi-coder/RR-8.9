export function validateQCQuantities(rows:{piecesReceived:number;passCount:string|number;failCount:string|number}[]):string|null{
 if(!rows.length)return 'At least one component is required.';
 for(const row of rows){const received=Number(row.piecesReceived),pass=Number(row.passCount),fail=Number(row.failCount);
  if([received,pass,fail].some(n=>!Number.isInteger(n)||n<0))return 'QC quantities must be non-negative whole numbers.';
  if(pass+fail>received)return 'Pass plus fail cannot exceed pieces received.';
 }
 return null;
}
