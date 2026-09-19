'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Scissors, Shirt, Sparkles, ChevronRight, ArrowLeft, Package, TrendingDown, AlertCircle, Layers, FileText } from 'lucide-react';
import Link from 'next/link';
import { JobCard } from '@/app/job-card-management/components/JobCardContent';
import { BatchStage, ProductionBatch, StageRecord, CompositionStageRecord, ItemComposition } from '../../data/productionBatchData';
import { productionBatchService } from '@/lib/services/productionBatchService';
import { jobCardService } from '@/lib/services/jobCardService';
import { createClient } from '@/lib/supabase/client';

// ─── Stage config ────────────────────────────────────────────────────────────
const STAGES: { key: BatchStage; labelEn: string; labelHi: string; icon: React.ReactNode; color: string; href: string }[] = [
  { key: 'cutting',   labelEn: 'Cutting',   labelHi: 'कटाई',       icon: <Scissors size={18} />,    color: 'text-blue-600',   href: '/cutting'               },
  { key: 'stitching', labelEn: 'Stitching', labelHi: 'सिलाई',      icon: <Shirt size={18} />,       color: 'text-purple-600', href: '/stitching'             },
  { key: 'finishing', labelEn: 'Finishing', labelHi: 'फिनिशिंग',   icon: <Sparkles size={18} />,    color: 'text-green-600',  href: '/contractor-finishing'  },
];

const STAGE_ORDER: BatchStage[] = ['cutting', 'stitching', 'finishing', 'done'];

function stageIndex(s: BatchStage) {
  return STAGE_ORDER.indexOf(s);
}

function emptyRecord(stage: BatchStage, issuedQty: number): StageRecord {
  return {
    stage,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
    issuedQty,
    completedQty: 0,
    rejectedQty: 0,
    reworkQty: 0,
    lossQty: 0,
    remarks: '',
  };
}

function emptyCompRecord(issuedQty: number): CompositionStageRecord {
  return {
    issuedQty,
    completedQty: 0,
    rejectedQty: 0,
    reworkQty: 0,
    lossQty: 0,
    remarks: '',
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/'),
  };
}

// ─── Sub-component wise data ──────────────────────────────────────────────────
interface SubComponentRow {
  component: string;
  cutting: { totalCut: number; rejections: number; netPieces: number };
  stitching: { received: number; stitched: number; rejections: number; netPieces: number };
  finishing: { issued: number; received: number };
}

// ─── Stage-level totals (for metrics) ────────────────────────────────────────
interface WorkflowTotals {
  cuttingOut: number;
  stitchingOut: number;
  finishingOut: number;
  totalLoss: number;
}

async function fetchSubComponentSummary(jobCardRef: string): Promise<{ rows: SubComponentRow[]; totals: WorkflowTotals }> {
  if (!jobCardRef) return { rows: [], totals: { cuttingOut: 0, stitchingOut: 0, finishingOut: 0, totalLoss: 0 } };
  const supabase = createClient();

  // ── Cutting sub-components ────────────────────────────────────────────────
  const { data: cuttingEntries } = await supabase
    .from('cutting_entries')
    .select('id, net_pieces_for_stitching, total_pieces_cut, cutting_rejections, wastage_qty')
    .eq('job_card_ref', jobCardRef);

  const cuttingEntryIds = (cuttingEntries || []).map((e: any) => e.id);
  let cuttingSubRows: any[] = [];
  if (cuttingEntryIds.length > 0) {
    const { data } = await supabase
      .from('cutting_sub_components')
      .select('component, total_pieces, rejections, net_pieces')
      .in('cutting_entry_id', cuttingEntryIds);
    cuttingSubRows = data || [];
  }

  // ── Stitching: use stitch_issue_vouchers + stitch_issue_components ────────
  const { data: stitchIssueVouchers } = await supabase
    .from('stitch_issue_vouchers')
    .select('id, voucher_no, total_pieces')
    .eq('job_card_ref', jobCardRef);

  const stitchIssueVoucherIds = (stitchIssueVouchers || []).map((v: any) => v.id);
  let stitchIssueComponents: any[] = [];
  if (stitchIssueVoucherIds.length > 0) {
    const { data } = await supabase
      .from('stitch_issue_components')
      .select('component, issued_qty, received_qty, pending_qty, issue_voucher_id')
      .in('issue_voucher_id', stitchIssueVoucherIds);
    stitchIssueComponents = data || [];
  }

  // ── Stitching: use stitch_receive_vouchers + stitch_receive_components ────
  const { data: stitchReceiveVouchers } = await supabase
    .from('stitch_receive_vouchers')
    .select('id, voucher_no, total_pieces_received')
    .eq('job_card_ref', jobCardRef);

  const stitchReceiveVoucherIds = (stitchReceiveVouchers || []).map((v: any) => v.id);
  let stitchReceiveComponents: any[] = [];
  if (stitchReceiveVoucherIds.length > 0) {
    const { data } = await supabase
      .from('stitch_receive_components')
      .select('component, issued_qty, received_qty, balance_qty, receive_voucher_id')
      .in('receive_voucher_id', stitchReceiveVoucherIds);
    stitchReceiveComponents = data || [];
  }

  // ── Finishing: contractor_issue_vouchers + contractor_issue_items ─────────
  const { data: contractorIssueVouchers } = await supabase
    .from('contractor_issue_vouchers')
    .select('id, voucher_no, total_issued, contractor_name')
    .eq('job_card_ref', jobCardRef);

  const contractorIssueVoucherIds = (contractorIssueVouchers || []).map((v: any) => v.id);
  let contractorIssueItems: any[] = [];
  if (contractorIssueVoucherIds.length > 0) {
    const { data } = await supabase
      .from('contractor_issue_items')
      .select('item, colour, size, issued_qty, received_qty, balance_qty, issue_voucher_id')
      .in('issue_voucher_id', contractorIssueVoucherIds);
    contractorIssueItems = data || [];
  }

  // ── Finishing: contractor_receive_vouchers + contractor_receive_items ─────
  const { data: contractorReceiveVouchers } = await supabase
    .from('contractor_receive_vouchers')
    .select('id, voucher_no, total_received')
    .eq('job_card_ref', jobCardRef);

  const contractorReceiveVoucherIds = (contractorReceiveVouchers || []).map((v: any) => v.id);
  let contractorReceiveItems: any[] = [];
  if (contractorReceiveVoucherIds.length > 0) {
    const { data } = await supabase
      .from('contractor_receive_items')
      .select('item, colour, size, issued_qty, received_today, balance_before, receive_voucher_id')
      .in('receive_voucher_id', contractorReceiveVoucherIds);
    contractorReceiveItems = data || [];
  }

  // Totals for finishing
  const finishingIssued = (contractorIssueVouchers || []).reduce((s: number, r: any) => s + (r.total_issued || 0), 0);
  const finishingReceived = (contractorReceiveVouchers || []).reduce((s: number, r: any) => s + (r.total_received || 0), 0);

  // ── Aggregate by component ────────────────────────────────────────────────
  const componentMap = new Map<string, SubComponentRow>();

  function getOrCreate(component: string): SubComponentRow {
    if (!componentMap.has(component)) {
      componentMap.set(component, {
        component,
        cutting: { totalCut: 0, rejections: 0, netPieces: 0 },
        stitching: { received: 0, stitched: 0, rejections: 0, netPieces: 0 },
        finishing: { issued: 0, received: 0 },
      });
    }
    return componentMap.get(component)!;
  }

  // Cutting sub-components
  for (const row of cuttingSubRows) {
    const comp = getOrCreate(row.component || 'Unknown');
    comp.cutting.totalCut += row.total_pieces || 0;
    comp.cutting.rejections += row.rejections || 0;
    comp.cutting.netPieces += row.net_pieces || 0;
  }

  // Stitching: issued qty per component from stitch_issue_components
  for (const row of stitchIssueComponents) {
    const comp = getOrCreate(row.component || 'Unknown');
    comp.stitching.received += row.issued_qty || 0;
  }

  // Stitching: received back qty per component from stitch_receive_components
  for (const row of stitchReceiveComponents) {
    const comp = getOrCreate(row.component || 'Unknown');
    comp.stitching.stitched += row.received_qty || 0;
    comp.stitching.netPieces += row.received_qty || 0;
    const rej = Math.max(0, (row.issued_qty || 0) - (row.received_qty || 0) - (row.balance_qty || 0));
    comp.stitching.rejections += rej;
  }

  // Finishing: aggregate by item (component) from contractor_issue_items
  for (const row of contractorIssueItems) {
    const comp = getOrCreate(row.item || 'All Components');
    comp.finishing.issued += row.issued_qty || 0;
  }

  // Finishing: aggregate received from contractor_receive_items
  for (const row of contractorReceiveItems) {
    const comp = getOrCreate(row.item || 'All Components');
    comp.finishing.received += row.received_today || 0;
  }

  // If no sub-component data exists at all, fall back to entry-level totals as a single "All" row
  const hasSubComponents = componentMap.size > 0;

  if (!hasSubComponents) {
    // Fallback: aggregate entry-level totals into a single row
    const cuttingTotalCut = (cuttingEntries || []).reduce((s: number, r: any) => s + (r.total_pieces_cut || 0), 0);
    const cuttingRej = (cuttingEntries || []).reduce((s: number, r: any) => s + (r.cutting_rejections || 0), 0);
    const cuttingNet = (cuttingEntries || []).reduce((s: number, r: any) => s + (r.net_pieces_for_stitching || r.total_pieces_cut || 0), 0);
    const stitchIssued = (stitchIssueVouchers || []).reduce((s: number, r: any) => s + (r.total_pieces || 0), 0);
    const stitchReceived = (stitchReceiveVouchers || []).reduce((s: number, r: any) => s + (r.total_pieces_received || 0), 0);

    if (cuttingTotalCut > 0 || stitchIssued > 0 || finishingIssued > 0) {
      const allRow = getOrCreate('All Components');
      allRow.cutting = { totalCut: cuttingTotalCut, rejections: cuttingRej, netPieces: cuttingNet };
      allRow.stitching = { received: stitchIssued, stitched: stitchReceived, rejections: Math.max(0, stitchIssued - stitchReceived), netPieces: stitchReceived };
      allRow.finishing = { issued: finishingIssued, received: finishingReceived };
    }
  } else if (finishingIssued > 0) {
    // If finishing has no item-level breakdown but has totals, distribute proportionally
    const totalFinishingIssuedFromItems = Array.from(componentMap.values()).reduce((s, c) => s + c.finishing.issued, 0);
    if (totalFinishingIssuedFromItems === 0) {
      // No item-level finishing data — distribute proportionally by stitching net pieces
      const components = Array.from(componentMap.values());
      const totalStitchingOut = components.reduce((s, c) => s + c.stitching.netPieces, 0);
      for (const comp of components) {
        const ratio = totalStitchingOut > 0 ? comp.stitching.netPieces / totalStitchingOut : 1 / components.length;
        comp.finishing.issued = Math.round(finishingIssued * ratio);
        comp.finishing.received = Math.round(finishingReceived * ratio);
      }
    }
  }

  const rows = Array.from(componentMap.values());

  // Compute totals
  const cuttingOut = rows.reduce((s, r) => s + r.cutting.netPieces, 0) ||
    (cuttingEntries || []).reduce((s: number, r: any) => s + (r.net_pieces_for_stitching || r.total_pieces_cut || 0), 0);
  const stitchingOut = rows.reduce((s, r) => s + r.stitching.netPieces, 0) ||
    (stitchReceiveVouchers || []).reduce((s: number, r: any) => s + (r.total_pieces_received || 0), 0);
  const finishingOut = finishingReceived ||
    rows.reduce((s, r) => s + r.finishing.received, 0);
  const totalLoss =
    rows.reduce((s, r) => s + r.cutting.rejections, 0) +
    rows.reduce((s, r) => s + r.stitching.rejections, 0);

  return { rows, totals: { cuttingOut, stitchingOut, finishingOut, totalLoss } };
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ProductionBatchContentProps {
  jobCardId: string;
  lang: 'en' | 'hi';
}

export default function ProductionBatchContent({ jobCardId, lang }: ProductionBatchContentProps) {
  const [jobCard, setJobCard] = useState<JobCard | undefined>(undefined);
  const [loadingJC, setLoadingJC] = useState(true);
  const [compositions, setCompositions] = useState<ItemComposition[]>([]);
  const [subComponentRows, setSubComponentRows] = useState<SubComponentRow[]>([]);
  const [workflowTotals, setWorkflowTotals] = useState<WorkflowTotals>({ cuttingOut: 0, stitchingOut: 0, finishingOut: 0, totalLoss: 0 });
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    async function loadJobCard() {
      setLoadingJC(true);
      try {
        const allCards = await jobCardService.getAll();
        const found = allCards.find((jc) => jc.id === jobCardId);
        setJobCard(found || undefined);
      } catch {
        setJobCard(undefined);
      } finally {
        setLoadingJC(false);
      }
    }
    loadJobCard();
  }, [jobCardId]);

  // Load compositions for this job card's item style
  useEffect(() => {
    async function loadCompositions() {
      if (!jobCard) return;
      try {
        const supabase = createClient();
        const { data: styleData } = await supabase
          .from('item_styles')
          .select('id')
          .eq('job_card_no', jobCard.jobCardNo)
          .maybeSingle();

        if (styleData?.id) {
          const { data: compData } = await supabase
            .from('item_compositions')
            .select('*')
            .eq('style_id', styleData.id)
            .order('sort_order', { ascending: true });
          setCompositions((compData || []) as ItemComposition[]);
        }
      } catch {
        // no compositions
      }
    }
    loadCompositions();
  }, [jobCard]);

  // Build initial batch from job card
  const [batch, setBatch] = useState<ProductionBatch>(() => {
    return {
      id: `batch-${jobCardId}`,
      batchNo: `PB-${jobCardId.slice(-6).toUpperCase()}`,
      jobCardId,
      jobCardNo: jobCard?.jobCardNo ?? jobCardId,
      styleName: jobCard?.styleEn ?? '',
      partyName: jobCard?.partyName ?? '',
      totalOrderedQty: jobCard?.totalPieces ?? 0,
      currentStage: (jobCard?.stage as BatchStage) ?? 'cutting',
      stages: {
        cutting: emptyRecord('cutting', jobCard?.totalPieces ?? 0),
      },
      compositionStages: {},
      compositions: [],
      createdDate: jobCard?.createdDate ?? '',
      status: 'active',
    };
  });

  // Load existing batch from Supabase
  useEffect(() => {
    async function loadBatch() {
      try {
        const existing = await productionBatchService.getByJobCardId(jobCardId);
        if (existing) {
          setBatch(existing);
        }
      } catch {
        // keep local state
      }
    }
    loadBatch();
  }, [jobCardId]);

  // Load sub-component summary from manufacturing entries
  useEffect(() => {
    if (!jobCard?.jobCardNo) return;
    setLoadingReport(true);
    fetchSubComponentSummary(jobCard.jobCardNo)
      .then(({ rows, totals }) => {
        setSubComponentRows(rows);
        setWorkflowTotals(totals);
      })
      .catch(() => {})
      .finally(() => setLoadingReport(false));
  }, [jobCard?.jobCardNo]);

  const hasCompositions = compositions.length > 0;

  if (loadingJC) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle size={40} className="text-muted-foreground" />
        <p className="text-muted-foreground">{lang === 'hi' ? 'जॉब कार्ड नहीं मिला' : 'Job Card not found'}</p>
        <Link href="/job-card-management" className="btn-primary text-sm">
          {lang === 'hi' ? 'वापस जाएं' : 'Go Back'}
        </Link>
      </div>
    );
  }

  const { cuttingOut, stitchingOut, finishingOut, totalLoss } = workflowTotals;

  const efficiency =
    batch.totalOrderedQty > 0
      ? Math.round((finishingOut / batch.totalOrderedQty) * 100)
      : 0;

  // Totals row for sub-component table
  const totalsRow: SubComponentRow = {
    component: lang === 'hi' ? 'कुल' : 'Total',
    cutting: {
      totalCut: subComponentRows.reduce((s, r) => s + r.cutting.totalCut, 0),
      rejections: subComponentRows.reduce((s, r) => s + r.cutting.rejections, 0),
      netPieces: subComponentRows.reduce((s, r) => s + r.cutting.netPieces, 0),
    },
    stitching: {
      received: subComponentRows.reduce((s, r) => s + r.stitching.received, 0),
      stitched: subComponentRows.reduce((s, r) => s + r.stitching.stitched, 0),
      rejections: subComponentRows.reduce((s, r) => s + r.stitching.rejections, 0),
      netPieces: subComponentRows.reduce((s, r) => s + r.stitching.netPieces, 0),
    },
    finishing: {
      issued: subComponentRows.reduce((s, r) => s + r.finishing.issued, 0),
      received: subComponentRows.reduce((s, r) => s + r.finishing.received, 0),
    },
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/job-card-management"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all duration-150 flex-shrink-0 mt-0.5"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-700 text-foreground">{batch.batchNo}</h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-700 ${
                batch.status === 'completed'
                  ? 'bg-success-bg text-success border border-success-border' :'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              {batch.status === 'completed'
                ? (lang === 'hi' ? 'पूरा हो गया' : 'Completed')
                : (lang === 'hi' ? 'चल रहा है' : 'Active')}
            </span>
            {hasCompositions && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-purple-100 text-purple-700 border border-purple-200">
                <Layers size={11} />
                {compositions.length}-piece set
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {jobCard.jobCardNo} · <Link
              href={`/item-master?search=${encodeURIComponent(jobCard.styleEn)}`}
              className="text-primary hover:underline"
            >
              {jobCard.styleEn}
            </Link> · {jobCard.partyName}
          </p>
        </div>
      </div>

      {/* Composition info banner */}
      {hasCompositions && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={15} className="text-purple-600" />
            <span className="text-sm font-700 text-purple-700">
              {lang === 'hi' ? 'सेट कम्पोज़िशन' : 'Set Composition'} — {compositions.map(c => c.component_name).join(' + ')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {compositions.map((comp) => (
              <div key={comp.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-purple-200 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-xs font-600 text-foreground">{comp.component_name}</span>
                <span className="text-xs text-muted-foreground">×{comp.qty_per_set} {comp.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { labelEn: 'Ordered Qty', labelHi: 'ऑर्डर पीस', value: batch.totalOrderedQty, icon: <Package size={16} />, color: 'text-foreground' },
          { labelEn: 'Cut Pieces', labelHi: 'कटे पीस', value: cuttingOut, icon: <Scissors size={16} />, color: 'text-blue-600' },
          { labelEn: 'Finished', labelHi: 'फिनिश्ड', value: finishingOut, icon: <Sparkles size={16} />, color: 'text-green-600' },
        ].map((m, i) => (
          <div key={i} className="card-surface p-4">
            <div className={`flex items-center gap-1.5 mb-1 ${m.color}`}>
              {m.icon}
              <span className="section-label">{lang === 'hi' ? m.labelHi : m.labelEn}</span>
            </div>
            <p className="text-2xl font-800 text-foreground tabular-nums">{m.value.toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      {/* Efficiency + Loss bar */}
      <div className="card-surface p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-600 text-foreground">{lang === 'hi' ? 'उत्पादन दक्षता' : 'Production Efficiency'}</span>
            <span className="text-sm font-800 text-primary tabular-nums">{efficiency}%</span>
          </div>
          <div className="bg-border rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${efficiency >= 90 ? 'bg-success' : efficiency >= 70 ? 'bg-primary' : 'bg-warning'}`}
              style={{ width: `${efficiency}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 sm:border-l sm:border-border sm:pl-4">
          <TrendingDown size={16} className="text-danger flex-shrink-0" />
          <div>
            <p className="section-label">{lang === 'hi' ? 'कुल नुकसान' : 'Total Loss'}</p>
            <p className="text-lg font-800 text-danger tabular-nums">{totalLoss.toLocaleString('en-IN')} <span className="text-sm font-500 text-muted-foreground">{lang === 'hi' ? 'पीस' : 'pcs'}</span></p>
          </div>
        </div>
      </div>

      {/* Sub-Component Wise Report Table */}
      <div className="card-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-700 text-foreground">
              {lang === 'hi' ? 'सब-कम्पोनेंट वाइज़ रिपोर्ट' : 'Sub-Component Wise Report'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === 'hi' ?'प्रत्येक कम्पोनेंट की कटाई, सिलाई और फिनिशिंग की स्थिति' :'Cutting → Stitching → Finishing quantities per component'}
            </p>
          </div>
          {loadingReport && (
            <svg className="animate-spin w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
        </div>

        {subComponentRows.length === 0 && !loadingReport ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <FileText size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {lang === 'hi' ? 'कोई एंट्री नहीं मिली' : 'No manufacturing entries found for this job card'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="bg-muted border-b border-border">
                  <th className="px-4 py-3 text-left" rowSpan={2}>
                    <span className="section-label">{lang === 'hi' ? 'कम्पोनेंट' : 'Component'}</span>
                  </th>
                  {/* Cutting */}
                  <th className="px-3 py-2 text-center border-l border-border" colSpan={3}>
                    <div className="flex items-center justify-center gap-1 text-blue-600">
                      <Scissors size={12} />
                      <span className="section-label">{lang === 'hi' ? 'कटाई' : 'Cutting'}</span>
                    </div>
                  </th>
                  {/* Stitching */}
                  <th className="px-3 py-2 text-center border-l border-border" colSpan={3}>
                    <div className="flex items-center justify-center gap-1 text-purple-600">
                      <Shirt size={12} />
                      <span className="section-label">{lang === 'hi' ? 'सिलाई' : 'Stitching'}</span>
                    </div>
                  </th>
                  {/* Finishing */}
                  <th className="px-3 py-2 text-center border-l border-border" colSpan={2}>
                    <div className="flex items-center justify-center gap-1 text-green-600">
                      <Sparkles size={12} />
                      <span className="section-label">{lang === 'hi' ? 'फिनिशिंग' : 'Finishing'}</span>
                    </div>
                  </th>
                </tr>
                <tr className="bg-muted/60 border-b border-border text-muted-foreground">
                  {/* Cutting sub-headers */}
                  <th className="px-3 py-2 text-center font-500 border-l border-border">{lang === 'hi' ? 'कटे' : 'Cut'}</th>
                  <th className="px-3 py-2 text-center font-500 text-danger">{lang === 'hi' ? 'रिजेक्ट' : 'Rej.'}</th>
                  <th className="px-3 py-2 text-center font-500 text-success">{lang === 'hi' ? 'नेट' : 'Net'}</th>
                  {/* Stitching sub-headers */}
                  <th className="px-3 py-2 text-center font-500 border-l border-border">{lang === 'hi' ? 'मिले' : 'Rcvd'}</th>
                  <th className="px-3 py-2 text-center font-500 text-danger">{lang === 'hi' ? 'रिजेक्ट' : 'Rej.'}</th>
                  <th className="px-3 py-2 text-center font-500 text-success">{lang === 'hi' ? 'नेट' : 'Net'}</th>
                  {/* Finishing sub-headers */}
                  <th className="px-3 py-2 text-center font-500 border-l border-border">{lang === 'hi' ? 'भेजे' : 'Issued'}</th>
                  <th className="px-3 py-2 text-center font-500 text-success">{lang === 'hi' ? 'मिले' : 'Rcvd'}</th>
                </tr>
              </thead>
              <tbody>
                {subComponentRows.map((row, idx) => (
                  <tr key={row.component} className={`border-b border-border ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                        <span className="font-600 text-foreground">{row.component}</span>
                      </div>
                    </td>
                    {/* Cutting */}
                    <td className="px-3 py-3 text-center tabular-nums border-l border-border/50">
                      {row.cutting.totalCut > 0 ? <span className="font-600">{row.cutting.totalCut.toLocaleString('en-IN')}</span> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-danger">
                      {row.cutting.rejections > 0 ? row.cutting.rejections.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-700 text-blue-600">
                      {row.cutting.netPieces > 0 ? row.cutting.netPieces.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {/* Stitching */}
                    <td className="px-3 py-3 text-center tabular-nums border-l border-border/50">
                      {row.stitching.received > 0 ? row.stitching.received.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums text-danger">
                      {row.stitching.rejections > 0 ? row.stitching.rejections.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-700 text-purple-600">
                      {row.stitching.netPieces > 0 ? row.stitching.netPieces.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {/* Finishing */}
                    <td className="px-3 py-3 text-center tabular-nums border-l border-border/50">
                      {row.finishing.issued > 0 ? row.finishing.issued.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-700 text-green-600">
                      {row.finishing.received > 0 ? row.finishing.received.toLocaleString('en-IN') : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                {subComponentRows.length > 1 && (
                  <tr className="bg-muted border-t-2 border-border">
                    <td className="px-4 py-3">
                      <span className="text-xs font-800 text-foreground">{lang === 'hi' ? 'कुल' : 'Total'}</span>
                    </td>
                    {/* Cutting totals */}
                    <td className="px-3 py-3 text-center tabular-nums font-700 border-l border-border/50">
                      {totalsRow.cutting.totalCut > 0 ? totalsRow.cutting.totalCut.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-700 text-danger">
                      {totalsRow.cutting.rejections > 0 ? totalsRow.cutting.rejections.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-800 text-blue-600">
                      {totalsRow.cutting.netPieces > 0 ? totalsRow.cutting.netPieces.toLocaleString('en-IN') : '—'}
                    </td>
                    {/* Stitching totals */}
                    <td className="px-3 py-3 text-center tabular-nums font-700 border-l border-border/50">
                      {totalsRow.stitching.received > 0 ? totalsRow.stitching.received.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-700 text-danger">
                      {totalsRow.stitching.rejections > 0 ? totalsRow.stitching.rejections.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-800 text-purple-600">
                      {totalsRow.stitching.netPieces > 0 ? totalsRow.stitching.netPieces.toLocaleString('en-IN') : '—'}
                    </td>
                    {/* Finishing totals */}
                    <td className="px-3 py-3 text-center tabular-nums font-700 border-l border-border/50">
                      {totalsRow.finishing.issued > 0 ? totalsRow.finishing.issued.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums font-800 text-green-600">
                      {totalsRow.finishing.received > 0 ? totalsRow.finishing.received.toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Stage links footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex flex-wrap gap-3">
          {STAGES.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className={`flex items-center gap-1.5 text-xs font-500 hover:underline underline-offset-2 ${s.color}`}
            >
              {s.icon}
              {lang === 'hi' ? s.labelHi : s.labelEn}
              <ChevronRight size={11} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
