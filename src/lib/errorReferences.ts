export const errorReferenceTables: Record<string, {table: string; field: string}> = {
 EIV:{table:'emb_issue_vouchers',field:'voucher_no'}, ERV:{table:'emb_receive_vouchers',field:'voucher_no'},
 HWI:{table:'emb_issue_vouchers',field:'voucher_no'}, HWR:{table:'emb_receive_vouchers',field:'voucher_no'},
 SIV:{table:'stitch_issue_vouchers',field:'voucher_no'}, SRV:{table:'stitch_receive_vouchers',field:'voucher_no'},
 CIV:{table:'contractor_issue_vouchers',field:'voucher_no'}, CRV:{table:'contractor_receive_vouchers',field:'voucher_no'},
 CUT:{table:'cutting_entries',field:'entry_no'}, JC:{table:'job_cards',field:'job_card_no'},
 PFI:{table:'printer_fabric_issues',field:'issue_no'}, PFR:{table:'printer_fabric_receipts',field:'receipt_no'},
};
export function errorReferences(message: string) {
 return [...new Set(message.match(/\b(?:EIV|ERV|HWI|HWR|SIV|SRV|CIV|CRV|CUT|PFI|PFR)-\d+\b|\bJC-\d{4}-\d+\b/g) || [])]
 .map(reference => ({reference, ...errorReferenceTables[reference.split('-')[0]]}));
}
export function errorRequestRecord(url: string) {
 try {
  const parsed=new URL(url);
  const table=parsed.pathname.match(/\/rest\/v1\/([a-z_]+)$/)?.[1];
  const id=parsed.searchParams.get('id')?.match(/^eq\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
  if(!table||!id||!Object.values(errorReferenceTables).some(ref=>ref.table===table))return undefined;
  return {table,id,label:'Affected record'};
 }catch{return undefined;}
}
