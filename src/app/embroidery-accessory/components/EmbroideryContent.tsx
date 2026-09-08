'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronRight, Trash2, Pencil, CheckCircle, Scissors, Package, Sparkles, MoreHorizontal, Layers, ArrowUpFromLine, ArrowDownToLine, Eye, Search } from 'lucide-react';
import {
  EmbroideryAccessoryEntry,
  ProcessType,
  EmbroideryType,
  PROCESS_TYPE_LABELS,
  EMBROIDERY_TYPE_LABELS,
  AccessoryUsed,
  ProcessDetail,
  FabricIssueRow,
} from '../data/embroideryData';
import { embroideryService } from '@/lib/services/embroideryService';
import { embroideryVoucherService, EmbIssueVoucher, EmbReceiveVoucher, CuttingStockItem, CuttingMovement,  } from '@/lib/services/embroideryVoucherService';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { accountService } from '@/lib/services/accountService';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { FabricStockItem } from '@/app/fabric-inventory/data/fabricStockData';
import { Account } from '@/app/account-master/data/accountsData';
import IssueVoucherModal from './IssueVoucherModal';
import ReceiveVoucherModal from './ReceiveVoucherModal';
import { useSearchParams } from 'next/navigation';

const PROCESS_TYPES: ProcessType[] = ['embroidery', 'yoke_embroidery', 'accessory_sorting', 'other'];
const EMBROIDERY_TYPES: EmbroideryType[] = ['yoke_embroidery', 'border_embroidery'];

const REJECTION_REASONS = [
  'Embroidery defect',
  'Wrong design',
  'Thread break',
  'Colour mismatch',
  'Accessory missing',
  'Size mismatch',
  'Fabric damage',
  'Other',
];

const ACCESSORY_UNITS = ['Pcs', 'Metres', 'Dozen', 'Set', 'Kg', 'Grams'];
const SUB_COMPONENTS = ['Kurta', 'Pant', 'Dupatta', 'Shirt', 'Yoke', 'Sleeve', 'Collar', 'Pocket', 'Other'];

const PROCESS_ICONS: Record<ProcessType, React.ReactNode> = {
  embroidery: <Sparkles size={14} />,
  yoke_embroidery: <Scissors size={14} />,
  accessory_sorting: <Package size={14} />,
  other: <MoreHorizontal size={14} />,
};

const PROCESS_COLORS: Record<ProcessType, string> = {
  embroidery: 'bg-purple-100 text-purple-700',
  yoke_embroidery: 'bg-blue-100 text-blue-700',
  accessory_sorting: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-600',
};

type ActiveTab = 'issue_vouchers' | 'receive_vouchers';

const ISSUE_STATUS_COLORS: Record<string, string> = {
  open: 'bg-warning-bg text-warning',
  partially_received: 'bg-blue-100 text-blue-700',
  fully_received: 'bg-success-bg text-success',
  closed: 'bg-gray-100 text-gray-600',
};

const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  partially_received: 'Partial',
  fully_received: 'Fully Received',
  closed: 'Closed',
};

function makeAccessoryRow(): AccessoryUsed {
  return { name: '', qty: 0, unit: 'Pcs' };
}

function makeProcessDetailRow(): ProcessDetail {
  return { subComponent: 'Kurta', piecesIn: 0, piecesOut: 0, rejections: 0 };
}

function makeFabricIssueRow(): FabricIssueRow {
  return { fabricId: '', fabricName: '', rollId: '', rollName: '', issuedQty: 0, consumedQty: 0, returnedQty: 0, unit: 'Metre' };
}

interface FormState {
  date: string;
  jobCardRef: string;
  styleName: string;
  processType: ProcessType;
  embroideryType: EmbroideryType;
  operatorName: string;
  piecesReceived: string;
  piecesProcessed: string;
  piecesRejected: string;
  finishedPieces: string;
  rejectionReason: string;
  status: 'in_progress' | 'completed';
  remarks: string;
  pricePerPiece: string;
}

const DEFAULT_FORM: FormState = {
  date: new Date().toISOString().split('T')[0],
  jobCardRef: '',
  styleName: '',
  processType: 'yoke_embroidery',
  embroideryType: 'yoke_embroidery',
  operatorName: '',
  piecesReceived: '',
  piecesProcessed: '',
  piecesRejected: '0',
  finishedPieces: '',
  rejectionReason: '',
  status: 'completed',
  remarks: '',
  pricePerPiece: '',
};

// Group fabric inventory by fabric name for roll selection
function groupFabricsByName(fabrics: FabricStockItem[]): Record<string, FabricStockItem[]> {
  return fabrics.reduce((acc, f) => {
    if (!acc[f.fabricName]) acc[f.fabricName] = [];
    acc[f.fabricName].push(f);
    return acc;
  }, {} as Record<string, FabricStockItem[]>);
}

export default function EmbroideryContent() {
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issue_vouchers');
  const [issueStatusFilter, setIssueStatusFilter] = useState<string>('all');
  const [issueSearch, setIssueSearch] = useState('');
  const [receiveTypeFilter, setReceiveTypeFilter] = useState<string>('all');
  const [entries, setEntries] = useState<EmbroideryAccessoryEntry[]>([]);
  const [issueVouchers, setIssueVouchers] = useState<EmbIssueVoucher[]>([]);
  const [receiveVouchers, setReceiveVouchers] = useState<EmbReceiveVoucher[]>([]);
  const [cuttingStock, setCuttingStock] = useState<CuttingStockItem[]>([]);
  const [movementHistory, setMovementHistory] = useState<CuttingMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [preSelectedIssueId, setPreSelectedIssueId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<EmbroideryAccessoryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmbroideryAccessoryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Real-time stats
  const [embStats, setEmbStats] = useState({
    totalIssued: 0,
    totalReceived: 0,
    pendingFromEmbroidery: 0,
    embroideryReceived: 0,
    readyForCutting: 0,
    issuedToCutting: 0,
    balanceAvailable: 0,
  });

  // Issue / Receive voucher view/delete state
  const [viewIssueVoucher, setViewIssueVoucher] = useState<EmbIssueVoucher | null>(null);
  const [deleteIssueTarget, setDeleteIssueTarget] = useState<EmbIssueVoucher | null>(null);
  const [deletingIssue, setDeletingIssue] = useState(false);
  const [editIssueVoucher, setEditIssueVoucher] = useState<EmbIssueVoucher | null>(null);
  const [viewReceiveVoucher, setViewReceiveVoucher] = useState<EmbReceiveVoucher | null>(null);
  const [deleteReceiveTarget, setDeleteReceiveTarget] = useState<EmbReceiveVoucher | null>(null);
  const [deletingReceive, setDeletingReceive] = useState(false);
  const [editReceiveVoucher, setEditReceiveVoucher] = useState<EmbReceiveVoucher | null>(null);

  // Fabric inventory & accounts
  const [fabrics, setFabrics] = useState<FabricStockItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fabricsLoading, setFabricsLoading] = useState(false);

  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [accessories, setAccessories] = useState<AccessoryUsed[]>([]);
  const [processDetails, setProcessDetails] = useState<ProcessDetail[]>([makeProcessDetailRow()]);
  const [fabricIssues, setFabricIssues] = useState<FabricIssueRow[]>([]);

  const loadEntries = useCallback(async () => {
    const data = await embroideryService.getAll();
    setEntries(data);
    setLoading(false);
  }, []);

  const loadVouchers = useCallback(async () => {
    const [issues, receives, stock, movements, stats] = await Promise.all([
      embroideryVoucherService.getAllIssueVouchers(),
      embroideryVoucherService.getAllReceiveVouchers(),
      embroideryVoucherService.getAllCuttingStock(),
      embroideryVoucherService.getAllMovementHistory(),
      embroideryVoucherService.getRealTimeEmbroideryStats(),
    ]);
    setIssueVouchers(issues);
    setReceiveVouchers(receives);
    setCuttingStock(stock);
    setMovementHistory(movements);
    setEmbStats(stats);
  }, []);

  const loadFabricsAndAccounts = useCallback(async () => {
    setFabricsLoading(true);
    const [fabricData, accountData] = await Promise.all([
      fabricInventoryService.getAll(),
      accountService.getAll(),
    ]);
    // Only in-stock fabrics (stockQty > 0)
    setFabrics(fabricData.filter((f) => f.stockQty > 0));
    setAccounts(accountData);
    setFabricsLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
    loadVouchers();
    loadFabricsAndAccounts();
  }, [loadEntries, loadVouchers, loadFabricsAndAccounts]);

  // Apply URL filter params on mount
  useEffect(() => {
    const tab = searchParams.get('tab') as ActiveTab | null;
    const filter = searchParams.get('filter');
    if (tab === 'issue_vouchers' || tab === 'receive_vouchers') {
      setActiveTab(tab);
    }
    if (filter === 'pending') {
      setIssueStatusFilter('open');
    }
  }, [searchParams]);

  useRealtimeTable('embroidery_accessory_entries', loadEntries);
  useRealtimeTable('emb_issue_vouchers', loadVouchers);
  useRealtimeTable('emb_receive_vouchers', loadVouchers);
  useRealtimeTable('cutting_stock', loadVouchers);
  useRealtimeTable('cutting_movement_history', loadVouchers);
  useRealtimeTable('fabric_inventory', loadFabricsAndAccounts);
  useRealtimeTable('job_cards', refreshJobCards);

  const fabricsByName = groupFabricsByName(fabrics);
  const fabricNames = Object.keys(fabricsByName).sort();

  // Filtered issue vouchers for table display
  const filteredIssueVouchers = issueVouchers.filter((v) => {
    const matchSearch = !issueSearch ||
      v.voucherNo.toLowerCase().includes(issueSearch.toLowerCase()) ||
      v.jobCardRef.toLowerCase().includes(issueSearch.toLowerCase()) ||
      (v.styleName || '').toLowerCase().includes(issueSearch.toLowerCase()) ||
      (v.partyName || '').toLowerCase().includes(issueSearch.toLowerCase());
    const matchStatus = issueStatusFilter === 'all' || v.status === issueStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredReceiveVouchers = receiveVouchers.filter((v) => {
    if (receiveTypeFilter === 'fabric') return v.fabricItems.length > 0;
    if (receiveTypeFilter === 'accessory') return v.accessoryItems.length > 0;
    if (receiveTypeFilter === 'today') return v.voucherDate === new Date().toISOString().split('T')[0];
    return true;
  });

  // Derived stats
  const totalPiecesProcessed = entries.reduce((s, e) => s + e.piecesProcessed, 0);
  const totalPiecesRejected = entries.reduce((s, e) => s + e.piecesRejected, 0);
  const completedCount = entries.filter((e) => e.status === 'completed').length;
  const totalFinished = entries.reduce((s, e) => s + (e.finishedPieces || 0), 0);

  function openAddModal() {
    setEditingEntry(null);
    setForm({ ...DEFAULT_FORM, date: new Date().toISOString().split('T')[0] });
    setAccessories([]);
    setProcessDetails([makeProcessDetailRow()]);
    setFabricIssues([]);
    setSaveError(null);
    setShowModal(true);
  }

  function openEditModal(entry: EmbroideryAccessoryEntry) {
    setEditingEntry(entry);
    setForm({
      date: entry.date,
      jobCardRef: entry.jobCardRef,
      styleName: entry.styleName,
      processType: entry.processType,
      embroideryType: entry.embroideryType || 'yoke_embroidery',
      operatorName: entry.operatorName,
      piecesReceived: String(entry.piecesReceived),
      piecesProcessed: String(entry.piecesProcessed),
      piecesRejected: String(entry.piecesRejected),
      finishedPieces: String(entry.finishedPieces || ''),
      rejectionReason: entry.rejectionReason || '',
      status: entry.status,
      remarks: entry.remarks || '',
      pricePerPiece: entry.pricePerPiece != null ? String(entry.pricePerPiece) : '',
    });
    setAccessories(entry.accessoriesUsed.length > 0 ? [...entry.accessoriesUsed] : []);
    setProcessDetails(entry.processDetails.length > 0 ? [...entry.processDetails] : [makeProcessDetailRow()]);
    setFabricIssues(entry.fabricIssues && entry.fabricIssues.length > 0 ? [...entry.fabricIssues] : []);
    setSaveError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingEntry(null);
    setSaveError(null);
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const netPieces = Math.max(0, (parseInt(form.piecesProcessed) || 0) - (parseInt(form.piecesRejected) || 0));
  const totalAmount =
    form.pricePerPiece && netPieces > 0
      ? (parseFloat(form.pricePerPiece) * netPieces).toFixed(2)
      : null;

  const isEmbroideryProcess = form.processType === 'embroidery' || form.processType === 'yoke_embroidery';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.piecesReceived || !form.piecesProcessed) {
      setSaveError('Pieces received and processed are required.');
      return;
    }
    // Validate fabric issues
    for (const fi of fabricIssues) {
      if (!fi.fabricId || !fi.rollId) {
        setSaveError('Please select fabric and roll for all fabric issue rows.');
        return;
      }
      if (fi.issuedQty <= 0) {
        setSaveError('Issued quantity must be greater than 0 for all fabric issue rows.');
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    const payload: Omit<EmbroideryAccessoryEntry, 'id'> = {
      entryNo: editingEntry?.entryNo || (await embroideryService.getNextEntryNo()),
      date: form.date,
      jobCardRef: form.jobCardRef,
      styleName: form.styleName,
      processType: form.processType,
      embroideryType: isEmbroideryProcess ? form.embroideryType : undefined,
      operatorName: form.operatorName,
      piecesReceived: parseInt(form.piecesReceived) || 0,
      piecesProcessed: parseInt(form.piecesProcessed) || 0,
      piecesRejected: parseInt(form.piecesRejected) || 0,
      netPieces,
      finishedPieces: parseInt(form.finishedPieces) || 0,
      rejectionReason: form.rejectionReason || undefined,
      accessoriesUsed: accessories.filter((a) => a.name.trim()),
      processDetails: processDetails.filter((p) => p.subComponent),
      fabricIssues: fabricIssues.filter((f) => f.fabricId && f.rollId),
      status: form.status,
      remarks: form.remarks || undefined,
      pricePerPiece: form.pricePerPiece ? parseFloat(form.pricePerPiece) : undefined,
      totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
    };

    let result: EmbroideryAccessoryEntry | null = null;
    if (editingEntry) {
      result = await embroideryService.update(editingEntry.id, payload, editingEntry.fabricIssues || []);
    } else {
      result = await embroideryService.create(payload);
    }

    setSaving(false);
    if (!result) {
      setSaveError('Failed to save entry. Please try again.');
      return;
    }

    setSuccessMsg(editingEntry ? 'Entry updated successfully.' : 'Entry saved successfully.');
    setTimeout(() => setSuccessMsg(null), 3000);
    closeModal();
    loadEntries();
    loadFabricsAndAccounts();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await embroideryService.delete(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setDeleteTarget(null);
      loadEntries();
      loadFabricsAndAccounts();
    }
  }

  function addAccessory() { setAccessories((prev) => [...prev, makeAccessoryRow()]); }
  function removeAccessory(i: number) { setAccessories((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateAccessory(i: number, field: keyof AccessoryUsed, val: string | number) {
    setAccessories((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  }

  function addProcessDetail() { setProcessDetails((prev) => [...prev, makeProcessDetailRow()]); }
  function removeProcessDetail(i: number) { setProcessDetails((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateProcessDetail(i: number, field: keyof ProcessDetail, val: string | number) {
    setProcessDetails((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }

  function addFabricIssue() { setFabricIssues((prev) => [...prev, makeFabricIssueRow()]); }
  function removeFabricIssue(i: number) { setFabricIssues((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateFabricIssue(i: number, field: keyof FabricIssueRow, val: string | number) {
    setFabricIssues((prev) => prev.map((f, idx) => {
      if (idx !== i) return f;
      if (field === 'fabricName') {
        // Reset roll when fabric changes
        const rolls = fabricsByName[val as string] || [];
        const firstRoll = rolls[0];
        return {
          ...f,
          fabricName: val as string,
          fabricId: firstRoll?.id || '',
          rollId: firstRoll?.id || '',
          rollName: firstRoll?.fabricName || '',
          unit: firstRoll?.unit || 'Metre',
        };
      }
      if (field === 'rollId') {
        const roll = fabrics.find((fab) => fab.id === val);
        return { ...f, rollId: val as string, rollName: roll?.fabricName || '', unit: roll?.unit || f.unit };
      }
      return { ...f, [field]: val };
    }));
  }

  function handleVoucherSaved(msg: string) {
    setShowIssueModal(false);
    setShowReceiveModal(false);
    setEditIssueVoucher(null);
    setEditReceiveVoucher(null);
    setPreSelectedIssueId(undefined);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
    loadVouchers();
    loadFabricsAndAccounts();
  }

  async function handleDeleteIssueVoucher() {
    if (!deleteIssueTarget) return;
    setDeletingIssue(true);
    const ok = await embroideryVoucherService.deleteIssueVoucher(deleteIssueTarget.id);
    setDeletingIssue(false);
    if (ok) {
      setDeleteIssueTarget(null);
      setSuccessMsg('Issue Voucher deleted successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadVouchers();
    }
  }

  async function handleDeleteReceiveVoucher() {
    if (!deleteReceiveTarget) return;
    setDeletingReceive(true);
    const ok = await embroideryVoucherService.deleteReceiveVoucher(deleteReceiveTarget.id);
    setDeletingReceive(false);
    if (ok) {
      setDeleteReceiveTarget(null);
      setSuccessMsg('Receive Voucher deleted successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadVouchers();
    }
  }

  function openReceiveForIssue(issueId: string) {
    setPreSelectedIssueId(issueId);
    setShowReceiveModal(true);
  }

  function drillDownIssue(filter: string) {
    setActiveTab('issue_vouchers');
    setIssueStatusFilter(filter);
    setIssueSearch('');
    setTimeout(() => {
      document.getElementById('issue-vouchers-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function drillDownReceive(filter: string) {
    setActiveTab('receive_vouchers');
    setReceiveTypeFilter(filter);
    setTimeout(() => {
      document.getElementById('receive-vouchers-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-white flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-700 text-foreground font-display flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            Embroidery &amp; Accessory Sort-Out
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-0.5">
            Fabric issue → consumption → finished embroidered pieces (Yoke &amp; Border Embroidery)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'issue_vouchers' && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-600 hover:bg-primary/90 transition-colors font-body"
            >
              <ArrowUpFromLine size={16} /> New Issue Voucher
            </button>
          )}
          {activeTab === 'receive_vouchers' && (
            <button
              onClick={() => setShowReceiveModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-success text-white rounded-xl text-sm font-600 hover:bg-success/90 transition-colors font-body"
            >
              <ArrowDownToLine size={16} /> New Receive Voucher
            </button>
          )}
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mx-6 mt-4 p-3 bg-success-bg border border-success/20 rounded-xl text-sm text-success font-body flex items-center gap-2">
          <CheckCircle size={14} /> {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-1 border-b border-border bg-white overflow-x-auto">
        {([
          { key: 'issue_vouchers', label: 'Issue Vouchers', icon: <ArrowUpFromLine size={14} /> },
          { key: 'receive_vouchers', label: 'Receive Vouchers', icon: <ArrowDownToLine size={14} /> },
        ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-600 font-body border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.key === 'issue_vouchers' && issueVouchers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{issueVouchers.length}</span>
            )}
            {tab.key === 'receive_vouchers' && receiveVouchers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-success/10 text-success rounded-full text-xs">{receiveVouchers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Receive Voucher Stats */}
      {activeTab === 'receive_vouchers' && (
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Received', value: receiveVouchers.length, color: 'text-foreground', filter: 'all' },
            { label: 'Fabric Vouchers', value: receiveVouchers.filter((v) => v.fabricItems.length > 0).length, color: 'text-primary', filter: 'fabric' },
            { label: 'Accessory Vouchers', value: receiveVouchers.filter((v) => v.accessoryItems.length > 0).length, color: 'text-amber-600', filter: 'accessory' },
            { label: 'Today', value: receiveVouchers.filter((v) => v.voucherDate === new Date().toISOString().split('T')[0]).length, color: 'text-success', filter: 'today' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground font-body mb-1">{s.label}</p>
              <button
                onClick={() => drillDownReceive(s.filter)}
                className={`text-2xl font-700 font-display ${s.color} hover:underline cursor-pointer focus:outline-none`}
                title={`View ${s.label}`}
              >
                {s.value}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">

        {/* ── Issue Vouchers Tab ── */}
        {activeTab === 'issue_vouchers' && (
          <div id="issue-vouchers-table" className="bg-white border border-border rounded-xl overflow-hidden">
            {/* Search & Filter Bar */}
            {issueVouchers.length > 0 && (
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
                {searchParams.get('filter') === 'pending' && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-600 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    Drill-down from Dashboard
                  </span>
                )}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search voucher, job card, style..."
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    className="border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                  {['all', 'open', 'partially_received', 'fully_received'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setIssueStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-600 transition-colors capitalize ${issueStatusFilter === s ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{filteredIssueVouchers.length} vouchers</span>
              </div>
            )}
            {issueVouchers.length === 0 ? (
              <div className="p-12 text-center">
                <ArrowUpFromLine size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-600 text-foreground font-body">No Issue Vouchers yet</p>
                <p className="text-xs text-muted-foreground font-body mt-1">Create an Issue Voucher to issue fabric or material to an operator</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body w-8"></th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Voucher No</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Date</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Operator / Vendor</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Job Card</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Style</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Type</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Status</th>
                    <th className="text-right px-4 py-3 font-600 text-muted-foreground font-body">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIssueVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-muted-foreground">
                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-500">No vouchers match your filter</p>
                      </td>
                    </tr>
                  ) : filteredIssueVouchers.map((v) => {
                    const expanded = expandedRows.has(v.id);
                    return (
                      <React.Fragment key={v.id}>
                        <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <button onClick={() => toggleRow(v.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-600 text-foreground font-body">{v.voucherNo}</td>
                          <td className="px-4 py-3 text-muted-foreground font-body">{v.voucherDate}</td>
                          <td className="px-4 py-3 font-body font-600 text-foreground">{v.operatorName || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground font-body">{v.jobCardRef || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground font-body">{v.styleName || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 font-body ${
                              v.issueType === 'fabric' ? 'bg-blue-100 text-blue-700' :
                              v.issueType === 'accessory'? 'bg-amber-100 text-amber-700' :
                              v.issueType === 'cutting'? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {v.issueType === 'fabric' ? <Layers size={11} /> : v.issueType === 'accessory' ? <Package size={11} /> : v.issueType === 'cutting' ? <Scissors size={11} /> : null}
                              {v.issueType === 'fabric' ? 'Fabric' : v.issueType === 'accessory' ? 'Accessory' : v.issueType === 'cutting' ? 'Cutting' : 'Both'}
                            </span>
                            {v.issueSource === 'processed_cutting' && (
                              <span className="ml-1 inline-flex px-1.5 py-0.5 bg-success/10 text-success rounded text-xs font-600 font-body">Re-Issue</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-600 font-body ${ISSUE_STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600'}`}>
                              {ISSUE_STATUS_LABELS[v.status] || v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {(v.status === 'open' || v.status === 'partially_received') && (
                                <button
                                  onClick={() => openReceiveForIssue(v.id)}
                                  title="Receive against this voucher"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-success/10 text-success rounded-lg text-xs font-600 font-body hover:bg-success/20 transition-colors"
                                >
                                  <ArrowDownToLine size={11} /> Receive
                                </button>
                              )}
                              <button
                                onClick={() => setViewIssueVoucher(v)}
                                title="View details"
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => setEditIssueVoucher(v)}
                                title="Edit voucher"
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteIssueTarget(v)}
                                title="Delete voucher"
                                className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-border bg-muted/10">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {v.fabricItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1">
                                      <Layers size={12} /> Fabric Issued
                                    </p>
                                    <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Fabric</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Roll</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued Qty</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.fabricItems.map((f, i) => (
                                          <tr key={i} className="border-t border-border">
                                            <td className="px-3 py-2 font-body font-600">{f.fabricName}</td>
                                            <td className="px-3 py-2 font-body text-muted-foreground">#{f.rollId.slice(-6)}</td>
                                            <td className="px-3 py-2 text-right font-body text-primary font-600">{f.issuedQty}</td>
                                            <td className="px-3 py-2 font-body">{f.unit}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {v.accessoryItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1">
                                      <Package size={12} /> Accessories Issued
                                    </p>
                                    <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Item</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Qty</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.accessoryItems.map((a, i) => (
                                          <tr key={i} className="border-t border-border">
                                            <td className="px-3 py-2 font-body font-600">{a.name}</td>
                                            <td className="px-3 py-2 text-right font-body text-amber-700 font-600">{a.qty}</td>
                                            <td className="px-3 py-2 font-body">{a.unit}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                <div className="md:col-span-2 flex flex-wrap gap-4 text-xs font-body text-muted-foreground">
                                  {v.partyName && <span><span className="font-600 text-foreground">Party:</span> {v.partyName}</span>}
                                  {v.designCode && <span><span className="font-600 text-foreground">Design:</span> {v.designCode}</span>}
                                  {v.totalPieces > 0 && <span><span className="font-600 text-foreground">Total Pcs:</span> {v.totalPieces}</span>}
                                  {v.processType && <span><span className="font-600 text-foreground">Process:</span> <span className="capitalize">{v.processType.replace(/_/g, ' ')}</span></span>}
                                  {v.issuedToName && v.issuedToName !== v.operatorName && <span><span className="font-600 text-foreground">Issued To:</span> {v.issuedToName}</span>}
                                  {v.issueSource === 'processed_cutting' && <span className="text-success font-600">↺ Re-Issue from Cutting Stock</span>}
                                  {v.remarks && <span><span className="font-600 text-foreground">Remarks:</span> {v.remarks}</span>}
                                </div>
                                {v.cuttingItems && v.cuttingItems.length > 0 && (
                                  <div className="md:col-span-2">
                                    <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1">
                                      <Scissors size={12} /> Cutting Items Issued
                                    </p>
                                    <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Component</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Description</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Pieces</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.cuttingItems.map((c, i) => (
                                          <tr key={i} className="border-t border-border">
                                            <td className="px-3 py-2 font-body font-600">{c.component}</td>
                                            <td className="px-3 py-2 font-body text-muted-foreground">{c.description || '—'}</td>
                                            <td className="px-3 py-2 text-right font-body text-primary font-600">{c.pieces}</td>
                                            <td className="px-3 py-2 font-body">{c.unit}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* ── Receive Vouchers Tab ── */}
        {activeTab === 'receive_vouchers' && (
          <div id="receive-vouchers-table" className="bg-white border border-border rounded-xl overflow-hidden">
            {receiveVouchers.length > 0 && receiveTypeFilter !== 'all' && (
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-600 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                  Filtered: {receiveTypeFilter === 'fabric' ? 'Fabric Vouchers' : receiveTypeFilter === 'accessory' ? 'Accessory Vouchers' : 'Today'}
                </span>
                <button onClick={() => setReceiveTypeFilter('all')} className="text-xs text-muted-foreground hover:text-foreground underline">Clear filter</button>
                <span className="ml-auto text-xs text-muted-foreground">{filteredReceiveVouchers.length} vouchers</span>
              </div>
            )}
            {receiveVouchers.length === 0 ? (
              <div className="p-12 text-center">
                <ArrowDownToLine size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-600 text-foreground font-body">No Receive Vouchers yet</p>
                <p className="text-xs text-muted-foreground font-body mt-1">Create a Receive Voucher to record material received back from an operator</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body w-8"></th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Voucher No</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Date</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Issue Voucher</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Operator</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Job Card</th>
                    <th className="text-left px-4 py-3 font-600 text-muted-foreground font-body">Style</th>
                    <th className="text-right px-4 py-3 font-600 text-muted-foreground font-body">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceiveVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-muted-foreground">
                        <Search size={24} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-500">No vouchers match your filter</p>
                      </td>
                    </tr>
                  ) : filteredReceiveVouchers.map((v) => {
                    const expanded = expandedRows.has(v.id);
                    return (
                      <React.Fragment key={v.id}>
                        <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <button onClick={() => toggleRow(v.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-600 text-foreground font-body">{v.voucherNo}</td>
                          <td className="px-4 py-3 text-muted-foreground font-body">{v.voucherDate}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-600 font-body">{v.issueVoucherNo}</span>
                          </td>
                          <td className="px-4 py-3 font-body font-600 text-foreground">{v.operatorName || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground font-body">{v.jobCardRef || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground font-body">{v.styleName || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewReceiveVoucher(v)}
                                title="View details"
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => setEditReceiveVoucher(v)}
                                title="Edit voucher"
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteReceiveTarget(v)}
                                title="Delete voucher"
                                className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-border bg-muted/10">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Operator traceability */}
                                <div className="md:col-span-2 flex flex-wrap gap-x-6 gap-y-2 text-xs font-body pb-2 border-b border-border">
                                  <div>
                                    <span className="text-muted-foreground font-600">Issue Operator:</span>{' '}
                                    <span className="text-foreground font-700">{v.operatorName || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-600">Receive Operator:</span>{' '}
                                    <span className="text-foreground font-700">{(v as any).receiveOperatorName || v.operatorName || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-600">Linked Issue:</span>{' '}
                                    <span className="inline-flex px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-600">{v.issueVoucherNo}</span>
                                  </div>
                                  {v.jobCardRef && (
                                    <div>
                                      <span className="text-muted-foreground font-600">Job Card:</span>{' '}
                                      <span className="text-foreground">{v.jobCardRef}</span>
                                    </div>
                                  )}
                                </div>
                                {v.fabricItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1">
                                      <Layers size={12} /> Fabric Received
                                    </p>
                                    <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Fabric</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Issue Unit</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Received</th>
                                          <th className="text-right px-3 py-2 font-600 text-danger font-body">Rejected</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Recv Unit</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Balance</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.fabricItems.map((f, i) => {
                                          const receiveUnit = (f as any).receiveUnit || f.unit;
                                          const unitDiffers = receiveUnit !== f.unit;
                                          const rejectedQty = (f as any).rejectedQty || 0;
                                          const rejectionReason = (f as any).rejectionReason || '';
                                          return (
                                            <tr key={i} className="border-t border-border">
                                              <td className="px-3 py-2 font-body font-600">{f.fabricName}</td>
                                              <td className="px-3 py-2 text-right font-body">{f.issuedQty}</td>
                                              <td className="px-3 py-2 font-body text-muted-foreground">{f.unit}</td>
                                              <td className="px-3 py-2 text-right font-body text-success font-600">{f.receivedQty}</td>
                                              <td className="px-3 py-2 text-right font-body">
                                                {rejectedQty > 0 ? (
                                                  <span className="text-danger font-600">{rejectedQty}{rejectionReason ? <span className="ml-1 text-xs text-muted-foreground font-400">({rejectionReason})</span> : null}</span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                              </td>
                                              <td className="px-3 py-2 font-body">
                                                <span className={unitDiffers ? 'text-primary font-700' : ''}>{receiveUnit}</span>
                                                {unitDiffers && <span className="ml-1 text-xs text-primary">(≠ issue)</span>}
                                              </td>
                                              <td className="px-3 py-2 text-right font-body text-warning">{unitDiffers ? '—' : f.balanceQty}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {v.accessoryItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1">
                                      <Package size={12} /> Accessories Received
                                    </p>
                                    <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Item</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Issue Unit</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Received</th>
                                          <th className="text-right px-3 py-2 font-600 text-danger font-body">Rejected</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Recv Unit</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Balance</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.accessoryItems.map((a, i) => {
                                          const receiveUnit = (a as any).receiveUnit || a.unit;
                                          const unitDiffers = receiveUnit !== a.unit;
                                          const rejectedQty = (a as any).rejectedQty || 0;
                                          const rejectionReason = (a as any).rejectionReason || '';
                                          return (
                                            <tr key={i} className="border-t border-border">
                                              <td className="px-3 py-2 font-body font-600">{a.name}</td>
                                              <td className="px-3 py-2 text-right font-body">{a.issuedQty}</td>
                                              <td className="px-3 py-2 font-body text-muted-foreground">{a.unit}</td>
                                              <td className="px-3 py-2 text-right font-body text-success font-600">{a.receivedQty}</td>
                                              <td className="px-3 py-2 text-right font-body">
                                                {rejectedQty > 0 ? (
                                                  <span className="text-danger font-600">{rejectedQty}{rejectionReason ? <span className="ml-1 text-xs text-muted-foreground font-400">({rejectionReason})</span> : null}</span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                              </td>
                                              <td className="px-3 py-2 font-body">
                                                <span className={unitDiffers ? 'text-primary font-700' : ''}>{receiveUnit}</span>
                                                {unitDiffers && <span className="ml-1 text-xs text-primary">(≠ issue)</span>}
                                              </td>
                                              <td className="px-3 py-2 text-right font-body text-warning">{unitDiffers ? '—' : a.balanceQty}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {v.cuttingItems && v.cuttingItems.length > 0 && (
                                  <div>
                                    <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1">
                                      <Scissors size={12} /> Cutting Pieces Received
                                      <span className="ml-1 px-1.5 py-0.5 bg-success/10 text-success rounded text-xs font-600">→ Added to Cutting Stock</span>
                                    </p>
                                    <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                                      <thead className="bg-muted/40">
                                        <tr>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Component</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Issue Unit</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Received</th>
                                          <th className="text-right px-3 py-2 font-600 text-danger font-body">Rejected</th>
                                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Recv Unit</th>
                                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Balance</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {v.cuttingItems.map((c, i) => {
                                          const receiveUnit = (c as any).receiveUnit || c.unit;
                                          const unitDiffers = receiveUnit !== c.unit;
                                          const rejectedPieces = (c as any).rejectedPieces || 0;
                                          const rejectionReason = (c as any).rejectionReason || '';
                                          return (
                                            <tr key={i} className="border-t border-border">
                                              <td className="px-3 py-2 font-body font-600">{c.component}</td>
                                              <td className="px-3 py-2 text-right font-body">{c.issuedPieces}</td>
                                              <td className="px-3 py-2 font-body text-muted-foreground">{c.unit}</td>
                                              <td className="px-3 py-2 text-right font-body text-success font-600">{c.receivedPieces}</td>
                                              <td className="px-3 py-2 text-right font-body">
                                                {rejectedPieces > 0 ? (
                                                  <span className="text-danger font-600">{rejectedPieces}{rejectionReason ? <span className="ml-1 text-xs text-muted-foreground font-400">({rejectionReason})</span> : null}</span>
                                                ) : <span className="text-muted-foreground">—</span>}
                                              </td>
                                              <td className="px-3 py-2 font-body">
                                                <span className={unitDiffers ? 'text-primary font-700' : ''}>{receiveUnit}</span>
                                                {unitDiffers && <span className="ml-1 text-xs text-primary">(≠ issue)</span>}
                                              </td>
                                              <td className="px-3 py-2 text-right font-body text-warning">{unitDiffers ? '—' : c.balancePieces}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {v.remarks && (
                                  <div className="md:col-span-2 text-xs font-body text-muted-foreground">
                                    <span className="font-600 text-foreground">Remarks:</span> {v.remarks}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
              <h2 className="text-base font-700 text-foreground font-display">
                {editingEntry ? 'Edit Entry' : 'New Embroidery / Accessory Entry'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {saveError && (
                <div className="p-3 bg-danger-bg border border-danger/20 rounded-xl text-sm text-danger font-body">{saveError}</div>
              )}

              {/* Row 1: Date & Process Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    required
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Process Type *</label>
                  <select
                    value={form.processType}
                    onChange={(e) => setForm((f) => ({ ...f, processType: e.target.value as ProcessType }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {PROCESS_TYPES.map((pt) => (
                      <option key={pt} value={pt}>{PROCESS_TYPE_LABELS[pt]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isEmbroideryProcess && (
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Embroidery Type *</label>
                  <div className="flex gap-3">
                    {EMBROIDERY_TYPES.map((et) => (
                      <label key={et} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-colors text-sm font-600 font-body ${
                        form.embroideryType === et ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}>
                        <input type="radio" name="embroideryType" value={et} checked={form.embroideryType === et} onChange={() => setForm((f) => ({ ...f, embroideryType: et }))} className="sr-only" />
                        {et === 'yoke_embroidery' ? <Scissors size={14} /> : <Sparkles size={14} />}
                        {EMBROIDERY_TYPE_LABELS[et]}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Job Card Ref</label>
                  <select
                    value={form.jobCardRef}
                    onChange={(e) => {
                      const jc = jobCards.find((j) => j.jobCardNo === e.target.value);
                      setForm((f) => ({
                        ...f,
                        jobCardRef: e.target.value,
                        styleName: jc?.styleEn || f.styleName,
                        piecesReceived: jc ? String(jc.totalPieces) : f.piecesReceived,
                      }));
                    }}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Select Job Card —</option>
                    {jobCards.map((jc) => (
                      <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Style Name</label>
                  <input
                    type="text"
                    value={form.styleName}
                    onChange={(e) => setForm((f) => ({ ...f, styleName: e.target.value }))}
                    placeholder="Style / design name"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {form.jobCardRef && (() => {
                const jc = jobCards.find((j) => j.jobCardNo === form.jobCardRef);
                if (!jc) return null;
                return (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs font-body">
                    <div><span className="text-muted-foreground font-600">Party:</span> <span className="text-foreground font-600">{jc.partyName}</span></div>
                    {(jc as any).poNo && <div><span className="text-muted-foreground font-600">PO No:</span> <span className="text-foreground">{(jc as any).poNo}</span></div>}
                    <div><span className="text-muted-foreground font-600">Total Pieces:</span> <span className="text-primary font-700">{jc.totalPieces}</span></div>
                    {(jc as any).colors && (jc as any).colors.length > 0 && <div><span className="text-muted-foreground font-600">Colors:</span> <span className="text-foreground">{(jc as any).colors.join(', ')}</span></div>}
                    {(jc as any).sizes && (jc as any).sizes.length > 0 && <div><span className="text-muted-foreground font-600">Sizes:</span> <span className="text-foreground">{(jc as any).sizes.join(', ')}</span></div>}
                    {jc.designCode && <div><span className="text-muted-foreground font-600">Design Code:</span> <span className="text-foreground">{jc.designCode}</span></div>}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Operator / Worker Name</label>
                <select
                  value={form.operatorName}
                  onChange={(e) => setForm((f) => ({ ...f, operatorName: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">— Select Operator —</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>{acc.name}</option>
                  ))}
                  <option value="__other__">Other (type below)</option>
                </select>
                {form.operatorName === '__other__' && (
                  <input
                    type="text"
                    placeholder="Enter operator name"
                    className="mt-2 w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => setForm((f) => ({ ...f, operatorName: e.target.value }))}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Pieces Received *</label>
                  <input type="number" min="0" value={form.piecesReceived} onChange={(e) => setForm((f) => ({ ...f, piecesReceived: e.target.value }))} required placeholder="0"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Pieces Processed *</label>
                  <input type="number" min="0" value={form.piecesProcessed} onChange={(e) => setForm((f) => ({ ...f, piecesProcessed: e.target.value }))} required placeholder="0"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Finished Pieces</label>
                  <input type="number" min="0" value={form.finishedPieces} onChange={(e) => setForm((f) => ({ ...f, finishedPieces: e.target.value }))} placeholder="0"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Rejections</label>
                  <input type="number" min="0" value={form.piecesRejected} onChange={(e) => setForm((f) => ({ ...f, piecesRejected: e.target.value }))} placeholder="0"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl flex-wrap">
                <span className="text-xs text-muted-foreground font-body">Net Pieces:</span>
                <span className="text-base font-700 text-success font-display">{netPieces}</span>
                {totalAmount && (
                  <>
                    <span className="text-xs text-muted-foreground font-body ml-4">Total Amount:</span>
                    <span className="text-base font-700 text-primary font-display">₹{totalAmount}</span>
                  </>
                )}
              </div>

              {parseInt(form.piecesRejected) > 0 && (
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Rejection Reason</label>
                  <select value={form.rejectionReason} onChange={(e) => setForm((f) => ({ ...f, rejectionReason: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">— Select reason —</option>
                    {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              {/* Fabric Issue Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                    <Layers size={12} /> Fabric Issue &amp; Consumption
                  </label>
                  <button type="button" onClick={addFabricIssue} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Fabric
                  </button>
                </div>
                {fabricsLoading && <p className="text-xs text-muted-foreground font-body italic">Loading fabric inventory…</p>}
                {!fabricsLoading && fabricIssues.length === 0 && (
                  <p className="text-xs text-muted-foreground font-body italic">No fabric issued. Click &quot;Add Fabric&quot; to issue fabric to this entry.</p>
                )}
                {fabricIssues.length > 0 && (
                  <div className="space-y-3">
                    {fabricIssues.map((fi, i) => {
                      const availableRolls = fi.fabricName ? (fabricsByName[fi.fabricName] || []) : [];
                      const selectedRoll = fabrics.find((f) => f.id === fi.rollId);
                      return (
                        <div key={i} className="border border-border rounded-xl p-3 bg-muted/10 relative">
                          <button type="button" onClick={() => removeFabricIssue(i)} className="absolute top-2 right-2 text-danger hover:text-danger/70 transition-colors">
                            <X size={13} />
                          </button>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Fabric *</label>
                              <select value={fi.fabricName} onChange={(e) => updateFabricIssue(i, 'fabricName', e.target.value)}
                                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20">
                                <option value="">— Select Fabric —</option>
                                {fabricNames.map((name) => <option key={name} value={name}>{name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">
                                Roll *
                                {selectedRoll && <span className="ml-1 text-success font-400">(In stock: {selectedRoll.stockQty} {selectedRoll.unit})</span>}
                              </label>
                              <select value={fi.rollId} onChange={(e) => updateFabricIssue(i, 'rollId', e.target.value)} disabled={!fi.fabricName}
                                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50">
                                <option value="">— Select Roll —</option>
                                {availableRolls.map((roll) => (
                                  <option key={roll.id} value={roll.id}>Roll #{roll.id.slice(-6)} — {roll.stockQty} {roll.unit}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Issued Qty *</label>
                              <input type="number" min="0" step="0.001" value={fi.issuedQty || ''} onChange={(e) => updateFabricIssue(i, 'issuedQty', parseFloat(e.target.value) || 0)} placeholder="0"
                                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Consumed Qty</label>
                              <input type="number" min="0" step="0.001" value={fi.consumedQty || ''} onChange={(e) => updateFabricIssue(i, 'consumedQty', parseFloat(e.target.value) || 0)} placeholder="0"
                                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20" />
                            </div>
                            <div>
                              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Returned Qty</label>
                              <input type="number" min="0" step="0.001" value={fi.returnedQty || ''} onChange={(e) => updateFabricIssue(i, 'returnedQty', parseFloat(e.target.value) || 0)} placeholder="0"
                                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Process Details */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Process Details (Sub-Components)</label>
                  <button type="button" onClick={addProcessDetail} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Row
                  </button>
                </div>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Sub-Component</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Pcs In</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Pcs Out</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Rejected</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {processDetails.map((pd, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5">
                            <select value={pd.subComponent} onChange={(e) => updateProcessDetail(i, 'subComponent', e.target.value)}
                              className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20">
                              {SUB_COMPONENTS.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={pd.piecesIn || ''} onChange={(e) => updateProcessDetail(i, 'piecesIn', parseInt(e.target.value) || 0)}
                              className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={pd.piecesOut || ''} onChange={(e) => updateProcessDetail(i, 'piecesOut', parseInt(e.target.value) || 0)}
                              className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" value={pd.rejections || ''} onChange={(e) => updateProcessDetail(i, 'rejections', parseInt(e.target.value) || 0)}
                              className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20" placeholder="0" />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {processDetails.length > 1 && (
                              <button type="button" onClick={() => removeProcessDetail(i)} className="text-danger hover:text-danger/70 transition-colors">
                                <X size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Accessories Used */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Accessories Used</label>
                  <button type="button" onClick={addAccessory} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Accessory
                  </button>
                </div>
                {accessories.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-body italic">No accessories added</p>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Accessory Name</th>
                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Qty</th>
                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessories.map((acc, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <input type="text" value={acc.name} onChange={(e) => updateAccessory(i, 'name', e.target.value)} placeholder="e.g. Buttons, Lace, Thread"
                                className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" value={acc.qty || ''} onChange={(e) => updateAccessory(i, 'qty', parseFloat(e.target.value) || 0)}
                                className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20" placeholder="0" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={acc.unit} onChange={(e) => updateAccessory(i, 'unit', e.target.value)}
                                className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20">
                                {ACCESSORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button type="button" onClick={() => removeAccessory(i)} className="text-danger hover:text-danger/70 transition-colors">
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pricing & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Price per Piece (₹)</label>
                  <input type="number" min="0" step="0.01" value={form.pricePerPiece} onChange={(e) => setForm((f) => ({ ...f, pricePerPiece: e.target.value }))} placeholder="0.00"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'in_progress' | 'completed' }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Any additional notes…"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 font-body hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {saving ? 'Saving…' : editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-700 text-foreground font-display mb-2">Delete Entry</h3>
            <p className="text-sm text-muted-foreground font-body mb-5">
              Are you sure you want to delete entry <span className="font-600 text-foreground">{deleteTarget.entryNo}</span>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-danger text-white rounded-xl text-sm font-600 font-body hover:bg-danger/90 transition-colors disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Voucher Modal */}
      {showIssueModal && (
        <IssueVoucherModal
          jobCards={jobCards}
          onClose={() => setShowIssueModal(false)}
          onSaved={() => handleVoucherSaved('Issue Voucher saved successfully.')}
        />
      )}

      {/* Edit Issue Voucher Modal */}
      {editIssueVoucher && (
        <IssueVoucherModal
          jobCards={jobCards}
          editVoucher={editIssueVoucher}
          onClose={() => setEditIssueVoucher(null)}
          onSaved={() => handleVoucherSaved('Issue Voucher updated successfully.')}
        />
      )}

      {/* Receive Voucher Modal */}
      {showReceiveModal && (
        <ReceiveVoucherModal
          issueVouchers={issueVouchers}
          preSelectedIssueId={preSelectedIssueId}
          onClose={() => { setShowReceiveModal(false); setPreSelectedIssueId(undefined); }}
          onSaved={() => handleVoucherSaved('Receive Voucher saved successfully.')}
        />
      )}

      {/* Edit Receive Voucher Modal */}
      {editReceiveVoucher && (
        <ReceiveVoucherModal
          issueVouchers={issueVouchers}
          editVoucher={editReceiveVoucher}
          onClose={() => setEditReceiveVoucher(null)}
          onSaved={() => handleVoucherSaved('Receive Voucher updated successfully.')}
        />
      )}

      {/* View Issue Voucher Modal */}
      {viewIssueVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-700 text-foreground font-display flex items-center gap-2">
                  <ArrowUpFromLine size={16} className="text-primary" />
                  Issue Voucher — {viewIssueVoucher.voucherNo}
                </h2>
                <p className="text-xs text-muted-foreground font-body mt-0.5">{viewIssueVoucher.voucherDate}</p>
              </div>
              <button onClick={() => setViewIssueVoucher(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-body mb-0.5">Operator / Issued To</p>
                  <p className="font-600 text-foreground font-body">{viewIssueVoucher.operatorName || '—'}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-body mb-0.5">Status</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-600 font-body ${ISSUE_STATUS_COLORS[viewIssueVoucher.status] || 'bg-gray-100 text-gray-600'}`}>
                    {ISSUE_STATUS_LABELS[viewIssueVoucher.status] || viewIssueVoucher.status}
                  </span>
                </div>
                {viewIssueVoucher.jobCardRef && (
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-body mb-0.5">Job Card</p>
                    <p className="font-600 text-foreground font-body">{viewIssueVoucher.jobCardRef}</p>
                  </div>
                )}
                {viewIssueVoucher.styleName && (
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-body mb-0.5">Style</p>
                    <p className="font-600 text-foreground font-body">{viewIssueVoucher.styleName}</p>
                  </div>
                )}
                {viewIssueVoucher.processType && (
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-body mb-0.5">Process</p>
                    <p className="font-600 text-foreground font-body capitalize">{viewIssueVoucher.processType.replace(/_/g, ' ')}</p>
                  </div>
                )}
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-body mb-0.5">Issue Type</p>
                  <p className="font-600 text-foreground font-body capitalize">{viewIssueVoucher.issueType} {viewIssueVoucher.issueSource === 'processed_cutting' ? '(Re-Issue)' : ''}</p>
                </div>
              </div>
              {/* Fabric Items */}
              {viewIssueVoucher.fabricItems.length > 0 && (
                <div>
                  <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1"><Layers size={12} /> Fabric Issued</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Fabric</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued Qty</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewIssueVoucher.fabricItems.map((f, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-body font-600">{f.fabricName}</td>
                          <td className="px-3 py-2 text-right font-body text-primary font-600">{f.issuedQty}</td>
                          <td className="px-3 py-2 font-body">{f.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Accessory Items */}
              {viewIssueVoucher.accessoryItems.length > 0 && (
                <div>
                  <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1"><Package size={12} /> Accessories Issued</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Item</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Qty</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewIssueVoucher.accessoryItems.map((a, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-body font-600">{a.name}</td>
                          <td className="px-3 py-2 text-right font-body text-amber-700 font-600">{a.qty}</td>
                          <td className="px-3 py-2 font-body">{a.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Cutting Items */}
              {viewIssueVoucher.cuttingItems && viewIssueVoucher.cuttingItems.length > 0 && (
                <div>
                  <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1"><Scissors size={12} /> Cutting Items Issued</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Component</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Pieces</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewIssueVoucher.cuttingItems.map((c, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-body font-600">{c.component}</td>
                          <td className="px-3 py-2 text-right font-body text-primary font-600">{c.pieces}</td>
                          <td className="px-3 py-2 font-body">{c.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewIssueVoucher.remarks && (
                <p className="text-xs text-muted-foreground font-body"><span className="font-600 text-foreground">Remarks:</span> {viewIssueVoucher.remarks}</p>
              )}
              <div className="flex justify-end pt-2 border-t border-border">
                <button onClick={() => setViewIssueVoucher(null)} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Issue Voucher Confirm */}
      {deleteIssueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-700 text-foreground font-display mb-2">Delete Issue Voucher?</h3>
            <p className="text-sm text-muted-foreground font-body mb-5">
              Are you sure you want to delete Issue Voucher <span className="font-600 text-foreground">{deleteIssueTarget.voucherNo}</span>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteIssueTarget(null)} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">Cancel</button>
              <button onClick={handleDeleteIssueVoucher} disabled={deletingIssue} className="px-4 py-2 bg-danger text-white rounded-xl text-sm font-600 font-body hover:bg-danger/90 transition-colors disabled:opacity-60">
                {deletingIssue ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Receive Voucher Modal */}
      {viewReceiveVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-700 text-foreground font-display flex items-center gap-2">
                  <ArrowDownToLine size={16} className="text-success" />
                  Receive Voucher — {viewReceiveVoucher.voucherNo}
                </h2>
                <p className="text-xs text-muted-foreground font-body mt-0.5">{viewReceiveVoucher.voucherDate}</p>
              </div>
              <button onClick={() => setViewReceiveVoucher(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-body mb-0.5">Issue Voucher Ref</p>
                  <p className="font-600 text-primary font-body">{viewReceiveVoucher.issueVoucherNo}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-body mb-0.5">Operator</p>
                  <p className="font-600 text-foreground font-body">{viewReceiveVoucher.operatorName || '—'}</p>
                </div>
                {viewReceiveVoucher.jobCardRef && (
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-body mb-0.5">Job Card</p>
                    <p className="font-600 text-foreground font-body">{viewReceiveVoucher.jobCardRef}</p>
                  </div>
                )}
                {viewReceiveVoucher.styleName && (
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground font-body mb-0.5">Style</p>
                    <p className="font-600 text-foreground font-body">{viewReceiveVoucher.styleName}</p>
                  </div>
                )}
              </div>
              {viewReceiveVoucher.fabricItems.length > 0 && (
                <div>
                  <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1"><Layers size={12} /> Fabric Received</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Fabric</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Received</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Rejected</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Rejection Reason</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewReceiveVoucher.fabricItems.map((f, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-body font-600">{f.fabricName}</td>
                          <td className="px-3 py-2 text-right font-body">{f.issuedQty}</td>
                          <td className="px-3 py-2 text-right font-body text-success font-600">{f.receivedQty}</td>
                          <td className="px-3 py-2 text-right font-body text-danger font-600">{(f as any).rejectedQty > 0 ? (f as any).rejectedQty : '—'}</td>
                          <td className="px-3 py-2 font-body text-muted-foreground">{(f as any).rejectionReason || '—'}</td>
                          <td className="px-3 py-2 font-body">{f.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewReceiveVoucher.accessoryItems.length > 0 && (
                <div>
                  <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1"><Package size={12} /> Accessories Received</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Item</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Received</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Rejected</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Rejection Reason</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewReceiveVoucher.accessoryItems.map((a, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-body font-600">{a.name}</td>
                          <td className="px-3 py-2 text-right font-body">{a.issuedQty}</td>
                          <td className="px-3 py-2 text-right font-body text-success font-600">{a.receivedQty}</td>
                          <td className="px-3 py-2 text-right font-body text-danger font-600">{(a as any).rejectedQty > 0 ? (a as any).rejectedQty : '—'}</td>
                          <td className="px-3 py-2 font-body text-muted-foreground">{(a as any).rejectionReason || '—'}</td>
                          <td className="px-3 py-2 font-body">{a.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewReceiveVoucher.cuttingItems && viewReceiveVoucher.cuttingItems.length > 0 && (
                <div>
                  <p className="text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide flex items-center gap-1"><Scissors size={12} /> Cutting Pieces Received</p>
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Component</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued Pcs</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Received Pcs</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Rejected Pcs</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Rejection Reason</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewReceiveVoucher.cuttingItems.map((c, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-body font-600">{c.component}</td>
                          <td className="px-3 py-2 text-right font-body">{c.issuedPieces}</td>
                          <td className="px-3 py-2 text-right font-body text-success font-600">{c.receivedPieces}</td>
                          <td className="px-3 py-2 text-right font-body text-danger font-600">{(c as any).rejectedPieces > 0 ? (c as any).rejectedPieces : '—'}</td>
                          <td className="px-3 py-2 font-body text-muted-foreground">{(c as any).rejectionReason || '—'}</td>
                          <td className="px-3 py-2 font-body">{c.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {viewReceiveVoucher.remarks && (
                <p className="text-xs text-muted-foreground font-body"><span className="font-600 text-foreground">Remarks:</span> {viewReceiveVoucher.remarks}</p>
              )}
              <div className="flex justify-end pt-2 border-t border-border">
                <button onClick={() => setViewReceiveVoucher(null)} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Receive Voucher Confirm */}
      {deleteReceiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-700 text-foreground font-display mb-2">Delete Receive Voucher?</h3>
            <p className="text-sm text-muted-foreground font-body mb-5">
              Are you sure you want to delete Receive Voucher <span className="font-600 text-foreground">{deleteReceiveTarget.voucherNo}</span>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDeleteReceiveTarget(null)} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">Cancel</button>
              <button onClick={handleDeleteReceiveVoucher} disabled={deletingReceive} className="px-4 py-2 bg-danger text-white rounded-xl text-sm font-600 font-body hover:bg-danger/90 transition-colors disabled:opacity-60">
                {deletingReceive ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
