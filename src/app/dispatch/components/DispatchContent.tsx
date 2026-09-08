'use client';
import {toast} from 'sonner';
import React, { useState,useRef, useEffect, useCallback } from 'react';
import { Plus, X, Truck, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { dispatchService, DispatchVoucher } from '@/lib/services/dispatchService';
import { contractorFinishingService, FinishedGoodsEntry } from '@/lib/services/contractorFinishingService';
import { useAuth } from '@/contexts/AuthContext';

interface DispatchContentProps {
  lang?: 'en' | 'hi';
}

export default function DispatchContent({ lang = 'en' }: DispatchContentProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { jobCards, refresh: refreshJobCards } = useJobCards();

  const [entries, setEntries] = useState<DispatchVoucher[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const saveRef=useRef(false);const requestRef=useRef<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    partyName: '',
    jobCardRef: '',
    styleName: '',
    finishedGoodsId: '',
    itemName: '',
    colour: '',
    size: '',
    orderedPieces: '',
    dispatchedPieces: '',
    vehicleNo: '',
    driverName: '',
    invoiceNo: '',
    remarks: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dispatchData, fgData] = await Promise.all([
      dispatchService.getAll(),
      contractorFinishingService.getFinishedGoodsByComponentAssembly(),
    ]);
    setEntries(dispatchData);
    setFinishedGoods(fgData);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useRealtimeTable('job_cards', refreshJobCards);
  useRealtimeTable('dispatch_vouchers', loadData);
  useRealtimeTable('finished_goods', loadData);

  const totalDispatched = entries.reduce((s, e) => s + e.dispatchedPieces, 0);
  const totalOrdered = entries.reduce((s, e) => s + e.orderedPieces, 0);

  const handleJobCardChange = (jobCardNo: string) => {
    if (jobCardNo === '__create_new__') {
      router.push('/job-card-management');
      return;
    }
    if (!jobCardNo) {
      setForm((f) => ({ ...f, jobCardRef: '', styleName: '', partyName: '', orderedPieces: '' }));
      return;
    }
    const jc = jobCards.find((j) => j.jobCardNo === jobCardNo);
    setForm((f) => ({
      ...f,
      jobCardRef: jobCardNo,
      styleName: jc?.styleEn || f.styleName,
      partyName: jc?.partyName || f.partyName,
      orderedPieces: jc?.totalPieces ? String(jc.totalPieces) : f.orderedPieces,
    }));
  };

  const handleFinishedGoodsChange = (fgId: string) => {
    if (!fgId) {
      setForm((f) => ({ ...f, finishedGoodsId: '', itemName: '', colour: '', size: '' }));
      return;
    }
    const fg = finishedGoods.find((g) => g.id === fgId);
    if (fg) {
      setForm((f) => ({
        ...f,
        finishedGoodsId: fgId,
        itemName: fg.item || fg.styleName || '',
        colour: fg.colour || '',
        size: fg.size || '',
        jobCardRef: fg.jobCardRef || f.jobCardRef,
        styleName: fg.styleName || f.styleName,
        partyName: fg.partyName || f.partyName,
        orderedPieces: String(fg.availableForDispatch),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(saveRef.current)return;saveRef.current=true;
    setSaving(true);
    try{

    const dispatched = parseInt(form.dispatchedPieces) || 0;
    const ordered = parseInt(form.orderedPieces) || 0;

    if (!form.finishedGoodsId) throw new Error('Select an assembled ready item before dispatch.');
    // Validate against available stock if a finished goods entry is selected
    if (form.finishedGoodsId) {
      const fg = finishedGoods.find((g) => g.id === form.finishedGoodsId);
      if (fg && dispatched > fg.availableForDispatch) {
        alert(`Cannot dispatch ${dispatched} pcs. Only ${fg.availableForDispatch} pcs available in Finished Goods.`);
        setSaving(false);
        return;
      }
    }

    requestRef.current??=crypto.randomUUID();
    const result = await dispatchService.create(
      {
        dispatchDate: form.date,
        partyName: form.partyName,
        jobCardRef: form.jobCardRef || undefined,
        styleName: form.styleName || undefined,
        finishedGoodsId: form.finishedGoodsId || undefined,
        itemName: form.itemName || undefined,
        colour: form.colour || undefined,
        size: form.size || undefined,
        orderedPieces: ordered,
        dispatchedPieces: dispatched,
        vehicleNo: form.vehicleNo || undefined,
        driverName: form.driverName || undefined,
        invoiceNo: form.invoiceNo || undefined,
        remarks: form.remarks || undefined,
      },
      user?.email || null,requestRef.current
    );

    setSaving(false);
    if (result) {
      requestRef.current=null;
      setShowModal(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        partyName: '',
        jobCardRef: '',
        styleName: '',
        finishedGoodsId: '',
        itemName: '',
        colour: '',
        size: '',
        orderedPieces: '',
        dispatchedPieces: '',
        vehicleNo: '',
        driverName: '',
        invoiceNo: '',
        remarks: '',
      });
      await loadData();
    }
    }catch(e){toast.error((e as Error).message||'Dispatch save failed');}finally{saveRef.current=false;setSaving(false);}
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-warning-bg text-warning border border-warning-border',
    dispatched: 'bg-info-bg text-info border border-info-border',
    delivered: 'bg-success-bg text-success border border-success-border',
  };

  const availableFGItems = finishedGoods.filter((g) => g.availableForDispatch > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Dispatch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Final dispatch from finished goods inventory — Step 9</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New Dispatch Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Dispatches</p>
          <p className="text-2xl font-700 text-foreground mt-1">{loading ? '—' : entries.length}</p>
          <p className="text-xs text-muted-foreground">Entries</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Pieces Ordered</p>
          <p className="text-2xl font-700 text-primary mt-1">{loading ? '—' : totalOrdered.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Pieces Dispatched</p>
          <p className="text-2xl font-700 text-success mt-1">{loading ? '—' : totalDispatched.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Sent out</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Available in FG</p>
          <p className="text-2xl font-700 text-warning mt-1">{loading ? '—' : finishedGoods.reduce((s, g) => s + g.availableForDispatch, 0).toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Ready to Dispatch</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Truck size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Dispatch Records</span>
          <span className="ml-auto text-xs text-muted-foreground">{entries.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Dispatch No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Party</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Item / Job Card</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Ordered</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Dispatched</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Vehicle / Driver</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Invoice No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-sm">Loading dispatch records...</p>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    <Truck size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No dispatch entries yet</p>
                    <p className="text-xs mt-1">Create dispatch entries to track outgoing shipments</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-600 text-primary text-xs">{entry.dispatchNo}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.dispatchDate}</td>
                    <td className="px-4 py-3 font-500 text-foreground">{entry.partyName}</td>
                    <td className="px-4 py-3">
                      <div className="font-500 text-foreground text-sm">{entry.itemName || entry.styleName || '—'}</div>
                      {entry.jobCardRef && <div className="text-xs text-muted-foreground">JC: {entry.jobCardRef}</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.orderedPieces.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{entry.dispatchedPieces.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {entry.vehicleNo || '—'}{entry.driverName ? ` / ${entry.driverName}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{entry.invoiceNo || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusColor[entry.status] || statusColor['dispatched']}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">New Dispatch Entry</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Date *</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Invoice No</label>
                  <input type="text" placeholder="INV-0001" value={form.invoiceNo} onChange={(e) => setForm((f) => ({ ...f, invoiceNo: e.target.value }))} className="input-field text-sm" />
                </div>
              </div>

              {/* Finished Goods selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground flex items-center gap-1.5">
                  <Package size={12} />
                  Select from Finished Goods
                </label>
                <select
                  value={form.finishedGoodsId}
                  onChange={(e) => handleFinishedGoodsChange(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">-- Select Ready Item (optional) --</option>
                  {availableFGItems.map((fg) => (
                    <option key={fg.id} value={fg.id}>
                      {fg.item || fg.styleName} {fg.colour ? `| ${fg.colour}` : ''} {fg.size ? `| ${fg.size}` : ''} — {fg.availableForDispatch} pcs available
                    </option>
                  ))}
                </select>
                {form.finishedGoodsId && (() => {
                  const fg = finishedGoods.find((g) => g.id === form.finishedGoodsId);
                  return fg ? (
                    <p className="text-xs text-success">Available: <strong>{fg.availableForDispatch}</strong> pcs</p>
                  ) : null;
                })()}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Job Card Ref</label>
                <select value={form.jobCardRef} onChange={(e) => handleJobCardChange(e.target.value)} className="input-field text-sm">
                  <option value="">-- Select Job Card --</option>
                  <option value="__create_new__" className="text-primary font-600">+ Create New Job Card</option>
                  {jobCards.map((jc) => (
                    <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Party Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter party name"
                  value={form.partyName}
                  onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Style / Item Name</label>
                  <input
                    type="text"
                    placeholder="Style or item name"
                    value={form.itemName || form.styleName}
                    onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value, styleName: e.target.value }))}
                    className="input-field text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Ordered Pieces *</label>
                  <input type="number" required min="0" placeholder="0" value={form.orderedPieces} onChange={(e) => setForm((f) => ({ ...f, orderedPieces: e.target.value }))} className="input-field text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Dispatched Pieces *</label>
                  <input type="number" required min="0" placeholder="0" value={form.dispatchedPieces} onChange={(e) => setForm((f) => ({ ...f, dispatchedPieces: e.target.value }))} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Vehicle No</label>
                  <input type="text" placeholder="e.g. GJ-01-AB-1234" value={form.vehicleNo} onChange={(e) => setForm((f) => ({ ...f, vehicleNo: e.target.value }))} className="input-field text-sm" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Driver Name</label>
                <input type="text" placeholder="Driver name" value={form.driverName} onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))} className="input-field text-sm" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} className="input-field text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
