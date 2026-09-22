/** Legacy receipts without grey_consumed settled qty_received only. Do not invent a historical shrinkage adjustment. */
export function printerReceiptTotals(rows:ReadonlyArray<{qty_received:number|string;grey_consumed?:number|string|null}>){
 let received=0,consumed=0;
 for(const row of rows){received+=Number(row.qty_received)||0;consumed+=Number(row.grey_consumed??row.qty_received)||0;}
 return {received:Math.round(received*1000)/1000,consumed:Math.round(consumed*1000)/1000};
}
