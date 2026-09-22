/** Grey issued is historical quantity sent, independent of subsequent receipts. */
export function greyIssueSummary(actualQty: number, purchaseNo: string, issues: Array<{gray_fabric_ref: string; qty_issued: number | string}>) {
  const sent = Math.round(issues.filter(row => row.gray_fabric_ref === purchaseNo).reduce((sum, row) => sum + Number(row.qty_issued || 0), 0) * 10000) / 10000;
  return { sent, available: Math.round((actualQty - sent) * 10000) / 10000 };
}
