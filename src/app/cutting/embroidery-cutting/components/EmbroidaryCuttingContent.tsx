'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Scissors, ChevronDown, ChevronRight, Trash2,
  CheckCircle, Pencil, Package, AlertCircle, Search, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { cuttingService } from '@/lib/services/cuttingService';
import { cuttingMasterService } from '@/lib/services/cuttingMasterService';
import { embroideryVoucherService, CuttingStockItem } from '@/lib/services/embroideryVoucherService';
import { createClient } from '@/lib/supabase/client';

interface EmbCuttingContentProps {
  lang?: 'en' | 'hi';
}

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size', 'KA'];

const REJECTION_REASONS = [
  'Embroidery defect',
  'Wrong size',
  'Pattern mismatch',
  'Colour variation',
  'Measurement error',
  'Blade damage',
  'Embroidery damage during cutting',
  'Other',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SizeRow {
  size: string;
  qty: string;
}

interface EmbCuttingComponent {
  id: string;
  stockItem: CuttingStockItem;
  piecesIssued: string;
  sizes: SizeRow[];
  rejections: string;
  cuttingPrice: string;
}

interface EmbCuttingEntry {
  id: string;
  entryNo: string;
  date: string;
  jobCardRef: string;
  styleName: string;
  cuttingMaster: string;
  components: EmbCuttingComponent[];
  totalPiecesCut: number;
  totalRejections: number;
  netPieces: number;
  rejectionReason?: string;
  remarks?: string;
  status: string;
  createdAt?: string;
}

function makeDefaultSizes(jcSizes?: string[]): SizeRow[] {
  const sizes = jcSizes && jcSizes.length > 0 ? jcSizes : SIZE_OPTIONS;
  return sizes.map((s) => ({ size: s, qty: '' }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmbroidaryCuttingContent({ lang = 'en' }: EmbCuttingContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { jobCards, refresh: refreshJobCards } = useJobCards();

  // Entries state
  const [entries, setEntries] = useState<EmbCuttingEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<EmbCuttingEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmbCuttingEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search
  const [entrySearch, setEntrySearch] = useState('');

  // Job card & emb stock
  const [embStockItems, setEmbStockItems] = useState<CuttingStockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Cutting masters
  const [cuttingMasters, setCuttingMasters] = useState<string[]>([]);
  const [customCuttingMaster, setCustomCuttingMaster] = useState('');

  // Form
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    jobCardRef: '',
    styleName: '',
    cuttingMaster: '',
    rejectionReason: '',
    remarks: '',
  });

  // Selected components with size breakdown
  const [selectedComponents, setSelectedComponents] = useState<EmbCuttingComponent[]>([]);

  // ── Load entries from Supabase ──────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('emb_cutting_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[EmbCutting.loadEntries]', error);
      setEntries([]);
    } else {
      setEntries((data || []).map(rowToEntry));
    }
    setLoadingEntries(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useRealtimeTable('emb_cutting_entries', loadEntries);

  // ── Load cutting masters ────────────────────────────────────────────────────
  const loadMasters = useCallback(async () => {
    const masters = await cuttingMasterService.getAll();
    if (masters.length > 0) setCuttingMasters(masters.map((m) => m.name));
  }, []);
  useEffect(() => { loadMasters(); }, [loadMasters]);
  useRealtimeTable('cutting_masters', loadMasters);

  // ── Load emb stock for job card ─────────────────────────────────────────────
  const loadEmbStock = useCallback(async (jobCardRef: string) => {
    if (!jobCardRef) { setEmbStockItems([]); return; }
    setLoadingStock(true);
    try {
      const items = await cuttingService.getEmbReceivePendingByJobCard(jobCardRef);
      setEmbStockItems(items);
    } catch {
      setEmbStockItems([]);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  // ── Derived totals ──────────────────────────────────────────────────────────
  const totalPiecesCutDerived = selectedComponents.reduce((sum, c) =>
    sum + c.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0), 0);
  const totalRejectionsDerived = selectedComponents.reduce((sum, c) =>
    sum + (parseInt(c.rejections) || 0), 0);
  const netPiecesDerived = totalPiecesCutDerived - totalRejectionsDerived;

  // ── Summary totals ──────────────────────────────────────────────────────────
  const summaryTotalPieces = entries.reduce((s, e) => s + e.totalPiecesCut, 0);
  const summaryTotalRej = entries.reduce((s, e) => s + e.totalRejections, 0);
  const summaryNetPieces = entries.reduce((s, e) => s + e.netPieces, 0);
  const summaryEntries = entries.length;

  // ── Filtered entries ────────────────────────────────────────────────────────
  const filteredEntries = entrySearch
    ? entries.filter((e) =>
        e.entryNo.toLowerCase().includes(entrySearch.toLowerCase()) ||
        e.styleName.toLowerCase().includes(entrySearch.toLowerCase()) ||
        (e.jobCardRef || '').toLowerCase().includes(entrySearch.toLowerCase()) ||
        e.cuttingMaster.toLowerCase().includes(entrySearch.toLowerCase())
      )
    : entries;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleJobCardChange = (val: string) => {
    if (val === '__create_new__') { router.push('/job-card-management'); return; }
    const jc = jobCards.find((j) => j.jobCardNo === val);
    setForm((f) => ({ ...f, jobCardRef: val, styleName: jc?.styleEn || '' }));
    setSelectedComponents([]);
    if (val) loadEmbStock(val);
    else setEmbStockItems([]);
  };

  const addComponentFromStock = (item: CuttingStockItem) => {
    const already = selectedComponents.find((c) => c.stockItem.id === item.id);
    if (already) return;
    const jc = jobCards.find((j) => j.jobCardNo === form.jobCardRef);
    setSelectedComponents((prev) => [
      ...prev,
      {
        id: `ec-${Date.now()}-${Math.random()}`,
        stockItem: item,
        piecesIssued: String(item.availablePieces),
        sizes: makeDefaultSizes(jc?.sizes),
        rejections: '',
        cuttingPrice: '',
      },
    ]);
  };

  const removeComponent = (id: string) => {
    setSelectedComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const updateComponentField = (id: string, field: keyof Pick<EmbCuttingComponent, 'piecesIssued' | 'rejections' | 'cuttingPrice'>, value: string) => {
    setSelectedComponents((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === 'piecesIssued') {
          const num = parseInt(value) || 0;
          const capped = Math.min(Math.max(0, num), c.stockItem.availablePieces);
          return { ...c, piecesIssued: String(capped) };
        }
        return { ...c, [field]: value };
      })
    );
  };

  const updateSizeQty = (compId: string, sizeIdx: number, qty: string) => {
    setSelectedComponents((prev) =>
      prev.map((c) =>
        c.id !== compId
          ? c
          : {
              ...c,
              sizes: c.sizes.map((sz, i) => (i === sizeIdx ? { ...sz, qty } : sz)),
            }
      )
    );
  };

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', cuttingMaster: '', rejectionReason: '', remarks: '' });
    setSelectedComponents([]);
    setEmbStockItems([]);
    setSaveError(null);
    setEditingEntry(null);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!form.date) { setSaveError('Date is required.'); return; }
    if (!form.jobCardRef) { setSaveError('Job Card is required.'); return; }
    if (!form.cuttingMaster) { setSaveError('Cutting Master is required.'); return; }
    if (selectedComponents.length === 0) { setSaveError('Select at least one embroidery-received component.'); return; }

    for (const c of selectedComponents) {
      const issued = parseInt(c.piecesIssued) || 0;
      if (issued <= 0) { setSaveError(`Pieces issued for "${c.stockItem.component}" must be > 0.`); return; }
      if (issued > c.stockItem.availablePieces) { setSaveError(`Pieces for "${c.stockItem.component}" (${issued}) exceeds available (${c.stockItem.availablePieces}).`); return; }
      const sizeTotal = c.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0);
      if (sizeTotal === 0) { setSaveError(`Enter size-wise quantities for "${c.stockItem.component}".`); return; }
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const entryNo = editingEntry
        ? editingEntry.entryNo
        : `EMB-CUT-${String(entries.length + 1).padStart(4, '0')}`;

      // For each component, resolve the real cutting_stock ID if it's a synthesized item
      const resolvedComponents = await Promise.all(
        selectedComponents.map(async (c) => {
          let realStockId = c.stockItem.id;
          // Synthesized items have IDs starting with "rv-"
          if (c.stockItem.id.startsWith('rv-')) {
            const resolved = await embroideryVoucherService.getOrCreateRealCuttingStockId(
              c.stockItem.id,
              form.jobCardRef
            );
            if (resolved) realStockId = resolved;
          }
          return { ...c, resolvedStockId: realStockId };
        })
      );

      const componentsPayload = resolvedComponents.map((c) => ({
        stockItemId: c.resolvedStockId,
        component: c.stockItem.component,
        receiveVoucherNo: c.stockItem.receiveVoucherNo || '',
        issueVoucherNo: c.stockItem.issueVoucherNo || '',
        piecesIssued: parseInt(c.piecesIssued) || 0,
        unit: c.stockItem.unit,
        sizes: c.sizes.map((sz) => ({ size: sz.size, qty: parseInt(sz.qty) || 0 })).filter((sz) => sz.qty > 0),
        rejections: parseInt(c.rejections) || 0,
        netPieces: c.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0) - (parseInt(c.rejections) || 0),
        cuttingPrice: parseFloat(c.cuttingPrice) || 0,
      }));

      const totalPiecesCut = componentsPayload.reduce((s, c) => s + c.sizes.reduce((ss, sz) => ss + sz.qty, 0), 0);
      const totalRejections = componentsPayload.reduce((s, c) => s + c.rejections, 0);
      const netPieces = totalPiecesCut - totalRejections;

      if (editingEntry) {
        // Restore old stock deductions first
        const oldComponents: any[] = editingEntry.components || [];
        for (const oc of oldComponents) {
          if (oc.stockItemId && (parseInt(oc.piecesIssued) || 0) > 0) {
            await embroideryVoucherService.restoreCuttingStock(oc.stockItemId, parseInt(oc.piecesIssued) || 0);
          }
        }

        const { error } = await supabase
          .from('emb_cutting_entries')
          .update({
            date: form.date,
            job_card_ref: form.jobCardRef,
            style_name: form.styleName,
            cutting_master: form.cuttingMaster,
            components: componentsPayload,
            total_pieces_cut: totalPiecesCut,
            total_rejections: totalRejections,
            net_pieces: netPieces,
            rejection_reason: form.rejectionReason || null,
            remarks: form.remarks || null,
          })
          .eq('id', editingEntry.id);

        if (error) { setSaveError('Failed to update entry. Please try again.'); setSaving(false); return; }
      } else {
        const { error } = await supabase
          .from('emb_cutting_entries')
          .insert({
            entry_no: entryNo,
            date: form.date,
            job_card_ref: form.jobCardRef,
            style_name: form.styleName,
            cutting_master: form.cuttingMaster,
            components: componentsPayload,
            total_pieces_cut: totalPiecesCut,
            total_rejections: totalRejections,
            net_pieces: netPieces,
            rejection_reason: form.rejectionReason || null,
            remarks: form.remarks || null,
            status: 'completed',
          });

        if (error) { setSaveError('Failed to save entry. Please try again.'); setSaving(false); return; }
      }

      // Deduct stock for each component (only for real DB IDs — synthesized IDs are tracked via emb_cutting_entries)
      for (const c of componentsPayload) {
        if (c.piecesIssued > 0 && !c.stockItemId.startsWith('rv-')) {
          await embroideryVoucherService.deductCuttingStock(c.stockItemId, c.piecesIssued);
        }
      }

      await loadEntries();
      // Reload emb stock to reflect updated available quantities
      if (form.jobCardRef) await loadEmbStock(form.jobCardRef);
      setShowModal(false);
      resetForm();
      setSuccessMsg(`Entry ${entryNo} ${editingEntry ? 'updated' : 'saved'} successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setSaveError('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEditEntry = async (entry: EmbCuttingEntry) => {
    setEditingEntry(entry);
    setForm({
      date: entry.date,
      jobCardRef: entry.jobCardRef || '',
      styleName: entry.styleName,
      cuttingMaster: entry.cuttingMaster,
      rejectionReason: entry.rejectionReason || '',
      remarks: entry.remarks || '',
    });

    // Load all stock for this job card (including fully issued for edit restore)
    if (entry.jobCardRef) {
      const allItems = await cuttingService.getEmbReceiveAllByJobCard(entry.jobCardRef);
      setEmbStockItems(allItems);

      // Restore selected components from saved entry
      const restored: EmbCuttingComponent[] = (entry.components || []).map((c: any) => {
        const stockItem = allItems.find((i) => i.id === c.stockItemId) || {
          id: c.stockItemId,
          component: c.component,
          receiveVoucherNo: c.receiveVoucherNo || '',
          issueVoucherNo: c.issueVoucherNo || '',
          availablePieces: c.piecesIssued,
          totalPieces: c.piecesIssued,
          issuedPieces: c.piecesIssued,
          unit: c.unit || 'Pcs',
          jobCardRef: entry.jobCardRef,
          styleName: entry.styleName,
          partyName: '',
          status: 'fully_issued' as const,
        };
        return {
          id: `ec-edit-${c.stockItemId}-${Date.now()}`,
          stockItem,
          piecesIssued: String(c.piecesIssued),
          sizes: Array.isArray(c.sizes)
            ? c.sizes.map((sz: any) => ({ size: sz.size, qty: String(sz.qty) }))
            : makeDefaultSizes(),
          rejections: String(c.rejections || ''),
          cuttingPrice: String(c.cuttingPrice || ''),
        };
      });
      setSelectedComponents(restored);
    }

    setSaveError(null);
    setShowModal(true);
    refreshJobCards();
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();

    // Restore stock for each component
    for (const c of deleteTarget.components || []) {
      if ((c as any).stockItemId && (c as any).piecesIssued > 0) {
        await embroideryVoucherService.restoreCuttingStock((c as any).stockItemId, (c as any).piecesIssued);
      }
    }

    const { error } = await supabase.from('emb_cutting_entries').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setSuccessMsg(`Entry ${deleteTarget.entryNo} deleted.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
    setDeleteTarget(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles size={16} className="text-amber-600" />
            <h1 className="text-xl font-700 text-foreground">Embroidery Cutting</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Issue embroidery-received components (Yoke, Border, Front Palla, etc.) for cutting — size-wise tracking with stock deduction
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cutting" className="btn-secondary text-sm flex items-center gap-1.5">
            <Scissors size={13} />
            Fabric Cutting
          </Link>
          <button
            onClick={() => { resetForm(); refreshJobCards(); setShowModal(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={14} />
            New Emb Cutting Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Entries</p>
          <p className="text-2xl font-700 text-primary mt-1">{summaryEntries}</p>
          <p className="text-xs text-muted-foreground">Emb cutting records</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Pieces Cut</p>
          <p className="text-2xl font-700 text-foreground mt-1">{summaryTotalPieces.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Cutting Rejections</p>
          <p className="text-2xl font-700 text-danger mt-1">{summaryTotalRej.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces rejected</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Net for Stitching</p>
          <p className="text-2xl font-700 text-success mt-1">{summaryNetPieces.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Net pieces</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
          <Sparkles size={15} className="text-amber-600" />
          <span className="text-sm font-600 text-foreground">Embroidery Cutting Entries</span>
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
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Cutting Master</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Components</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pieces Cut</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Rejections</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Net Pieces</th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading entries...</p>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <Sparkles size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No embroidery cutting entries yet</p>
                    <p className="text-xs mt-1">Create entries to track cutting of embroidery-received components</p>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">
                    <Search size={28} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-500">No entries match your search</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-3">
                        {(entry.components || []).length > 0 && (
                          <button onClick={() => toggleRow(entry.id)} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                            {expandedRows.has(entry.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 font-600 text-primary text-xs">
                        <span className="flex items-center gap-1.5">
                          {entry.entryNo}
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-600">
                            <Sparkles size={8} />
                            EMB
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.date}</td>
                      <td className="px-4 py-3">
                        <p className="font-500 text-sm text-foreground">{entry.styleName}</p>
                        {entry.jobCardRef && <p className="text-xs text-muted-foreground">JC: {entry.jobCardRef}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{entry.cuttingMaster}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(entry.components || []).map((c: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-500">
                              {c.component}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-600 text-foreground">{entry.totalPiecesCut.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{entry.totalRejections}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{entry.netPieces.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleEditEntry(entry)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(entry)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {expandedRows.has(entry.id) && (entry.components || []).length > 0 && (
                      <tr className="border-b border-border/50 bg-amber-50/30">
                        <td colSpan={10} className="px-6 py-4">
                          <p className="text-xs font-700 text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                            <Package size={12} />
                            Embroidery Component Breakdown
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(entry.components || []).map((c: any, idx: number) => {
                              const sizeTotal = (c.sizes || []).reduce((s: number, sz: any) => s + (sz.qty || 0), 0);
                              return (
                                <div key={idx} className="bg-white border border-amber-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-700 text-amber-800">{c.component}</span>
                                    <span className="text-xs text-success font-600">Net: {c.netPieces ?? (sizeTotal - (c.rejections || 0))} pcs</span>
                                  </div>
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {c.receiveVoucherNo && (
                                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-600">RV: {c.receiveVoucherNo}</span>
                                    )}
                                    {c.issueVoucherNo && (
                                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-600">IV: {c.issueVoucherNo}</span>
                                    )}
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-600">
                                      Issued: {c.piecesIssued} {c.unit}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {(c.sizes || []).filter((sz: any) => sz.qty > 0).map((sz: any, si: number) => (
                                      <div key={si} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5">
                                        <span className="text-xs font-600 text-muted-foreground">{sz.size}:</span>
                                        <span className="text-xs font-700 text-foreground">{sz.qty}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>Total: <span className="font-600 text-foreground">{sizeTotal}</span></span>
                                    {(c.rejections || 0) > 0 && <span className="text-danger">Rej: <span className="font-600">{c.rejections}</span></span>}
                                    {(c.cuttingPrice || 0) > 0 && <span>Price: <span className="font-600 text-foreground">₹{c.cuttingPrice}</span></span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {entry.remarks && (
                            <p className="text-xs text-muted-foreground mt-3">Remarks: <span className="font-500 text-foreground">{entry.remarks}</span></p>
                          )}
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

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-danger" />
              </div>
              <div>
                <h3 className="text-base font-700 text-foreground">Delete Entry</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Stock will be restored. This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground">
              Delete entry <span className="font-700 text-primary">{deleteTarget.entryNo}</span>?
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-600 hover:bg-danger/90 transition-colors disabled:opacity-60"
              >
                {deleting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-600" />
                <h2 className="text-base font-700 text-foreground">
                  {editingEntry ? `Edit — ${editingEntry.entryNo}` : 'New Embroidery Cutting Entry'}
                </h2>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
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
                  <label className="text-xs font-600 text-muted-foreground">Job Card *</label>
                  <select value={form.jobCardRef} onChange={(e) => handleJobCardChange(e.target.value)} className="input-field text-sm" required>
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
                  </div>
                );
              })()}

              {/* Cutting Master */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Cutting Master *</label>
                {form.cuttingMaster === '__create_new__' ? (
                  <div className="flex gap-1.5">
                    <input autoFocus type="text" placeholder="Enter new cutting master name" value={customCuttingMaster} onChange={(e) => setCustomCuttingMaster(e.target.value)} className="input-field text-sm flex-1" />
                    <button type="button" onClick={async () => {
                      if (customCuttingMaster.trim()) {
                        const n = customCuttingMaster.trim();
                        const saved = await cuttingMasterService.create(n);
                        if (saved && !cuttingMasters.includes(n)) setCuttingMasters((p) => [...p, n].sort());
                        setForm({ ...form, cuttingMaster: n });
                        setCustomCuttingMaster('');
                      }
                    }} className="px-2 py-1 bg-primary text-white rounded-lg text-xs font-600">Add</button>
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

              {/* Embroidery-Received Stock Panel */}
              {form.jobCardRef && form.jobCardRef !== '__create_new__' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-amber-600" />
                    <p className="text-xs font-700 text-amber-700">Embroidery-Received Stock</p>
                    {loadingStock && <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin ml-1" />}
                  </div>

                  {!loadingStock && embStockItems.length === 0 && (
                    <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground">
                      <AlertCircle size={13} />
                      No embroidery-received materials available for this Job Card.
                    </div>
                  )}

                  {!loadingStock && embStockItems.length > 0 && (
                    <div className="border border-amber-200 rounded-xl overflow-hidden">
                      <div className="bg-amber-50 px-3 py-2 border-b border-amber-200">
                        <p className="text-[11px] text-amber-700 font-600">
                          Click "+ Add" to include an embroidery-received component in this cutting entry.
                        </p>
                      </div>
                      <div className="divide-y divide-amber-100">
                        {embStockItems.map((item) => {
                          const alreadyAdded = selectedComponents.some((c) => c.stockItem.id === item.id);
                          return (
                            <div key={item.id} className="px-3 py-2.5 flex items-center gap-3 bg-white hover:bg-amber-50/50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-700 text-foreground">{item.component}</span>
                                  {item.receiveVoucherNo && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-600">RV: {item.receiveVoucherNo}</span>
                                  )}
                                  {item.issueVoucherNo && (
                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-600">IV: {item.issueVoucherNo}</span>
                                  )}
                                  <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-600">
                                    Available: {item.availablePieces}/{item.totalPieces} {item.unit}
                                  </span>
                                </div>
                                {item.description && <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>}
                              </div>
                              <button
                                type="button"
                                onClick={() => addComponentFromStock(item)}
                                disabled={alreadyAdded}
                                className={`text-xs px-2.5 py-1 rounded-lg font-600 transition-colors flex-shrink-0 ${alreadyAdded ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                              >
                                {alreadyAdded ? 'Added' : '+ Add'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Components with Size Breakdown */}
              {selectedComponents.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-700 text-foreground">Component-wise Cutting Details *</p>
                  {selectedComponents.map((comp) => {
                    const sizeTotal = comp.sizes.reduce((s, sz) => s + (parseInt(sz.qty) || 0), 0);
                    const rej = parseInt(comp.rejections) || 0;
                    return (
                      <div key={comp.id} className="border border-amber-200 rounded-xl p-4 flex flex-col gap-3 bg-amber-50/30">
                        {/* Component header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-700 text-amber-800">{comp.stockItem.component}</span>
                            {comp.stockItem.receiveVoucherNo && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-600">RV: {comp.stockItem.receiveVoucherNo}</span>
                            )}
                            <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-600">
                              Available: {comp.stockItem.availablePieces} {comp.stockItem.unit}
                            </span>
                          </div>
                          <button type="button" onClick={() => removeComponent(comp.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Pieces Issued + Rejections + Price */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-600 text-muted-foreground">Pieces Issued *</label>
                            <input
                              type="number"
                              min="1"
                              max={comp.stockItem.availablePieces}
                              value={comp.piecesIssued}
                              onChange={(e) => updateComponentField(comp.id, 'piecesIssued', e.target.value)}
                              className="input-field text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-600 text-muted-foreground">Rejections</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={comp.rejections}
                              onChange={(e) => updateComponentField(comp.id, 'rejections', e.target.value)}
                              className="input-field text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-600 text-muted-foreground">Cutting Price (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={comp.cuttingPrice}
                              onChange={(e) => updateComponentField(comp.id, 'cuttingPrice', e.target.value)}
                              className="input-field text-sm"
                            />
                          </div>
                        </div>

                        {/* Size-wise Qty */}
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-600 text-muted-foreground">Size-wise Qty *</p>
                          <div className="grid grid-cols-4 gap-2 sm:grid-cols-9">
                            {comp.sizes.map((sz, szIdx) => (
                              <div key={szIdx} className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide">{sz.size}</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={sz.qty}
                                  onChange={(e) => updateSizeQty(comp.id, szIdx, e.target.value)}
                                  className="input-field text-sm text-center w-full px-1"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {sizeTotal > 0 && (
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">Total: <span className="font-700 text-foreground">{sizeTotal} pcs</span></span>
                            {rej > 0 && <span className="text-danger">Rej: <span className="font-700">{rej}</span></span>}
                            <span className="text-success font-600">Net: {sizeTotal - rej} pcs</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Grand total */}
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
              )}

              {/* Rejection Reason */}
              {totalRejectionsDerived > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Rejection Reason</label>
                  <select value={form.rejectionReason} onChange={(e) => setForm({ ...form, rejectionReason: e.target.value })} className="input-field text-sm">
                    <option value="">-- Select Reason --</option>
                    {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
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

// ─── Row mapper ───────────────────────────────────────────────────────────────
function rowToEntry(row: any): EmbCuttingEntry {
  return {
    id: row.id,
    entryNo: row.entry_no,
    date: row.date,
    jobCardRef: row.job_card_ref || '',
    styleName: row.style_name || '',
    cuttingMaster: row.cutting_master || '',
    components: Array.isArray(row.components) ? row.components : [],
    totalPiecesCut: row.total_pieces_cut || 0,
    totalRejections: row.total_rejections || 0,
    netPieces: row.net_pieces || 0,
    rejectionReason: row.rejection_reason || undefined,
    remarks: row.remarks || undefined,
    status: row.status || 'completed',
    createdAt: row.created_at || '',
  };
}
