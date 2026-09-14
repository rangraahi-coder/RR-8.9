'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, X, Droplets, Pencil, Trash2, CheckCircle, Clock, FlaskConical, Printer, Package, AlertCircle, Search, Ruler, TrendingDown, ArrowUpFromLine, Eye } from 'lucide-react';
import { DyeingProcessingEntry, DyeingProcessType, DYEING_PROCESS_TYPE_LABELS } from '../data/dyeingData';
import { dyeingProcessingService } from '@/lib/services/dyeingProcessingService';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { printerFabricService, PrinterFabricIssue, ConsolidatedOutstandingFabric } from '@/lib/services/printerFabricService';
import { accountService } from '@/lib/services/accountService';
import { greyFabricService } from '@/lib/services/greyFabricService';
import { GreyFabricPurchase } from '@/app/grey-fabric/data/greyFabricData';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useRouter, useSearchParams } from 'next/navigation';

interface DyeingProcessingContentProps {
  lang?: 'en' | 'hi';
}

const PROCESS_TYPES: DyeingProcessType[] = ['dyeing', 'printing', 'washing', 'bleaching', 'other'];

const PROCESS_COLORS: Record<DyeingProcessType, string> = {
  dyeing: 'bg-blue-100 text-blue-700',
  printing: 'bg-purple-100 text-purple-700',
  washing: 'bg-cyan-100 text-cyan-700',
  bleaching: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-600',
};

interface FormState {
  date: string;
  grayFabricRef: string;
  jobCardRef: string;
  styleName: string;
  processType: DyeingProcessType;
  processorName: string;
  dyeBatchNo: string;
  colourShade: string;
  qtyMeters: string;
  lValue: string;
  ratePerUnit: string;
  discount: string;
  discountType: 'amount' | 'percent';
  sentDate: string;
  expectedDate: string;
  remarks: string;
}

const DEFAULT_FORM: FormState = {
  date: new Date().toISOString().split('T')[0],
  grayFabricRef: '',
  jobCardRef: '',
  styleName: '',
  processType: 'dyeing',
  processorName: '',
  dyeBatchNo: '',
  colourShade: '',
  qtyMeters: '',
  lValue: '100',
  ratePerUnit: '',
  discount: '',
  discountType: 'amount',
  sentDate: new Date().toISOString().split('T')[0],
  expectedDate: '',
  remarks: '',
};

// ─── Printer Issue Form State ──────────────────────────────────────────────
interface PrinterIssueFormState {
  date: string;
  printerAccount: string;
  grayFabricRef: string;  // stores qualityKey (fabricName|fabricType) for new issues
  fabricName: string;
  qtyIssued: string;
  remarks: string;
}

const DEFAULT_PRINTER_ISSUE_FORM: PrinterIssueFormState = {
  date: new Date().toISOString().split('T')[0],
  printerAccount: '',
  grayFabricRef: '',
  fabricName: '',
  qtyIssued: '',
  remarks: '',
};

// ─── Printer Receipt Form State ────────────────────────────────────────────
interface PrinterReceiptFormState {
  date: string;
  printerAccount: string;
  issueId: string;
  grayFabricRef: string;
  fabricName: string;
  qtyReceived: string;
  processedFabricName: string;
  processedQty: string;
  shortage: string;
  shrinkage: string;
  remarks: string;
}

const DEFAULT_PRINTER_RECEIPT_FORM: PrinterReceiptFormState = {
  date: new Date().toISOString().split('T')[0],
  printerAccount: '',
  issueId: '',
  grayFabricRef: '',
  fabricName: '',
  qtyReceived: '',
  processedFabricName: '',
  processedQty: '',
  shortage: '',
  shrinkage: '',
  remarks: '',
};

// ─── Modal Entry Type ──────────────────────────────────────────────────────
type EntryModalType = 'processing' | 'printer_issue' | 'printer_receipt';

// Voucher print component
function VoucherPrint({ entry, onClose }: { entry: DyeingProcessingEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Voucher Header */}
        <div className="border-b-2 border-gray-800 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-800 text-gray-900 uppercase tracking-wide">Dyer / Printer Order</h2>
              <p className="text-xs text-gray-500 mt-0.5">Processing Voucher</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-700 text-gray-900">{entry.entryNo}</p>
              <p className="text-xs text-gray-500">{entry.date}</p>
            </div>
          </div>
        </div>

        {/* Voucher Body */}
        <div className="px-6 py-4 flex flex-col gap-3">
          {/* To: Processor */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 font-600 uppercase tracking-wide mb-1">To (Processor / Mill)</p>
            <p className="text-base font-700 text-gray-900">{entry.processorName || '—'}</p>
          </div>

          {/* Fabric Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 font-600">Gray Fabric Ref.</p>
              <p className="text-sm font-700 text-gray-900">{entry.grayFabricRef}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-600">Batch No.</p>
              <p className="text-sm font-700 text-gray-900">{entry.dyeBatchNo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-600">Process Type</p>
              <p className="text-sm font-700 text-gray-900 capitalize">{DYEING_PROCESS_TYPE_LABELS[entry.processType]}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-600">Colour / Shade</p>
              <p className="text-sm font-700 text-gray-900">{entry.colourShade || '—'}</p>
            </div>
          </div>

          {/* Qty Table */}
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-3 py-2 text-xs font-700 text-gray-700">Description</th>
                <th className="text-right px-3 py-2 text-xs font-700 text-gray-700">Qty (Mt.)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-200">
                <td className="px-3 py-2 text-gray-800">{entry.grayFabricRef} — {DYEING_PROCESS_TYPE_LABELS[entry.processType]}</td>
                <td className="px-3 py-2 text-right font-700 text-gray-900">{entry.qtyMeters?.toFixed(2) || '0.00'}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td className="px-3 py-2 font-700 text-gray-900">Total</td>
                <td className="px-3 py-2 text-right font-800 text-gray-900">{entry.qtyMeters?.toFixed(2) || '0.00'} Mt.</td>
              </tr>
            </tfoot>
          </table>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 font-600">Sent Date</p>
              <p className="text-sm font-600 text-gray-800">{entry.sentDate || entry.date}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-600">Expected Return Date</p>
              <p className="text-sm font-600 text-gray-800">{entry.expectedDate || '—'}</p>
            </div>
          </div>

          {entry.jobCardRef && (
            <div>
              <p className="text-xs text-gray-500 font-600">Job Card Ref.</p>
              <p className="text-sm font-600 text-gray-800">{entry.jobCardRef}</p>
            </div>
          )}

          {entry.remarks && (
            <div>
              <p className="text-xs text-gray-500 font-600">Remarks</p>
              <p className="text-sm text-gray-700 italic">{entry.remarks}</p>
            </div>
          )}

          {/* Signature line */}
          <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="border-b border-gray-400 mb-1 h-8" />
              <p className="text-xs text-gray-500">Authorised By</p>
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 mb-1 h-8" />
              <p className="text-xs text-gray-500">Received By (Processor)</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          <button
            onClick={() => window.print()}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Printer size={14} />
            Print Voucher
          </button>
        </div>
      </div>
    </div>
  );
}

// Receive Back Modal
function ReceiveBackModal({
  entry,
  onClose,
  onConfirm,
  saving,
}: {
  entry: DyeingProcessingEntry;
  onClose: () => void;
  onConfirm: (receivedDate: string, receivedQty: number, finishedFabricName: string) => void;
  saving: boolean;
}) {
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedQty, setReceivedQty] = useState(entry.qtyMeters || 0);
  const [finishedFabricName, setFinishedFabricName] = useState(entry.finishedFabricName || '');
  const [nameError, setNameError] = useState('');

  const handleConfirm = () => {
    const trimmed = finishedFabricName.trim();
    if (!trimmed) {
      setNameError('Finished fabric name is required before posting to inventory.');
      return;
    }
    setNameError('');
    onConfirm(receivedDate, receivedQty, trimmed);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-success" />
          <h3 className="text-base font-700 text-foreground">Receive Fabric Back</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Entry <span className="font-600 text-foreground">{entry.entryNo}</span> — fabric will be posted to Finished Fabric Inventory.
        </p>

        {/* Finished Fabric Name — mandatory */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-600 text-muted-foreground">
            Finished Fabric Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={finishedFabricName}
            onChange={(e) => { setFinishedFabricName(e.target.value); setNameError(''); }}
            placeholder="e.g. Cotton Twill – Navy"
            className={`input-field text-sm ${nameError ? 'border-red-400' : ''}`}
          />
          {nameError ? (
            <span className="text-xs text-red-500">{nameError}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              This name will be the canonical identity for this finished fabric in inventory.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-600 text-muted-foreground">Received Date *</label>
          <input
            type="date"
            required
            value={receivedDate}
            onChange={(e) => setReceivedDate(e.target.value)}
            className="input-field text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-600 text-muted-foreground">Received Qty (Mt.) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={receivedQty}
            onChange={(e) => setReceivedQty(parseFloat(e.target.value) || 0)}
            className="input-field text-sm"
          />
        </div>

        {finishedFabricName.trim() && (
          <div className="bg-info-bg border border-info-border rounded-lg px-3 py-2 text-xs text-info font-500">
            Will create finished inventory: <strong>"{finishedFabricName.trim()}"</strong> — {receivedQty} Mt.
            <br />
            <span className="text-muted-foreground">Source grey: {entry.grayFabricRef || '—'} | Processor: {entry.processorName || '—'}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? <><Clock size={14} className="animate-spin" />Saving…</> : <><Package size={14} />Post to Inventory</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DyeingProcessingContent({ lang = 'en' }: DyeingProcessingContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const [entries, setEntries] = useState<DyeingProcessingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [entryModalType, setEntryModalType] = useState<EntryModalType>('processing');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<DyeingProcessingEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DyeingProcessingEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [voucherEntry, setVoucherEntry] = useState<DyeingProcessingEntry | null>(null);
  const [receiveEntry, setReceiveEntry] = useState<DyeingProcessingEntry | null>(null);
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [processorAccounts, setProcessorAccounts] = useState<{ name: string; id: string }[]>([]);
  const [greyFabrics, setGreyFabrics] = useState<GreyFabricPurchase[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [entrySearch, setEntrySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'received'>('all');

  // ─── Printer Issue / Receipt state ──────────────────────────────────────
  const [printerIssueForm, setPrinterIssueForm] = useState<PrinterIssueFormState>({ ...DEFAULT_PRINTER_ISSUE_FORM });
  const [printerReceiptForm, setPrinterReceiptForm] = useState<PrinterReceiptFormState>({ ...DEFAULT_PRINTER_RECEIPT_FORM });
  const [printerIssues, setPrinterIssues] = useState<PrinterFabricIssue[]>([]);
  const [pendingIssuesForPrinter, setPendingIssuesForPrinter] = useState<PrinterFabricIssue[]>([]);
  const [allIssues, setAllIssues] = useState<PrinterFabricIssue[]>([]);
  const [eligibleFabrics, setEligibleFabrics] = useState<GreyFabricPurchase[]>([]);
  const [lockedFabricRefs, setLockedFabricRefs] = useState<Set<string>>(new Set());
  const [consolidatedOutstanding, setConsolidatedOutstanding] = useState<ConsolidatedOutstandingFabric[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'processing' | 'printer'>('processing');

  // ─── Quality-Grouped Pending Issues (for consolidated receipt dropdown) ──
  interface QualityGroupedPending {
    qualityKey: string;       // fabricName (normalized)
    fabricName: string;
    displayLabel: string;
    totalPendingQty: number;  // sum of qtyPending across all matching issues
    issueIds: string[];       // all issue IDs belonging to this quality
  }

  const qualityGroupedPending = React.useMemo<QualityGroupedPending[]>(() => {
    const map = new Map<string, QualityGroupedPending>();
    for (const issue of pendingIssuesForPrinter) {
      const key = (issue.fabricName || issue.grayFabricRef || '').trim().toLowerCase();
      const label = issue.fabricName || issue.grayFabricRef || issue.issueNo;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.totalPendingQty = Math.round((existing.totalPendingQty + issue.qtyPending) * 10000) / 10000;
        existing.issueIds.push(issue.id);
      } else {
        map.set(key, {
          qualityKey: key,
          fabricName: label,
          displayLabel: label,
          totalPendingQty: issue.qtyPending,
          issueIds: [issue.id],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
  }, [pendingIssuesForPrinter]);

  const selectedQualityGroupForReceipt = React.useMemo(
    () => qualityGroupedPending.find((g) => g.qualityKey === printerReceiptForm.issueId) ?? null,
    [qualityGroupedPending, printerReceiptForm.issueId]
  );

  // ─── Quality-Grouped Outstanding (for consolidated dropdown) ───────────────
  interface QualityGroupedOutstanding {
    qualityKey: string;           // fabricName + '|' + (fabricType || '')
    fabricName: string;
    fabricType?: string;
    displayLabel: string;
    totalOutstandingQty: number;  // sum across all purchaseNos
    totalAvailable: number;
    totalIssuedPending: number;
    purchaseNos: string[];        // all purchaseNos belonging to this quality
  }

  // ─── Derived: quality-grouped outstanding for the issue dropdown ──────────
  const qualityGroupedOutstanding = React.useMemo<QualityGroupedOutstanding[]>(() => {
    // Build the set of fabric refs already pending/partial with the selected printer
    const selectedPrinter = printerIssueForm.printerAccount;
    const alreadyIssuedToSelectedPrinter = new Set<string>(
      selectedPrinter
        ? allIssues
            .filter((i) => i.printerAccount === selectedPrinter && (i.status === 'pending' || i.status === 'partial'))
            .map((i) => i.grayFabricRef)
        : []
    );

    const map = new Map<string, QualityGroupedOutstanding>();
    for (const f of consolidatedOutstanding) {
      // Skip fabrics already pending/partial with the currently selected printer
      if (alreadyIssuedToSelectedPrinter.has(f.purchaseNo)) continue;

      const key = `${f.fabricName}|${f.fabricType || ''}`;
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.totalOutstandingQty = Math.round((existing.totalOutstandingQty + f.outstandingQty) * 10000) / 10000;
        existing.totalAvailable = Math.round((existing.totalAvailable + f.totalAvailable) * 10000) / 10000;
        existing.totalIssuedPending = Math.round((existing.totalIssuedPending + f.totalIssuedPending) * 10000) / 10000;
        existing.purchaseNos.push(f.purchaseNo);
      } else {
        const label = `${f.fabricName}${f.fabricType ? ` (${f.fabricType})` : ''}`;
        map.set(key, {
          qualityKey: key,
          fabricName: f.fabricName,
          fabricType: f.fabricType,
          displayLabel: label,
          totalOutstandingQty: f.outstandingQty,
          totalAvailable: f.totalAvailable,
          totalIssuedPending: f.totalIssuedPending,
          purchaseNos: [f.purchaseNo],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
  }, [consolidatedOutstanding, allIssues, printerIssueForm.printerAccount]);

  const [viewIssue, setViewIssue] = useState<PrinterFabricIssue | null>(null);
  const [deleteIssueTarget, setDeleteIssueTarget] = useState<PrinterFabricIssue | null>(null);
  const [deletingIssue, setDeletingIssue] = useState(false);
  const [editingIssue, setEditingIssue] = useState<PrinterFabricIssue | null>(null);

  const loadEntries = useCallback(async () => {
    const data = await dyeingProcessingService.getAll();
    setEntries(data);
    setLoading(false);
  }, []);

  const loadAllIssues = useCallback(async () => {
    const data = await printerFabricService.getAllIssues();
    setAllIssues(data);
  }, []);

  const loadEligibleFabrics = useCallback(async (allGreyFabrics: GreyFabricPurchase[]) => {
    if (allGreyFabrics.length === 0) return;
    const { eligible, lockedRefs } = await printerFabricService.getEligibleFabricsForPrinter(allGreyFabrics);
    setEligibleFabrics(eligible);
    setLockedFabricRefs(lockedRefs);
    // Also compute consolidated outstanding for the issue dropdown
    const outstanding = await printerFabricService.getConsolidatedOutstandingFabrics(allGreyFabrics);
    setConsolidatedOutstanding(outstanding);
  }, []);

  useEffect(() => { loadEntries(); loadAllIssues(); }, [loadEntries, loadAllIssues]);

  // Apply URL filter params on mount
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'pending') {
      setStatusFilter('pending');
    }
  }, [searchParams]);

  // Load processor accounts from Account Master
  useEffect(() => {
    accountService.getAll().then((accounts) => {
      const processors = accounts
        .filter((a) => ['Sundry Creditors', 'Job Work Creditors', 'Sundry Debtors'].includes(a.parentGroup))
        .map((a) => ({ name: a.name, id: a.id }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const unique = Array.from(new Map(processors.map((p) => [p.name, p])).values());
      setProcessorAccounts(unique);
    });
    greyFabricService.getAll().then((fabrics) => {
      setGreyFabrics(fabrics);
      loadEligibleFabrics(fabrics);
    });
  }, [loadEligibleFabrics]);

  // When printer account changes in receipt form, load pending issues for that printer
  useEffect(() => {
    if (printerReceiptForm.printerAccount) {
      setIssuesLoading(true);
      printerFabricService.getIssuesByPrinter(printerReceiptForm.printerAccount).then((issues) => {
        setPendingIssuesForPrinter(issues);
        setIssuesLoading(false);
      });
    } else {
      setPendingIssuesForPrinter([]);
    }
  }, [printerReceiptForm.printerAccount]);

  useRealtimeTable('dyeing_processing_entries', loadEntries);
  useRealtimeTable('printer_fabric_issues', () => {
    loadAllIssues();
    greyFabricService.getAll().then((fabrics) => {
      setGreyFabrics(fabrics);
      loadEligibleFabrics(fabrics);
    });
  });
  useRealtimeTable('printer_fabric_receipts', () => {
    loadAllIssues();
    greyFabricService.getAll().then((fabrics) => {
      setGreyFabrics(fabrics);
      loadEligibleFabrics(fabrics);
    });
  });
  useRealtimeTable('job_cards', refreshJobCards);

  // Stats
  const totalQtyMeters = entries.reduce((s, e) => s + (e.qtyMeters || 0), 0);
  const receivedCount = entries.filter((e) => e.receivedDate).length;
  const pendingCount = entries.filter((e) => !e.receivedDate).length;
  const pendingWithPrinterQty = allIssues
    .filter((i) => i.status !== 'settled')
    .reduce((s, i) => s + i.qtyPending, 0);

  // Filtered entries for table display
  const filteredDyeingEntries = entries.filter((e) => {
    const matchSearch = !entrySearch ||
      (e.entryNo || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
      (e.jobCardRef || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
      (e.styleName || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
      (e.processorName || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
      (e.dyeBatchNo || '').toLowerCase().includes(entrySearch.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && !e.receivedDate) ||
      (statusFilter === 'received' && !!e.receivedDate);
    return matchSearch && matchStatus;
  });

  async function openAddModal() {
    setEditingEntry(null);
    setBatchLoading(true);
    const batchNo = await dyeingProcessingService.getNextBatchNo();
    setBatchLoading(false);
    setForm({
      ...DEFAULT_FORM,
      date: new Date().toISOString().split('T')[0],
      sentDate: new Date().toISOString().split('T')[0],
      dyeBatchNo: batchNo,
    });
    setPrinterIssueForm({ ...DEFAULT_PRINTER_ISSUE_FORM, date: new Date().toISOString().split('T')[0] });
    setPrinterReceiptForm({ ...DEFAULT_PRINTER_RECEIPT_FORM, date: new Date().toISOString().split('T')[0] });
    setSaveError(null);
    setEntryModalType('processing');
    setShowModal(true);
  }

  function openEditModal(entry: DyeingProcessingEntry) {
    setEditingEntry(entry);
    setEntryModalType('processing');
    setForm({
      date: entry.date,
      grayFabricRef: entry.grayFabricRef,
      jobCardRef: entry.jobCardRef || '',
      styleName: entry.styleName || '',
      processType: entry.processType,
      processorName: entry.processorName,
      dyeBatchNo: entry.dyeBatchNo,
      colourShade: entry.colourShade,
      qtyMeters: entry.qtyMeters ? String(entry.qtyMeters) : '',
      lValue: String((entry as any).lValue ?? 100),
      ratePerUnit: String((entry as any).ratePerUnit ?? ''),
      discount: String((entry as any).discount ?? ''),
      discountType: ((entry as any).discountType ?? 'amount') as 'amount' | 'percent',
      sentDate: entry.sentDate || '',
      expectedDate: entry.expectedDate || '',
      remarks: entry.remarks || '',
    });
    setSaveError(null);
    setShowModal(true);
  }

  function openEditIssueModal(issue: PrinterFabricIssue) {
    setEditingIssue(issue);
    setPrinterIssueForm({
      date: issue.date,
      printerAccount: issue.printerAccount,
      grayFabricRef: issue.grayFabricRef,
      fabricName: issue.fabricName || '',
      qtyIssued: String(issue.qtyIssued),
      remarks: issue.remarks || '',
    });
    setSaveError(null);
    setEntryModalType('printer_issue');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingEntry(null);
    setEditingIssue(null);
    setSaveError(null);
    setPendingIssuesForPrinter([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.grayFabricRef.trim()) {
      setSaveError('Gray Fabric Reference is required.');
      return;
    }
    if (!form.qtyMeters || parseFloat(form.qtyMeters) <= 0) {
      setSaveError('Qty (Mt.) must be greater than 0.');
      return;
    }
    setSaving(true);
    setSaveError(null);

    const lVal = parseFloat(form.lValue) || 100;
    const billedQty = parseFloat(form.qtyMeters) || 0;
    const actualQty = billedQty * lVal / 100;

    const payload: Omit<DyeingProcessingEntry, 'id'> = {
      entryNo: editingEntry?.entryNo || (await dyeingProcessingService.getNextEntryNo()),
      date: form.date,
      grayFabricRef: form.grayFabricRef.trim(),
      jobCardRef: form.jobCardRef || undefined,
      styleName: form.styleName || undefined,
      processType: form.processType,
      processorName: form.processorName,
      dyeBatchNo: form.dyeBatchNo,
      colourShade: form.colourShade,
      qtyMeters: billedQty,
      piecesIn: 0,
      piecesOut: 0,
      piecesRejected: 0,
      netPieces: 0,
      sentDate: form.sentDate || undefined,
      expectedDate: form.expectedDate || undefined,
      remarks: form.remarks || undefined,
      ...(lVal !== 100 && { lValue: lVal, actualQtyMeters: actualQty }),
      ...(form.ratePerUnit && { ratePerUnit: parseFloat(form.ratePerUnit) || 0 }),
      ...(form.discount && { discount: parseFloat(form.discount) || 0, discountType: form.discountType }),
    } as Omit<DyeingProcessingEntry, 'id'>;

    let result: DyeingProcessingEntry | null = null;
    if (editingEntry) {
      result = await dyeingProcessingService.update(editingEntry.id, payload);
    } else {
      result = await dyeingProcessingService.create(payload);
    }

    setSaving(false);
    if (!result) {
      setSaveError('Failed to save entry. Please try again.');
      return;
    }
    setSuccessMsg(editingEntry ? 'Entry updated.' : 'Entry saved successfully.');
    setTimeout(() => setSuccessMsg(null), 3000);
    closeModal();
    loadEntries();
  }

  async function handlePrinterIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!printerIssueForm.printerAccount) { setSaveError('Please select a Printer Account.'); return; }
    if (!printerIssueForm.grayFabricRef) { setSaveError('Please select a fabric.'); return; }
    if (!printerIssueForm.qtyIssued || parseFloat(printerIssueForm.qtyIssued) <= 0) { setSaveError('Qty must be greater than 0.'); return; }

    const qtyToIssue = parseFloat(printerIssueForm.qtyIssued);

    // If editing an existing issue, update it (grayFabricRef is a real purchaseNo in edit mode)
    if (editingIssue) {
      setSaving(true);
      setSaveError(null);
      let result = await printerFabricService.updateIssue(editingIssue.id, {
        date: printerIssueForm.date,
        printerAccount: printerIssueForm.printerAccount,
        grayFabricRef: printerIssueForm.grayFabricRef,
        fabricName: printerIssueForm.fabricName || undefined,
        qtyIssued: qtyToIssue,
        remarks: printerIssueForm.remarks || undefined,
      });
      setSaving(false);
      if (!result) { setSaveError('Failed to update issue. Please try again.'); return; }
      setSuccessMsg('Issue updated successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      closeModal();
      loadAllIssues();
      return;
    }

    // ── Resolve quality group → purchaseNo(s) ─────────────────────────────
    const qualityGroup = qualityGroupedOutstanding.find(
      (q) => q.qualityKey === printerIssueForm.grayFabricRef
    );

    // Fallback: if grayFabricRef is a direct purchaseNo (edit mode or legacy)
    const selectedOutstanding = qualityGroup
      ? null
      : consolidatedOutstanding.find((f) => f.purchaseNo === printerIssueForm.grayFabricRef);

    const totalOutstanding = qualityGroup
      ? qualityGroup.totalOutstandingQty
      : selectedOutstanding?.outstandingQty ?? 0;

    if (!qualityGroup && !selectedOutstanding) {
      setSaveError(`Fabric "${printerIssueForm.grayFabricRef}" is not available for issue. It may have zero outstanding quantity or may not exist in inventory.`);
      return;
    }

    if (qtyToIssue > totalOutstanding + 0.0001) {
      setSaveError(
        `Cannot issue ${qtyToIssue.toFixed(3)} Mt. — only ${totalOutstanding.toFixed(3)} Mt. is outstanding for this quality. Please reduce the quantity.`
      );
      return;
    }

    setSaving(true);
    setSaveError(null);
    const issueNo = await printerFabricService.getNextIssueNo();

    // ── For quality group: issue against purchaseNos in order, splitting qty if needed ──
    if (qualityGroup) {
      const fabricLabel = `${qualityGroup.fabricName}${qualityGroup.fabricType ? ` (${qualityGroup.fabricType})` : ''}`;
      let remainingQty = qtyToIssue;
      let lastResult: any = null;
      let lastError: string | undefined;

      for (const purchaseNo of qualityGroup.purchaseNos) {
        if (remainingQty <= 0) break;
        const fabricEntry = consolidatedOutstanding.find((f) => f.purchaseNo === purchaseNo);
        if (!fabricEntry || fabricEntry.outstandingQty <= 0) continue;

        const qtyForThisEntry = Math.min(remainingQty, fabricEntry.outstandingQty);
        const entryIssueNo = remainingQty === qtyToIssue ? issueNo : await printerFabricService.getNextIssueNo();

        const { data: res, error: err } = await printerFabricService.createIssue(
          {
            issueNo: entryIssueNo,
            date: printerIssueForm.date,
            printerAccount: printerIssueForm.printerAccount,
            grayFabricRef: purchaseNo,
            fabricName: fabricLabel,
            qtyIssued: Math.round(qtyForThisEntry * 10000) / 10000,
            remarks: printerIssueForm.remarks || undefined,
          },
          undefined,
          fabricEntry.outstandingQty
        );

        if (!res) { lastError = err; break; }
        lastResult = res;
        remainingQty = Math.round((remainingQty - qtyForThisEntry) * 10000) / 10000;
      }

      setSaving(false);
      if (!lastResult) {
        setSaveError(lastError || 'Failed to save issue. Please try again.');
        return;
      }

      const remainingOutstanding = Math.round((totalOutstanding - qtyToIssue) * 10000) / 10000;
      setSuccessMsg(
        `Fabric issued to ${printerIssueForm.printerAccount} — ${issueNo}. ` +
        `Issued: ${qtyToIssue.toFixed(3)} Mt. ` +
        (remainingOutstanding > 0
          ? `Remaining outstanding: ${remainingOutstanding.toFixed(3)} Mt.`
          : `Outstanding balance is now zero — fabric removed from issue dropdown.`)
      );
    } else {
      // Legacy path: direct purchaseNo
      const fabricLabel = `${selectedOutstanding!.fabricName}${selectedOutstanding!.fabricType ? ` (${selectedOutstanding!.fabricType})` : ''}`;
      const { data: result, error: issueError } = await printerFabricService.createIssue(
        {
          issueNo,
          date: printerIssueForm.date,
          printerAccount: printerIssueForm.printerAccount,
          grayFabricRef: printerIssueForm.grayFabricRef,
          fabricName: fabricLabel,
          qtyIssued: qtyToIssue,
          remarks: printerIssueForm.remarks || undefined,
        },
        undefined,
        selectedOutstanding!.outstandingQty
      );
      setSaving(false);
      if (!result) {
        setSaveError(issueError || 'Failed to save issue. Please try again.');
        return;
      }
      const remainingOutstanding = Math.round((selectedOutstanding!.outstandingQty - qtyToIssue) * 10000) / 10000;
      setSuccessMsg(
        `Fabric issued to ${printerIssueForm.printerAccount} — ${issueNo}. ` +
        `Issued: ${qtyToIssue.toFixed(3)} Mt. ` +
        (remainingOutstanding > 0
          ? `Remaining outstanding: ${remainingOutstanding.toFixed(3)} Mt.`
          : `Outstanding balance is now zero — fabric removed from issue dropdown.`)
      );
    }

    setTimeout(() => setSuccessMsg(null), 6000);
    closeModal();
    loadAllIssues();
    // Refresh consolidated outstanding so dropdown updates immediately
    greyFabricService.getAll().then((fabrics) => {
      setGreyFabrics(fabrics);
      loadEligibleFabrics(fabrics);
    });
  }

  async function handleDeleteIssue() {
    if (!deleteIssueTarget) return;
    setDeletingIssue(true);
    const ok = await printerFabricService.deleteIssue(deleteIssueTarget.id);
    setDeletingIssue(false);
    if (ok) {
      setDeleteIssueTarget(null);
      loadAllIssues();
      greyFabricService.getAll().then((fabrics) => {
        setGreyFabrics(fabrics);
        loadEligibleFabrics(fabrics);
      });
    }
  }

  async function handlePrinterReceiptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!printerReceiptForm.printerAccount) { setSaveError('Please select a Printer Account.'); return; }
    if (!printerReceiptForm.issueId) { setSaveError('Please select the issued fabric.'); return; }
    if (!printerReceiptForm.qtyReceived || parseFloat(printerReceiptForm.qtyReceived) <= 0) { setSaveError('Received Qty must be greater than 0.'); return; }
    const finishedName = printerReceiptForm.processedFabricName.trim();
    if (!finishedName) { setSaveError('Finished Fabric Name is required before posting to inventory.'); return; }

    const qtyToReceive = parseFloat(printerReceiptForm.qtyReceived);

    // Resolve quality group
    const qualityGroup = qualityGroupedPending.find((q) => q.qualityKey === printerReceiptForm.issueId);
    const totalGroupPending = qualityGroup?.totalPendingQty ?? 0;

    if (qualityGroup && qtyToReceive > totalGroupPending + 0.0001) {
      setSaveError(`Received qty cannot exceed total pending qty (${totalGroupPending.toFixed(2)} Mt.).`);
      return;
    }

    setSaving(true);
    setSaveError(null);
    const receiptNo = await printerFabricService.getNextReceiptNo();

    if (qualityGroup && qualityGroup.issueIds.length > 1) {
      // Split receipt across multiple issue vouchers of the same quality
      let remainingQty = qtyToReceive;
      let lastResult: any = null;
      let lastError: string | undefined;

      for (const issueId of qualityGroup.issueIds) {
        if (remainingQty <= 0) break;
        const issue = pendingIssuesForPrinter.find((i) => i.id === issueId);
        if (!issue || issue.qtyPending <= 0) continue;

        const qtyForThisIssue = Math.min(remainingQty, issue.qtyPending);
        const entryReceiptNo = remainingQty === qtyToReceive ? receiptNo : await printerFabricService.getNextReceiptNo();

        const res = await printerFabricService.createReceipt({
          receiptNo: entryReceiptNo,
          date: printerReceiptForm.date,
          printerAccount: printerReceiptForm.printerAccount,
          issueId,
          grayFabricRef: issue.grayFabricRef,
          fabricName: issue.fabricName || printerReceiptForm.fabricName || undefined,
          qtyReceived: Math.round(qtyForThisIssue * 10000) / 10000,
          processedFabricName: printerReceiptForm.processedFabricName || undefined,
          processedQty: parseFloat(printerReceiptForm.processedQty) || 0,
          shortage: parseFloat(printerReceiptForm.shortage) || 0,
          shrinkage: parseFloat(printerReceiptForm.shrinkage) || 0,
          remarks: printerReceiptForm.remarks || undefined,
        });

        if (!res) { lastError = 'Failed to save receipt. Please try again.'; break; }
        lastResult = res;
        remainingQty = Math.round((remainingQty - qtyForThisIssue) * 10000) / 10000;
      }

      setSaving(false);
      if (!lastResult) { setSaveError(lastError || 'Failed to save receipt. Please try again.'); return; }
      const remaining = Math.round((totalGroupPending - qtyToReceive) * 10000) / 10000;
      // Post to finished inventory (idempotent — uses receiptNo as key)
      await fabricInventoryService.postFinishedFabricReceipt({
        finishedFabricName: finishedName,
        receivedQty: qtyToReceive,
        category: 'OTHER',
        unit: 'Metre',
        sourceModule: 'printer_receipt',
        sourceReceiptId: receiptNo,
        sourceGreyFabricRef: printerReceiptForm.grayFabricRef || undefined,
        processorName: printerReceiptForm.printerAccount || undefined,
        processingType: 'printing',
        receivedDate: printerReceiptForm.date,
      });
      setSuccessMsg(`Receipt saved (${receiptNo}). Finished inventory posted as "${finishedName}". ${remaining > 0 ? `${remaining.toFixed(2)} Mt. still pending with printer.` : 'All issues fully settled.'}`);
    } else {
      // Single issue voucher path
      const singleIssueId = qualityGroup ? qualityGroup.issueIds[0] : printerReceiptForm.issueId;
      const singleIssue = pendingIssuesForPrinter.find((i) => i.id === singleIssueId);
      if (singleIssue && qtyToReceive > singleIssue.qtyPending + 0.0001) {
        setSaving(false);
        setSaveError(`Received qty cannot exceed pending qty (${singleIssue.qtyPending.toFixed(2)} Mt.).`);
        return;
      }
      let result = await printerFabricService.createReceipt({
        receiptNo,
        date: printerReceiptForm.date,
        printerAccount: printerReceiptForm.printerAccount,
        issueId: singleIssueId,
        grayFabricRef: printerReceiptForm.grayFabricRef,
        fabricName: printerReceiptForm.fabricName || undefined,
        qtyReceived: qtyToReceive,
        processedFabricName: finishedName,
        processedQty: parseFloat(printerReceiptForm.processedQty) || 0,
        shortage: parseFloat(printerReceiptForm.shortage) || 0,
        shrinkage: parseFloat(printerReceiptForm.shrinkage) || 0,
        remarks: printerReceiptForm.remarks || undefined,
      });
      setSaving(false);
      if (!result) { setSaveError('Failed to save receipt. Please try again.'); return; }
      // Post to finished inventory (idempotent)
      await fabricInventoryService.postFinishedFabricReceipt({
        finishedFabricName: finishedName,
        receivedQty: qtyToReceive,
        category: 'OTHER',
        unit: 'Metre',
        sourceModule: 'printer_receipt',
        sourceReceiptId: receiptNo,
        sourceGreyFabricRef: printerReceiptForm.grayFabricRef || undefined,
        processorName: printerReceiptForm.printerAccount || undefined,
        processingType: 'printing',
        receivedDate: printerReceiptForm.date,
      });
      const remaining = singleIssue ? Math.max(0, singleIssue.qtyPending - qtyToReceive) : 0;
      setSuccessMsg(`Receipt saved (${receiptNo}). Finished inventory posted as "${finishedName}". ${remaining > 0 ? `${remaining.toFixed(2)} Mt. still pending with printer.` : 'Issue fully settled.'}`);
    }

    setTimeout(() => setSuccessMsg(null), 5000);
    closeModal();
    loadAllIssues();
    // Refresh eligible fabrics — a fully-settled fabric becomes available again
    greyFabricService.getAll().then((fabrics) => {
      setGreyFabrics(fabrics);
      loadEligibleFabrics(fabrics);
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await dyeingProcessingService.delete(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setDeleteTarget(null);
      loadEntries();
    }
  }

  async function handleReceiveBack(receivedDate: string, receivedQty: number, finishedFabricName: string) {
    if (!receiveEntry) return;
    setReceiveSaving(true);

    // Update entry with received date, qty, and finished fabric name
    const updated: Omit<DyeingProcessingEntry, 'id'> = {
      ...receiveEntry,
      receivedDate,
      qtyMeters: receivedQty,
      finishedFabricName: finishedFabricName.trim(),
    };
    const saved = await dyeingProcessingService.update(receiveEntry.id, updated);

    if (saved) {
      // Post to finished fabric inventory (idempotent)
      const punchResult = await dyeingProcessingService.punchToFabricInventory(
        { ...saved, qtyMeters: receivedQty },
        finishedFabricName.trim()
      );
      if (punchResult.success) {
        if (punchResult.alreadyPosted) {
          setSuccessMsg(`Fabric received. Note: inventory was already posted for entry ${saved.entryNo}.`);
        } else {
          setSuccessMsg(`Fabric received and posted to Finished Inventory as "${finishedFabricName.trim()}"!`);
        }
      } else {
        setSuccessMsg('Entry updated but inventory post failed: ' + punchResult.error);
      }
    } else {
      setSuccessMsg('Failed to update entry.');
    }

    setReceiveSaving(false);
    setReceiveEntry(null);
    setTimeout(() => setSuccessMsg(null), 5000);
    loadEntries();
  }

  // Metering variation calculations
  const computedActualQty = () => {
    const billed = parseFloat(form.qtyMeters) || 0;
    const l = parseFloat(form.lValue) || 100;
    return billed * l / 100;
  };

  const computedVariation = () => {
    const billed = parseFloat(form.qtyMeters) || 0;
    return computedActualQty() - billed;
  };

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

  // When quality group is selected in receipt form, auto-fill fabric details
  const handleIssueSelect = (qualityKey: string) => {
    const group = qualityGroupedPending.find((q) => q.qualityKey === qualityKey);
    if (group) {
      // Use the first issue's grayFabricRef for reference
      const firstIssue = pendingIssuesForPrinter.find((i) => group.issueIds.includes(i.id));
      setPrinterReceiptForm((prev) => ({
        ...prev,
        issueId: qualityKey,
        grayFabricRef: firstIssue?.grayFabricRef || '',
        fabricName: group.fabricName,
      }));
    } else {
      setPrinterReceiptForm((prev) => ({ ...prev, issueId: qualityKey, grayFabricRef: '', fabricName: '' }));
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-white flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-700 text-foreground font-display flex items-center gap-2">
            <FlaskConical size={20} className="text-primary" />
            Dyeing / Processing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send gray fabric to dyer/printer — track batches, qty in metres &amp; expected return
          </p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New Processing Entry
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mx-6 mt-4 flex items-center gap-2 bg-success-bg border border-success-border text-success rounded-xl px-4 py-2.5 text-sm font-500">
          <CheckCircle size={15} />
          {successMsg}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-500">Total Batches</p>
            <p className="text-2xl font-700 text-foreground mt-1">{entries.length}</p>
            <p className="text-xs text-muted-foreground">Vouchers issued</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-500">Total Qty Sent</p>
            <p className="text-2xl font-700 text-primary mt-1">{totalQtyMeters.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Metres</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-500">Pending Return</p>
            <p className="text-2xl font-700 text-warning mt-1">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Awaiting receipt</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-500">Fabric Pending w/ Printer</p>
            <p className="text-2xl font-700 text-orange-500 mt-1">{pendingWithPrinterQty.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Mt. issued, not received</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('processing')}
            className={`px-4 py-2 rounded-lg text-sm font-600 transition-colors flex items-center gap-2 ${activeTab === 'processing' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <FlaskConical size={14} />
            Processing Vouchers
          </button>
          <button
            onClick={() => setActiveTab('printer')}
            className={`px-4 py-2 rounded-lg text-sm font-600 transition-colors flex items-center gap-2 ${activeTab === 'printer' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Printer size={14} />
            Printer Fabric Ledger
            {allIssues.filter((i) => i.status !== 'settled').length > 0 && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs font-700 rounded-full">
                {allIssues.filter((i) => i.status !== 'settled').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'processing' && (
          /* Table */
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
              <Droplets size={15} className="text-primary" />
              <span className="text-sm font-600 text-foreground">Processing Vouchers</span>
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
                    placeholder="Search batch, job card, processor..."
                    value={entrySearch}
                    onChange={(e) => setEntrySearch(e.target.value)}
                    className="input-field pl-8 text-xs w-52 h-8"
                  />
                </div>
                <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                  {(['all', 'pending', 'received'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-600 transition-colors capitalize ${statusFilter === s ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{filteredDyeingEntries.length} records</span>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading entries…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1000px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Voucher No</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Gray Fabric Ref.</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Batch No</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Process</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Processor</th>
                      <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Qty (Mt.)</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Sent Date</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Expected Date</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDyeingEntries.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-16 text-muted-foreground">
                          {entries.length === 0 ? (
                            <>
                              <FlaskConical size={36} className="mx-auto mb-3 opacity-20" />
                              <p className="text-sm font-500">No processing vouchers yet</p>
                              <p className="text-xs mt-1">Create a new entry to issue a dyer/printer order voucher</p>
                            </>
                          ) : (
                            <>
                              <Search size={28} className="mx-auto mb-2 opacity-20" />
                              <p className="text-sm font-500">No entries match your filter</p>
                            </>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredDyeingEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-600 text-primary text-xs">{entry.entryNo}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-600 text-foreground">{entry.grayFabricRef}</span>
                            {entry.colourShade && <div className="text-xs text-muted-foreground">{entry.colourShade}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs font-500 text-foreground">{entry.dyeBatchNo || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${PROCESS_COLORS[entry.processType]}`}>
                              {DYEING_PROCESS_TYPE_LABELS[entry.processType]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground">{entry.processorName || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-600 text-foreground">{entry.qtyMeters?.toFixed(2) || '0.00'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{entry.sentDate || '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{entry.expectedDate || '—'}</td>
                          <td className="px-4 py-3">
                            {entry.receivedDate ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-600 bg-success-bg text-success border border-success-border">
                                {entry.receivedDate}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-600 bg-warning-bg text-warning border border-warning-border">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setVoucherEntry(entry)}
                                title="Print Voucher"
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                onClick={() => openEditModal(entry)}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(entry)}
                                className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'printer' && (
          /* Printer Fabric Ledger */
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <Printer size={15} className="text-orange-500" />
              <span className="text-sm font-600 text-foreground">Fabric Pending with Printer</span>
              <span className="ml-auto text-xs text-muted-foreground">{allIssues.length} issues</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Issue No</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Printer Account</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Fabric</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Issued (Mt.)</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received (Mt.)</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pending (Mt.)</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allIssues.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <Printer size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-500">No fabric issued to printers yet</p>
                        <p className="text-xs mt-1">Use "New Processing Entry → Fabric Issue to Printer" to issue fabric</p>
                      </td>
                    </tr>
                  ) : (
                    allIssues.map((issue) => (
                      <tr key={issue.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-600 text-primary text-xs">{issue.issueNo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{issue.date}</td>
                        <td className="px-4 py-3 text-xs font-600 text-foreground">{issue.printerAccount}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-600 text-foreground">{issue.grayFabricRef}</span>
                          {issue.fabricName && <div className="text-xs text-muted-foreground">{issue.fabricName}</div>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-600 text-foreground">{issue.qtyIssued.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-success font-600">{issue.qtyReceived.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-700 text-orange-600">{issue.qtyPending.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${
                            issue.status === 'settled' ? 'bg-success-bg text-success border border-success-border' :
                            issue.status === 'partial'? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-orange-50 text-orange-600 border border-orange-200'
                          }`}>
                            {issue.status === 'settled' ? 'Settled' : issue.status === 'partial' ? 'Partial' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setViewIssue(issue)}
                              title="View Details"
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => openEditIssueModal(issue)}
                              title="Edit Issue"
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteIssueTarget(issue)}
                              title="Delete Issue"
                              className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">
                {editingEntry ? 'Edit Processing Entry' : editingIssue ? 'Edit Fabric Issue' : 'New Processing Entry'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Entry Type Selector — only for new entries */}
            {!editingEntry && !editingIssue && (
              <div className="px-6 pt-4 pb-0">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEntryModalType('processing'); setSaveError(null); }}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-xs font-600 ${entryModalType === 'processing' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                  >
                    <FlaskConical size={18} />
                    Dyer / Printer Order
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEntryModalType('printer_issue'); setSaveError(null); }}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-xs font-600 ${entryModalType === 'printer_issue' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-border text-muted-foreground hover:border-orange-300'}`}
                  >
                    <ArrowUpFromLine size={18} />
                    Fabric Issue to Printer
                  </button>
                </div>
              </div>
            )}

            {/* ── Processing Entry Form (existing) ── */}
            {entryModalType === 'processing' && (
              <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                {saveError && (
                  <div className="bg-danger-bg border border-danger-border text-danger rounded-lg px-3 py-2 text-xs font-500 flex items-center gap-2">
                    <AlertCircle size={13} />
                    {saveError}
                  </div>
                )}

                {/* Row 1: Processor / Mill — FIRST SELECTION */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Processor / Mill <span className="text-danger">*</span></label>
                  <select
                    required
                    value={form.processorName}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') { router.push('/account-master'); }
                      else { setForm({ ...form, processorName: e.target.value }); }
                    }}
                    className="input-field text-sm"
                  >
                    <option value="">-- Select Processor / Mill --</option>
                    <option value="__create_new__" className="text-primary font-600">+ Add New Account</option>
                    {processorAccounts.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  {!form.processorName && (
                    <p className="text-xs text-muted-foreground mt-0.5">Select a processor first to fill in the rest of the details.</p>
                  )}
                </div>

                {/* Rest of the form — shown only after processor is selected */}
                {form.processorName && (
                  <>
                    {/* Row 2: Date + Process Type */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Date *</label>
                        <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Process Type *</label>
                        <select required value={form.processType} onChange={(e) => setForm({ ...form, processType: e.target.value as DyeingProcessType })} className="input-field text-sm">
                          {PROCESS_TYPES.map((pt) => (
                            <option key={pt} value={pt}>{DYEING_PROCESS_TYPE_LABELS[pt]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Gray Fabric Ref (required) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-600 text-muted-foreground">
                        Gray Fabric Reference <span className="text-danger">*</span>
                      </label>
                      <select
                        required
                        value={form.grayFabricRef}
                        onChange={(e) => setForm({ ...form, grayFabricRef: e.target.value })}
                        className="input-field text-sm"
                      >
                        <option value="">-- Select Gray Fabric --</option>
                        {(() => {
                          // Build consolidated quality groups for the selected processor
                          const issuedRefs = new Set(
                            allIssues
                              .filter(
                                (i) =>
                                  i.printerAccount === form.processorName &&
                                  (i.status === 'pending' || i.status === 'partial')
                              )
                              .map((i) => i.grayFabricRef)
                          );
                          const filtered = issuedRefs.size > 0
                            ? greyFabrics.filter((gf) => issuedRefs.has(gf.purchaseNo))
                            : greyFabrics;

                          if (filtered.length === 0) {
                            return (
                              <option disabled value="">No fabric issued/pending for this account</option>
                            );
                          }

                          // Consolidate by quality (fabricName + fabricType)
                          const qualityMap = new Map<string, { label: string; totalPending: number; purchaseNos: string[] }>();
                          for (const gf of filtered) {
                            const key = `${gf.fabricName}|${gf.fabricType || ''}`;
                            const label = `${gf.fabricName}${gf.fabricType ? ` (${gf.fabricType})` : ''}`;
                            const pendingQty = allIssues
                              .filter(
                                (i) =>
                                  i.printerAccount === form.processorName &&
                                  i.grayFabricRef === gf.purchaseNo &&
                                  (i.status === 'pending' || i.status === 'partial')
                              )
                              .reduce((sum, i) => sum + i.qtyPending, 0);
                            if (qualityMap.has(key)) {
                              const existing = qualityMap.get(key)!;
                              existing.totalPending = Math.round((existing.totalPending + pendingQty) * 10000) / 10000;
                              existing.purchaseNos.push(gf.purchaseNo);
                            } else {
                              qualityMap.set(key, { label, totalPending: pendingQty, purchaseNos: [gf.purchaseNo] });
                            }
                          }

                          return Array.from(qualityMap.entries())
                            .sort(([, a], [, b]) => a.label.localeCompare(b.label))
                            .map(([key, group]) => (
                              <option key={key} value={group.label}>
                                {group.label}{group.totalPending > 0 ? ` — Pending: ${group.totalPending.toFixed(3)} Mt.` : ''}
                              </option>
                            ));
                        })()}
                      </select>
                      {(() => {
                        const issuedRefs = new Set(
                          allIssues
                            .filter(
                              (i) =>
                                i.printerAccount === form.processorName &&
                                (i.status === 'pending' || i.status === 'partial')
                            )
                            .map((i) => i.grayFabricRef)
                        );
                        if (issuedRefs.size === 0) {
                          return (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Showing all fabrics — no fabric currently issued/pending for this account.
                            </p>
                          );
                        }
                        // Count unique quality groups
                        const qualitySet = new Set(
                          greyFabrics
                            .filter((gf) => issuedRefs.has(gf.purchaseNo))
                            .map((gf) => `${gf.fabricName}|${gf.fabricType || ''}`)
                        );
                        return (
                          <p className="text-xs text-success mt-0.5">
                            Showing {qualitySet.size} quality type(s) issued/pending to <strong>{form.processorName}</strong>.
                          </p>
                        );
                      })()}
                    </div>

                    {/* Row 4: Job Card (optional) + Style */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Job Card Ref <span className="text-muted-foreground/60 font-400">(optional)</span></label>
                        <select
                          value={form.jobCardRef}
                          onChange={(e) => {
                            const jc = jobCards.find((j) => j.jobCardNo === e.target.value);
                            setForm({
                              ...form,
                              jobCardRef: e.target.value,
                              styleName: jc?.styleEn || form.styleName,
                              colourShade: jc?.colors && jc.colors.length > 0 ? jc.colors[0] : form.colourShade,
                            });
                          }}
                          className="input-field text-sm"
                        >
                          <option value="">-- None --</option>
                          {jobCards.map((jc) => (
                            <option key={jc.id} value={jc.jobCardNo}>
                              {jc.jobCardNo} — {jc.styleEn}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Style Name</label>
                        <input type="text" placeholder="Auto-filled from job card" value={form.styleName} onChange={(e) => setForm({ ...form, styleName: e.target.value })} className="input-field text-sm" />
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
                          {jc.designCode && <div><span className="text-muted-foreground font-600">Design Code:</span> <span className="text-foreground ml-1">{jc.designCode}</span></div>}
                        </div>
                      );
                    })()}

                    {/* Row 5: Batch No (auto) + Colour Shade */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground flex items-center gap-1.5">
                          Batch No
                          <span className="text-xs bg-info-bg text-info border border-info-border rounded px-1.5 py-0.5 font-500">Auto</span>
                        </label>
                        <input
                          type="text"
                          value={batchLoading ? 'Generating…' : form.dyeBatchNo}
                          onChange={(e) => setForm({ ...form, dyeBatchNo: e.target.value })}
                          className="input-field text-sm bg-muted/30"
                          placeholder="Auto-generated"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Colour / Shade</label>
                        <input type="text" placeholder="e.g. Navy Blue" value={form.colourShade} onChange={(e) => setForm({ ...form, colourShade: e.target.value })} className="input-field text-sm" />
                      </div>
                    </div>

                    {/* Row 6: Qty in Metres */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-600 text-muted-foreground">Qty (Mt.) *</label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          value={form.qtyMeters}
                          onChange={(e) => setForm({ ...form, qtyMeters: e.target.value })}
                          className="input-field text-sm pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-600">Mt.</span>
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
                            <span className="text-xs text-muted-foreground">Mt.</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Billed Qty × L ÷ 100</p>
                        </div>
                      </div>
                      {/* Variation display */}
                      {parseFloat(form.qtyMeters) > 0 && parseFloat(form.lValue) !== 100 && (
                        <div className={`flex items-center justify-between rounded-lg px-3 py-2 border ${computedVariation() < 0 ? 'bg-danger-bg border-danger-border' : 'bg-success-bg border-success-border'}`}>
                          <div className="flex items-center gap-2">
                            <TrendingDown size={13} className={computedVariation() < 0 ? 'text-danger' : 'text-success'} />
                            <span className={`text-xs font-600 ${computedVariation() < 0 ? 'text-danger' : 'text-success'}`}>
                              Metering Variation
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-700 tabular-nums ${computedVariation() < 0 ? 'text-danger' : 'text-success'}`}>
                              {computedVariation() > 0 ? '+' : ''}{computedVariation().toLocaleString('en-IN', { maximumFractionDigits: 3 })} Mt.
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {Math.abs(computedVariation()).toLocaleString('en-IN', { maximumFractionDigits: 3 })} Mt. {computedVariation() < 0 ? 'less' : 'more'} than billed
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

                    {/* Net Amount preview — based on actual qty */}
                    {(form.qtyMeters || form.ratePerUnit || form.discount) && (
                      <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-3 py-2">
                        <div>
                          <span className="text-xs text-muted-foreground font-500">Net Amount</span>
                          {parseFloat(form.lValue) !== 100 && (
                            <p className="text-xs text-muted-foreground">Based on actual qty ({computedActualQty().toLocaleString('en-IN', { maximumFractionDigits: 3 })} Mt.)</p>
                          )}
                        </div>
                        <span className="text-sm font-700 text-foreground">
                          ₹{computedNetAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {/* Row 7: Sent Date + Expected Date */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Sent Date</label>
                        <input type="date" value={form.sentDate} onChange={(e) => setForm({ ...form, sentDate: e.target.value })} className="input-field text-sm" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-600 text-muted-foreground">Expected Return Date</label>
                        <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} className="input-field text-sm" />
                      </div>
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                      <input type="text" placeholder="Optional notes…" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm" />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={saving || !form.processorName} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    {saving ? <><Clock size={14} className="animate-spin" /> Saving…</> : (editingEntry ? 'Update Entry' : 'Save & Issue Voucher')}
                  </button>
                </div>
              </form>
            )}

            {/* ── Fabric Issue to Printer Form ── */}
            {entryModalType === 'printer_issue' && (
              <form onSubmit={handlePrinterIssueSubmit} className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                  <ArrowUpFromLine size={15} className="text-orange-500 shrink-0" />
                  <p className="text-xs text-orange-700 font-500">
                    Fabric issued here will be transferred to the selected printer's account and shown as <strong>Fabric Pending with Printer</strong>. Partial issues are allowed — the remaining outstanding balance stays available.
                  </p>
                </div>

                {saveError && (
                  <div className="bg-danger-bg border border-danger-border text-danger rounded-lg px-3 py-2 text-xs font-500 flex items-center gap-2">
                    <AlertCircle size={13} />
                    {saveError}
                  </div>
                )}

                {/* Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Date *</label>
                  <input type="date" required value={printerIssueForm.date} onChange={(e) => setPrinterIssueForm({ ...printerIssueForm, date: e.target.value })} className="input-field text-sm" />
                </div>

                {/* Printer Account — must select first */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Printer Account <span className="text-danger">*</span></label>
                  <select
                    required
                    value={printerIssueForm.printerAccount}
                    onChange={(e) => {
                      if (e.target.value === '__create_new__') { router.push('/account-master'); }
                      else { setPrinterIssueForm({ ...printerIssueForm, printerAccount: e.target.value, grayFabricRef: '', fabricName: '', qtyIssued: '' }); }
                    }}
                    className="input-field text-sm"
                  >
                    <option value="">-- Select Printer Account --</option>
                    <option value="__create_new__" className="text-primary font-600">+ Add New Account</option>
                    {processorAccounts.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Fabric — shown after printer selected, uses consolidated outstanding */}
                {printerIssueForm.printerAccount && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-600 text-muted-foreground">
                        Select Fabric to Issue <span className="text-danger">*</span>
                        <span className="ml-2 text-xs font-400 text-muted-foreground">(shows current outstanding qty only)</span>
                      </label>
                      <select
                        required
                        value={printerIssueForm.grayFabricRef}
                        onChange={(e) => {
                          const selected = qualityGroupedOutstanding.find((q) => q.qualityKey === e.target.value);
                          setPrinterIssueForm({
                            ...printerIssueForm,
                            grayFabricRef: e.target.value,
                            fabricName: selected ? `${selected.fabricName}${selected.fabricType ? ` (${selected.fabricType})` : ''}` : '',
                            qtyIssued: selected ? String(selected.totalOutstandingQty) : '',
                          });
                        }}
                        className="input-field text-sm"
                      >
                        <option value="">-- Select Fabric --</option>
                        {qualityGroupedOutstanding.length === 0 ? (
                          <option disabled value="">No fabrics with outstanding qty available</option>
                        ) : (
                          qualityGroupedOutstanding.map((q) => (
                            <option key={q.qualityKey} value={q.qualityKey}>
                              {q.displayLabel} — Outstanding: {q.totalOutstandingQty.toFixed(3)} Mt.
                            </option>
                          ))
                        )}
                      </select>
                      {qualityGroupedOutstanding.length === 0 ? (
                        <p className="text-xs text-danger mt-0.5">No fabrics with outstanding quantity. All available stock has been issued or inventory is empty.</p>
                      ) : (
                        <p className="text-xs text-success mt-0.5">
                          {qualityGroupedOutstanding.length} quality type(s) with outstanding qty — fully-issued and zero-stock fabrics are hidden.
                        </p>
                      )}
                    </div>

                    {/* Outstanding balance info panel */}
                    {printerIssueForm.grayFabricRef && (() => {
                      const sel = qualityGroupedOutstanding.find((q) => q.qualityKey === printerIssueForm.grayFabricRef);
                      if (!sel) return null;
                      return (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-orange-600 font-600">Total Available</p>
                            <p className="text-orange-800 font-700 text-sm">{sel.totalAvailable.toFixed(3)} Mt.</p>
                          </div>
                          <div>
                            <p className="text-orange-600 font-600">Already Issued / Pending</p>
                            <p className="text-orange-800 font-700 text-sm">{sel.totalIssuedPending.toFixed(3)} Mt.</p>
                          </div>
                          <div>
                            <p className="text-orange-600 font-700">Outstanding Balance</p>
                            <p className="text-orange-700 font-800 text-sm">{sel.totalOutstandingQty.toFixed(3)} Mt.</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Qty — max capped at outstanding */}
                    {printerIssueForm.grayFabricRef && (() => {
                      const sel = qualityGroupedOutstanding.find((q) => q.qualityKey === printerIssueForm.grayFabricRef);
                      const maxQty = sel?.totalOutstandingQty ?? 0;
                      const enteredQty = parseFloat(printerIssueForm.qtyIssued) || 0;
                      const overLimit = enteredQty > maxQty + 0.0001;
                      return (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-600 text-muted-foreground">
                            Qty to Issue (Mt.) <span className="text-danger">*</span>
                            <span className="ml-2 text-xs font-400 text-muted-foreground">Max: {maxQty.toFixed(3)} Mt.</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              required
                              min="0.001"
                              step="0.001"
                              max={maxQty}
                              placeholder="0.000"
                              value={printerIssueForm.qtyIssued}
                              onChange={(e) => setPrinterIssueForm({ ...printerIssueForm, qtyIssued: e.target.value })}
                              className={`input-field text-sm pr-12 ${overLimit ? 'border-danger ring-1 ring-danger' : ''}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-600">Mt.</span>
                          </div>
                          {overLimit && (
                            <p className="text-xs text-danger font-500 flex items-center gap-1">
                              <AlertCircle size={11} />
                              Exceeds outstanding qty ({maxQty.toFixed(3)} Mt.). Reduce the quantity.
                            </p>
                          )}
                          {!overLimit && enteredQty > 0 && enteredQty < maxQty && (
                            <p className="text-xs text-info font-500">
                              Partial issue — {(maxQty - enteredQty).toFixed(3)} Mt. will remain as outstanding balance after this issue.
                            </p>
                          )}
                          {!overLimit && enteredQty > 0 && Math.abs(enteredQty - maxQty) < 0.0001 && (
                            <p className="text-xs text-success font-500">
                              Full outstanding qty — fabric will be removed from the issue dropdown after this.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Remarks */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                      <input type="text" placeholder="Optional notes…" value={printerIssueForm.remarks} onChange={(e) => setPrinterIssueForm({ ...printerIssueForm, remarks: e.target.value })} className="input-field text-sm" />
                    </div>

                    {/* Preview */}
                    {printerIssueForm.qtyIssued && parseFloat(printerIssueForm.qtyIssued) > 0 && (() => {
                      const sel = qualityGroupedOutstanding.find((q) => q.qualityKey === printerIssueForm.grayFabricRef);
                      const maxQty = sel?.totalOutstandingQty ?? 0;
                      const enteredQty = parseFloat(printerIssueForm.qtyIssued) || 0;
                      if (enteredQty > maxQty + 0.0001) return null;
                      return (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-600 text-orange-700">Will be shown as Pending with Printer</p>
                            <p className="text-xs text-orange-600 mt-0.5">{printerIssueForm.printerAccount}</p>
                          </div>
                          <span className="text-lg font-700 text-orange-600">{enteredQty.toFixed(3)} Mt.</span>
                        </div>
                      );
                    })()}
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                  <button
                    type="submit"
                    disabled={saving || !printerIssueForm.printerAccount || !printerIssueForm.grayFabricRef || (() => {
                      const sel = qualityGroupedOutstanding.find((q) => q.qualityKey === printerIssueForm.grayFabricRef);
                      const maxQty = sel?.totalOutstandingQty ?? 0;
                      const enteredQty = parseFloat(printerIssueForm.qtyIssued) || 0;
                      return enteredQty <= 0 || enteredQty > maxQty + 0.0001;
                    })()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? <><Clock size={14} className="animate-spin" /> Saving…</> : <><ArrowUpFromLine size={14} /> Issue Fabric to Printer</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Voucher Print Modal */}
      {voucherEntry && (
        <VoucherPrint entry={voucherEntry} onClose={() => setVoucherEntry(null)} />
      )}

      {/* Receive Back Modal */}
      {receiveEntry && (
        <ReceiveBackModal
          entry={receiveEntry}
          onClose={() => setReceiveEntry(null)}
          onConfirm={handleReceiveBack}
          saving={receiveSaving}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="text-base font-700 text-foreground">Delete Entry?</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-600 text-foreground">{deleteTarget.entryNo}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Printer Issue Modal */}
      {viewIssue && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b-2 border-gray-800 px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-800 text-gray-900 uppercase tracking-wide">Fabric Issue Voucher</h2>
                <p className="text-xs text-gray-500 mt-0.5">Printer Fabric Issue</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-700 text-gray-900">{viewIssue.issueNo}</p>
                <p className="text-xs text-gray-500">{viewIssue.date}</p>
              </div>
            </div>
            <div className="px-6 py-4 flex flex-col gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-600 uppercase tracking-wide mb-1">To (Printer Account)</p>
                <p className="text-base font-700 text-gray-900">{viewIssue.printerAccount}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 font-600">Gray Fabric Ref.</p>
                  <p className="text-sm font-700 text-gray-900">{viewIssue.grayFabricRef}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-600">Fabric Name</p>
                  <p className="text-sm font-700 text-gray-900">{viewIssue.fabricName || '—'}</p>
                </div>
              </div>
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-3 py-2 text-xs font-700 text-gray-700">Description</th>
                    <th className="text-right px-3 py-2 text-xs font-700 text-gray-700">Qty (Mt.)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2 text-gray-800">Issued</td>
                    <td className="px-3 py-2 text-right font-700 text-gray-900">{viewIssue.qtyIssued.toFixed(2)}</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2 text-gray-800">Received</td>
                    <td className="px-3 py-2 text-right font-700 text-green-700">{viewIssue.qtyReceived.toFixed(2)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td className="px-3 py-2 font-700 text-gray-900">Pending</td>
                    <td className="px-3 py-2 text-right font-800 text-orange-600">{viewIssue.qtyPending.toFixed(2)} Mt.</td>
                  </tr>
                </tfoot>
              </table>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500 font-600">Status:</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${
                  viewIssue.status === 'settled' ? 'bg-green-100 text-green-700 border border-green-200' :
                  viewIssue.status === 'partial' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-orange-50 text-orange-600 border border-orange-200'
                }`}>
                  {viewIssue.status === 'settled' ? 'Settled' : viewIssue.status === 'partial' ? 'Partial' : 'Pending'}
                </span>
              </div>
              {viewIssue.remarks && (
                <div>
                  <p className="text-xs text-gray-500 font-600">Remarks</p>
                  <p className="text-sm text-gray-700 italic">{viewIssue.remarks}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6 mt-2 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <div className="border-b border-gray-400 mb-1 h-8" />
                  <p className="text-xs text-gray-500">Authorised By</p>
                </div>
                <div className="text-center">
                  <div className="border-b border-gray-400 mb-1 h-8" />
                  <p className="text-xs text-gray-500">Received By (Printer)</p>
                </div>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setViewIssue(null)} className="btn-secondary flex-1">Close</button>
              <button
                onClick={() => window.print()}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Printer size={14} />
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Printer Issue Confirm */}
      {deleteIssueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="text-base font-700 text-foreground">Delete Issue?</h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete issue <span className="font-600 text-foreground">{deleteIssueTarget.issueNo}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteIssueTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteIssue} disabled={deletingIssue} className="btn-danger flex-1">
                {deletingIssue ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
