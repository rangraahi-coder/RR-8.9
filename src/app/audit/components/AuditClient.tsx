'use client';

import React, { useEffect, useState } from 'react';
import ERPLayout from '@/components/erp/ERPLayout';
import PageHeader from '@/components/erp/PageHeader';
import { TableSkeleton } from '@/components/erp/LoadingSkeleton';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import { supabase } from '@/lib/supabase/client';

interface AuditRow {
  id: string;
  created_at?: string;
  performed_by?:string;transaction_type?:string;voucher_no?:string;job_card_ref?:string;
  changed_by?: string;
  action?: string;
  table_name?: string;
  record_id?: string;
  old_values?: unknown;
  new_values?: unknown;
}

function formatDate(d: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AuditClient() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [legacy,current]=await Promise.all([
        supabase.from('stitch_audit_trail').select('*').order('created_at',{ascending:false}).limit(100),
        supabase.from('erp_activity_log').select('*').order('created_at',{ascending:false}).limit(100)
      ]);
      if(legacy.error||current.error)throw new Error(legacy.error?.message||current.error?.message);
      setRows([...(legacy.data||[]),...(current.data||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRealtimeTable('stitch_audit_trail',load);

  return (
    <ERPLayout>
      <PageHeader
        title="Audit Trail"
        breadcrumbs={[{ label: 'KurtiERP' }, { label: 'Audit Trail' }]}
      />

      <div className="card p-0 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
            <button onClick={load} className="btn-secondary text-xs"><RefreshCw size={14} /> Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="table-th">Timestamp</th>
                  <th className="table-th">User</th>
                  <th className="table-th">Action</th>
                  <th className="table-th">Voucher</th>
                  <th className="table-th">Job Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={5}><TableSkeleton rows={8} cols={5} /></td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <ShieldCheck size={22} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">No audit records found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="table-row-hover">
                      <td className="table-td text-slate-500 text-xs">{formatDate(r.created_at ?? '')}</td>
                      <td className="table-td font-semibold text-slate-700">{r.performed_by ?? '—'}</td>
                      <td className="table-td">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md">{r.transaction_type ?? '—'}</span>
                      </td>
                      <td className="table-td text-slate-600 text-xs">{r.voucher_no ?? '—'}</td>
                      <td className="table-td font-mono text-xs text-slate-400">{r.job_card_ref ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ERPLayout>
  );
}
