'use client';
import type { GreyFabricPurchase } from '../data/greyFabricData';
import { GreyIssue, greyStockGroups } from '@/lib/greyStockGroups';
import VoucherDetails from '@/components/VoucherDetails';
const qty = (n: number) => n.toLocaleString('en-IN', {maximumFractionDigits:3});
export default function GreyStockOverview({purchases,issues,selected,onSelect,loading}:{purchases:GreyFabricPurchase[];issues:GreyIssue[]|null;selected:string;onSelect:(key:string)=>void;loading:boolean}) {
  const groups = greyStockGroups(purchases,issues || []);
  const active = groups.find(g => g.key === selected);
  return <section className="space-y-4">
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4"><h2 className="font-600">Grey Fabric Stock</h2><p className="text-xs text-muted-foreground">Click a fabric for purchase and printer/dyer details. Available grey excludes all fabric already issued.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/40"><tr>{['Fabric / Quality','Purchased (Actual)','Sent for Process','Available Grey','Pending with Printer/Dyer'].map(h=><th key={h} className="p-3 text-left">{h}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} className="p-5">Loading stock…</td></tr> : groups.length === 0 ? <tr><td colSpan={5} className="p-5">No grey purchases recorded.</td></tr> : groups.map(g=><tr key={g.key} onClick={()=>onSelect(selected===g.key?'':g.key)} className={`border-t border-border cursor-pointer hover:bg-muted/30 ${selected===g.key?'bg-primary/5':''}`}>
          <td className="p-3"><button type="button" aria-expanded={selected===g.key} onClick={e=>{e.stopPropagation();onSelect(selected===g.key?'':g.key);}} className="text-primary text-left font-600">{g.name}</button><p className="text-xs text-muted-foreground">{g.type} · {g.purchases.length} purchases · {g.unit}</p></td>
          <td className="p-3 tabular-nums">{qty(g.purchased)}</td><td className="p-3 tabular-nums">{issues===null?'—':qty(g.sent)}</td><td className="p-3 tabular-nums font-600">{issues===null?'—':qty(g.available)}</td><td className="p-3 tabular-nums">{issues===null?'—':qty(g.pending)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>
    {active && <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex justify-between gap-4"><h3 className="font-600 break-words">{active.name} — Printer / Dyer Breakdown</h3><button onClick={()=>onSelect('')} className="text-primary">Close details</button></div>
      <p className="text-xs text-muted-foreground">Available here: {issues===null?'—':qty(active.available)} {active.unit}. Received processed fabric belongs to finished inventory.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr>{['Issue Voucher','Grey Purchase','Printer / Dyer','Issued','Processed Received','Pending Grey'].map(h=><th key={h} className="text-left p-2">{h}</th>)}</tr></thead><tbody>
        {issues===null ? <tr><td colSpan={6} className="p-2">Issue details unavailable. Use Retry.</td></tr> : active.issues.length===0 ? <tr><td colSpan={6} className="p-2">No issue vouchers for this fabric.</td></tr> : active.issues.map(i=><tr key={i.id} className="border-t border-border"><td className="p-2"><VoucherDetails table="printer_fabric_issues" recordId={i.id} label={i.issue_no}/><div className="text-xs text-muted-foreground">{i.date}</div></td><td className="p-2">{i.gray_fabric_ref}</td><td className="p-2">{i.printer_account}</td><td className="p-2">{qty(Number(i.qty_issued))}</td><td className="p-2">{i.qty_actual_received==null?'Not recorded':qty(Number(i.qty_actual_received))}</td><td className="p-2">{qty(Number(i.qty_pending))}</td></tr>)}
      </tbody></table></div>
      <p className="text-xs text-muted-foreground">Purchase vouchers and their individual balances are below.</p>
    </div>}
  </section>;
}
