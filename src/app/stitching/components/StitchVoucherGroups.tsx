'use client';
import { groupStitchVouchers } from '@/lib/stitchVoucherGroups';
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { StitchIssueVoucher, StitchReceiveVoucher } from '@/lib/services/stitchingVoucherService';
type Voucher = StitchIssueVoucher | StitchReceiveVoucher;

// Grouping is presentation-only: source voucher IDs remain intact for all actions.
export default function StitchVoucherGroups<T extends Voucher>({ vouchers, issues, kind, loading, children }: {
  vouchers: T[]; issues: StitchIssueVoucher[]; kind: 'issue' | 'receive'; loading: boolean;
  children: (vouchers: T[]) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupStitchVouchers(vouchers, issues), [vouchers, issues]);
  function toggle(key: string) { setExpanded(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; }); }
  function summary(rows: T[]) {
    const total = rows.reduce((n, v) => n + Number('totalPieces' in v ? v.totalPieces : v.totalPiecesReceived), 0);
    return `${rows.length} vouchers · ${kind === 'issue' ? 'Issued' : 'Received'} ${total.toLocaleString('en-IN')} pcs`;
  }
  if (loading) return <p className="p-6 text-muted-foreground" role="status">Loading vouchers…</p>;
  if (!vouchers.length) return <p className="p-6 text-muted-foreground">No matching vouchers.</p>;
  return <div className="min-w-0">
    <p className="px-4 py-2 text-xs text-muted-foreground">Item → Job Card → Vouchers · Totals follow the current filters</p>
    {groups.map(([key, item]) => <section key={key} className="border-t border-border min-w-0">
      <button type="button" aria-expanded={expanded.has(key)} onClick={() => toggle(key)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30">
        {expanded.has(key) ? <ChevronDown size={18} className="shrink-0"/> : <ChevronRight size={18} className="shrink-0"/>}
        <span className="min-w-0 flex-1"><span className="block font-semibold text-primary break-words">{item.name}</span><span className="block text-xs text-muted-foreground mt-1">{item.jobs.size} Job Cards · {summary(item.rows)}</span></span>
      </button>
      {expanded.has(key) && [...item.jobs].map(([jobKey, job]) => {
        const nestedKey = JSON.stringify([key, jobKey]);
        return <div key={jobKey} className="border-t border-border bg-muted/10 min-w-0">
          <button type="button" aria-expanded={expanded.has(nestedKey)} onClick={() => toggle(nestedKey)} className="w-full flex items-start gap-3 px-6 py-3 text-left hover:bg-muted/30">
            {expanded.has(nestedKey) ? <ChevronDown size={16} className="shrink-0"/> : <ChevronRight size={16} className="shrink-0"/>}
            <span className="min-w-0"><span className="block font-semibold break-words">{job.name}</span><span className="block text-xs text-muted-foreground">{summary(job.rows)}</span></span>
          </button>
          {expanded.has(nestedKey) && children(job.rows)}
        </div>;
      })}
    </section>)}
  </div>;
}
