'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, CheckCircle2, ChevronDown, ChevronRight, Trash2, PackageCheck, BadgeCheck } from 'lucide-react';
import {
  FinishingEntry,
  FinishingSubComponentDetail,
  PACKAGING_STATUS_OPTIONS,
} from '../data/finishingData';
import { QCEntry } from '@/app/qc-entry/data/qcData';
import {finishingEntryService} from '@/lib/services/finishingEntryService';
import {toast} from 'sonner';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';

interface SubComponentRow {
  id: string;
  component: string;
  qcPassCount: number;
  finalCount: string;
  packagingStatus: 'packed' | 'unpacked' | 'partial';
  sizeBreakdown: { size: string; qty: number }[];
  remarks: string;
}

function makeSubComponentRow(
  component: string,
  qcPassCount: number,
  sizeBreakdown: { size: string; qty: number }[]
): SubComponentRow {
  return {
    id: `fin-sc-${Date.now()}-${Math.random()}`,
    component,
    qcPassCount,
    finalCount: String(qcPassCount),
    packagingStatus: 'unpacked',
    sizeBreakdown,
    remarks: '',
  };
}

const PACKAGING_BADGE: Record<string, string> = {
  packed: 'bg-success/10 text-success',
  partial: 'bg-warning/10 text-warning',
  unpacked: 'bg-danger/10 text-danger',
};

export default function FinishingEntryContent() {
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const [entries, setEntries] = useState<FinishingEntry[]>([]);
  const [qcEntries,setQcEntries]=useState<QCEntry[]>([]);
  const [saving,setSaving]=useState(false);const saveRef=useRef(false);const requestId=useRef<string|null>(null);
  const load=useCallback(async()=>{try{const [f,q]=await Promise.all([finishingEntryService.getAll(),finishingEntryService.getQCEntries()]);setEntries(f);setQcEntries(q);}catch(e){toast.error((e as Error).message||'Unable to load finishing data',{id:'finishing-load'});}},[]);
  useEffect(()=>{void load();},[load]);
  useRealtimeTable('qc_entries',load);useRealtimeTable('qc_sub_components',load);
  const [showModal, setShowModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    jobCardRef: '',
    styleName: '',
    qcEntryRef: '',
    qualitySignOffBy: '',
    qualitySignOff: false,
    remarks: '',
  });

  const [subComponents, setSubComponents] = useState<SubComponentRow[]>([
    makeSubComponentRow('Kurta', 0, []),
  ]);
  const [inheritedFrom, setInheritedFrom] = useState<string | null>(null);

  // Summary stats
  const totalFinished = entries.reduce((s, e) => s + e.totalFinished, 0);
  const totalQcPassed = entries.reduce((s, e) => s + e.totalQcPassed, 0);
  const totalPacked = entries.filter((e) => e.packagingStatus === 'packed').length;
  const totalSignedOff = entries.filter((e) => e.qualitySignOff).length;

  // Derived totals from form
  const totalFinalDerived = subComponents.reduce((s, sc) => s + (parseInt(sc.finalCount) || 0), 0);
  const totalQcDerived = subComponents.reduce((s, sc) => s + sc.qcPassCount, 0);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Realtime: subscribe to finishing_entries and job_cards table changes from any user/session
  useRealtimeTable('finishing_entries', load);
  useRealtimeTable('job_cards', refreshJobCards);

  const inheritFromQC = (qcEntry: QCEntry) => {
    const rows: SubComponentRow[] = qcEntry.subComponents.map((sc) =>
      makeSubComponentRow(sc.component, sc.passCount, sc.sizeBreakdown)
    );
    setSubComponents(rows.length > 0 ? rows : [makeSubComponentRow('Kurta', 0, [])]);
    setInheritedFrom(qcEntry.entryNo);
  };

  const handleQCRefChange = (val: string) => {
    setForm({ ...form, qcEntryRef: val });
    if (val) {
      const qc = qcEntries.find((q) => q.entryNo === val);
      if (qc) {
        inheritFromQC(qc);
        setForm((prev) => ({
          ...prev,
          qcEntryRef: val,
          jobCardRef: qc.jobCardRef || prev.jobCardRef,
          styleName: qc.styleName || prev.styleName,
        }));
      }
    } else {
      setSubComponents([makeSubComponentRow('Kurta', 0, [])]);
      setInheritedFrom(null);
    }
  };

  const handleJobCardChange = (val: string) => {
    if (!val) { setForm({ ...form, jobCardRef: '' }); return; }
    const jc = jobCards.find((j) => j.jobCardNo === val);
    setForm({ ...form, jobCardRef: val, styleName: jc?.styleEn || form.styleName });
  };

  const updateSubComponent = (id: string, field: keyof SubComponentRow, value: string) => {
    setSubComponents((prev) => prev.map((sc) => sc.id === id ? { ...sc, [field]: value } : sc));
  };

  const addSubComponent = () => {
    setSubComponents((prev) => [...prev, makeSubComponentRow('', 0, [])]);
  };

  const removeSubComponent = (id: string) => {
    setSubComponents((prev) => prev.filter((sc) => sc.id !== id));
  };

  const overallPackagingStatus = (): 'packed' | 'unpacked' | 'partial' => {
    const statuses = subComponents.map((sc) => sc.packagingStatus);
    if (statuses.every((s) => s === 'packed')) return 'packed';
    if (statuses.every((s) => s === 'unpacked')) return 'unpacked';
    return 'partial';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(saveRef.current)return;
    setFormError(null);

    if (!form.date) { setFormError('Date is required.'); return; }
    if (!form.jobCardRef) { setFormError('Job Card is required.'); return; }
    if (subComponents.some((sc) => !sc.component.trim())) {
      setFormError('All sub-components must have a component name.');
      return;
    }

    if(!subComponents.length || subComponents.some(sc=>!Number.isInteger(Number(sc.finalCount))||Number(sc.finalCount)<0||Number(sc.finalCount)>sc.qcPassCount)){setFormError('Finished quantity must be a whole number between zero and QC passed quantity.');return;}
    if(form.qualitySignOff&&!form.qualitySignOffBy.trim()){setFormError('Enter the person signing off quality.');return;}
    requestId.current??=crypto.randomUUID();
    const builtSubs: FinishingSubComponentDetail[] = subComponents.map((sc) => ({
      id: sc.id,
      component: sc.component,
      qcPassCount: sc.qcPassCount,
      finalCount: parseInt(sc.finalCount) || 0,
      packagingStatus: sc.packagingStatus,
      sizeBreakdown: sc.sizeBreakdown,
      remarks: sc.remarks,
    }));

    const newEntry: FinishingEntry = {
      id: requestId.current,
      entryNo: `FIN-${String(Math.max(0,...entries.map(e=>Number(e.entryNo.replace(/^FIN-/,''))||0))+1).padStart(4,'0')}`,
      date: form.date,
      jobCardRef: form.jobCardRef,
      styleName: form.styleName,
      qcEntryRef: form.qcEntryRef,
      totalQcPassed: totalQcDerived,
      totalFinished: totalFinalDerived,
      packagingStatus: overallPackagingStatus(),
      qualitySignOff: form.qualitySignOff,
      qualitySignOffBy: form.qualitySignOffBy,
      subComponents: builtSubs,
      status: 'completed',
      remarks: form.remarks,
    };

    saveRef.current=true;setSaving(true);
    try{await finishingEntryService.create(newEntry);requestId.current=null;await load();}
    catch(e){setFormError((e as Error).message||'Save failed. Please retry.');return;}
    finally{saveRef.current=false;setSaving(false);}

    resetForm();
  };

  const resetForm = () => {
    setShowModal(false);
    setFormError(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      jobCardRef: '',
      styleName: '',
      qcEntryRef: '',
      qualitySignOffBy: '',
      qualitySignOff: false,
      remarks: '',
    });
    setSubComponents([makeSubComponentRow('Kurta', 0, [])]);
    setInheritedFrom(null);
  };

  const STYLE_NAMES = Array.from(
    new Set(jobCards.map((jc) => jc.styleEn).filter(Boolean))
  ).sort();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Finishing Entry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Record final piece counts, packaging status &amp; quality sign-off — auto-inherits sub-components from QC entry
          </p>
        </div>
        <button
          onClick={() => { setSubComponents([makeSubComponentRow('Kurta', 0, [])]); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={14} />
          New Finishing Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">QC Passed (Total)</p>
          <p className="text-2xl font-700 text-primary mt-1">{totalQcPassed.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">From QC entries</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Final Finished</p>
          <p className="text-2xl font-700 text-success mt-1">{totalFinished.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces finished</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Fully Packed</p>
          <p className="text-2xl font-700 text-foreground mt-1">{totalPacked}</p>
          <p className="text-xs text-muted-foreground">Entries packed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Quality Sign-Off</p>
          <p className="text-2xl font-700 text-foreground mt-1">{totalSignedOff}</p>
          <p className="text-xs text-muted-foreground">Entries approved</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <PackageCheck size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Finishing Entries</span>
          <span className="ml-auto text-xs text-muted-foreground">{entries.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">QC Ref</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Components</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">QC Passed</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Final Count</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Packaging</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Sign-Off</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <PackageCheck size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No finishing entries yet</p>
                    <p className="text-xs mt-1">Add finishing records — sub-components auto-inherit from QC entry</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
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
                        <span className="font-500 text-sm text-foreground">{entry.styleName}</span>
                        {entry.jobCardRef && <div className="text-xs text-muted-foreground">JC: {entry.jobCardRef}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {entry.qcEntryRef ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-foreground text-xs font-500">
                            <CheckCircle2 size={10} /> {entry.qcEntryRef}
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
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.totalQcPassed.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{entry.totalFinished.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-600 capitalize ${PACKAGING_BADGE[entry.packagingStatus]}`}>
                          {entry.packagingStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.qualitySignOff ? (
                          <div className="flex items-center gap-1">
                            <BadgeCheck size={14} className="text-success" />
                            <span className="text-xs text-success font-600">{entry.qualitySignOffBy || 'Approved'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(entry.id) && entry.subComponents.length > 0 && (
                      <tr className="border-b border-border/50 bg-muted/10">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="flex flex-col gap-3">
                            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide">Sub-Component Finishing Breakdown</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {entry.subComponents.map((sc) => (
                                <div key={sc.id} className="bg-card border border-border rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-700 text-foreground">{sc.component}</span>
                                    <span className={`text-xs font-600 capitalize px-2 py-0.5 rounded-md ${PACKAGING_BADGE[sc.packagingStatus]}`}>{sc.packagingStatus}</span>
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
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>QC Pass: <span className="font-600 text-foreground">{sc.qcPassCount}</span></span>
                                    <span className="text-success">Final: <span className="font-700">{sc.finalCount}</span></span>
                                  </div>
                                  {sc.remarks && <p className="text-xs text-muted-foreground mt-1.5 italic">{sc.remarks}</p>}
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
              <h2 className="text-base font-700 text-foreground">New Finishing Entry</h2>
              <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

              {formError && (
                <div className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">{formError}</div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Date *</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Job Card Ref</label>
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
                    {jc.dueDate && <div><span className="text-muted-foreground font-600">Due Date:</span> <span className="text-foreground ml-1">{jc.dueDate}</span></div>}
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

              {/* QC Entry Reference — auto-inherit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">
                  QC Entry Ref
                  <span className="ml-1.5 text-[10px] text-primary font-500 bg-primary/10 px-1.5 py-0.5 rounded-md">Auto-inherits sub-components</span>
                </label>
                <select value={form.qcEntryRef} onChange={(e) => handleQCRefChange(e.target.value)} className="input-field text-sm">
                  <option value="">-- Select QC Entry (optional) --</option>
                  {qcEntries.map((qc) => (
                    <option key={qc.id} value={qc.entryNo}>{qc.entryNo} — {qc.styleName} ({qc.netPassed} pcs passed)</option>
                  ))}
                </select>
                {inheritedFrom && (
                  <p className="text-xs text-success font-500 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Sub-components auto-inherited from {inheritedFrom}
                  </p>
                )}
                {qcEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground">No QC entries yet — you can add sub-components manually below.</p>
                )}
              </div>

              {/* Sub-Component Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-700 text-foreground">Sub-Component Finishing Details *</p>
                  <button type="button" onClick={addSubComponent} className="flex items-center gap-1 text-xs text-primary font-600 hover:underline">
                    <Plus size={12} /> Add Component
                  </button>
                </div>

                {subComponents.map((sc) => (
                  <div key={sc.id} className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-muted/20">
                    {/* Component name row */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs font-600 text-muted-foreground">Component</label>
                        <input
                          type="text"
                          value={sc.component}
                          onChange={(e) => updateSubComponent(sc.id, 'component', e.target.value)}
                          className="input-field text-sm"
                          placeholder="e.g. Kurta"
                        />
                      </div>
                      {subComponents.length > 1 && (
                        <button type="button" onClick={() => removeSubComponent(sc.id)} className="mt-5 p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Counts + Packaging */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-600 text-muted-foreground">QC Pass Count</label>
                        <input
                          type="number"
                          min="0"
                          value={sc.qcPassCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setSubComponents((prev) => prev.map((s) => s.id === sc.id ? { ...s, qcPassCount: val, finalCount: String(val) } : s));
                          }}
                          className="input-field text-sm tabular-nums"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-600 text-muted-foreground text-success">Final Count *</label>
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="0"
                          value={sc.finalCount}
                          onChange={(e) => updateSubComponent(sc.id, 'finalCount', e.target.value)}
                          className="input-field text-sm tabular-nums border-success/40 focus:border-success"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-600 text-muted-foreground">Packaging Status</label>
                        <select
                          value={sc.packagingStatus}
                          onChange={(e) => updateSubComponent(sc.id, 'packagingStatus', e.target.value)}
                          className="input-field text-sm"
                        >
                          {PACKAGING_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Size breakdown (inherited from QC) */}
                    {sc.sizeBreakdown.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-600 text-muted-foreground">Finished Size Quantities (total must match Final Count)</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sc.sizeBreakdown.map((sz, sizeIndex) => (
                            <div key={sz.size} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5">
                              <span className="text-xs font-600 text-muted-foreground">{sz.size}:</span>
                              <input type="number" min="0" step="1" aria-label={`${sc.component} ${sz.size} finished quantity`} value={sz.qty} className="input-field w-20 text-xs" onChange={e => setSubComponents(prev => prev.map(row => row.id === sc.id ? {...row, sizeBreakdown: row.sizeBreakdown.map((value,index) => index === sizeIndex ? {...value, qty: Number(e.target.value)} : value)} : row))} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Component remarks */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-600 text-muted-foreground">Component Remarks</label>
                      <input
                        type="text"
                        value={sc.remarks}
                        onChange={(e) => updateSubComponent(sc.id, 'remarks', e.target.value)}
                        className="input-field text-sm"
                        placeholder="Optional notes for this component..."
                      />
                    </div>
                  </div>
                ))}

                {totalFinalDerived > 0 && (
                  <div className="flex items-center gap-4 bg-success-bg border border-success-border rounded-lg px-4 py-2.5">
                    <p className="text-xs text-success font-600">
                      QC Passed: <span className="font-700">{totalQcDerived}</span>
                      <span className="ml-3 text-foreground">Final Count: <span className="font-700">{totalFinalDerived}</span></span>
                    </p>
                  </div>
                )}
              </div>

              {/* Quality Sign-Off */}
              <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-muted/10">
                <p className="text-xs font-700 text-foreground flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-success" />
                  Quality Sign-Off
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.qualitySignOff}
                      onChange={(e) => setForm({ ...form, qualitySignOff: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-success"
                    />
                    <span className="text-sm font-500 text-foreground">Quality Approved</span>
                  </label>
                </div>
                {form.qualitySignOff && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-600 text-muted-foreground">Approved By *</label>
                    <input
                      type="text"
                      required={form.qualitySignOff}
                      value={form.qualitySignOffBy}
                      onChange={(e) => setForm({ ...form, qualitySignOffBy: e.target.value })}
                      className="input-field text-sm"
                      placeholder="Name of quality inspector / supervisor"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">Save Finishing Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
