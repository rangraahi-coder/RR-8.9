'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Layers, FileText, Droplets, Scissors, Sparkles, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { FabricStockItem } from '@/app/fabric-inventory/data/fabricStockData';

const CATEGORY_LABELS: Record<string, string> = {
  JK: 'JK', MALMAL: 'Malmal', RAYON: 'Rayon',
  YUFTA: 'Yufta', KERI_PRINT: 'Keri Print', OTHER: 'Other',
};
const CATEGORY_COLORS: Record<string, string> = {
  JK: 'bg-blue-100 text-blue-700', MALMAL: 'bg-purple-100 text-purple-700',
  RAYON: 'bg-green-100 text-green-700', YUFTA: 'bg-amber-100 text-amber-700',
  KERI_PRINT: 'bg-rose-100 text-rose-700', OTHER: 'bg-gray-100 text-gray-600',
};

interface GreyPurchase {
  id: string; purchaseNo: string; date: string; supplierName: string;
  receivedQty: number; unit: string; ratePerUnit: number; totalAmount: number;
  status: string; balanceInStock: number;
}
interface DyeingEntry {
  id: string; entryNo: string; date: string; processType: string;
  processorName: string; qtyMeters: number; colourShade: string;
  status: string; sentDate?: string; receivedDate?: string;
  finishedFabricName?: string;
}
interface CuttingEntry {
  id: string; entryNo: string; date: string; jobCardRef: string;
  styleName: string; cuttingMaster: string; fabricConsumedQty: number;
  unit: string; totalPiecesCut: number; netPiecesForStitching: number;
}
interface EmbFabricIssue {
  id: string; entryRef: string; issueDate: string; operatorName: string;
  embroideryType: string; issuedQty: number; consumedQty: number;
  returnedQty: number; unit: string; finishedPieces: number;
}

interface SectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  children: React.ReactNode;
}

function CollapsibleSection({ title, subtitle, icon, count, colorClass, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${colorClass}`}>{icon}</div>
          <div className="text-left">
            <h2 className="text-sm font-700 text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${colorClass}`}>{count}</span>
          {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </div>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function EmptyRows({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-muted-foreground">{message}</div>
  );
}

/** Renders a voucher/entry number as a clickable link, or plain text if no href */
function VoucherLink({ label, href }: { label: string; href?: string }) {
  if (!label || label === '—') return <span className="text-xs text-muted-foreground">—</span>;
  if (!href) return <span className="text-xs font-600 text-foreground font-mono">{label}</span>;
  return (
    <Link
      href={href}
      className="text-xs font-600 text-primary hover:underline font-mono"
      title={`Open ${label}`}
    >
      {label}
    </Link>
  );
}

interface FabricDetailContentProps { id: string; }

export default function FabricDetailContent({ id }: FabricDetailContentProps) {
  const fabricName = decodeURIComponent(id);
  const [stockRows, setStockRows] = useState<FabricStockItem[]>([]);
  const [greyPurchases, setGreyPurchases] = useState<GreyPurchase[]>([]);
  const [dyeingEntries, setDyeingEntries] = useState<DyeingEntry[]>([]);
  const [cuttingEntries, setCuttingEntries] = useState<CuttingEntry[]>([]);
  const [embFabricIssues, setEmbFabricIssues] = useState<EmbFabricIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      try {
        // Load finished inventory entries for this fabric name
        const inventoryData = await fabricInventoryService.getEntriesByFabricName(fabricName);

        // Derive grey fabric refs from inventory lineage
        const greyRefs = Array.from(new Set(
          inventoryData
            .map((r) => r.sourceGreyFabricRef)
            .filter(Boolean) as string[]
        ));

        // Load grey purchases linked via lineage OR by fabric name match
        const [greyData, dyeingData, cuttingData, embIssueData] = await Promise.all([
          greyRefs.length > 0
            ? supabase.from('grey_fabric_purchases').select('*').in('purchase_no', greyRefs).order('created_at', { ascending: false })
            : supabase.from('grey_fabric_purchases').select('*').ilike('fabric_name', fabricName).order('created_at', { ascending: false }),
          // Dyeing entries: match by finished_fabric_name OR gray_fabric_ref
          supabase.from('dyeing_processing_entries').select('*')
            .or(`finished_fabric_name.ilike.${fabricName},gray_fabric_ref.ilike.${fabricName}`)
            .order('created_at', { ascending: false }),
          supabase.from('cutting_entries').select('*').ilike('fabric_name', fabricName).order('created_at', { ascending: false }),
          supabase.from('embroidery_fabric_issues').select('*').ilike('fabric_name', fabricName).order('created_at', { ascending: false }),
        ]);

        setStockRows(inventoryData);

        setGreyPurchases((greyData.data || []).map((r: any): GreyPurchase => ({
          id: r.id, purchaseNo: r.purchase_no, date: r.date,
          supplierName: r.supplier_name, receivedQty: Number(r.received_qty) || 0,
          unit: r.unit, ratePerUnit: Number(r.rate_per_unit) || 0,
          totalAmount: Number(r.total_amount) || 0, status: r.status,
          balanceInStock: Number(r.balance_in_stock) || 0,
        })));

        setDyeingEntries((dyeingData.data || []).map((r: any): DyeingEntry => ({
          id: r.id, entryNo: r.entry_no, date: r.date, processType: r.process_type,
          processorName: r.processor_name || '—', qtyMeters: Number(r.qty_meters) || 0,
          colourShade: r.colour_shade || '—', status: r.status,
          sentDate: r.sent_date, receivedDate: r.received_date,
          finishedFabricName: r.finished_fabric_name || undefined,
        })));

        setCuttingEntries((cuttingData.data || []).map((r: any): CuttingEntry => ({
          id: r.id, entryNo: r.entry_no, date: r.date,
          jobCardRef: r.job_card_ref || '—', styleName: r.style_name || '—',
          cuttingMaster: r.cutting_master || '—',
          fabricConsumedQty: Number(r.fabric_consumed_qty) || 0,
          unit: r.unit || 'Metres', totalPiecesCut: r.total_pieces_cut || 0,
          netPiecesForStitching: r.net_pieces_for_stitching || 0,
        })));

        setEmbFabricIssues((embIssueData.data || []).map((r: any): EmbFabricIssue => ({
          id: r.id, entryRef: r.entry_ref || '—', issueDate: r.issue_date,
          operatorName: r.operator_name || '—', embroideryType: r.embroidery_type || '—',
          issuedQty: Number(r.issued_qty) || 0, consumedQty: Number(r.consumed_qty) || 0,
          returnedQty: Number(r.returned_qty) || 0, unit: r.unit || 'Metre',
          finishedPieces: r.finished_pieces || 0,
        })));

      } catch (err: any) {
        setError(err?.message || 'Failed to load fabric details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fabricName]);

  const totalQty = stockRows.reduce((sum, e) => sum + e.stockQty, 0);
  const category = stockRows[0]?.category ?? 'OTHER';
  const unit = stockRows[0]?.unit ?? 'Metre';
  const totalGreyReceived = greyPurchases.reduce((s, r) => s + r.receivedQty, 0);
  const totalDyeingQty = dyeingEntries.reduce((s, r) => s + r.qtyMeters, 0);
  const totalCuttingConsumed = cuttingEntries.reduce((s, r) => s + r.fabricConsumedQty, 0);
  const totalEmbIssued = embFabricIssues.reduce((s, r) => s + r.issuedQty, 0);

  // Lineage from first inventory row
  const firstRow = stockRows[0];
  const sourceGreyRef = firstRow?.sourceGreyFabricRef;
  const processorName = firstRow?.processorName;
  const processingType = firstRow?.processingType;
  const receivedDate = firstRow?.receivedDate;
  const sourceModule = firstRow?.sourceModule;

  const fmt = (n: number, d = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading fabric details…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Package size={48} className="text-muted-foreground opacity-30" />
        <p className="text-lg font-600 text-foreground">Error loading fabric</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/fabric-inventory" className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Back to Fabric Inventory
        </Link>
      </div>
    );
  }

  const hasAnyData = stockRows.length > 0 || dyeingEntries.length > 0 || cuttingEntries.length > 0 || embFabricIssues.length > 0;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Package size={48} className="text-muted-foreground opacity-30" />
        <p className="text-lg font-600 text-foreground">No data found for "{fabricName}"</p>
        <Link href="/fabric-inventory" className="flex items-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Back to Fabric Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl">
      {/* Back */}
      <Link href="/fabric-inventory" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft size={15} /> Back to Fabric Inventory
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 bg-emerald-100 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Finished Fabric
          </span>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-600 ${CATEGORY_COLORS[category]}`}>
            {CATEGORY_LABELS[category]}
          </span>
          {processingType && (
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-600 bg-blue-100 text-blue-700 capitalize">
              {processingType}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-700 text-foreground leading-tight">{fabricName}</h1>
        <p className="text-sm text-muted-foreground">Finished fabric — full transaction history and source traceability</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers size={13} />
            <span className="text-xs font-600 uppercase tracking-wide">Finished Balance</span>
          </div>
          <p className="text-2xl font-700 text-primary tabular-nums">{fmt(totalQty)}</p>
          <p className="text-xs text-muted-foreground">{unit}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Droplets size={13} />
            <span className="text-xs font-600 uppercase tracking-wide">Processed Qty</span>
          </div>
          <p className="text-2xl font-700 text-cyan-600 tabular-nums">{fmt(totalDyeingQty)}</p>
          <p className="text-xs text-muted-foreground">Metres processed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scissors size={13} />
            <span className="text-xs font-600 uppercase tracking-wide">Cutting Used</span>
          </div>
          <p className="text-2xl font-700 text-orange-600 tabular-nums">{fmt(totalCuttingConsumed)}</p>
          <p className="text-xs text-muted-foreground">Metres consumed</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles size={13} />
            <span className="text-xs font-600 uppercase tracking-wide">Emb Issued</span>
          </div>
          <p className="text-2xl font-700 text-purple-600 tabular-nums">{fmt(totalEmbIssued)}</p>
          <p className="text-xs text-muted-foreground">Metres issued</p>
        </div>
      </div>

      {/* ── Traceability: Source Grey Fabric ── */}
      {(sourceGreyRef || processorName || greyPurchases.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={15} className="text-amber-600" />
            <h2 className="text-sm font-700 text-amber-800">Source Grey Fabric Traceability</h2>
            <span className="text-xs text-amber-600 font-500">(for audit purposes — not the inventory identity)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-600 text-amber-700">Source Grey Ref</span>
              <span className="text-sm font-700 text-amber-900">{sourceGreyRef || (greyPurchases[0]?.purchaseNo) || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-600 text-amber-700">Processor / Mill</span>
              <span className="text-sm font-700 text-amber-900">{processorName || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-600 text-amber-700">Process Type</span>
              <span className="text-sm font-700 text-amber-900 capitalize">{processingType || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-600 text-amber-700">Received Date</span>
              <span className="text-sm font-700 text-amber-900">{receivedDate ? fmtDate(receivedDate) : '—'}</span>
            </div>
          </div>
          {greyPurchases.length > 0 && (
            <div className="mt-3 pt-3 border-t border-amber-200">
              <p className="text-xs font-600 text-amber-700 mb-2">Linked Grey Fabric Purchases</p>
              <div className="flex flex-col gap-1.5">
                {greyPurchases.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 text-xs">
                    <VoucherLink label={p.purchaseNo} href="/grey-fabric" />
                    <span className="text-amber-700">{p.supplierName || '—'}</span>
                    <span className="text-amber-600 tabular-nums">{fmt(p.receivedQty)} {p.unit} received</span>
                    <span className="text-amber-600 tabular-nums">{fmt(p.balanceInStock)} balance</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 1. Finished Inventory Entries ── */}
      <CollapsibleSection
        title="Finished Inventory Entries"
        subtitle={`Processed fabric stock entries for "${fabricName}"`}
        icon={<FileText size={14} className="text-emerald-600" />}
        count={stockRows.length}
        colorClass="bg-emerald-100 text-emerald-600"
      >
        {stockRows.length === 0 ? (
          <EmptyRows message="No finished inventory entries found for this fabric." />
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-600 text-muted-foreground">Finished Fabric Name</span>
              <span className="text-xs font-600 text-muted-foreground">Category</span>
              <span className="text-xs font-600 text-muted-foreground">Stock Qty</span>
              <span className="text-xs font-600 text-muted-foreground">Source</span>
              <span className="text-xs font-600 text-muted-foreground">Received Date</span>
            </div>
            <div className="divide-y divide-border/50">
              {stockRows.map((row) => (
                <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors">
                  <span className="text-xs font-700 text-foreground">{row.finishedFabricName || row.fabricName}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full w-fit font-500">{row.category}</span>
                  <span className="text-sm font-700 text-primary tabular-nums">{fmt(row.stockQty)} {row.unit}</span>
                  <span className="text-xs text-muted-foreground capitalize">{row.sourceModule?.replace('_', ' ') || 'manual'}</span>
                  <span className="text-xs text-muted-foreground">{row.receivedDate ? fmtDate(row.receivedDate) : '—'}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
              <span className="text-xs font-600 text-muted-foreground">{stockRows.length} entr{stockRows.length !== 1 ? 'ies' : 'y'}</span>
              <span className="text-sm font-700 text-primary tabular-nums">{fmt(totalQty)} {unit} total balance</span>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* ── 2. Dyeing / Processing ── */}
      <CollapsibleSection
        title="Dyeing / Processing History"
        subtitle="Processing entries that produced this finished fabric"
        icon={<Droplets size={14} className="text-cyan-600" />}
        count={dyeingEntries.length}
        colorClass="bg-cyan-100 text-cyan-600"
      >
        {dyeingEntries.length === 0 ? <EmptyRows message="No dyeing or processing entries found for this fabric." /> : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-5 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-600 text-muted-foreground">Entry No</span>
              <span className="text-xs font-600 text-muted-foreground">Date</span>
              <span className="text-xs font-600 text-muted-foreground">Processor</span>
              <span className="text-xs font-600 text-muted-foreground">Process</span>
              <span className="text-xs font-600 text-muted-foreground">Qty (m)</span>
              <span className="text-xs font-600 text-muted-foreground">Status</span>
            </div>
            <div className="divide-y divide-border/50">
              {dyeingEntries.map((d) => (
                <div key={d.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_1fr] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors">
                  <VoucherLink label={d.entryNo} href="/dyeing-printing" />
                  <span className="text-xs text-muted-foreground">{fmtDate(d.date)}</span>
                  <span className="text-xs text-foreground">{d.processorName}</span>
                  <span className="text-xs capitalize text-muted-foreground">{d.processType}</span>
                  <span className="text-xs font-700 text-cyan-600 tabular-nums">{fmt(d.qtyMeters)}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-600 px-2 py-0.5 rounded-full w-fit ${d.status === 'received' ? 'bg-green-100 text-green-700' : d.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {d.status}
                    </span>
                    {d.receivedDate && <span className="text-xs text-muted-foreground">Rcvd: {fmtDate(d.receivedDate)}</span>}
                    {d.finishedFabricName && <span className="text-xs text-emerald-600 font-500">→ {d.finishedFabricName}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
              <span className="text-xs font-600 text-muted-foreground">Total processed ({dyeingEntries.length} entries)</span>
              <span className="text-sm font-700 text-cyan-600 tabular-nums">{fmt(totalDyeingQty)} m</span>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* ── 3. Cutting Usage ── */}
      <CollapsibleSection
        title="Cutting Usage"
        subtitle="Cutting entries that consumed this finished fabric"
        icon={<Scissors size={14} className="text-orange-600" />}
        count={cuttingEntries.length}
        colorClass="bg-orange-100 text-orange-600"
      >
        {cuttingEntries.length === 0 ? <EmptyRows message="No cutting entries found for this fabric." /> : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_0.8fr_0.8fr] gap-3 px-5 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-600 text-muted-foreground">Entry No</span>
              <span className="text-xs font-600 text-muted-foreground">Date</span>
              <span className="text-xs font-600 text-muted-foreground">Job Card</span>
              <span className="text-xs font-600 text-muted-foreground">Cutting Master</span>
              <span className="text-xs font-600 text-muted-foreground">Consumed</span>
              <span className="text-xs font-600 text-muted-foreground">Pieces Cut</span>
            </div>
            <div className="divide-y divide-border/50">
              {cuttingEntries.map((c) => (
                <div key={c.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_0.8fr_0.8fr] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors">
                  <VoucherLink label={c.entryNo} href="/cutting" />
                  <span className="text-xs text-muted-foreground">{fmtDate(c.date)}</span>
                  <VoucherLink label={c.jobCardRef !== '—' ? c.jobCardRef : ''} href={c.jobCardRef !== '—' ? '/job-card-management' : undefined} />
                  <span className="text-xs text-muted-foreground">{c.cuttingMaster}</span>
                  <span className="text-xs font-700 text-orange-600 tabular-nums">{fmt(c.fabricConsumedQty)} {c.unit}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-700 text-foreground tabular-nums">{c.totalPiecesCut} pcs</span>
                    <span className="text-xs text-muted-foreground">Net: {c.netPiecesForStitching}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
              <span className="text-xs font-600 text-muted-foreground">Total consumed ({cuttingEntries.length} entries)</span>
              <span className="text-sm font-700 text-orange-600 tabular-nums">{fmt(totalCuttingConsumed)} Metres</span>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* ── 4. Embroidery Fabric Issues ── */}
      <CollapsibleSection
        title="Embroidery Fabric Issues"
        subtitle="Finished fabric issued for embroidery work"
        icon={<Sparkles size={14} className="text-purple-600" />}
        count={embFabricIssues.length}
        colorClass="bg-purple-100 text-purple-600"
      >
        {embFabricIssues.length === 0 ? <EmptyRows message="No embroidery fabric issues found for this fabric." /> : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_0.8fr_0.8fr] gap-3 px-5 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-600 text-muted-foreground">Entry Ref</span>
              <span className="text-xs font-600 text-muted-foreground">Issue Date</span>
              <span className="text-xs font-600 text-muted-foreground">Operator</span>
              <span className="text-xs font-600 text-muted-foreground">Type</span>
              <span className="text-xs font-600 text-muted-foreground">Issued</span>
              <span className="text-xs font-600 text-muted-foreground">Consumed</span>
            </div>
            <div className="divide-y divide-border/50">
              {embFabricIssues.map((e) => (
                <div key={e.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_0.8fr_0.8fr] gap-3 px-5 py-3 items-center hover:bg-muted/20 transition-colors">
                  <VoucherLink label={e.entryRef} href="/embroidery-accessory" />
                  <span className="text-xs text-muted-foreground">{fmtDate(e.issueDate)}</span>
                  <span className="text-xs text-foreground">{e.operatorName}</span>
                  <span className="text-xs text-muted-foreground capitalize">{e.embroideryType.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-700 text-purple-600 tabular-nums">{fmt(e.issuedQty)} {e.unit}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-700 text-foreground tabular-nums">{fmt(e.consumedQty)} {e.unit}</span>
                    {e.returnedQty > 0 && <span className="text-xs text-green-600">Ret: {fmt(e.returnedQty)}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
              <span className="text-xs font-600 text-muted-foreground">Total issued ({embFabricIssues.length} entries)</span>
              <span className="text-sm font-700 text-purple-600 tabular-nums">{fmt(totalEmbIssued)} Metre</span>
            </div>
          </>
        )}
      </CollapsibleSection>
    </div>
  );
}
