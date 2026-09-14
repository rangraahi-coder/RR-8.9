'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Package, TrendingDown, ArrowRight, X, ShoppingCart, RefreshCw, AlertCircle, Pencil, Trash2, Ruler } from 'lucide-react';
import { GreyFabricPurchase } from '../data/greyFabricData';
import { greyFabricService } from '@/lib/services/greyFabricService';
import { useAuth } from '@/contexts/AuthContext';
import AuditBadge from '@/components/ui/AuditBadge';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { useRouter } from 'next/navigation';
import { accountService } from '@/lib/services/accountService';
import { Account } from '@/app/account-master/data/accountsData';

interface GreyFabricContentProps {
  lang?: 'en' | 'hi';
}

const FABRIC_TYPES = ['Cotton', 'Rayon', 'Malmal', 'JK', 'Yufta', 'Keri Print', 'Other'];

const GST_SLABS = [0, 5, 12, 18, 28];

const EMPTY_FORM = {
  date: '',
  supplierName: '',
  fabricName: '',
  customFabricName: '',
  fabricType: 'Cotton',
  orderedQty: '',
  receivedQty: '',
  unit: 'Metres',
  ratePerUnit: '',
  discount: '',
  discountType: 'amount' as 'amount' | 'percent',
  thaanCount: '1',
  thaanLengths: [''] as string[],
  lValue: '100',
  gstSlab: '0',
  remarks: '',
};

export default function GreyFabricContent({ lang = 'en' }: GreyFabricContentProps) {
  const { username } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<GreyFabricPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });

  // Account master
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Edit state
  const [editingEntry, setEditingEntry] = useState<GreyFabricPurchase | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<GreyFabricPurchase | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Load all entries from Supabase ──────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    try {
      setError(null);
      const data = await greyFabricService.getAll();
      setEntries(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ── Load accounts for supplier dropdown ─────────────────────────────────────
  useEffect(() => {
    accountService.getAll().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  // ── Realtime: re-fetch whenever any user inserts/updates/deletes ────────────
  useRealtimeTable('grey_fabric_purchases', loadEntries);

  // ── Summary stats ───────────────────────────────────────────────────────────
  const totalReceived = entries.reduce((s, e) => s + e.receivedQty, 0);
  const totalSent = entries.reduce((s, e) => s + e.sentForDyeing + e.sentForPrinting, 0);
  const totalBalance = entries.reduce((s, e) => s + e.balanceInStock, 0);

  // ── Metering variation calculations ─────────────────────────────────────────
  const computedActualQty = () => {
    const billed = parseFloat(form.receivedQty) || 0;
    const l = parseFloat(form.lValue) || 100;
    return billed * l / 100;
  };

  const computedVariation = () => {
    const billed = parseFloat(form.receivedQty) || 0;
    return computedActualQty() - billed;
  };

  // ── Thaan count change: resize thaanLengths array ───────────────────────────
  const handleThaanCountChange = (val: string) => {
    const count = Math.max(1, parseInt(val) || 1);
    const current = form.thaanLengths;
    const updated = Array.from({ length: count }, (_, i) => current[i] ?? '');
    setForm({ ...form, thaanCount: String(count), thaanLengths: updated });
  };

  const handleThaanLengthChange = (index: number, val: string) => {
    const updated = [...form.thaanLengths];
    updated[index] = val;
    setForm({ ...form, thaanLengths: updated });
  };

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const handleEditClick = (entry: GreyFabricPurchase) => {
    setEditingEntry(entry);
    const lengths = entry.thaanLengths && entry.thaanLengths.length > 0
      ? entry.thaanLengths.map(String)
      : [''];
    setForm({
      date: entry.date,
      supplierName: entry.supplierName,
      fabricName: entry.fabricName,
      customFabricName: '',
      fabricType: entry.fabricType,
      orderedQty: String(entry.orderedQty),
      receivedQty: String(entry.receivedQty),
      unit: entry.unit,
      ratePerUnit: String(entry.ratePerUnit),
      discount: String(entry.discount ?? ''),
      discountType: (entry.discountType ?? 'amount') as 'amount' | 'percent',
      thaanCount: String(lengths.length),
      thaanLengths: lengths,
      lValue: String(entry.lValue ?? 100),
      gstSlab: String(entry.gstSlab ?? 0),
      remarks: entry.remarks || '',
    });
    setSaveError(null);
    setShowModal(true);
  };

  // ── Open new entry modal ────────────────────────────────────────────────────
  const handleNewClick = () => {
    setEditingEntry(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setSaveError(null);
    setShowModal(true);
  };

  // ── Close modal ─────────────────────────────────────────────────────────────
  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setSaveError(null);
  };

  // ── Computed net amount — uses actual fabric qty for costing ─────────────────
  const computedNetAmount = () => {
    const actualQty = computedActualQty();
    const rate = parseFloat(form.ratePerUnit) || 0;
    const discountVal = parseFloat(form.discount) || 0;
    const gross = actualQty * rate;
    if (form.discountType === 'percent') {
      return Math.max(0, gross - (gross * discountVal) / 100);
    }
    return Math.max(0, gross - discountVal);
  };

  // ── Submit: save or update to Supabase ──────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    const fabricName = form.fabricName === '__create_new__'
      ? form.customFabricName.trim()
      : form.fabricName.trim();

    if (!fabricName) {
      setSaveError('Please enter a fabric name.');
      setSaving(false);
      return;
    }

    const received = parseFloat(form.receivedQty) || 0;
    const ordered = parseFloat(form.orderedQty) || 0;
    const rate = parseFloat(form.ratePerUnit) || 0;
    const discountVal = parseFloat(form.discount) || 0;
    const lVal = parseFloat(form.lValue) || 100;
    const actualQty = received * lVal / 100;
    const gstSlabVal = parseFloat(form.gstSlab) || 0;
    const thaanLengths = form.thaanLengths
      .map((l) => parseFloat(l) || 0)
      .filter((l) => l > 0);

    const status: GreyFabricPurchase['status'] = received >= ordered ? 'received' : received > 0 ? 'partial' : 'pending';
    // Costing uses actual fabric qty
    const gross = actualQty * rate;
    const totalAmount = form.discountType === 'percent'
      ? Math.max(0, gross - (gross * discountVal) / 100)
      : Math.max(0, gross - discountVal);

    if (editingEntry) {
      // ── Update existing entry — stock uses actual qty ──
      const balanceInStock = editingEntry.balanceInStock + (actualQty - editingEntry.actualFabricQty);
      const result = await greyFabricService.update(editingEntry.id, {
        date: form.date,
        supplierName: form.supplierName,
        fabricName,
        fabricType: form.fabricType,
        orderedQty: ordered,
        receivedQty: received,
        unit: form.unit,
        ratePerUnit: rate,
        discount: discountVal,
        discountType: form.discountType,
        totalAmount,
        status,
        balanceInStock: Math.max(0, balanceInStock),
        thaanLengths,
        lValue: lVal,
        actualFabricQty: actualQty,
        gstSlab: gstSlabVal,
        remarks: form.remarks,
      });

      if (!result.success) {
        setSaveError(result.error || 'Failed to update entry. Please try again.');
        setSaving(false);
        return;
      }
    } else {
      // ── Insert new entry — stock uses actual qty ──
      const purchaseNo = await greyFabricService.getNextPurchaseNo();

      const newEntry: Omit<GreyFabricPurchase, 'id'> = {
        purchaseNo,
        date: form.date,
        supplierName: form.supplierName,
        fabricName,
        fabricType: form.fabricType,
        orderedQty: ordered,
        receivedQty: received,
        unit: form.unit,
        ratePerUnit: rate,
        discount: discountVal,
        discountType: form.discountType,
        totalAmount,
        status,
        sentForDyeing: 0,
        sentForPrinting: 0,
        balanceInStock: actualQty,
        thaanLengths,
        lValue: lVal,
        actualFabricQty: actualQty,
        gstSlab: gstSlabVal,
        remarks: form.remarks,
        createdBy: username ?? null,
        createdAt: new Date().toISOString(),
      };

      const result = await greyFabricService.insert(newEntry);

      if (!result.success) {
        setSaveError(result.error || 'Failed to save entry. Please try again.');
        setSaving(false);
        return;
      }
    }

    await loadEntries();
    setSaving(false);
    handleCloseModal();
  };

  // ── Delete: confirm then remove ─────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await greyFabricService.delete(deleteTarget.id);
    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete entry.');
      setDeleting(false);
      return;
    }
    await loadEntries();
    setDeleting(false);
    setDeleteTarget(null);
  };

  const statusColor: Record<string, string> = {
    received: 'bg-success-bg text-success border border-success-border',
    partial: 'bg-warning-bg text-warning border border-warning-border',
    pending: 'bg-danger-bg text-danger border border-danger-border',
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Grey Fabric Purchase</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Raw fabric procurement — Step 1 of manufacturing workflow</p>
        </div>
        <button onClick={handleNewClick} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New Purchase Entry
        </button>
      </div>

      {/* Workflow Banner */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-600 text-muted-foreground mb-3 uppercase tracking-wide">Manufacturing Flow</p>
        <div className="flex items-center gap-2 flex-wrap">
          {['Grey Fabric', 'Dyeing / Printing', 'Ready-to-Cut', 'Cutting', 'Stitching', 'QC', 'Finishing', 'Dispatch'].map((stage, i) => (
            <React.Fragment key={stage}>
              <span className={`px-3 py-1 rounded-full text-xs font-600 ${i === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{stage}</span>
              {i < 7 && <ArrowRight size={12} className="text-muted-foreground flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Purchases</p>
          <p className="text-2xl font-700 text-foreground mt-1">{entries.length}</p>
          <p className="text-xs text-muted-foreground">Entries</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Received</p>
          <p className="text-2xl font-700 text-primary mt-1">{totalReceived.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">Metres (Billed)</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Sent for Processing</p>
          <p className="text-2xl font-700 text-warning mt-1">{totalSent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">Metres</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Balance in Stock</p>
          <p className="text-2xl font-700 text-success mt-1">{totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">Metres (Actual)</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-danger flex-shrink-0" />
          <p className="text-sm text-danger flex-1">{error}</p>
          <button onClick={loadEntries} className="flex items-center gap-1.5 text-xs font-600 text-danger underline">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <ShoppingCart size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Purchase Entries</span>
          <span className="ml-auto text-xs text-muted-foreground">{entries.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Purchase No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Fabric</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Billed Qty</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">L (cm)</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Actual Qty</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Variation</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Discount</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Sent for Process</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">By</th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-muted-foreground">
                    <RefreshCw size={24} className="mx-auto mb-3 opacity-40 animate-spin" />
                    <p className="text-sm font-500">Loading entries…</p>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-muted-foreground">
                    <Package size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No purchase entries yet</p>
                    <p className="text-xs mt-1">Click "New Purchase Entry" to add grey fabric</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const variation = entry.actualFabricQty - entry.receivedQty;
                  const hasVariation = Math.abs(variation) > 0.001;
                  return (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-600 text-primary text-xs">{entry.purchaseNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                      <td className="px-4 py-3 font-500 text-foreground">{entry.supplierName}</td>
                      <td className="px-4 py-3">
                        <div className="font-500 text-foreground">{entry.fabricName}</div>
                        <div className="text-xs text-muted-foreground">{entry.fabricType}</div>
                        {entry.thaanLengths && entry.thaanLengths.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Ruler size={10} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{entry.thaanLengths.length} thaan{entry.thaanLengths.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.receivedQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {entry.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        <span className={`text-xs font-600 ${entry.lValue !== 100 ? 'text-warning' : 'text-muted-foreground'}`}>
                          {entry.lValue ?? 100} cm
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-600 text-foreground">{entry.actualFabricQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {entry.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {hasVariation ? (
                          <span className={`text-xs font-600 ${variation < 0 ? 'text-danger' : 'text-success'}`}>
                            {variation > 0 ? '+' : ''}{variation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {entry.discount > 0
                          ? (entry.discountType === 'percent'
                            ? `${entry.discount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`
                            : `₹${entry.discount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-warning">{(entry.sentForDyeing + entry.sentForPrinting).toLocaleString('en-IN', { maximumFractionDigits: 2 })} {entry.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-600 text-success">{entry.balanceInStock.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {entry.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusColor[entry.status] || statusColor.pending}`}>
                          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AuditBadge
                          createdBy={entry.createdBy}
                          createdAt={entry.createdAt}
                          variant="compact"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(entry)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit entry"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(entry); setDeleteError(null); }}
                            className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-700 text-foreground">
                  {editingEntry ? 'Edit Grey Fabric Purchase' : 'New Grey Fabric Purchase'}
                </h2>
                {username && (
                  <p className="text-xs text-muted-foreground mt-0.5">Entry by <span className="font-600 text-foreground">{username}</span></p>
                )}
              </div>
              <button onClick={handleCloseModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {saveError && (
                <div className="flex items-center gap-2 bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="text-danger flex-shrink-0" />
                  <p className="text-xs text-danger">{saveError}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Date *</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Fabric Type *</label>
                  <select required value={form.fabricType} onChange={(e) => setForm({ ...form, fabricType: e.target.value })} className="input-field text-sm">
                    {FABRIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Supplier Name *</label>
                <select
                  required
                  value={form.supplierName}
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  className="input-field text-sm"
                >
                  <option value="">Select supplier</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Fabric Name *</label>
                {form.fabricName === '__create_new__' ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Enter new fabric name"
                      value={form.customFabricName}
                      onChange={(e) => setForm({ ...form, customFabricName: e.target.value })}
                      className="input-field text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (form.customFabricName.trim()) {
                          setForm({ ...form, fabricName: form.customFabricName.trim() });
                        }
                      }}
                      className="px-2 py-1 bg-primary text-white rounded-lg text-xs font-600"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, fabricName: '', customFabricName: '' })}
                      className="px-2 py-1 bg-muted text-muted-foreground rounded-lg text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="Enter fabric name (e.g. Grey Cotton 60x60)"
                      value={form.fabricName}
                      onChange={(e) => setForm({ ...form, fabricName: e.target.value })}
                      className="input-field text-sm flex-1"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Received Qty (Billed) *</label>
                  <input type="number" required min="0" step="0.01" placeholder="0.00" value={form.receivedQty} onChange={(e) => setForm({ ...form, receivedQty: e.target.value })} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field text-sm">
                    <option>Metres</option>
                    <option>Kg</option>
                    <option>Yards</option>
                  </select>
                </div>
              </div>

              {/* Metering Variation — L field */}
              <div className="flex flex-col gap-3 border border-border rounded-xl p-4 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Ruler size={14} className="text-primary" />
                  <span className="text-xs font-700 text-foreground">Metering Variation</span>
                  <span className="text-xs text-muted-foreground">(Supplier's actual metre length)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-600 text-muted-foreground">L — Length per Metre (cm)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        step="0.1"
                        placeholder="100"
                        value={form.lValue}
                        onChange={(e) => setForm({ ...form, lValue: e.target.value })}
                        className="input-field text-sm pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-500">cm</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Standard = 100 cm. Enter 98 if supplier measures 98 cm per metre.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-600 text-muted-foreground">Actual Fabric Qty</label>
                    <div className="input-field text-sm bg-muted/50 flex items-center justify-between">
                      <span className="font-700 text-foreground tabular-nums">
                        {computedActualQty().toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-xs text-muted-foreground">{form.unit}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Billed Qty × L ÷ 100</p>
                  </div>
                </div>
                {/* Variation display */}
                {parseFloat(form.receivedQty) > 0 && parseFloat(form.lValue) !== 100 && (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${computedVariation() < 0 ? 'bg-danger-bg border-danger-border' : 'bg-success-bg border-success-border'}`}>
                    <div className="flex items-center gap-2">
                      <TrendingDown size={13} className={computedVariation() < 0 ? 'text-danger' : 'text-success'} />
                      <span className={`text-xs font-600 ${computedVariation() < 0 ? 'text-danger' : 'text-success'}`}>
                        Metering Variation
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-700 tabular-nums ${computedVariation() < 0 ? 'text-danger' : 'text-success'}`}>
                        {computedVariation() > 0 ? '+' : ''}{computedVariation().toLocaleString('en-IN', { maximumFractionDigits: 3 })} {form.unit}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {Math.abs(computedVariation()).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {form.unit} {computedVariation() < 0 ? 'less' : 'more'} than billed
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rate + Discount row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Rate per Unit (₹)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={form.ratePerUnit} onChange={(e) => setForm({ ...form, ratePerUnit: e.target.value })} className="input-field text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Discount</label>
                  <div className="flex gap-0">
                    <div className="flex border border-border rounded-l-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, discountType: 'amount' })}
                        className={`px-2.5 py-1.5 text-xs font-600 transition-colors ${form.discountType === 'amount' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >₹</button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, discountType: 'percent' })}
                        className={`px-2.5 py-1.5 text-xs font-600 transition-colors ${form.discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      >%</button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: e.target.value })}
                      className="input-field text-sm rounded-l-none flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* GST Slab */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">GST Slab</label>
                <div className="flex gap-2 flex-wrap">
                  {GST_SLABS.map((slab) => (
                    <button
                      key={slab}
                      type="button"
                      onClick={() => setForm({ ...form, gstSlab: String(slab) })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-600 border transition-colors ${
                        form.gstSlab === String(slab)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                      }`}
                    >
                      {slab === 0 ? 'Nil (0%)' : `${slab}%`}
                    </button>
                  ))}
                </div>
                {parseFloat(form.gstSlab) > 0 && parseFloat(form.ratePerUnit) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    GST Amount: ₹{((computedNetAmount() * parseFloat(form.gstSlab)) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {' '}· Total with GST: ₹{(computedNetAmount() * (1 + parseFloat(form.gstSlab) / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              {/* Net Amount preview — based on actual qty */}
              {(form.receivedQty || form.ratePerUnit || form.discount) && (
                <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs text-muted-foreground font-500">Net Amount</span>
                    {parseFloat(form.lValue) !== 100 && (
                      <p className="text-xs text-muted-foreground">Based on actual qty ({computedActualQty().toLocaleString('en-IN', { maximumFractionDigits: 3 })} {form.unit})</p>
                    )}
                  </div>
                  <span className="text-sm font-700 text-foreground">
                    ₹{computedNetAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {form.orderedQty && form.receivedQty && parseFloat(form.receivedQty) < parseFloat(form.orderedQty) && (
                <div className="flex items-center gap-2 bg-warning-bg border border-warning-border rounded-lg px-3 py-2">
                  <TrendingDown size={14} className="text-warning flex-shrink-0" />
                  <p className="text-xs text-warning font-500">
                    Shortage: {(parseFloat(form.orderedQty) - parseFloat(form.receivedQty)).toFixed(2)} {form.unit} less than ordered
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      {editingEntry ? 'Updating…' : 'Saving…'}
                    </>
                  ) : (
                    editingEntry ? 'Update Purchase' : 'Save Purchase'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">Delete Purchase Entry</h2>
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" disabled={deleting}>
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-danger-bg flex-shrink-0">
                  <Trash2 size={16} className="text-danger" />
                </div>
                <div>
                  <p className="text-sm font-600 text-foreground">Are you sure you want to delete this entry?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-600 text-foreground">{deleteTarget.purchaseNo}</span> — {deleteTarget.fabricName} ({deleteTarget.supplierName})
                  </p>
                  <p className="text-xs text-danger mt-2 font-500">This action cannot be undone.</p>
                </div>
              </div>
              {deleteError && (
                <div className="flex items-center gap-2 bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="text-danger flex-shrink-0" />
                  <p className="text-xs text-danger">{deleteError}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                  className="btn-secondary flex-1"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-600 hover:opacity-90 transition-opacity disabled:opacity-60"
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
