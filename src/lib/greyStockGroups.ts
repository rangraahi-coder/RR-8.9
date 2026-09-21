import type { GreyFabricPurchase } from '@/app/grey-fabric/data/greyFabricData';
export interface GreyIssue { id: string; gray_fabric_ref: string; qty_issued: number; qty_pending: number; qty_actual_received: number | null; issue_no: string; printer_account: string; date: string; }
const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export function greyStockKey(p: GreyFabricPurchase) {
  // Quality/width are recorded in fabricName; do not fuzzy-merge different names.
  const unit = /^(m|mt\.?|metres?|meters?)$/.test(norm(p.unit)) ? 'metre' : norm(p.unit);
  return JSON.stringify([norm(p.fabricName), norm(p.fabricType), unit]);
}
export function greyStockGroups(purchases: GreyFabricPurchase[], issues: GreyIssue[]) {
  const groups = new Map<string, { key: string; name: string; type: string; unit: string; purchases: GreyFabricPurchase[]; issues: GreyIssue[]; purchased: number; sent: number; pending: number; available: number }>();
  for (const p of purchases) {
    const key = greyStockKey(p);
    if (!groups.has(key)) groups.set(key, {key, name:p.fabricName, type:p.fabricType, unit:p.unit, purchases:[], issues:[], purchased:0, sent:0, pending:0, available:0});
    const g = groups.get(key)!; g.purchases.push(p); g.purchased += p.actualFabricQty;
  }
  for (const g of groups.values()) {
    const refs = new Set(g.purchases.map(p => p.purchaseNo));
    g.issues = issues.filter(i => refs.has(i.gray_fabric_ref));
    g.sent = g.issues.reduce((s,i) => s + Number(i.qty_issued || 0),0);
    g.pending = g.issues.reduce((s,i) => s + Number(i.qty_pending || 0),0);
    g.available = Math.round((g.purchased-g.sent)*10000)/10000;
  }
  return [...groups.values()].sort((a,b) => a.name.localeCompare(b.name));
}
