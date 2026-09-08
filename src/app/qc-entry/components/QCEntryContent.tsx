'use client';
import {validateQCQuantities} from '@/lib/quantityValidation';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, CheckCircle2, ChevronDown, ChevronRight, Trash2, ShieldCheck, Pencil, Search } from 'lucide-react';
import { QCEntry, DEFECT_CATEGORIES } from '../data/qcData';
import Link from 'next/link';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { stitchingVoucherService, StitchReceiveVoucher } from '@/lib/services/stitchingVoucherService';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

interface SubComponentRow {
  id: string;
  component: string;
  piecesReceived: number;
  passCount: string;
  failCount: string;
  sizeBreakdown: { size: string; qty: number }[];
  defectCategories: string[];
}

function makeSubComponentRow(component: string, sizeBreakdown: { size: string; qty: number }[], piecesReceived: number): SubComponentRow {
  return {
    id: `qc-sc-${Date.now()}-${Math.random()}`,
    component,
    piecesReceived,
    passCount: String(piecesReceived),
    failCount: '0',
    sizeBreakdown,
    defectCategories: [],
  };
}

export default function QCEntryContent() {
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<QCEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<QCEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [entrySearch, setEntrySearch] = useState('');

  // Real-time stitching receive vouchers
  const [stitchReceiveVouchers, setStitchReceiveVouchers] = useState<StitchReceiveVoucher[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  const fetchReceiveVouchers = useCallback(async () => {
    setLoadingVouchers(true);
    const data = await stitchingVoucherService.getReceiveVouchers();
    setStitchReceiveVouchers(data);
    setLoadingVouchers(false);
  }, []);

  // ── Fetch QC entries from Supabase ────────────────────────────────────────
  const fetchQCEntries = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: entriesData, error: entriesError } = await supabase
        .from('qc_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (entriesError) {
        console.error('Error fetching QC entries:', entriesError);
        return;
      }

      if (!entriesData) return;

      // Fetch all sub-components for these entries
      const entryIds = entriesData.map((e: any) => e.id);
      let subComponentsData: any[] = [];
      if (entryIds.length > 0) {
        const { data: subs, error: subsError } = await supabase
          .from('qc_sub_components')
          .select('*')
          .in('qc_entry_id', entryIds);
        if (!subsError && subs) {
          subComponentsData = subs;
        }
      }

      const mapped: QCEntry[] = entriesData.map((r: any) => {
        const subs = subComponentsData
          .filter((s: any) => s.qc_entry_id === r.id)
          .map((s: any) => ({
            id: s.id,
            component: s.component,
            piecesReceived: s.pieces_received,
            passCount: s.pass_count,
            failCount: s.fail_count,
            sizeBreakdown: s.size_breakdown || [],
            defectCategories: s.defect_categories || [],
          }));
        return {
          id: r.id,
          entryNo: r.entry_no,
          date: r.date,
          jobCardRef: r.job_card_ref || '',
          styleName: r.style_name,
          stitchingEntryRef: r.stitching_entry_ref || '',
          totalPiecesReceived: r.total_pieces_received,
          totalPass: r.total_pass,
          totalFail: r.total_fail,
          netPassed: r.net_passed,
          defectCategories: r.defect_categories || [],
          subComponents: subs,
          status: r.status || 'completed',
          remarks: r.remarks || '',
        };
      });

      setEntries(mapped);
    } catch (err) {
      console.error('Unexpected error fetching QC entries:', err);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    fetchQCEntries();
    fetchReceiveVouchers();
  }, [fetchQCEntries, fetchReceiveVouchers]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    jobCardRef: '',
    styleName: '',
    stitchingEntryRef: '',
    remarks: '',
  });

  const [subComponents, setSubComponents] = useState<SubComponentRow[]>([
    makeSubComponentRow('', [], 0),
  ]);
  const [inheritedFrom, setInheritedFrom] = useState<string | null>(null);
  const [globalDefects, setGlobalDefects] = useState<string[]>([]);

  // Summary stats
  const totalPass = entries.reduce((s, e) => s + e.totalPass, 0);
  const totalFail = entries.reduce((s, e) => s + e.totalFail, 0);
  const totalReceived = entries.reduce((s, e) => s + e.totalPiecesReceived, 0);
  const totalNet = entries.reduce((s, e) => s + e.netPassed, 0);

  // Derived totals from form sub-components
  const totalPassDerived = subComponents.reduce((s, sc) => s + (parseInt(sc.passCount) || 0), 0);
  const totalFailDerived = subComponents.reduce((s, sc) => s + (parseInt(sc.failCount) || 0), 0);
  const totalReceivedDerived = subComponents.reduce((s, sc) => s + sc.piecesReceived, 0);
  const netPassedDerived = totalPassDerived;

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Realtime: subscribe to qc_entries, job_cards, and stitching receive vouchers
  useRealtimeTable('qc_entries', fetchQCEntries);
  useRealtimeTable('qc_sub_components', fetchQCEntries);
  useRealtimeTable('job_cards', refreshJobCards);
  useRealtimeTable('stitch_receive_vouchers', fetchReceiveVouchers);
  useRealtimeTable('stitch_receive_components', fetchReceiveVouchers);

  // Filtered QC entries for table display
  const filteredQCEntries = entrySearch
    ? entries.filter((e) =>
        e.entryNo.toLowerCase().includes(entrySearch.toLowerCase()) ||
        e.styleName.toLowerCase().includes(entrySearch.toLowerCase()) ||
        (e.jobCardRef || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
        (e.stitchingEntryRef || '').toLowerCase().includes(entrySearch.toLowerCase())
      )
    : entries;

  // Filtered stitching receive vouchers based on selected job card
  const filteredReceiveVouchers = form.jobCardRef
    ? stitchReceiveVouchers.filter((v) => v.jobCardRef === form.jobCardRef)
    : stitchReceiveVouchers;

  // Components available from the selected stitching receive voucher
  const selectedReceiveVoucher = stitchReceiveVouchers.find((v) => v.voucherNo === form.stitchingEntryRef);
  const availableComponents = selectedReceiveVoucher?.components ?? [];

  // Auto-inherit sub-components from a stitching receive voucher
  const inheritFromReceiveVoucher = (voucher: StitchReceiveVoucher) => {
    const rows: SubComponentRow[] = voucher.components.map((c) => {
      return makeSubComponentRow(c.component, [], c.receivedQty);
    });
    setSubComponents(rows.length > 0 ? rows : [makeSubComponentRow('', [], 0)]);
    setInheritedFrom(voucher.voucherNo);
  };

  const handleStitchingRefChange = (val: string) => {
    setForm((prev) => ({ ...prev, stitchingEntryRef: val }));
    if (val) {
      const voucher = stitchReceiveVouchers.find((v) => v.voucherNo === val);
      if (voucher) {
        inheritFromReceiveVoucher(voucher);
        setForm((prev) => ({
          ...prev,
          stitchingEntryRef: val,
          jobCardRef: voucher.jobCardRef || prev.jobCardRef,
          styleName: voucher.styleName || prev.styleName,
        }));
      }
    } else {
      setSubComponents([makeSubComponentRow('', [], 0)]);
      setInheritedFrom(null);
    }
  };

  const handleJobCardChange = (val: string) => {
    if (!val) {
      setForm({ ...form, jobCardRef: '', stitchingEntryRef: '' });
      setSubComponents([makeSubComponentRow('', [], 0)]);
      setInheritedFrom(null);
      return;
    }
    const jc = jobCards.find((j) => j.jobCardNo === val);
    setForm({ ...form, jobCardRef: val, styleName: jc?.styleEn || form.styleName, stitchingEntryRef: '' });
    setSubComponents([makeSubComponentRow('', [], 0)]);
    setInheritedFrom(null);
  };

  const updateSubComponent = (id: string, field: keyof SubComponentRow, value: string | string[]) => {
    setSubComponents((prev) => prev.map((sc) => sc.id === id ? { ...sc, [field]: value } : sc));
  };

  const handleSubComponentSelect = (scId: string, componentName: string) => {
    const compData = availableComponents.find((c) => c.component === componentName);
    setSubComponents((prev) => prev.map((sc) => {
      if (sc.id !== scId) return sc;
      const qty = compData ? compData.receivedQty : sc.piecesReceived;
      return { ...sc, component: componentName, piecesReceived: qty, passCount: String(qty) };
    }));
  };

  const toggleSubDefect = (scId: string, defect: string) => {
    setSubComponents((prev) =>
      prev.map((sc) => {
        if (sc.id !== scId) return sc;
        const has = sc.defectCategories.includes(defect);
        return { ...sc, defectCategories: has ? sc.defectCategories.filter((d) => d !== defect) : [...sc.defectCategories, defect] };
      })
    );
  };

  const toggleGlobalDefect = (defect: string) => {
    setGlobalDefects((prev) =>
      prev.includes(defect) ? prev.filter((d) => d !== defect) : [...prev, defect]
    );
  };

  const addSubComponent = () => {
    setSubComponents((prev) => [...prev, makeSubComponentRow('', [], 0)]);
  };

  const removeSubComponent = (id: string) => {
    setSubComponents((prev) => prev.filter((sc) => sc.id !== id));
  };

  // ── Generate next entry number ────────────────────────────────────────────
  const getNextEntryNo = async (): Promise<string> => {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('qc_entries')
        .select('*', { count: 'exact', head: true });
      return `QC-${String((count || 0) + 1).padStart(4, '0')}`;
    } catch {
      return `QC-${String(Date.now()).slice(-4)}`;
    }
  };

  // ── Save to Supabase ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.date) { setFormError('Date is required.'); return; }
    if (!form.jobCardRef) { setFormError('Job Card is required.'); return; }
    if (subComponents.some((sc) => !sc.component.trim())) {
      setFormError('All sub-components must have a component name.');
      return;
    }
    if (subComponents.every((sc) => sc.piecesReceived <= 0)) {
      setFormError('At least one sub-component must have pieces received > 0.');
      return;
    }

    const quantityError=validateQCQuantities(subComponents);if(quantityError){setFormError(quantityError);return;}
    if(saving)return;
    setSaving(true);
    try {
      const supabase = createClient();
      const entryNo = await getNextEntryNo();

      const allDefects = Array.from(new Set([
        ...globalDefects,
        ...subComponents.flatMap((sc) => sc.defectCategories),
      ]));

      const {error}=await supabase.rpc('save_original_qc_entry',{
       p_id:null,p_header:{entry_no:entryNo,date:form.date,job_card_ref:form.jobCardRef||null,style_name:form.styleName||'',stitching_entry_ref:form.stitchingEntryRef||null,total_pieces_received:totalReceivedDerived,total_pass:totalPassDerived,total_fail:totalFailDerived,net_passed:netPassedDerived,defect_categories:allDefects,status:'completed',remarks:form.remarks||null},
       p_lines:subComponents.map(sc=>({component:sc.component,pieces_received:sc.piecesReceived,pass_count:parseInt(sc.passCount)||0,fail_count:parseInt(sc.failCount)||0,size_breakdown:sc.sizeBreakdown,defect_categories:sc.defectCategories}))
      });
      if(error)throw error;

      // Success — refresh and close
      await fetchQCEntries();
      resetForm();
    } catch (err: any) {
      setFormError(`Unexpected error: ${err?.message || 'Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setFormError(null);
    setEditingEntry(null);
    setForm({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', stitchingEntryRef: '', remarks: '' });
    setSubComponents([makeSubComponentRow('', [], 0)]);
    setInheritedFrom(null);
    setGlobalDefects([]);
  };

  // ── Delete QC Entry ───────────────────────────────────────────────────────
  const handleDelete = async (entry: QCEntry) => {
    if (!confirm(`Delete QC entry ${entry.entryNo}? This cannot be undone.`)) return;
    setDeletingId(entry.id);
    try {
      const supabase = createClient();
      // Delete sub-components first
      await supabase.from('qc_sub_components').delete().eq('qc_entry_id', entry.id);
      const { error } = await supabase.from('qc_entries').delete().eq('id', entry.id);
      if (error) {
        alert(`Failed to delete: ${error.message}`);
      } else {
        await fetchQCEntries();
      }
    } catch (err: any) {
      alert(`Unexpected error: ${err?.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Open Edit Modal ───────────────────────────────────────────────────────
  const handleEdit = (entry: QCEntry) => {
    setEditingEntry(entry);
    setForm({
      date: entry.date,
      jobCardRef: entry.jobCardRef,
      styleName: entry.styleName,
      stitchingEntryRef: entry.stitchingEntryRef,
      remarks: entry.remarks || '',
    });
    const mappedSubs: SubComponentRow[] = entry.subComponents.map((sc) => ({
      id: sc.id,
      component: sc.component,
      piecesReceived: sc.piecesReceived,
      passCount: String(sc.passCount),
      failCount: String(sc.failCount),
      sizeBreakdown: sc.sizeBreakdown,
      defectCategories: sc.defectCategories,
    }));
    setSubComponents(mappedSubs.length > 0 ? mappedSubs : [makeSubComponentRow('', [], 0)]);
    setGlobalDefects(entry.defectCategories);
    setInheritedFrom(entry.stitchingEntryRef || null);
    setShowModal(true);
  };

  // ── Update existing entry ─────────────────────────────────────────────────
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setFormError(null);

    if (!form.date) { setFormError('Date is required.'); return; }
    if (!form.jobCardRef) { setFormError('Job Card is required.'); return; }
    if (subComponents.some((sc) => !sc.component.trim())) {
      setFormError('All sub-components must have a component name.');
      return;
    }

    const quantityError=validateQCQuantities(subComponents);if(quantityError){setFormError(quantityError);return;}
    if(saving)return;
    setSaving(true);
    try {
      const supabase = createClient();

      const allDefects = Array.from(new Set([
        ...globalDefects,
        ...subComponents.flatMap((sc) => sc.defectCategories),
      ]));

      const {error}=await supabase.rpc('save_original_qc_entry',{
       p_id:editingEntry.id,p_header:{entry_no:editingEntry.entryNo,date:form.date,job_card_ref:form.jobCardRef||null,style_name:form.styleName||'',stitching_entry_ref:form.stitchingEntryRef||null,total_pieces_received:totalReceivedDerived,total_pass:totalPassDerived,total_fail:totalFailDerived,net_passed:netPassedDerived,defect_categories:allDefects,status:editingEntry.status,remarks:form.remarks||null},
       p_lines:subComponents.map(sc=>({component:sc.component,pieces_received:sc.piecesReceived,pass_count:parseInt(sc.passCount)||0,fail_count:parseInt(sc.failCount)||0,size_breakdown:sc.sizeBreakdown,defect_categories:sc.defectCategories}))
      });
      if(error)throw error;
      await fetchQCEntries();
      resetForm();
    } catch (err: any) {
      setFormError(`Unexpected error: ${err?.message || 'Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const STYLE_NAMES = Array.from(new Set(jobCards.map((jc) => jc.styleEn).filter(Boolean))).sort();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">QC Entry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pass/fail counts per component &amp; size, defect categories — auto-inherits sub-components from Stitching entry
          </p>
        </div>
        <button
          onClick={() => { setEditingEntry(null); setSubComponents([makeSubComponentRow('', [], 0)]); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={14} />
          New QC Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Pieces Received</p>
          <p className="text-2xl font-700 text-primary mt-1">{totalReceived.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">From stitching</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Pass</p>
          <p className="text-2xl font-700 text-success mt-1">{totalPass.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">QC passed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Fail</p>
          <p className="text-2xl font-700 text-danger mt-1">{totalFail.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">QC failed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Net Passed</p>
          <p className="text-2xl font-700 text-foreground mt-1">{totalNet.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">For finishing</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
          <ShieldCheck size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">QC Entries</span>
          {searchParams.get('filter') === 'pending' && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-600 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              Drill-down from Dashboard
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search entry, style, job card..."
                value={entrySearch}
                onChange={(e) => setEntrySearch(e.target.value)}
                className="input-field pl-8 text-xs w-52 h-8"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {loadingEntries ? 'Loading…' : `${filteredQCEntries.length} records`}
            </span>
            <span className="text-[10px] text-success font-500 bg-success/10 px-1.5 py-0.5 rounded-md">Live</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Stitching Ref</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Components</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pass</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Fail</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Defects</th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading QC entries…</p>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-muted-foreground">
                    <ShieldCheck size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No QC entries yet</p>
                    <p className="text-xs mt-1">Add QC records — sub-components auto-inherit from Stitching entry</p>
                  </td>
                </tr>
              ) : filteredQCEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
                    <Search size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-500">No entries match your search</p>
                  </td>
                </tr>
              ) : (
                filteredQCEntries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3">
                        {entry.subComponents.length > 0 && (
                          <button onClick={() => toggleRow(entry.id)} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                            {expandedRows.has(entry.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 font-600 text-primary text-xs">{entry.entryNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                      <td className="px-4 py-3">
                        <Link href={`/item-master?search=${encodeURIComponent(entry.styleName)}`} className="text-primary hover:underline font-500 text-sm">{entry.styleName}</Link>
                        {entry.jobCardRef && <div className="text-xs text-muted-foreground">JC: {entry.jobCardRef}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {entry.stitchingEntryRef ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-foreground text-xs font-500">
                            <CheckCircle2 size={10} /> {entry.stitchingEntryRef}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {entry.subComponents.map((sc) => (
                            <span key={sc.id} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-500">{sc.component}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.totalPiecesReceived.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{entry.totalPass.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{entry.totalFail}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {entry.defectCategories.slice(0, 2).map((d) => (
                            <span key={d} className="px-1.5 py-0.5 rounded-md bg-danger/10 text-danger text-xs font-500">{d}</span>
                          ))}
                          {entry.defectCategories.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-xs">+{entry.defectCategories.length - 2}</span>
                          )}
                          {entry.defectCategories.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit entry"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={deletingId === entry.id}
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors disabled:opacity-50"
                            title="Delete entry"
                          >
                            {deletingId === entry.id ? (
                              <div className="w-3 h-3 border-2 border-danger border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRows.has(entry.id) && entry.subComponents.length > 0 && (
                      <tr className="border-b border-border/50 bg-muted/10">
                        <td colSpan={11} className="px-6 py-3">
                          <div className="flex flex-col gap-3">
                            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide">Sub-Component QC Breakdown</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {entry.subComponents.map((sc) => (
                                <div key={sc.id} className="bg-card border border-border rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-700 text-foreground">{sc.component}</span>
                                    <span className="text-xs text-success font-600">Pass: {sc.passCount} pcs</span>
                                  </div>
                                  {sc.sizeBreakdown.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {sc.sizeBreakdown.filter((sz) => sz.qty > 0).map((sz) => (
                                        <div key={sz.size} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5">
                                          <span className="text-xs font-600 text-muted-foreground">{sz.size}:</span>
                                          <span className="text-xs font-700 text-foreground">{sz.qty}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                                    <span>Rcvd: <span className="font-600 text-foreground">{sc.piecesReceived}</span></span>
                                    <span className="text-success">Pass: <span className="font-600">{sc.passCount}</span></span>
                                    {Number(sc.failCount) > 0 && <span className="text-danger">Fail: <span className="font-600">{sc.failCount}</span></span>}
                                  </div>
                                  {sc.defectCategories.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {sc.defectCategories.map((d) => (
                                        <span key={d} className="px-1.5 py-0.5 rounded-md bg-danger/10 text-danger text-xs font-500">{d}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-base font-700 text-foreground">{editingEntry ? `Edit QC Entry — ${editingEntry.entryNo}` : 'New QC Entry'}</h2>
              <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <form onSubmit={editingEntry ? handleUpdate : handleSubmit} className="p-6 flex flex-col gap-5">

              {formError && (
                <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Date *</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Job Card Ref *</label>
                  <select value={form.jobCardRef} onChange={(e) => handleJobCardChange(e.target.value)} className="input-field text-sm">
                    <option value="">-- Select Job Card --</option>
                    {jobCards.map((jc) => (
                      <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Job Card Info Panel */}
              {form.jobCardRef && (() => {
                const jc = jobCards.find((j) => j.jobCardNo === form.jobCardRef);
                if (!jc) return null;
                return (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs">
                    <div><span className="text-muted-foreground font-600">Party:</span> <span className="text-foreground font-600 ml-1">{jc.partyName}</span></div>
                    {jc.poNo && <div><span className="text-muted-foreground font-600">PO No:</span> <span className="text-foreground ml-1">{jc.poNo}</span></div>}
                    <div><span className="text-muted-foreground font-600">Total Pieces:</span> <span className="text-primary font-700 ml-1">{jc.totalPieces}</span></div>
                    {jc.colors && jc.colors.length > 0 && <div><span className="text-muted-foreground font-600">Colors:</span> <span className="text-foreground ml-1">{jc.colors.join(', ')}</span></div>}
                    {jc.sizes && jc.sizes.length > 0 && <div><span className="text-muted-foreground font-600">Sizes:</span> <span className="text-foreground ml-1">{jc.sizes.join(', ')}</span></div>}
                  </div>
                );
              })()}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Style Name *</label>
                <select required value={form.styleName} onChange={(e) => setForm({ ...form, styleName: e.target.value })} className="input-field text-sm">
                  <option value="">-- Select Style --</option>
                  {STYLE_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Stitching Receive Voucher Reference */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">
                  Stitching Received Entry
                  <span className="ml-1.5 text-[10px] text-primary font-500 bg-primary/10 px-1.5 py-0.5 rounded-md">
                    {loadingVouchers ? 'Loading…' : `${filteredReceiveVouchers.length} available`}
                  </span>
                  <span className="ml-1.5 text-[10px] text-success font-500 bg-success/10 px-1.5 py-0.5 rounded-md">Live</span>
                </label>
                <select
                  value={form.stitchingEntryRef}
                  onChange={(e) => handleStitchingRefChange(e.target.value)}
                  className="input-field text-sm"
                  disabled={loadingVouchers}
                >
                  <option value="">-- Select Stitching Received Entry --</option>
                  {filteredReceiveVouchers.map((v) => (
                    <option key={v.id} value={v.voucherNo}>
                      {v.voucherNo} — {v.jobCardRef}{v.styleName ? ` | ${v.styleName}` : ''} ({v.totalPiecesReceived} pcs)
                    </option>
                  ))}
                </select>
                {form.jobCardRef && filteredReceiveVouchers.length === 0 && !loadingVouchers && (
                  <p className="text-xs text-warning font-500">No stitching received entries found for this job card.</p>
                )}
                {inheritedFrom && (
                  <p className="text-xs text-success font-500 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Sub-components auto-inherited from {inheritedFrom}
                  </p>
                )}
              </div>

              {/* Sub-Component Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-700 text-foreground">Sub-Component QC Details *</p>
                  <button type="button" onClick={addSubComponent} className="flex items-center gap-1 text-xs text-primary font-600 hover:underline">
                    <Plus size={12} /> Add Component
                  </button>
                </div>

                {subComponents.map((sc) => {
                  const pass = parseInt(sc.passCount) || 0;
                  const fail = parseInt(sc.failCount) || 0;
                  return (
                    <div key={sc.id} className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-muted/20">
                      {/* Component name row */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-600 text-muted-foreground">
                            Component
                            {availableComponents.length > 0 && (
                              <span className="ml-1.5 text-[10px] text-primary font-500 bg-primary/10 px-1.5 py-0.5 rounded-md">
                                From stitching entry
                              </span>
                            )}
                          </label>
                          {availableComponents.length > 0 ? (
                            <select
                              value={sc.component}
                              onChange={(e) => handleSubComponentSelect(sc.id, e.target.value)}
                              className="input-field text-sm"
                            >
                              <option value="">-- Select Component --</option>
                              {availableComponents.map((c) => (
                                <option key={c.id} value={c.component}>
                                  {c.component} ({c.receivedQty} pcs received)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={sc.component}
                              onChange={(e) => updateSubComponent(sc.id, 'component', e.target.value)}
                              className="input-field text-sm"
                              placeholder="e.g. Kurta"
                            />
                          )}
                        </div>
                        {subComponents.length > 1 && (
                          <button type="button" onClick={() => removeSubComponent(sc.id)} className="mt-5 p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Pass / Fail counts */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-muted-foreground">Pieces Received</label>
                          <input
                            type="number"
                            min="0"
                            value={sc.piecesReceived}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setSubComponents((prev) => prev.map((s) => s.id === sc.id ? { ...s, piecesReceived: val, passCount: String(val) } : s));
                            }}
                            className="input-field text-sm tabular-nums"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-muted-foreground text-success">Pass Count *</label>
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="0"
                            value={sc.passCount}
                            onChange={(e) => updateSubComponent(sc.id, 'passCount', e.target.value)}
                            className="input-field text-sm tabular-nums border-success/40 focus:border-success"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-danger">Fail Count</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={sc.failCount}
                            onChange={(e) => updateSubComponent(sc.id, 'failCount', e.target.value)}
                            className="input-field text-sm tabular-nums border-danger/40 focus:border-danger"
                          />
                        </div>
                      </div>

                      {/* Size breakdown */}
                      {sc.sizeBreakdown.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs font-600 text-muted-foreground">Size Breakdown (inherited)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {sc.sizeBreakdown.filter((sz) => sz.qty > 0).map((sz) => (
                              <div key={sz.size} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5">
                                <span className="text-xs font-600 text-muted-foreground">{sz.size}:</span>
                                <span className="text-xs font-700 text-foreground">{sz.qty}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Defect categories */}
                      {fail > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs font-600 text-muted-foreground">Defect Categories</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DEFECT_CATEGORIES.map((defect) => (
                              <button
                                key={defect}
                                type="button"
                                onClick={() => toggleSubDefect(sc.id, defect)}
                                className={`px-2 py-1 rounded-lg text-xs font-500 border transition-colors ${
                                  sc.defectCategories.includes(defect)
                                    ? 'bg-danger text-white border-danger' : 'bg-card text-muted-foreground border-border hover:border-danger/50 hover:text-danger'
                                }`}
                              >
                                {defect}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {pass > 0 && (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-success font-600">Pass: <span className="font-700">{pass} pcs</span></span>
                          {fail > 0 && <span className="text-danger">Fail: <span className="font-700">{fail}</span></span>}
                          <span className="text-muted-foreground">Net: <span className="font-600 text-foreground">{pass - fail} pcs</span></span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {totalPassDerived > 0 && (
                  <div className="flex items-center gap-4 bg-success/10 border border-success/20 rounded-lg px-4 py-2.5">
                    <p className="text-xs text-success font-600">
                      Total Pass: <span className="font-700">{totalPassDerived}</span>
                      {totalFailDerived > 0 && <span className="text-danger ml-3">Fail: {totalFailDerived}</span>}
                      <span className="ml-3 text-foreground">Net Passed: <span className="font-700">{netPassedDerived}</span></span>
                    </p>
                  </div>
                )}
              </div>

              {/* Global Defect Categories */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-700 text-foreground">Overall Defect Categories <span className="font-400 text-muted-foreground">(optional)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {DEFECT_CATEGORIES.map((defect) => (
                    <button
                      key={defect}
                      type="button"
                      onClick={() => toggleGlobalDefect(defect)}
                      className={`px-2 py-1 rounded-lg text-xs font-500 border transition-colors ${
                        globalDefects.includes(defect)
                          ? 'bg-danger text-white border-danger' : 'bg-card text-muted-foreground border-border hover:border-danger/50 hover:text-danger'
                      }`}
                    >
                      {defect}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} disabled={saving} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : editingEntry ? 'Update QC Entry' : 'Save QC Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
