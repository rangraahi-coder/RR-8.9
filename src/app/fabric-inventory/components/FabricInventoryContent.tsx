'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Package, CheckCircle, List, PlusCircle, AlertCircle, Loader2, Eye, Pencil, X, Save, ArrowDownToLine, RefreshCw } from 'lucide-react';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { FabricStockItem } from '@/app/fabric-inventory/data/fabricStockData';
import { useRealtimeData } from '@/contexts/RealtimeDataContext';
import { printerFabricService, PrinterFabricIssue } from '@/lib/services/printerFabricService';

interface FabricRoll {
  id: string;
  rollNo: string;
  qty: string;
  remarks: string;
}

interface FabricVoucherLine {
  id: string;
  fabricName: string;
  category: string;
  unit: string;
  width: string;
  rolls: FabricRoll[];
}

const DEFAULT_CATEGORY_OPTIONS = [
  { value: '', label: 'Select Category' },
  { value: 'COTTON_60_60', label: 'Cotton 60*60' },
  { value: 'COTTON_60_40', label: 'Cotton 60*40' },
  { value: 'RAYON', label: 'Rayon' },
  { value: 'RAYON_SLUB', label: 'Rayon Slub' },
  { value: 'MAMAL', label: 'Mamal' },
];

const UNIT_OPTIONS = ['Metre', 'Yard', 'KG', 'Pcs'];

function newRoll(index: number): FabricRoll {
  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    rollNo: `R${index + 1}`,
    qty: '',
    remarks: '',
  };
}

function newLine(): FabricVoucherLine {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fabricName: '',
    category: '',
    unit: 'Metre',
    width: '',
    rolls: [newRoll(0)],
  };
}

function generateVoucherNo(count: number) {
  return `FV-${String(count + 1).padStart(3, '0')}`;
}

// ── View Modal ──────────────────────────────────────────────────────────────
interface ViewModalProps {
  fabricName: string;
  entries: FabricStockItem[];
  loading: boolean;
  onClose: () => void;
}

function ViewModal({ fabricName, entries, loading, onClose }: ViewModalProps) {
  const totalQty = entries.reduce((s, e) => s + e.stockQty, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye size={15} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-700 text-foreground">{fabricName}</h3>
              <p className="text-xs text-muted-foreground">Voucher Entries</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Package size={24} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No entries found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Column headers */}
              <div className="grid grid-cols-[0.5fr_1.5fr_1fr_1fr] gap-2 px-3 py-1.5 bg-muted/40 rounded-lg">
                <span className="text-xs font-600 text-muted-foreground">#</span>
                <span className="text-xs font-600 text-muted-foreground">Category</span>
                <span className="text-xs font-600 text-muted-foreground">Qty</span>
                <span className="text-xs font-600 text-muted-foreground">Unit</span>
              </div>
              {entries.map((entry, idx) => (
                <div key={entry.id} className="grid grid-cols-[0.5fr_1.5fr_1fr_1fr] gap-2 px-3 py-2.5 bg-background border border-border rounded-lg items-center">
                  <span className="text-xs font-600 text-muted-foreground">{idx + 1}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full w-fit font-500">{entry.category}</span>
                  <span className="text-sm font-700 text-foreground tabular-nums">{entry.stockQty.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">{entry.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 rounded-b-2xl">
            <span className="text-xs text-muted-foreground">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Total:</span>
              <span className="text-sm font-700 text-primary tabular-nums">{totalQty.toFixed(2)} {entries[0]?.unit}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditModalProps {
  fabricName: string;
  entries: FabricStockItem[];
  loading: boolean;
  saving: boolean;
  onSave: (id: string, newQty: number) => Promise<void>;
  onClose: () => void;
}

function EditModal({ fabricName, entries, loading, saving, onSave, onClose }: EditModalProps) {
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    entries.forEach((e) => { initial[e.id] = String(e.stockQty); });
    setEditValues(initial);
  }, [entries]);

  const handleSave = async (id: string) => {
    const val = parseFloat(editValues[id] || '0');
    if (isNaN(val) || val < 0) return;
    await onSave(id, val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Pencil size={15} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-700 text-foreground">{fabricName}</h3>
              <p className="text-xs text-muted-foreground">Edit Stock Quantities</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Package size={24} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No entries found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground mb-1">Update the quantity for each entry and click Save.</p>
              {entries.map((entry, idx) => (
                <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 bg-background border border-border rounded-lg">
                  <span className="text-xs font-600 text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-500 flex-1">{entry.category}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editValues[entry.id] ?? String(entry.stockQty)}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                      className="w-24 px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                      disabled={saving}
                    />
                    <span className="text-xs text-muted-foreground">{entry.unit}</span>
                  </div>
                  <button
                    onClick={() => handleSave(entry.id)}
                    disabled={saving}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white text-xs font-600 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Save
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-border bg-muted/20 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Modal ────────────────────────────────────────────────────────────
interface DeleteModalProps {
  fabricName: string;
  entries: FabricStockItem[];
  loading: boolean;
  deleting: boolean;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

function DeleteModal({ fabricName, entries, loading, deleting, onDelete, onClose }: DeleteModalProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Trash2 size={15} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-700 text-foreground">{fabricName}</h3>
              <p className="text-xs text-muted-foreground">Delete Entries</p>
            </div>
          </div>
          <button onClick={onClose} disabled={deleting} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Package size={24} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No entries found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground mb-1">Select an entry to delete. This action cannot be undone.</p>
              {entries.map((entry, idx) => (
                <div key={entry.id} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-background border border-border rounded-lg">
                    <span className="text-xs font-600 text-muted-foreground w-5 text-center">{idx + 1}</span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-500 flex-1">{entry.category}</span>
                    <span className="text-sm font-700 text-foreground tabular-nums">{entry.stockQty.toFixed(2)} {entry.unit}</span>
                    <button
                      onClick={() => setConfirmId(entry.id)}
                      disabled={deleting}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 text-xs font-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>
                  {/* Inline confirmation */}
                  {confirmId === entry.id && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                      <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
                      <span className="text-xs text-red-700 flex-1">Are you sure? This entry will be permanently deleted.</span>
                      <button
                        onClick={async () => { await onDelete(entry.id); setConfirmId(null); }}
                        disabled={deleting}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {deleting ? <Loader2 size={11} className="animate-spin" /> : null}
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={deleting}
                        className="px-2.5 py-1.5 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-border bg-muted/20 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Receive Roll ─────────────────────────────────────────────────────────────
interface ReceiveRoll {
  id: string;
  rollNo: string;
  qty: string;
  remarks: string;
}

function newReceiveRoll(index: number): ReceiveRoll {
  return {
    id: `rr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    rollNo: `R${index + 1}`,
    qty: '',
    remarks: '',
  };
}

// ── Main Component ──────────────────────────────────────────────────────────
interface FabricInventoryContentProps {lang?:'en'|'hi';}

export default function FabricInventoryContent({ lang = 'en' }: FabricInventoryContentProps) {
  const { accounts: contextAccounts, accountsLoading: contextAccountsLoading, fabricInventoryLoading: _fabricSignal } = useRealtimeData();
  const [activeTab, setActiveTab] = useState<'entry' | 'receive' | 'inventory'>('entry');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [voucherCount, setVoucherCount] = useState(0);
  const [voucherNo, setVoucherNo] = useState('FV-001');
  const [source, setSource] = useState('');
  const [lines, setLines] = useState<FabricVoucherLine[]>([newLine()]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inventory state — loaded from Supabase
  const [inventoryItems, setInventoryItems] = useState<FabricStockItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Derive accounts list from context (name is sufficient for the source dropdown)
  const accounts = contextAccounts.map((a) => ({ id: a.id, name: a.name } as { id: string; name: string }));
  const accountsLoading = contextAccountsLoading;

  // ── Fabric Receive state ──────────────────────────────────────────────────
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiveReceiptNo, setReceiveReceiptNo] = useState('');
  const [receiveReceiptNoLoading, setReceiveReceiptNoLoading] = useState(false);
  const [receivePrinter, setReceivePrinter] = useState('');
  const [pendingIssues, setPendingIssues] = useState<PrinterFabricIssue[]>([]);
  const [pendingIssuesLoading, setPendingIssuesLoading] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<PrinterFabricIssue | null>(null);
  const [receiveRolls, setReceiveRolls] = useState<ReceiveRoll[]>([newReceiveRoll(0)]);
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [receiveFinishedFabricName, setReceiveFinishedFabricName] = useState('');
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receiveSubmitError, setReceiveSubmitError] = useState<string | null>(null);
  const [receiveErrors, setReceiveErrors] = useState<Record<string, string>>({});
  const [receiveSubmitted, setReceiveSubmitted] = useState(false);
  const [lastReceiptNo, setLastReceiptNo] = useState('');

  // Load next receipt no on mount
  useEffect(() => {
    if (activeTab === 'receive' && !receiveReceiptNo) {
      setReceiveReceiptNoLoading(true);
      printerFabricService.getNextReceiptNo().then((no) => {
        setReceiveReceiptNo(no);
        setReceiveReceiptNoLoading(false);
      });
    }
  }, [activeTab]);

  // Load pending issues when printer changes
  useEffect(() => {
    if (!receivePrinter) {
      setPendingIssues([]);
      setSelectedIssueId('');
      setSelectedIssue(null);
      return;
    }
    setPendingIssuesLoading(true);
    printerFabricService.getIssuesByPrinter(receivePrinter).then((issues) => {
      setPendingIssues(issues);
      setPendingIssuesLoading(false);
    });
  }, [receivePrinter]);

  // Update selected issue object when id changes
  useEffect(() => {
    if (!selectedIssueId) {
      setSelectedIssue(null);
      return;
    }
    const found = pendingIssues.find((i) => i.id === selectedIssueId) || null;
    setSelectedIssue(found);
  }, [selectedIssueId, pendingIssues]);

  const addReceiveRoll = () => setReceiveRolls((prev) => [...prev, newReceiveRoll(prev.length)]);

  const removeReceiveRoll = (id: string) => {
    if (receiveRolls.length === 1) return;
    setReceiveRolls((prev) => prev.filter((r) => r.id !== id));
  };

  const updateReceiveRoll = (id: string, field: keyof Omit<ReceiveRoll, 'id'>, value: string) => {
    setReceiveRolls((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const totalReceiveQty = receiveRolls.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);

  const validateReceive = () => {
    const errs: Record<string, string> = {};
    if (!receiveReceiptNo.trim()) errs.receiptNo = 'Receipt No. is required';
    if (!receiveDate) errs.receiveDate = 'Date is required';
    if (!receivePrinter) errs.receivePrinter = 'Select a printer/account';
    if (!selectedIssueId) errs.selectedIssue = 'Select a fabric issue';
    if (!receiveFinishedFabricName.trim()) errs.finishedFabricName = 'Finished Fabric Name is required before posting to inventory';
    receiveRolls.forEach((roll, idx) => {
      if (!roll.qty || isNaN(Number(roll.qty)) || Number(roll.qty) <= 0) {
        errs[`rqty-${idx}`] = 'Valid qty required';
      }
    });
    if (selectedIssue && totalReceiveQty > selectedIssue.qtyPending + 0.001) {
      errs.totalQty = `Total received (${totalReceiveQty.toFixed(3)}) exceeds pending qty (${selectedIssue.qtyPending.toFixed(3)})`;
    }
    setReceiveErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateReceive() || !selectedIssue) return;
    setReceiveSubmitting(true);
    setReceiveSubmitError(null);

    const finishedName = receiveFinishedFabricName.trim();

    const result = await printerFabricService.createReceipt(
      {
        receiptNo: receiveReceiptNo,
        date: receiveDate,
        printerAccount: receivePrinter,
        issueId: selectedIssue.id,
        grayFabricRef: selectedIssue.grayFabricRef,
        fabricName: selectedIssue.fabricName,
        qtyReceived: totalReceiveQty,
        processedFabricName: finishedName,
        processedQty: totalReceiveQty,
        shortage: Math.max(0, selectedIssue.qtyPending - totalReceiveQty),
        shrinkage: 0,
        remarks: receiveRemarks.trim() || undefined,
      },
      undefined
    );

    if (!result) {
      setReceiveSubmitError('Failed to save receipt. Please try again.');
      setReceiveSubmitting(false);
      return;
    }

    // Post to finished inventory (idempotent)
    await fabricInventoryService.postFinishedFabricReceipt({
      finishedFabricName: finishedName,
      receivedQty: totalReceiveQty,
      category: 'OTHER',
      unit: 'Metre',
      sourceModule: 'printer_receipt',
      sourceReceiptId: receiveReceiptNo,
      sourceGreyFabricRef: selectedIssue.grayFabricRef || undefined,
      processorName: receivePrinter || undefined,
      processingType: 'printing',
      receivedDate: receiveDate,
    });

    setLastReceiptNo(receiveReceiptNo);
    setReceiveSubmitting(false);
    setReceiveSubmitted(true);
  };

  const handleReceiveReset = async () => {
    setReceiveRolls([newReceiveRoll(0)]);
    setReceivePrinter('');
    setSelectedIssueId('');
    setSelectedIssue(null);
    setPendingIssues([]);
    setReceiveRemarks('');
    setReceiveFinishedFabricName('');
    setReceiveErrors({});
    setReceiveSubmitError(null);
    setReceiveSubmitted(false);
    // Load next receipt no
    setReceiveReceiptNoLoading(true);
    const no = await printerFabricService.getNextReceiptNo();
    setReceiveReceiptNo(no);
    setReceiveReceiptNoLoading(false);
  };

  const [customCategories, setCustomCategories] = useState<{ value: string; label: string }[]>([]);
  const [addingCategoryForLine, setAddingCategoryForLine] = useState<string | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Modal state
  type ModalType = 'view' | 'edit' | 'delete' | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalFabricName, setModalFabricName] = useState<string>('');
  const [modalEntries, setModalEntries] = useState<FabricStockItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalDeleting, setModalDeleting] = useState(false);

  // Load inventory from Supabase
  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const data = await fabricInventoryService.getAll();
      setInventoryItems(data);
    } catch (err: any) {
      setInventoryError('Failed to load inventory. Please refresh.');
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Realtime: re-fetch whenever global context detects a fabric_inventory change
  useEffect(() => {
    loadInventory();
  }, [_fabricSignal]);

  // Refresh inventory when switching to inventory tab
  useEffect(() => {
    if (activeTab === 'inventory') {
      loadInventory();
    }
  }, [activeTab, loadInventory]);

  // Load entries for a specific fabric name (for modals)
  const loadModalEntries = useCallback(async (fabricName: string) => {
    setModalLoading(true);
    try {
      const entries = await fabricInventoryService.getEntriesByFabricName(fabricName);
      setModalEntries(entries);
    } catch {
      setModalEntries([]);
    } finally {
      setModalLoading(false);
    }
  }, []);

  const openModal = async (type: ModalType, fabricName: string) => {
    setActiveModal(type);
    setModalFabricName(fabricName);
    setModalEntries([]);
    await loadModalEntries(fabricName);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalFabricName('');
    setModalEntries([]);
  };

  const handleEditSave = async (id: string, newQty: number) => {
    setModalSaving(true);
    const ok = await fabricInventoryService.update(id, newQty);
    if (ok) {
      await loadModalEntries(modalFabricName);
      await loadInventory();
    }
    setModalSaving(false);
  };

  const handleDelete = async (id: string) => {
    setModalDeleting(true);
    const ok = await fabricInventoryService.delete(id);
    if (ok) {
      const updated = modalEntries.filter((e) => e.id !== id);
      setModalEntries(updated);
      await loadInventory();
      // Auto-close if no entries left
      if (updated.length === 0) {
        closeModal();
      }
    }
    setModalDeleting(false);
  };

  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof Omit<FabricVoucherLine, 'rolls' | 'id'>, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const addRoll = (lineId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        return { ...l, rolls: [...l.rolls, newRoll(l.rolls.length)] };
      })
    );
  };

  const removeRoll = (lineId: string, rollId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        if (l.rolls.length === 1) return l;
        return { ...l, rolls: l.rolls.filter((r) => r.id !== rollId) };
      })
    );
  };

  const updateRoll = (lineId: string, rollId: string, field: keyof Omit<FabricRoll, 'id'>, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          rolls: l.rolls.map((r) => (r.id === rollId ? { ...r, [field]: value } : r)),
        };
      })
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!voucherNo.trim()) newErrors.voucherNo = 'Voucher No. is required';
    if (!voucherDate) newErrors.voucherDate = 'Date is required';
    lines.forEach((line, lineIdx) => {
      if (!line.fabricName.trim()) newErrors[`fabricName-${lineIdx}`] = 'Required';
      if (!line.category) newErrors[`category-${lineIdx}`] = 'Required';
      line.rolls.forEach((roll, rollIdx) => {
        if (!roll.qty || isNaN(Number(roll.qty)) || Number(roll.qty) <= 0)
          newErrors[`qty-${lineIdx}-${rollIdx}`] = 'Valid qty required';
      });
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    // Build one insert entry per roll (each roll = one fabric_inventory row)
    const entries = lines.flatMap((line) =>
      line.rolls.map((roll) => ({
        fabricName: line.fabricName.trim(),
        category: line.category || 'OTHER',
        unit: line.unit,
        stockQty: parseFloat(roll.qty) || 0,
        voucherNo,
        voucherDate,
        source: source.trim() || 'Direct Entry',
        remarks: roll.remarks,
      }))
    );

    const result = await fabricInventoryService.insertVoucherEntries(entries);

    if (!result.success) {
      setSubmitError(result.error || 'Failed to save fabric voucher. Please try again.');
      setSubmitting(false);
      return;
    }

    // Refresh inventory from Supabase so it reflects the new entries
    await loadInventory();

    const newCount = voucherCount + 1;
    setVoucherCount(newCount);
    setSubmitting(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    const newCount = voucherCount;
    setLines([newLine()]);
    setVoucherNo(generateVoucherNo(newCount));
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setSource('');
    setErrors({});
    setSubmitError(null);
    setSubmitted(false);
  };

  const totalRolls = lines.reduce((sum, l) => sum + l.rolls.length, 0);
  const totalQty = lines.reduce(
    (sum, l) => sum + l.rolls.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0),
    0
  );

  // Group inventory by fabric name for summary display
  const inventorySummary = inventoryItems.reduce<Record<string, { qty: number; unit: string; category: string; count: number }>>((acc, item) => {
    if (!acc[item.fabricName]) {
      acc[item.fabricName] = { qty: 0, unit: item.unit, category: item.category, count: 0 };
    }
    acc[item.fabricName].qty += item.stockQty;
    acc[item.fabricName].count += 1;
    return acc;
  }, {});

  const inventoryRows = Object.entries(inventorySummary).map(([name, data]) => ({
    fabricName: name,
    ...data,
  }));

  // ── Receive Submitted Success Screen ─────────────────────────────────────
  if (receiveSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={36} className="text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-700 text-foreground">Fabric Receipt Saved</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Receipt <span className="font-600 text-primary">{lastReceiptNo}</span> has been saved and linked to issue{' '}
            <span className="font-600 text-primary">{selectedIssue?.issueNo}</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The pending quantity has been adjusted against the original fabric issue.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReceiveReset}
            className="px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Add Another Receipt
          </button>
          <button
            onClick={() => { handleReceiveReset(); setActiveTab('inventory'); }}
            className="px-5 py-2 border border-border text-sm font-600 text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            View Inventory
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={36} className="text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-700 text-foreground">Fabric Voucher Saved</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Voucher <span className="font-600 text-primary">{voucherNo}</span> with{' '}
            {lines.length} fabric {lines.length === 1 ? 'type' : 'types'} and {totalRolls} roll{totalRolls !== 1 ? 's' : ''} has been permanently saved to inventory.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            These fabrics are now available for selection across all ERP modules.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Add Another Voucher
          </button>
          <button
            onClick={() => { handleReset(); setActiveTab('inventory'); }}
            className="px-5 py-2 border border-border text-sm font-600 text-foreground rounded-lg hover:bg-muted/50 transition-colors"
          >
            View Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Modals */}
      {activeModal === 'view' && (
        <ViewModal
          fabricName={modalFabricName}
          entries={modalEntries}
          loading={modalLoading}
          onClose={closeModal}
        />
      )}
      {activeModal === 'edit' && (
        <EditModal
          fabricName={modalFabricName}
          entries={modalEntries}
          loading={modalLoading}
          saving={modalSaving}
          onSave={handleEditSave}
          onClose={closeModal}
        />
      )}
      {activeModal === 'delete' && (
        <DeleteModal
          fabricName={modalFabricName}
          entries={modalEntries}
          loading={modalLoading}
          deleting={modalDeleting}
          onDelete={handleDelete}
          onClose={closeModal}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-700 text-foreground">Fabric Entry</h1>
            <p className="text-sm text-muted-foreground">Enter finished fabric stock — processed &amp; ready for production use</p>
          </div>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('entry')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 rounded-md transition-colors ${
              activeTab === 'entry' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PlusCircle size={13} />
            New Entry
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 rounded-md transition-colors ${
              activeTab === 'receive' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowDownToLine size={13} />
            Fabric Receive
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 rounded-md transition-colors ${
              activeTab === 'inventory' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List size={13} />
            Inventory
            {inventoryRows.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary text-white text-xs rounded-full leading-none">
                {inventoryRows.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── ENTRY TAB ── */}
      {activeTab === 'entry' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Submit error banner */}
          {submitError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Voucher Header */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-700 text-foreground mb-4">Voucher Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Voucher No. *</label>
                <input
                  type="text"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder="e.g. FV-001"
                  className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors.voucherNo ? 'border-red-400' : 'border-border'
                  }`}
                />
                {errors.voucherNo && <span className="text-xs text-red-500">{errors.voucherNo}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Date *</label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors.voucherDate ? 'border-red-400' : 'border-border'
                  }`}
                />
                {errors.voucherDate && <span className="text-xs text-red-500">{errors.voucherDate}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Source / Supplier</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  disabled={accountsLoading}
                >
                  <option value="">{accountsLoading ? 'Loading...' : 'Select Account'}</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Fabric Entries */}
          <div className="flex flex-col gap-4">
            {lines.map((line, lineIdx) => {
              const lineTotalQty = line.rolls.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
              return (
                <div key={line.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Fabric Header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-700 text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Fabric #{lineIdx + 1}
                      </span>
                      {line.fabricName && (
                        <span className="text-xs font-600 text-foreground">{line.fabricName}</span>
                      )}
                      {line.rolls.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          · {line.rolls.length} rolls
                          {lineTotalQty > 0 && ` · ${lineTotalQty.toFixed(2)} ${line.unit}`}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length === 1}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    {/* Common Fabric Details */}
                    <div>
                      <p className="text-xs font-600 text-muted-foreground mb-2.5 uppercase tracking-wide">Common Fabric Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        {/* Fabric Name */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-muted-foreground">Fabric Name *</label>
                          <input
                            type="text"
                            value={line.fabricName}
                            onChange={(e) => updateLine(line.id, 'fabricName', e.target.value)}
                            placeholder="e.g. Malmal White"
                            className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                              errors[`fabricName-${lineIdx}`] ? 'border-red-400' : 'border-border'
                            }`}
                          />
                          {errors[`fabricName-${lineIdx}`] && (
                            <span className="text-xs text-red-500">{errors[`fabricName-${lineIdx}`]}</span>
                          )}
                        </div>

                        {/* Category */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-muted-foreground">Category *</label>
                          {addingCategoryForLine === line.id ? (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                autoFocus
                                value={newCategoryInput}
                                onChange={(e) => setNewCategoryInput(e.target.value)}
                                placeholder="New category name"
                                className="flex-1 px-3 py-2 text-sm border border-primary rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const trimmed = newCategoryInput.trim();
                                    if (trimmed) {
                                      const val = trimmed.toUpperCase().replace(/\s+/g, '_');
                                      setCustomCategories((prev) => [...prev, { value: val, label: trimmed }]);
                                      updateLine(line.id, 'category', val);
                                    }
                                    setAddingCategoryForLine(null);
                                    setNewCategoryInput('');
                                  } else if (e.key === 'Escape') {
                                    setAddingCategoryForLine(null);
                                    setNewCategoryInput('');
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const trimmed = newCategoryInput.trim();
                                  if (trimmed) {
                                    const val = trimmed.toUpperCase().replace(/\s+/g, '_');
                                    setCustomCategories((prev) => [...prev, { value: val, label: trimmed }]);
                                    updateLine(line.id, 'category', val);
                                  }
                                  setAddingCategoryForLine(null);
                                  setNewCategoryInput('');
                                }}
                                className="px-2 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => { setAddingCategoryForLine(null); setNewCategoryInput(''); }}
                                className="px-2 py-1 text-xs border border-border rounded-lg hover:bg-muted"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <select
                              value={line.category}
                              onChange={(e) => {
                                if (e.target.value === '__ADD_NEW__') {
                                  setAddingCategoryForLine(line.id);
                                  setNewCategoryInput('');
                                } else {
                                  updateLine(line.id, 'category', e.target.value);
                                }
                              }}
                              className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                                errors[`category-${lineIdx}`] ? 'border-red-400' : 'border-border'
                              }`}
                            >
                              {DEFAULT_CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                              {customCategories.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                              <option value="__ADD_NEW__">+ Add New Category</option>
                            </select>
                          )}
                          {errors[`category-${lineIdx}`] && (
                            <span className="text-xs text-red-500">{errors[`category-${lineIdx}`]}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Width */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-muted-foreground">Width (inches)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={line.width}
                            onChange={(e) => updateLine(line.id, 'width', e.target.value)}
                            placeholder="e.g. 44"
                            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                          />
                        </div>

                        {/* Unit */}
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-600 text-muted-foreground">Unit</label>
                          <select
                            value={line.unit}
                            onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Rolls Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">
                          Rolls / Thans
                          <span className="ml-1.5 px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-500 normal-case tracking-normal">
                            {line.rolls.length}
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => addRoll(line.id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-600 rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          <Plus size={12} />
                          Add Roll
                        </button>
                      </div>

                      {/* Roll column headers */}
                      <div className="hidden sm:grid grid-cols-[0.6fr_1.2fr_2fr_auto] gap-2 px-3 py-1.5 bg-muted/40 rounded-t-lg border border-border border-b-0">
                        <span className="text-xs font-600 text-muted-foreground">#</span>
                        <span className="text-xs font-600 text-muted-foreground">Qty *</span>
                        <span className="text-xs font-600 text-muted-foreground">Remarks</span>
                        <span className="text-xs font-600 text-muted-foreground w-7"></span>
                      </div>

                      <div className="border border-border rounded-b-lg sm:rounded-t-none rounded-lg sm:rounded-none overflow-hidden divide-y divide-border/50">
                        {line.rolls.map((roll, rollIdx) => (
                          <div key={roll.id} className="grid grid-cols-1 sm:grid-cols-[0.6fr_1.2fr_2fr_auto] gap-2 px-3 py-2.5 items-center bg-background hover:bg-muted/10 transition-colors">
                            {/* Roll number badge */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-700 text-muted-foreground w-6 text-center bg-muted/60 rounded px-1 py-0.5">
                                {rollIdx + 1}
                              </span>
                            </div>

                            {/* Qty */}
                            <div className="flex flex-col gap-0.5">
                              <label className="text-xs text-muted-foreground sm:hidden">Qty *</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={roll.qty}
                                onChange={(e) => updateRoll(line.id, roll.id, 'qty', e.target.value)}
                                placeholder="0.00"
                                className={`px-2.5 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums w-full ${
                                  errors[`qty-${lineIdx}-${rollIdx}`] ? 'border-red-400' : 'border-border'
                                }`}
                              />
                              {errors[`qty-${lineIdx}-${rollIdx}`] && (
                                <span className="text-xs text-red-500">{errors[`qty-${lineIdx}-${rollIdx}`]}</span>
                              )}
                            </div>

                            {/* Remarks */}
                            <div className="flex flex-col gap-0.5">
                              <label className="text-xs text-muted-foreground sm:hidden">Remarks</label>
                              <input
                                type="text"
                                value={roll.remarks}
                                onChange={(e) => updateRoll(line.id, roll.id, 'remarks', e.target.value)}
                                placeholder="Optional note for this roll"
                                className="px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
                              />
                            </div>

                            {/* Delete roll */}
                            <button
                              type="button"
                              onClick={() => removeRoll(line.id, roll.id)}
                              disabled={line.rolls.length === 1}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed justify-self-end"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Roll subtotal */}
                      {line.rolls.length > 1 && lineTotalQty > 0 && (
                        <div className="flex items-center justify-end gap-2 mt-1.5 px-1">
                          <span className="text-xs text-muted-foreground">Subtotal:</span>
                          <span className="text-xs font-700 text-primary tabular-nums">
                            {lineTotalQty.toFixed(2)} {line.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Fabric button */}
            <button
              type="button"
              onClick={addLine}
              className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-border rounded-xl text-sm font-600 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <Plus size={15} />
              Add Another Fabric
            </button>
          </div>

          {/* Grand total */}
          {totalQty > 0 && (
            <div className="flex items-center justify-end gap-3 px-5 py-3 bg-muted/30 border border-border rounded-xl">
              <span className="text-xs font-600 text-muted-foreground">
                Grand Total ({lines.length} fabric{lines.length !== 1 ? 's' : ''}, {totalRolls} roll{totalRolls !== 1 ? 's' : ''}):
              </span>
              <span className="text-sm font-700 text-primary tabular-nums">
                {totalQty.toFixed(2)} (mixed units)
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              className="px-5 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Save Fabric Voucher
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── FABRIC RECEIVE TAB ── */}
      {activeTab === 'receive' && (
        <form onSubmit={handleReceiveSubmit} className="flex flex-col gap-6">
          {/* Error banner */}
          {receiveSubmitError && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{receiveSubmitError}</span>
            </div>
          )}

          {/* Receipt Header */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-700 text-foreground mb-4">Receipt Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Receipt No */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Receipt No. *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={receiveReceiptNo}
                    onChange={(e) => setReceiveReceiptNo(e.target.value)}
                    placeholder="e.g. PFR-0001"
                    disabled={receiveReceiptNoLoading}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      receiveErrors.receiptNo ? 'border-red-400' : 'border-border'
                    }`}
                  />
                  {receiveReceiptNoLoading && (
                    <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                {receiveErrors.receiptNo && <span className="text-xs text-red-500">{receiveErrors.receiptNo}</span>}
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Date *</label>
                <input
                  type="date"
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    receiveErrors.receiveDate ? 'border-red-400' : 'border-border'
                  }`}
                />
                {receiveErrors.receiveDate && <span className="text-xs text-red-500">{receiveErrors.receiveDate}</span>}
              </div>

              {/* Printer / Account */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Printer / Account *</label>
                <select
                  value={receivePrinter}
                  onChange={(e) => { setReceivePrinter(e.target.value); setSelectedIssueId(''); }}
                  disabled={accountsLoading}
                  className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    receiveErrors.receivePrinter ? 'border-red-400' : 'border-border'
                  }`}
                >
                  <option value="">{accountsLoading ? 'Loading...' : 'Select Printer / Account'}</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>{acc.name}</option>
                  ))}
                </select>
                {receiveErrors.receivePrinter && <span className="text-xs text-red-500">{receiveErrors.receivePrinter}</span>}
              </div>

              {/* Finished Fabric Name */}
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <label className="text-xs font-600 text-muted-foreground">Finished Fabric Name *</label>
                <input
                  type="text"
                  value={receiveFinishedFabricName}
                  onChange={(e) => setReceiveFinishedFabricName(e.target.value)}
                  placeholder="e.g. Malmal White Printed"
                  className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    receiveErrors.finishedFabricName ? 'border-red-400' : 'border-border'
                  }`}
                />
                {receiveErrors.finishedFabricName && <span className="text-xs text-red-500">{receiveErrors.finishedFabricName}</span>}
              </div>
            </div>
          </div>

          {/* Fabric Issue Selection */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-700 text-foreground">Select Fabric Issue</h2>
              {receivePrinter && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingIssuesLoading(true);
                    printerFabricService.getIssuesByPrinter(receivePrinter).then((issues) => {
                      setPendingIssues(issues);
                      setPendingIssuesLoading(false);
                    });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <RefreshCw size={11} />
                  Refresh
                </button>
              )}
            </div>

            {!receivePrinter ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg">
                <AlertCircle size={15} className="text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Select a printer/account above to see pending fabric issues.</p>
              </div>
            ) : pendingIssuesLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading pending issues...</span>
              </div>
            ) : pendingIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Package size={22} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No pending fabric issues found for this printer.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Pending Fabric Issues *</label>
                  <select
                    value={selectedIssueId}
                    onChange={(e) => setSelectedIssueId(e.target.value)}
                    className={`px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      receiveErrors.selectedIssue ? 'border-red-400' : 'border-border'
                    }`}
                  >
                    <option value="">— Select Fabric Issue —</option>
                    {(() => {
                      // Group issues by fabric name for consolidated display
                      const grouped = pendingIssues.reduce<Record<string, typeof pendingIssues>>((acc, issue) => {
                        const key = issue.fabricName || issue.grayFabricRef;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(issue);
                        return acc;
                      }, {});
                      return Object.entries(grouped).map(([fabricLabel, issues]) => {
                        const totalPending = issues.reduce((sum, i) => sum + i.qtyPending, 0);
                        return (
                          <optgroup key={fabricLabel} label={`${fabricLabel} — Total Pending: ${totalPending.toFixed(3)} Mt.`}>
                            {issues.map((issue) => (
                              <option key={issue.id} value={issue.id}>
                                {issue.issueNo} — Pending: {issue.qtyPending.toFixed(3)} Mt. [{issue.status}]
                              </option>
                            ))}
                          </optgroup>
                        );
                      });
                    })()}
                  </select>
                  {receiveErrors.selectedIssue && <span className="text-xs text-red-500">{receiveErrors.selectedIssue}</span>}
                </div>

                {/* Selected Issue Summary */}
                {selectedIssue && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                    <div className="flex flex-col gap-1 px-3 py-2.5 bg-muted/30 rounded-lg border border-border">
                      <span className="text-xs text-muted-foreground">Issue No.</span>
                      <span className="text-sm font-700 text-foreground">{selectedIssue.issueNo}</span>
                    </div>
                    <div className="flex flex-col gap-1 px-3 py-2.5 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-xs text-blue-600">Issued Qty</span>
                      <span className="text-sm font-700 text-blue-700 tabular-nums">{selectedIssue.qtyIssued.toFixed(3)} Mt.</span>
                    </div>
                    <div className="flex flex-col gap-1 px-3 py-2.5 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-xs text-green-600">Received So Far</span>
                      <span className="text-sm font-700 text-green-700 tabular-nums">{selectedIssue.qtyReceived.toFixed(3)} Mt.</span>
                    </div>
                    <div className="flex flex-col gap-1 px-3 py-2.5 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-xs text-amber-600">Pending</span>
                      <span className="text-sm font-700 text-amber-700 tabular-nums">{selectedIssue.qtyPending.toFixed(3)} Mt.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Roll-wise Receipt Entry */}
          {selectedIssue && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-700 text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {selectedIssue.fabricName || selectedIssue.grayFabricRef}
                  </span>
                  <span className="text-xs text-muted-foreground">· Roll-wise Receipt Entry</span>
                </div>
                <button
                  type="button"
                  onClick={addReceiveRoll}
                  className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs font-600 rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <Plus size={12} />
                  Add Roll
                </button>
              </div>

              <div className="p-5 flex flex-col gap-3">
                {/* Column headers */}
                <div className="hidden sm:grid grid-cols-[0.5fr_1.2fr_2fr_auto] gap-2 px-3 py-1.5 bg-muted/40 rounded-lg">
                  <span className="text-xs font-600 text-muted-foreground">#</span>
                  <span className="text-xs font-600 text-muted-foreground">Qty Received *</span>
                  <span className="text-xs font-600 text-muted-foreground">Remarks</span>
                  <span className="text-xs font-600 text-muted-foreground w-7"></span>
                </div>

                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border/50">
                  {receiveRolls.map((roll, idx) => (
                    <div key={roll.id} className="grid grid-cols-1 sm:grid-cols-[0.5fr_1.2fr_2fr_auto] gap-2 px-3 py-2.5 items-center bg-background hover:bg-muted/10 transition-colors">
                      <span className="text-xs font-700 text-muted-foreground w-6 text-center bg-muted/60 rounded px-1 py-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-muted-foreground sm:hidden">Qty Received *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={roll.qty}
                          onChange={(e) => updateReceiveRoll(roll.id, 'qty', e.target.value)}
                          placeholder="0.000"
                          className={`px-2.5 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums w-full ${
                            receiveErrors[`rqty-${idx}`] ? 'border-red-400' : 'border-border'
                          }`}
                        />
                        {receiveErrors[`rqty-${idx}`] && (
                          <span className="text-xs text-red-500">{receiveErrors[`rqty-${idx}`]}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-muted-foreground sm:hidden">Remarks</label>
                        <input
                          type="text"
                          value={roll.remarks}
                          onChange={(e) => updateReceiveRoll(roll.id, 'remarks', e.target.value)}
                          placeholder="Optional note for this roll"
                          className="px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeReceiveRoll(roll.id)}
                        disabled={receiveRolls.length === 1}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed justify-self-end"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total received vs pending */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 rounded-lg border border-border mt-1">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Total Receiving:</span>
                      <span className={`text-sm font-700 tabular-nums ${totalReceiveQty > (selectedIssue?.qtyPending ?? 0) + 0.001 ? 'text-red-600' : 'text-primary'}`}>
                        {totalReceiveQty.toFixed(3)} Mt.
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Remaining after receipt:</span>
                      <span className="text-sm font-700 tabular-nums text-amber-600">
                        {Math.max(0, (selectedIssue?.qtyPending ?? 0) - totalReceiveQty).toFixed(3)} Mt.
                      </span>
                    </div>
                  </div>
                  {receiveRolls.length > 1 && (
                    <span className="text-xs text-muted-foreground">{receiveRolls.length} rolls</span>
                  )}
                </div>
                {receiveErrors.totalQty && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={13} className="text-red-600 flex-shrink-0" />
                    <span className="text-xs text-red-600">{receiveErrors.totalQty}</span>
                  </div>
                )}

                {/* Remarks */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-xs font-600 text-muted-foreground">Voucher Remarks</label>
                  <input
                    type="text"
                    value={receiveRemarks}
                    onChange={(e) => setReceiveRemarks(e.target.value)}
                    placeholder="Optional overall remarks for this receipt"
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReceiveReset}
              disabled={receiveSubmitting}
              className="px-5 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={receiveSubmitting || !selectedIssue}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {receiveSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ArrowDownToLine size={15} />
                  Save Fabric Receipt
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── INVENTORY TAB ── */}
      {activeTab === 'inventory' && (
        <div className="flex flex-col gap-4">
          {inventoryLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading inventory...</p>
            </div>
          ) : inventoryError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 bg-card border border-border rounded-xl">
              <AlertCircle size={28} className="text-red-500" />
              <p className="text-sm text-red-600">{inventoryError}</p>
              <button
                onClick={loadInventory}
                className="px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : inventoryRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 bg-card border border-border rounded-xl">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Package size={22} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-600 text-foreground">No fabric in inventory yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a fabric voucher to populate the inventory.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('entry')}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <PlusCircle size={14} />
                Add Fabric Entry
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-700 text-foreground">Finished Fabric Inventory</h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Ready Stock
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {inventoryRows.length} finished fabric type{inventoryRows.length !== 1 ? 's' : ''} · {inventoryItems.length} total entries · processed &amp; ready for production
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadInventory}
                    disabled={inventoryLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-600 text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {inventoryLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                    Refresh
                  </button>
                  <button
                    onClick={() => setActiveTab('entry')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-600 rounded-lg hover:bg-primary/20 transition-colors"
                  >
                    <Plus size={13} />
                    New Entry
                  </button>
                </div>
              </div>

              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_0.8fr_0.8fr_auto] gap-3 px-5 py-2.5 bg-muted/40 border-b border-border">
                <span className="text-xs font-600 text-muted-foreground">Fabric Name</span>
                <span className="text-xs font-600 text-muted-foreground">Category</span>
                <span className="text-xs font-600 text-muted-foreground">Total Qty</span>
                <span className="text-xs font-600 text-muted-foreground">Unit</span>
                <span className="text-xs font-600 text-muted-foreground">Entries</span>
                <span className="text-xs font-600 text-muted-foreground">Actions</span>
              </div>

              <div className="divide-y divide-border/50">
                {inventoryRows.map((row) => (
                  <div
                    key={row.fabricName}
                    className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_0.8fr_0.8fr_auto] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors"
                  >
                    <Link
                      href={`/fabric-inventory/${encodeURIComponent(row.fabricName)}`}
                      className="text-sm font-600 text-primary hover:underline hover:text-primary/80 transition-colors"
                    >
                      {row.fabricName}
                    </Link>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full w-fit font-500">
                      {row.category}
                    </span>
                    <span className="text-sm font-700 text-foreground tabular-nums">
                      {row.qty.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground">{row.unit}</span>
                    <span className="text-xs text-muted-foreground">{row.count} entr{row.count !== 1 ? 'ies' : 'y'}</span>
                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal('view', row.fabricName)}
                        title="View entries"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => openModal('edit', row.fabricName)}
                        title="Edit entries"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => openModal('delete', row.fabricName)}
                        title="Delete entries"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
