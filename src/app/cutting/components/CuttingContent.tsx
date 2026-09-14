'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Plus, X, Scissors, ChevronDown, ChevronRight, Trash2, CheckCircle, Pencil, Package, AlertCircle, Search } from 'lucide-react';
import { CuttingEntry, SubComponentCutDetail, SubComponentSizeDetail, RollDetail } from '../data/cuttingData';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { FabricStockItem } from '@/app/fabric-inventory/data/fabricStockData';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { cuttingService, EmbReceiveItem } from '@/lib/services/cuttingService';
import { cuttingMasterService } from '@/lib/services/cuttingMasterService';
import { CuttingStockItem } from '@/lib/services/embroideryVoucherService';

interface CuttingContentProps {
  lang?: 'en' | 'hi';
}

const DEFAULT_CUTTING_MASTERS: string[] = [];

const REJECTION_REASONS = [
  'Fabric defect',
  'Wrong size',
  'Pattern mismatch',
  'Colour variation',
  'Measurement error',
  'Blade damage',
  'Other',
];

const SUB_COMPONENT_OPTIONS = ['Kurta', 'Pant', 'Dupatta', 'Shirt', 'Salwar', 'Jacket', 'Blouse', 'Skirt', 'Top', 'Other'];
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size', 'KA'];

interface RollRow {
  id: string;
  fabricRollId: string;
  rollNo: string;
  fabricIssuedQty: string;
  fabricConsumedQty: string;
  wastageQty: string;
}

interface SubComponentRow {
  id: string;
  component: string;
  customComponent: string;
  fabricName: string;
  unit: string;
  rolls: RollRow[];
  sizes: { size: string; qty: string }[];
  rejections: string;
}

// Represents a selected emb-received stock item with user-entered piecesUsed
interface SelectedEmbItem {
  stockItem: CuttingStockItem;
  piecesUsed: string; // user input
}

function makeDefaultRoll(): RollRow {
  return {
    id: `roll-${Date.now()}-${Math.random()}`,
    fabricRollId: '',
    rollNo: '',
    fabricIssuedQty: '',
    fabricConsumedQty: '',
    wastageQty: '',
  };
}

function makeDefaultSubComponent(): SubComponentRow {
  return {
    id: `sc-${Date.now()}-${Math.random()}`,
    component: 'Kurta',
    customComponent: '',
    fabricName: '',
    unit: 'Metres',
    rolls: [makeDefaultRoll()],
    sizes: SIZE_OPTIONS.map((s) => ({ size: s, qty: '' })),
    rejections: '',
  };
}

export default function CuttingContent({ lang = 'en' }: CuttingContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const [entries, setEntries] = useState<CuttingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Search / filter
  const [entrySearch, setEntrySearch] = useState('');

  // Apply URL filter params on mount
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'pending') {
      setEntrySearch('');
      // Pending in cutting = entries with forStitching > 0 (not yet dispatched)
      // We surface this via a visual highlight; search stays empty but banner shown
    }
  }, [searchParams]);

  // Edit state
  const [editingEntry, setEditingEntry] = useState<CuttingEntry | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<CuttingEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fabric names from fabric inventory (Supabase)
  const [fabricItems, setFabricItems] = useState<FabricStockItem[]>([]);

  // Embroidery-received pending materials for selected job card
  const [embPendingItems, setEmbPendingItems] = useState<CuttingStockItem[]>([]);
  const [loadingEmbPending, setLoadingEmbPending] = useState(false);
  // Selected emb items with user-entered piecesUsed
  const [selectedEmbItems, setSelectedEmbItems] = useState<SelectedEmbItem[]>([]);
  // Emb flow summary for selected job card
  const [embFlowSummary, setEmbFlowSummary] = useState<{
    component: string; embIssued: number; embReceived: number; issuedToCutting: number; pendingForCutting: number; unit: string;
  }[]>([]);
  const [loadingEmbSummary, setLoadingEmbSummary] = useState(false);

  // Ref to always have the latest form jobCardRef for real-time callbacks
  const formJobCardRefRef = useRef<string>('');

  // Move form state declaration before useEffect that references form.jobCardRef
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    jobCardRef: '',
    styleName: '',
    styleNo: '',
    cuttingMaster: '',
    rejectionReason: '',
    remarks: '',
    cuttingPrice: '',
  });

  const [subComponents, setSubComponents] = useState<SubComponentRow[]>([makeDefaultSubComponent()]);
  const [cuttingMasters, setCuttingMasters] = useState<string[]>([...DEFAULT_CUTTING_MASTERS]);
  const [customCuttingMaster, setCustomCuttingMaster] = useState('');
  const [customRejectionReason, setCustomRejectionReason] = useState('');

  const loadEntries = useCallback(async () => {
    const data = await cuttingService.getAll();
    setEntries(data);
    setLoadingEntries(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useRealtimeTable('cutting_entries', () => {
    loadEntries();
  });

  useEffect(() => {
    fabricInventoryService.getAll().then((items) => {
      const available = items.filter((item) => item.stockQty > 0);
      setFabricItems(available);
    }).catch(() => {
      setFabricItems([]);
    });
  }, []);

  useRealtimeTable('fabric_inventory', () => {
    fabricInventoryService.getAll().then((items) => {
      setFabricItems(items.filter((item) => item.stockQty > 0));
    }).catch(() => {});
  });

  const loadCuttingMasters = useCallback(async () => {
    const masters = await cuttingMasterService.getAll();
    if (masters.length > 0) {
      setCuttingMasters(masters.map((m) => m.name));
    }
  }, []);

  useEffect(() => {
    loadCuttingMasters();
  }, [loadCuttingMasters]);

  useRealtimeTable('cutting_masters', () => {
    loadCuttingMasters();
  });

  // Load embroidery-received pending materials when job card changes
  const loadEmbPending = useCallback(async (jobCardRef: string) => {
    if (!jobCardRef) {
      setEmbPendingItems([]);
      setSelectedEmbItems([]);
      setEmbFlowSummary([]);
      return;
    }
    setLoadingEmbPending(true);
    setLoadingEmbSummary(true);
    try {
      const [items, summary] = await Promise.all([
        cuttingService.getEmbReceivePendingByJobCard(jobCardRef),
        cuttingService.getEmbCuttingSummaryByJobCard(jobCardRef),
      ]);
      setEmbPendingItems(items);
      setEmbFlowSummary(summary);
      // Reset selections when job card changes
      setSelectedEmbItems([]);
    } catch {
      setEmbPendingItems([]);
      setEmbFlowSummary([]);
    } finally {
      setLoadingEmbPending(false);
      setLoadingEmbSummary(false);
    }
  }, []);

  // Keep ref in sync with current form jobCardRef so real-time callbacks can access it
  useEffect(() => {
    formJobCardRefRef.current = form.jobCardRef;
  }, [form.jobCardRef]);

  // Real-time: reload emb pending qty when emb issue or receive vouchers change
  useRealtimeTable('emb_issue_vouchers', () => {
    if (formJobCardRefRef.current) {
      loadEmbPending(formJobCardRefRef.current);
    }
  });

  useRealtimeTable('emb_receive_vouchers', () => {
    if (formJobCardRefRef.current) {
      loadEmbPending(formJobCardRefRef.current);
    }
  });

  const styleNamesFromJC = Array.from(new Set(jobCards.map((jc) => jc.styleEn).filter(Boolean))).sort();

  // Derived totals from sub-components
  const totalPiecesCutDerived = subComponents.reduce((sum, sc) => {
    return sum + sc.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0);
  }, 0);
  const totalRejectionsDerived = subComponents.reduce((sum, sc) => sum + (parseInt(sc.rejections) || 0), 0);
  const netPiecesDerived = totalPiecesCutDerived - totalRejectionsDerived;

  // Aggregate fabric totals across all sub-components
  const totalIssuedAll = subComponents.reduce((sum, sc) =>
    sum + sc.rolls.reduce((s, r) => s + (parseFloat(r.fabricIssuedQty) || 0), 0), 0);
  const totalConsumedAll = subComponents.reduce((sum, sc) =>
    sum + sc.rolls.reduce((s, r) => s + (parseFloat(r.fabricConsumedQty) || 0), 0), 0);

  // ── Real-time Quantity Validation ──────────────────────────────────────────
  // Returns a map of error keys → error message strings.
  // Keys: `roll-${scId}-${rollId}-issued`, `roll-${scId}-${rollId}-consumed`,
  //       `sc-${scId}-rejections`, `emb-${stockId}`
  const quantityValidationErrors = React.useMemo(() => {
    const errors: Record<string, string> = {};

    subComponents.forEach((sc) => {
      const scTotal = sc.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0);
      const scRej = parseInt(sc.rejections) || 0;
      const compName = sc.component === 'Other' ? (sc.customComponent || 'Component') : sc.component;

      // Rejection cannot exceed total pieces cut for this sub-component
      if (scRej > scTotal && scTotal > 0) {
        errors[`sc-${sc.id}-rejections`] =
          `Rejections (${scRej}) cannot exceed total pieces cut (${scTotal}) for ${compName}.`;
      }

      sc.rolls.forEach((roll) => {
        const issuedNum = parseFloat(roll.fabricIssuedQty) || 0;
        const consumedNum = parseFloat(roll.fabricConsumedQty) || 0;

        // Issued qty cannot exceed available roll stock
        if (roll.fabricRollId && issuedNum > 0) {
          const rollItem = fabricItems.find((r) => r.id === roll.fabricRollId);
          if (rollItem && issuedNum > rollItem.stockQty) {
            errors[`roll-${sc.id}-${roll.id}-issued`] =
              `Issued qty (${issuedNum.toFixed(2)}) exceeds available stock (${rollItem.stockQty.toFixed(2)} ${rollItem.unit}) for ${compName}.`;
          }
        }

        // Consumed qty cannot exceed issued qty
        if (consumedNum > 0 && issuedNum > 0 && consumedNum > issuedNum) {
          errors[`roll-${sc.id}-${roll.id}-consumed`] =
            `Consumed qty (${consumedNum.toFixed(2)}) cannot exceed issued qty (${issuedNum.toFixed(2)}) for ${compName}.`;
        }
      });
    });

    // Emb pieces used cannot exceed available pieces
    selectedEmbItems.forEach((sel) => {
      const used = parseInt(sel.piecesUsed) || 0;
      if (used > sel.stockItem.availablePieces) {
        errors[`emb-${sel.stockItem.id}`] =
          `Pieces used (${used}) for "${sel.stockItem.component}" cannot exceed available (${sel.stockItem.availablePieces}).`;
      }
      if (used <= 0) {
        errors[`emb-${sel.stockItem.id}-zero`] =
          `Pieces to use for "${sel.stockItem.component}" must be greater than 0.`;
      }
    });

    return errors;
  }, [subComponents, selectedEmbItems, fabricItems]);

  const hasValidationErrors = Object.keys(quantityValidationErrors).length > 0;
  // ──────────────────────────────────────────────────────────────────────────

  const totalFabricIssued = entries.reduce((s, e) => s + e.fabricIssuedQty, 0);
  const totalPiecesCut = entries.reduce((s, e) => s + e.totalPiecesCut, 0);
  const totalRejections = entries.reduce((s, e) => s + e.cuttingRejections, 0);
  const totalForStitching = entries.reduce((s, e) => s + e.netPiecesForStitching, 0);

  // Filtered entries for table display
  const filteredEntries = entrySearch
    ? entries.filter((e) =>
        e.entryNo.toLowerCase().includes(entrySearch.toLowerCase()) ||
        e.styleName.toLowerCase().includes(entrySearch.toLowerCase()) ||
        (e.jobCardRef || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
        e.cuttingMaster.toLowerCase().includes(entrySearch.toLowerCase())
      )
    : entries;

  const isPendingFilter = searchParams.get('filter') === 'pending';

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sub-component helpers
  const addSubComponent = () => setSubComponents((prev) => [...prev, makeDefaultSubComponent()]);
  const removeSubComponent = (id: string) => setSubComponents((prev) => prev.filter((sc) => sc.id !== id));

  const updateSubComponent = (id: string, field: keyof SubComponentRow, value: string) => {
    setSubComponents((prev) => prev.map((sc) => sc.id === id ? { ...sc, [field]: value } : sc));
  };

  const addSizeRow = (scId: string) => {
    setSubComponents((prev) => prev.map((sc) =>
      sc.id === scId ? { ...sc, sizes: [...sc.sizes, { size: 'M', qty: '' }] } : sc
    ));
  };

  const removeSizeRow = (scId: string, idx: number) => {
    setSubComponents((prev) => prev.map((sc) =>
      sc.id === scId ? { ...sc, sizes: sc.sizes.filter((_, i) => i !== idx) } : sc
    ));
  };

  const updateSizeRow = (scId: string, idx: number, field: 'size' | 'qty', value: string) => {
    setSubComponents((prev) => prev.map((sc) =>
      sc.id === scId
        ? { ...sc, sizes: sc.sizes.map((sz, i) => i === idx ? { ...sz, [field]: value } : sz) }
        : sc
    ));
  };

  // Roll helpers (per sub-component)
  const addRoll = (scId: string) => {
    setSubComponents((prev) => prev.map((sc) =>
      sc.id === scId ? { ...sc, rolls: [...sc.rolls, makeDefaultRoll()] } : sc
    ));
  };

  const removeRoll = (scId: string, rollId: string) => {
    setSubComponents((prev) => prev.map((sc) =>
      sc.id === scId ? { ...sc, rolls: sc.rolls.filter((r) => r.id !== rollId) } : sc
    ));
  };

  const updateRoll = (scId: string, rollId: string, field: keyof RollRow, value: string) => {
    setSubComponents((prev) => prev.map((sc) =>
      sc.id === scId
        ? { ...sc, rolls: sc.rolls.map((r) => r.id === rollId ? { ...r, [field]: value } : r) }
        : sc
    ));
  };

  // Emb-received item selection helpers
  const toggleEmbItem = (stockItem: CuttingStockItem) => {
    setSelectedEmbItems((prev) => {
      const exists = prev.find((s) => s.stockItem.id === stockItem.id);
      if (exists) {
        return prev.filter((s) => s.stockItem.id !== stockItem.id);
      }
      // Default to full available quantity when selecting
      return [...prev, { stockItem, piecesUsed: String(stockItem.availablePieces) }];
    });
  };

  const updateEmbItemPieces = (stockId: string, value: string) => {
    setSelectedEmbItems((prev) =>
      prev.map((s) => {
        if (s.stockItem.id !== stockId) return s;
        // Allow any non-negative integer; validation will flag if it exceeds available
        const num = parseInt(value) || 0;
        const clamped = Math.max(0, num);
        return { ...s, piecesUsed: String(clamped) };
      })
    );
  };

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', styleNo: '', cuttingMaster: '', rejectionReason: '', remarks: '', cuttingPrice: '' });
    setSubComponents([makeDefaultSubComponent()]);
    setSaveError(null);
    setEditingEntry(null);
    setEmbPendingItems([]);
    setSelectedEmbItems([]);
    setEmbFlowSummary([]);
  };

  // Populate form for editing
  const handleEditEntry = (entry: CuttingEntry) => {
    setEditingEntry(entry);
    setForm({
      date: entry.date,
      jobCardRef: entry.jobCardRef || '',
      styleName: entry.styleName,
      styleNo: '',
      cuttingMaster: entry.cuttingMaster,
      rejectionReason: entry.rejectionReason || '',
      remarks: entry.remarks || '',
      cuttingPrice: entry.cuttingPrice != null ? String(entry.cuttingPrice) : '',
    });

    // Populate sub-components — each gets its own fabric/unit/rolls from saved data
    const scs: SubComponentRow[] = entry.subComponentDetails.map((sc) => {
      // Try to reconstruct rolls from rollDetails (legacy: all rolls at entry level)
      // For new entries, rolls are stored per sub-component via fabricName match
      const scRolls: RollRow[] = (entry.rollDetails && entry.rollDetails.length > 0)
        ? entry.rollDetails.map((rd, idx) => ({
            id: `roll-edit-${idx}-${Date.now()}-${Math.random()}`,
            fabricRollId: rd.fabricRollId || '',
            rollNo: rd.rollNo || '',
            fabricIssuedQty: String(rd.fabricIssuedQty),
            fabricConsumedQty: String(rd.fabricConsumedQty),
            wastageQty: String(rd.wastageQty || ''),
          }))
        : [{
            id: `roll-edit-${Date.now()}-${Math.random()}`,
            fabricRollId: '',
            rollNo: '',
            fabricIssuedQty: String(entry.fabricIssuedQty),
            fabricConsumedQty: String(entry.fabricConsumedQty),
            wastageQty: String(entry.wastageQty || ''),
          }];

      return {
        id: `sc-edit-${sc.component}-${Date.now()}-${Math.random()}`,
        component: SUB_COMPONENT_OPTIONS.includes(sc.component) ? sc.component : 'Other',
        customComponent: SUB_COMPONENT_OPTIONS.includes(sc.component) ? '' : sc.component,
        fabricName: sc.fabricName || entry.fabricName || '',
        unit: entry.unit || 'Metres',
        rolls: scRolls,
        sizes: sc.sizes.map((sz) => ({ size: sz.size, qty: String(sz.qty) })),
        rejections: String(sc.rejections || ''),
      };
    });
    setSubComponents(scs.length > 0 ? scs : [makeDefaultSubComponent()]);

    // Restore selected emb items from saved entry
    if (entry.embReceiveItems && entry.embReceiveItems.length > 0) {
      // We'll re-fetch all items for the job card and pre-select saved ones
      if (entry.jobCardRef) {
        cuttingService.getEmbReceiveAllByJobCard(entry.jobCardRef).then((items) => {
          setEmbPendingItems(items);
          // Pre-select items that were previously saved
          const preSelected: SelectedEmbItem[] = (entry.embReceiveItems || []).map((saved) => {
            const stockItem = items.find((i) => i.id === saved.cuttingStockId);
            if (stockItem) {
              return { stockItem, piecesUsed: String(saved.piecesUsed) };
            }
            // If stock item no longer in available list (fully used), create a placeholder
            return {
              stockItem: {
                id: saved.cuttingStockId,
                component: saved.component,
                receiveVoucherNo: saved.receiveVoucherNo,
                issueVoucherNo: saved.issueVoucherNo,
                availablePieces: 0,
                totalPieces: saved.piecesUsed,
                issuedPieces: saved.piecesUsed,
                unit: saved.unit,
                jobCardRef: entry.jobCardRef,
                styleName: entry.styleName,
                partyName: '',
                status: 'fully_issued' as const,
              },
              piecesUsed: String(saved.piecesUsed),
            };
          });
          setSelectedEmbItems(preSelected);
        }).catch(() => {});
      }
    } else {
      setEmbPendingItems([]);
      setSelectedEmbItems([]);
      setEmbFlowSummary([]);
      if (entry.jobCardRef) {
        loadEmbPending(entry.jobCardRef);
      }
    }

    setSaveError(null);
    setShowModal(true);
    refreshJobCards();
  };

  // Delete handlers
  const handleDeleteClick = (entry: CuttingEntry) => {
    setDeleteTarget(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await cuttingService.delete(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setSuccessMsg(`Entry ${deleteTarget.entryNo} deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setSuccessMsg('Failed to delete entry. Please try again.');
      setTimeout(() => setSuccessMsg(null), 4000);
    }
    setDeleteTarget(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    // Required field validation (matches QC/Finishing pattern)
    if (!form.date) { setSaveError('Date is required.'); return; }
    if (!form.jobCardRef) { setSaveError('Job Card is required.'); return; }
    if (subComponents.some((sc) => {
      const name = sc.component === 'Other' ? sc.customComponent.trim() : sc.component.trim();
      return !name;
    })) {
      setSaveError('All sub-components must have a component name.');
      return;
    }

    // Block save if any real-time quantity validation errors exist
    if (hasValidationErrors) {
      const firstError = Object.values(quantityValidationErrors)[0];
      setSaveError(firstError || 'Please fix all quantity validation errors before saving.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    // Aggregate fabric totals across all sub-components
    const issued = subComponents.reduce((sum, sc) =>
      sum + sc.rolls.reduce((s, r) => s + (parseFloat(r.fabricIssuedQty) || 0), 0), 0);
    const consumed = subComponents.reduce((sum, sc) =>
      sum + sc.rolls.reduce((s, r) => s + (parseFloat(r.fabricConsumedQty) || 0), 0), 0);
    const leftover = issued - consumed;
    const wastage = subComponents.reduce((sum, sc) =>
      sum + sc.rolls.reduce((s, r) => s + (parseFloat(r.wastageQty) || 0), 0), 0);

    // Use first sub-component's fabric/unit as entry-level defaults for legacy compatibility
    const firstSc = subComponents[0];
    const entryFabricName = firstSc?.fabricName || '';
    const entryUnit = firstSc?.unit || 'Metres';

    const builtSubComponents: SubComponentCutDetail[] = subComponents.map((sc) => {
      const componentName = sc.component === 'Other' ? (sc.customComponent || 'Other') : sc.component;
      const sizes: SubComponentSizeDetail[] = sc.sizes.map((sz) => ({ size: sz.size, qty: parseInt(sz.qty) || 0 }));
      const total = sizes.reduce((s, sz) => s + sz.qty, 0);
      const rej = parseInt(sc.rejections) || 0;
      return {
        component: componentName,
        fabricName: sc.fabricName || undefined,
        sizes,
        totalPieces: total,
        rejections: rej,
        netPieces: total - rej,
      };
    });

    // Flatten all rolls across sub-components for rollDetails storage
    const builtRollDetails: RollDetail[] = subComponents.flatMap((sc) =>
      sc.rolls.map((r, idx) => ({
        rollNo: r.rollNo || `Roll ${idx + 1}`,
        fabricRollId: r.fabricRollId || '',
        fabricIssuedQty: parseFloat(r.fabricIssuedQty) || 0,
        fabricConsumedQty: parseFloat(r.fabricConsumedQty) || 0,
        wastageQty: parseFloat(r.wastageQty) || 0,
      }))
    );

    // Build emb receive items from selected items
    const builtEmbReceiveItems: EmbReceiveItem[] = selectedEmbItems
      .filter((s) => (parseInt(s.piecesUsed) || 0) > 0)
      .map((s) => ({
        cuttingStockId: s.stockItem.id,
        receiveVoucherNo: s.stockItem.receiveVoucherNo || '',
        issueVoucherNo: s.stockItem.issueVoucherNo || '',
        component: s.stockItem.component,
        piecesUsed: parseInt(s.piecesUsed) || 0,
        unit: s.stockItem.unit,
      }));

    if (editingEntry) {
      const updatedEntry: Omit<CuttingEntry, 'id'> = {
        entryNo: editingEntry.entryNo,
        date: form.date,
        jobCardRef: form.jobCardRef,
        styleName: form.styleName,
        cuttingMaster: form.cuttingMaster,
        fabricName: entryFabricName,
        fabricIssuedQty: issued,
        fabricConsumedQty: consumed,
        fabricLeftover: leftover,
        unit: entryUnit,
        totalPiecesCut: totalPiecesCutDerived,
        wastageQty: wastage,
        cuttingRejections: totalRejectionsDerived,
        rejectionReason: form.rejectionReason || undefined,
        netPiecesForStitching: netPiecesDerived,
        subComponentDetails: builtSubComponents,
        rollDetails: builtRollDetails,
        status: editingEntry.status,
        remarks: form.remarks || undefined,
        cuttingPrice: parseFloat(form.cuttingPrice) || undefined,
        embReceiveItems: builtEmbReceiveItems,
      };

      const saved = await cuttingService.update(editingEntry.id, updatedEntry);
      if (!saved) {
        setSaveError('Failed to update cutting entry. Please try again.');
        setSaving(false);
        return;
      }
      setEntries((prev) => prev.map((e) => e.id === editingEntry.id ? saved : e));
      setShowModal(false);
      resetForm();
      setSaving(false);
      setSuccessMsg(`Entry ${saved.entryNo} updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      const entryCount = entries.length + 1;
      const newEntry: Omit<CuttingEntry, 'id'> = {
        entryNo: `CUT-${String(entryCount).padStart(4, '0')}`,
        date: form.date,
        jobCardRef: form.jobCardRef,
        styleName: form.styleName,
        cuttingMaster: form.cuttingMaster,
        fabricName: entryFabricName,
        fabricIssuedQty: issued,
        fabricConsumedQty: consumed,
        fabricLeftover: leftover,
        unit: entryUnit,
        totalPiecesCut: totalPiecesCutDerived,
        wastageQty: wastage,
        cuttingRejections: totalRejectionsDerived,
        rejectionReason: form.rejectionReason || undefined,
        netPiecesForStitching: netPiecesDerived,
        subComponentDetails: builtSubComponents,
        rollDetails: builtRollDetails,
        status: 'completed',
        remarks: form.remarks || undefined,
        cuttingPrice: parseFloat(form.cuttingPrice) || undefined,
        embReceiveItems: builtEmbReceiveItems,
      };

      const saved = await cuttingService.create(newEntry);
      if (!saved) {
        setSaveError('Failed to save cutting entry. Please try again.');
        setSaving(false);
        return;
      }
      setEntries((prev) => [saved, ...prev]);
      setShowModal(false);
      resetForm();
      setSaving(false);
      setSuccessMsg(`Cutting entry ${saved.entryNo} saved successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleJobCardChange = (val: string) => {
    if (val === '__create_new__') { router.push('/job-card-management'); return; }
    if (!val) {
      setForm({ ...form, jobCardRef: '', styleNo: '' });
      setEmbPendingItems([]);
      setSelectedEmbItems([]);
      setEmbFlowSummary([]);
      return;
    }
    const jc = jobCards.find((j) => j.jobCardRef === val);
    setForm({ ...form, jobCardRef: val, styleName: jc?.styleEn || form.styleName, styleNo: jc?.designCode || '' });
    if (jc?.sizes && jc.sizes.length > 0) {
      const sizeList = jc.sizes;
      const newSubComponents: SubComponentRow[] = [{
        id: `sc-jc-${Date.now()}`,
        component: 'Kurta',
        customComponent: '',
        fabricName: '',
        unit: 'Metres',
        rolls: [makeDefaultRoll()],
        sizes: sizeList.map((s) => ({ size: s, qty: jc.sizeRatios?.[s] != null ? String(jc.sizeRatios[s]) : '' })),
        rejections: '',
      }];
      setSubComponents(newSubComponents);
    }
    // Load embroidery-received pending materials for this job card
    loadEmbPending(val);
  };

  const handleOpenModal = () => {
    refreshJobCards();
    setSaveError(null);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Success Toast */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-success text-white px-4 py-3 rounded-xl shadow-lg text-sm font-600 animate-fade-in">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Cutting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sub-component &amp; size-wise cutting — pieces cut per component tracked for downstream workflow</p>
        </div>
        <button onClick={handleOpenModal} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New Cutting Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Fabric Issued</p>
          <p className="text-2xl font-700 text-primary mt-1">{totalFabricIssued.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">Metres total</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Pieces Cut</p>
          <p className="text-2xl font-700 text-foreground mt-1">{totalPiecesCut.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Cutting Rejections</p>
          <p className="text-2xl font-700 text-danger mt-1">{totalRejections.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces rejected</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">For Stitching</p>
          <p className="text-2xl font-700 text-success mt-1">{totalForStitching.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Net pieces</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
          <Scissors size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Cutting Entries</span>
          {isPendingFilter && (
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
            <span className="text-xs text-muted-foreground">{filteredEntries.length} records</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Cutting Master</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Components</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Fabric Issued</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Consumed</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Leftover</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pieces Cut</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Rejections</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">For Stitching</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Cutting Price</th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading cutting entries...</p>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-muted-foreground">
                    <Scissors size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No cutting entries yet</p>
                    <p className="text-xs mt-1">Add cutting records with sub-component and size-wise details</p>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-muted-foreground">
                    <Search size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-500">No entries match your search</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3">
                        {entry.subComponentDetails.length > 0 && (
                          <button onClick={() => toggleRow(entry.id)} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                            {expandedRows.has(entry.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 font-600 text-primary text-xs">
                        {entry.entryNo}
                        {entry.embReceiveItems && entry.embReceiveItems.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-600">
                            <Package size={9} />
                            EMB
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                      <td className="px-4 py-3">
                        <Link href={`/item-master?search=${encodeURIComponent(entry.styleName)}`} className="text-primary hover:underline font-500 text-sm">{entry.styleName}</Link>
                        {entry.jobCardRef && <div className="text-xs text-muted-foreground">JC: {entry.jobCardRef}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <Link href={`/account-master?search=${encodeURIComponent(entry.cuttingMaster)}`} className="text-primary hover:underline font-500 text-sm">{entry.cuttingMaster}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {entry.subComponentDetails.map((sc) => (
                            <span key={sc.component} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-500">{sc.component}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.fabricIssuedQty.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.fabricConsumedQty.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-warning">{entry.fabricLeftover.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-600 text-foreground">{entry.totalPiecesCut.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{entry.cuttingRejections}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{entry.netPiecesForStitching.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{entry.cuttingPrice != null ? `₹${entry.cuttingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                            title="Edit entry"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(entry)}
                            className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded sub-component detail */}
                    {expandedRows.has(entry.id) && entry.subComponentDetails.length > 0 && (
                      <tr className="border-b border-border/50 bg-muted/10">
                        <td colSpan={14} className="px-6 py-3">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide">Sub-Component Breakdown</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {entry.subComponentDetails.map((sc) => (
                                  <div key={sc.component} className="bg-card border border-border rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-700 text-foreground">{sc.component}</span>
                                      <span className="text-xs text-success font-600">Net: {sc.netPieces} pcs</span>
                                    </div>
                                    {sc.fabricName && (
                                      <p className="text-xs text-muted-foreground mb-2">Fabric: <span className="font-600 text-foreground">{sc.fabricName}</span></p>
                                    )}
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                      {sc.sizes.map((sz) => (
                                        <div key={sz.size} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5">
                                          <span className="text-xs font-600 text-muted-foreground">{sz.size}:</span>
                                          <span className="text-xs font-700 text-foreground">{sz.qty}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      <span>Total: <span className="font-600 text-foreground">{sc.totalPieces}</span></span>
                                      {sc.rejections > 0 && <span className="text-danger">Rej: <span className="font-600">{sc.rejections}</span></span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Emb Receive Items traceability */}
                            {entry.embReceiveItems && entry.embReceiveItems.length > 0 && (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs font-700 text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                                  <Package size={12} />
                                  Embroidery-Received Materials Used
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {entry.embReceiveItems.map((item, idx) => (
                                    <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
                                      <div>
                                        <p className="text-xs font-700 text-amber-800">{item.component}</p>
                                        <p className="text-[11px] text-amber-600 mt-0.5">
                                          Receive: {item.receiveVoucherNo || '—'} · Issue: {item.issueVoucherNo || '—'}
                                        </p>
                                      </div>
                                      <span className="text-sm font-700 text-amber-800">{item.piecesUsed} {item.unit}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-danger" />
              </div>
              <div>
                <h3 className="text-base font-700 text-foreground">Delete Entry</h3>
                <p className="text-sm text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground">
              Are you sure you want to delete cutting entry <span className="font-700 text-primary">{deleteTarget.entryNo}</span>
              {deleteTarget.styleName && <> for <span className="font-600">{deleteTarget.styleName}</span></>}?
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-600 hover:bg-danger/90 transition-colors disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-base font-700 text-foreground">
                {editingEntry ? `Edit Entry — ${editingEntry.entryNo}` : 'New Cutting Entry'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

              {/* Save Error */}
              {saveError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm font-500">
                  {saveError}
                </div>
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
                    <option value="__create_new__" className="text-primary font-600">+ Create New Job Card</option>
                    {jobCards.map((jc) => (
                      <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Job Card Info Panel */}
              {form.jobCardRef && form.jobCardRef !== '__create_new__' && (() => {
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
                    {jc.dueDate && <div><span className="text-muted-foreground font-600">Due Date:</span> <span className="text-foreground ml-1">{jc.dueDate}</span></div>}
                  </div>
                );
              })()}

              {/* ── Embroidery Flow Summary ── */}
              {form.jobCardRef && form.jobCardRef !== '__create_new__' && embFlowSummary.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-blue-600" />
                    <p className="text-xs font-700 text-blue-700">Embroidery Flow Summary — {form.jobCardRef}</p>
                    {loadingEmbSummary && <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin ml-1" />}
                  </div>
                  <div className="border border-blue-200 rounded-xl overflow-hidden">
                    <div className="bg-blue-50 px-3 py-1.5 border-b border-blue-200">
                      <div className="grid grid-cols-5 gap-2 text-[10px] font-700 text-blue-600 uppercase tracking-wide">
                        <span>Component</span>
                        <span className="text-right">Emb Issued</span>
                        <span className="text-right">Emb Received</span>
                        <span className="text-right">Issued to Cutting</span>
                        <span className="text-right">Pending for Cutting</span>
                      </div>
                    </div>
                    <div className="divide-y divide-blue-100">
                      {embFlowSummary.map((row) => (
                        <div key={row.component} className="grid grid-cols-5 gap-2 px-3 py-2 text-xs">
                          <span className="font-600 text-foreground">{row.component}</span>
                          <span className="text-right tabular-nums text-muted-foreground">{row.embIssued} {row.unit}</span>
                          <span className="text-right tabular-nums text-foreground font-600">{row.embReceived} {row.unit}</span>
                          <span className="text-right tabular-nums text-warning font-600">{row.issuedToCutting} {row.unit}</span>
                          <span className={`text-right tabular-nums font-700 ${row.pendingForCutting > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                            {row.pendingForCutting} {row.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                    {embFlowSummary.length > 0 && (
                      <div className="bg-blue-50 border-t border-blue-200 px-3 py-1.5 grid grid-cols-5 gap-2 text-xs font-700">
                        <span className="text-blue-700">Total</span>
                        <span className="text-right tabular-nums text-muted-foreground">{embFlowSummary.reduce((s, r) => s + r.embIssued, 0)}</span>
                        <span className="text-right tabular-nums text-foreground">{embFlowSummary.reduce((s, r) => s + r.embReceived, 0)}</span>
                        <span className="text-right tabular-nums text-warning">{embFlowSummary.reduce((s, r) => s + r.issuedToCutting, 0)}</span>
                        <span className="text-right tabular-nums text-success">{embFlowSummary.reduce((s, r) => s + r.pendingForCutting, 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Embroidery-Received Materials ── */}
              {form.jobCardRef && form.jobCardRef !== '__create_new__' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-amber-600" />
                    <p className="text-xs font-700 text-amber-700">Embroidery-Received Materials</p>
                    {loadingEmbPending && (
                      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin ml-1" />
                    )}
                  </div>

                  {!loadingEmbPending && embPendingItems.length === 0 && (
                    <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground">
                      <AlertCircle size={13} />
                      No embroidery-received materials found for this Job Card.
                    </div>
                  )}

                  {!loadingEmbPending && embPendingItems.length > 0 && (
                    <div className="border border-amber-200 rounded-xl overflow-hidden">
                      <div className="bg-amber-50 px-3 py-2 border-b border-amber-200 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-amber-700 font-600">
                          Select embroidery-received items to include in this cutting issue. Checkbox auto-fills full available quantity.
                        </p>
                        {embPendingItems.some((i) => i.availablePieces > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              const available = embPendingItems.filter((i) => i.availablePieces > 0);
                              setSelectedEmbItems(available.map((item) => ({
                                stockItem: item,
                                piecesUsed: String(item.availablePieces),
                              })));
                            }}
                            className="text-[10px] px-2 py-1 bg-amber-600 text-white rounded font-600 whitespace-nowrap hover:bg-amber-700 transition-colors flex-shrink-0"
                          >
                            Select All
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-amber-100">
                        {embPendingItems.map((item) => {
                          const sel = selectedEmbItems.find((s) => s.stockItem.id === item.id);
                          const isSelected = !!sel;
                          const isFullyIssued = item.status === 'fully_issued' || item.availablePieces === 0;
                          const usedPiecesNum = parseInt(sel?.piecesUsed || '0') || 0;
                          const isUsingAll = isSelected && usedPiecesNum === item.availablePieces;
                          return (
                            <div key={item.id} className={`px-3 py-2.5 flex items-center gap-3 transition-colors ${isSelected ? 'bg-amber-50' : isFullyIssued ? 'bg-muted/20' : 'bg-white hover:bg-amber-50/50'}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => !isFullyIssued && toggleEmbItem(item)}
                                disabled={isFullyIssued}
                                className="w-4 h-4 rounded border-amber-400 text-amber-600 cursor-pointer flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-700 ${isFullyIssued ? 'text-muted-foreground' : 'text-foreground'}`}>{item.component}</span>
                                  {item.receiveVoucherNo && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-600">
                                      RV: {item.receiveVoucherNo}
                                    </span>
                                  )}
                                  {item.issueVoucherNo && (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-600">
                                      IV: {item.issueVoucherNo}
                                    </span>
                                  )}
                                  {isFullyIssued ? (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-600">
                                      Fully Used
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-600">
                                      Available: {item.availablePieces}/{item.totalPieces} {item.unit}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Total received: <span className="font-700 text-foreground">{item.totalPieces} {item.unit}</span>
                                  {' · '}Balance: <span className={`font-700 ${isFullyIssued ? 'text-muted-foreground' : 'text-success'}`}>{item.availablePieces} {item.unit}</span>
                                  {item.description && <span className="ml-2 text-muted-foreground">{item.description}</span>}
                                </p>
                              </div>
                              {isSelected && !isFullyIssued && (
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] text-amber-700 font-600 whitespace-nowrap">Issue Qty:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={item.availablePieces}
                                      value={sel.piecesUsed}
                                      onChange={(e) => updateEmbItemPieces(item.id, e.target.value)}
                                      className={`w-24 input-field text-xs text-center py-1 ${
                                        quantityValidationErrors[`emb-${item.id}`] || quantityValidationErrors[`emb-${item.id}-zero`]
                                          ? 'border-danger ring-1 ring-danger' :'border-amber-300 focus:border-amber-500'
                                      }`}
                                      placeholder="0"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateEmbItemPieces(item.id, String(item.availablePieces))}
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-600 whitespace-nowrap transition-colors ${isUsingAll ? 'bg-success text-white' : 'bg-success/10 text-success hover:bg-success/20'}`}
                                      title={`Use all ${item.availablePieces} pieces`}
                                    >
                                      Use All
                                    </button>
                                    <span className="text-[11px] text-muted-foreground">{item.unit}</span>
                                  </div>
                                  {(quantityValidationErrors[`emb-${item.id}`] || quantityValidationErrors[`emb-${item.id}-zero`]) && (
                                    <p className="text-xs text-danger font-500 flex items-center gap-1">
                                      <AlertCircle size={11} className="flex-shrink-0" />
                                      {quantityValidationErrors[`emb-${item.id}`] || quantityValidationErrors[`emb-${item.id}-zero`]}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {selectedEmbItems.length > 0 && (
                        <div className="bg-amber-50 border-t border-amber-200 px-3 py-2 flex items-center gap-2">
                          <CheckCircle size={12} className="text-amber-600" />
                          <p className="text-[11px] text-amber-700 font-600">
                            {selectedEmbItems.length} item{selectedEmbItems.length > 1 ? 's' : ''} selected —{' '}
                            {selectedEmbItems.reduce((s, i) => s + (parseInt(i.piecesUsed) || 0), 0)} total pieces will be issued for cutting
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Style Name *</label>
                <select required value={form.styleName} onChange={(e) => { if (e.target.value === '__create_new__') { router.push('/job-card-management'); } else { setForm({ ...form, styleName: e.target.value }); } }} className="input-field text-sm">
                  <option value="">-- Select Style --</option>
                  <option value="__create_new__" className="text-primary font-600">+ Create New Style (via Job Card)</option>
                  {styleNamesFromJC.map((sn) => (
                    <option key={sn} value={sn}>{sn}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Style Number</label>
                <input
                  type="text"
                  readOnly
                  value={form.styleNo}
                  placeholder="Auto-filled from Job Card"
                  className="input-field text-sm bg-muted/50 cursor-not-allowed text-muted-foreground"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Cutting Master *</label>
                {form.cuttingMaster === '__create_new__' ? (
                  <div className="flex gap-1.5">
                    <input autoFocus type="text" placeholder="Enter new cutting master name" value={customCuttingMaster} onChange={(e) => setCustomCuttingMaster(e.target.value)} className="input-field text-sm flex-1" />
                    <button type="button" onClick={async () => { if (customCuttingMaster.trim()) { const n = customCuttingMaster.trim(); const saved = await cuttingMasterService.create(n); if (saved && !cuttingMasters.includes(n)) { setCuttingMasters((p) => [...p, n].sort()); } setForm({ ...form, cuttingMaster: n }); setCustomCuttingMaster(''); } }} className="px-2 py-1 bg-primary text-white rounded-lg text-xs font-600">Add</button>
                    <button type="button" onClick={() => { setForm({ ...form, cuttingMaster: '' }); setCustomCuttingMaster(''); }} className="px-2 py-1 bg-muted text-muted-foreground rounded-lg text-xs">✕</button>
                  </div>
                ) : (
                  <select required value={form.cuttingMaster} onChange={(e) => setForm({ ...form, cuttingMaster: e.target.value })} className="input-field text-sm">
                    <option value="">-- Select Master --</option>
                    <option value="__create_new__" className="text-primary font-600">+ Create New Cutting Master</option>
                    {cuttingMasters.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>

              {/* Sub-Component Section — each has its own Fabric, Unit, and Rolls */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-700 text-foreground">Sub-Component &amp; Size-wise Cutting *</p>
                  <button type="button" onClick={addSubComponent} className="flex items-center gap-1 text-xs text-primary font-600 hover:underline">
                    <Plus size={12} /> Add Component
                  </button>
                </div>

                {subComponents.map((sc, scIdx) => {
                  const scTotal = sc.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0);
                  const scRej = parseInt(sc.rejections) || 0;
                  const fabricOptions = Array.from(new Set(fabricItems.map((f) => f.fabricName))).sort();
                  const rollsForFabric = sc.fabricName
                    ? fabricItems.filter((f) => f.fabricName === sc.fabricName)
                    : [];
                  const scIssuedTotal = sc.rolls.reduce((s, r) => s + (parseFloat(r.fabricIssuedQty) || 0), 0);
                  const scConsumedTotal = sc.rolls.reduce((s, r) => s + (parseFloat(r.fabricConsumedQty) || 0), 0);

                  return (
                    <div key={sc.id} className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-muted/20">
                      {/* Component header */}
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs font-600 text-muted-foreground">Component Name</label>
                          {sc.component === 'Other' ? (
                            <div className="flex gap-2">
                              <select value={sc.component} onChange={(e) => updateSubComponent(sc.id, 'component', e.target.value)} className="input-field text-sm w-32">
                                {SUB_COMPONENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                              <input type="text" placeholder="Custom name" value={sc.customComponent} onChange={(e) => updateSubComponent(sc.id, 'customComponent', e.target.value)} className="input-field text-sm flex-1" />
                            </div>
                          ) : (
                            <select value={sc.component} onChange={(e) => updateSubComponent(sc.id, 'component', e.target.value)} className="input-field text-sm">
                              {SUB_COMPONENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 w-28">
                          <label className="text-xs font-600 text-muted-foreground">Rejections</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={sc.rejections}
                            onChange={(e) => updateSubComponent(sc.id, 'rejections', e.target.value)}
                            className={`input-field text-sm ${quantityValidationErrors[`sc-${sc.id}-rejections`] ? 'border-danger ring-1 ring-danger' : ''}`}
                          />
                          {quantityValidationErrors[`sc-${sc.id}-rejections`] && (
                            <p className="text-xs text-danger font-500 flex items-center gap-1 mt-0.5">
                              <AlertCircle size={11} className="flex-shrink-0" />
                              {quantityValidationErrors[`sc-${sc.id}-rejections`]}
                            </p>
                          )}
                        </div>
                        {subComponents.length > 1 && (
                          <button type="button" onClick={() => removeSubComponent(sc.id)} className="mt-5 p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Fabric Name & Unit for this component */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-600 text-muted-foreground">Fabric Name *</label>
                          <select
                            value={sc.fabricName}
                            onChange={(e) => updateSubComponent(sc.id, 'fabricName', e.target.value)}
                            className="input-field text-sm"
                          >
                            <option value="">-- Select Fabric --</option>
                            {fabricOptions.map((name) => {
                              const totalQty = fabricItems.filter((f) => f.fabricName === name).reduce((s, f) => s + f.stockQty, 0);
                              const unit = fabricItems.find((f) => f.fabricName === name)?.unit || '';
                              return (
                                <option key={name} value={name}>
                                  {name} — {totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {unit} available
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-600 text-muted-foreground">Unit</label>
                          <select
                            value={sc.unit}
                            onChange={(e) => updateSubComponent(sc.id, 'unit', e.target.value)}
                            className="input-field text-sm"
                          >
                            <option>Metres</option>
                            <option>Kg</option>
                            <option>Yards</option>
                          </select>
                        </div>
                      </div>

                      {/* Rolls for this component */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-600 text-muted-foreground">Rolls</p>
                          <button
                            type="button"
                            onClick={() => addRoll(sc.id)}
                            className="flex items-center gap-1 text-xs text-primary font-600 hover:underline"
                          >
                            <Plus size={11} /> Add Roll
                          </button>
                        </div>

                        {sc.rolls.map((roll, rollIdx) => {
                          const selectedInOtherRows = sc.rolls
                            .filter((r) => r.id !== roll.id && r.fabricRollId)
                            .map((r) => r.fabricRollId);
                          const availableRolls = rollsForFabric.filter((r) => !selectedInOtherRows.includes(r.id));
                          const selectedRollItem = rollsForFabric.find((r) => r.id === roll.fabricRollId);
                          const issuedNum = parseFloat(roll.fabricIssuedQty) || 0;
                          const consumedNum = parseFloat(roll.fabricConsumedQty) || 0;
                          const leftoverPreview = issuedNum > 0 && consumedNum > 0 ? issuedNum - consumedNum : 0;

                          return (
                            <div key={roll.id} className="border border-border/60 rounded-lg p-3 flex flex-col gap-2 bg-card">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-600 text-muted-foreground">Roll {rollIdx + 1}</span>
                                {sc.rolls.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeRoll(sc.id, roll.id)}
                                    className="p-1 rounded-lg hover:bg-danger/10 text-danger"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>

                              {rollsForFabric.length > 0 && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-600 text-muted-foreground">Roll / Lot from Inventory</label>
                                  <select
                                    value={roll.fabricRollId}
                                    onChange={(e) => {
                                      const item = rollsForFabric.find((r) => r.id === e.target.value);
                                      updateRoll(sc.id, roll.id, 'fabricRollId', e.target.value);
                                      if (item) {
                                        updateSubComponent(sc.id, 'unit', item.unit || sc.unit);
                                      }
                                    }}
                                    className="input-field text-sm"
                                  >
                                    <option value="">-- Select Roll / Lot --</option>
                                    {availableRolls.map((r, idx) => (
                                      <option key={r.id} value={r.id}>
                                        Roll {idx + 1} — {r.stockQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {r.unit} available
                                      </option>
                                    ))}
                                  </select>
                                  {selectedRollItem && (
                                    <p className="text-xs text-muted-foreground">
                                      Available: <span className="font-600 text-foreground">{selectedRollItem.stockQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {selectedRollItem.unit}</span>
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-600 text-muted-foreground">Issued Qty *</label>
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={roll.fabricIssuedQty}
                                    onChange={(e) => updateRoll(sc.id, roll.id, 'fabricIssuedQty', e.target.value)}
                                    className={`input-field text-sm ${quantityValidationErrors[`roll-${sc.id}-${roll.id}-issued`] ? 'border-danger ring-1 ring-danger' : ''}`}
                                  />
                                  {quantityValidationErrors[`roll-${sc.id}-${roll.id}-issued`] ? (
                                    <p className="text-xs text-danger font-500 flex items-center gap-1">
                                      <AlertCircle size={11} className="flex-shrink-0" />
                                      {quantityValidationErrors[`roll-${sc.id}-${roll.id}-issued`]}
                                    </p>
                                  ) : selectedRollItem && (
                                    <p className="text-xs text-muted-foreground">
                                      Available: <span className="font-600 text-foreground">{selectedRollItem.stockQty.toFixed(2)} {selectedRollItem.unit}</span>
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-600 text-muted-foreground">Consumed Qty *</label>
                                  <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={roll.fabricConsumedQty}
                                    onChange={(e) => updateRoll(sc.id, roll.id, 'fabricConsumedQty', e.target.value)}
                                    className={`input-field text-sm ${quantityValidationErrors[`roll-${sc.id}-${roll.id}-consumed`] ? 'border-danger ring-1 ring-danger' : ''}`}
                                  />
                                  {quantityValidationErrors[`roll-${sc.id}-${roll.id}-consumed`] && (
                                    <p className="text-xs text-danger font-500 flex items-center gap-1">
                                      <AlertCircle size={11} className="flex-shrink-0" />
                                      {quantityValidationErrors[`roll-${sc.id}-${roll.id}-consumed`]}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {leftoverPreview > 0 && (
                                <p className="text-xs text-warning font-500">Leftover: {leftoverPreview.toFixed(2)} {sc.unit}</p>
                              )}
                            </div>
                          );
                        })}

                        {/* Rolls aggregate for this component */}
                        {sc.rolls.length > 1 && scIssuedTotal > 0 && (
                          <div className="flex items-center gap-4 bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs">
                            <span className="text-muted-foreground">Total Issued: <span className="font-700 text-foreground">{scIssuedTotal.toFixed(2)} {sc.unit}</span></span>
                            <span className="text-muted-foreground">Consumed: <span className="font-700 text-foreground">{scConsumedTotal.toFixed(2)}</span></span>
                            {scIssuedTotal - scConsumedTotal > 0 && (
                              <span className="text-warning font-600">Leftover: {(scIssuedTotal - scConsumedTotal).toFixed(2)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Size allocation */}
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-600 text-muted-foreground">Size-wise Qty</p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                          {sc.sizes.map((sz, szIdx) => (
                            <div key={szIdx} className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide">{sz.size}</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={sz.qty}
                                onChange={(e) => updateSizeRow(sc.id, szIdx, 'qty', e.target.value)}
                                className="input-field text-sm text-center w-full px-1"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {scTotal > 0 && (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">Total: <span className="font-700 text-foreground">{scTotal} pcs</span></span>
                          {scRej > 0 && <span className="text-danger">Rej: <span className="font-700">{scRej}</span></span>}
                          <span className="text-success font-600">Net: {scTotal - scRej} pcs</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {totalPiecesCutDerived > 0 && (
                  <div className="flex items-center gap-4 bg-success-bg border border-success-border rounded-lg px-4 py-2.5">
                    <p className="text-xs text-success font-600">
                      Total Pieces Cut: <span className="font-700">{totalPiecesCutDerived}</span>
                      {totalRejectionsDerived > 0 && <span className="text-danger ml-3">Rejections: {totalRejectionsDerived}</span>}
                      <span className="ml-3">Net for Stitching: <span className="font-700">{netPiecesDerived}</span></span>
                    </p>
                  </div>
                )}
              </div>

              {/* Rejection Reason */}
              {totalRejectionsDerived > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Rejection Reason</label>
                  {form.rejectionReason === '__create_new__' ? (
                    <div className="flex gap-1.5">
                      <input autoFocus type="text" placeholder="Enter new rejection reason" value={customRejectionReason} onChange={(e) => setCustomRejectionReason(e.target.value)} className="input-field text-sm flex-1" />
                      <button type="button" onClick={() => { if (customRejectionReason.trim()) { setForm({ ...form, rejectionReason: customRejectionReason.trim() }); setCustomRejectionReason(''); } }} className="px-2 py-1 bg-primary text-white rounded-lg text-xs font-600">Add</button>
                      <button type="button" onClick={() => { setForm({ ...form, rejectionReason: '' }); setCustomRejectionReason(''); }} className="px-2 py-1 bg-muted text-muted-foreground rounded-lg text-xs">✕</button>
                    </div>
                  ) : (
                    <select value={form.rejectionReason} onChange={(e) => setForm({ ...form, rejectionReason: e.target.value })} className="input-field text-sm">
                      <option value="">-- Select Reason --</option>
                      <option value="__create_new__" className="text-primary font-600">+ Create New Reason</option>
                      {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" />
              </div>

              {/* Cutting Price */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Cutting Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.cuttingPrice}
                  onChange={(e) => setForm({ ...form, cuttingPrice: e.target.value })}
                  className="input-field text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Payment amount for this cutting master's work on this entry</p>
              </div>

              {/* Validation Error Summary Banner */}
              {hasValidationErrors && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-danger flex-shrink-0" />
                    <p className="text-xs font-700 text-danger">Fix the following errors before saving:</p>
                  </div>
                  <ul className="list-disc list-inside flex flex-col gap-1 pl-1">
                    {Object.values(quantityValidationErrors).map((err, idx) => (
                      <li key={idx} className="text-xs text-danger font-500">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saving || hasValidationErrors}
                  title={hasValidationErrors ? 'Fix quantity validation errors before saving' : undefined}
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
