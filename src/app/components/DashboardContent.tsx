'use client';
import React from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Scissors,
  Layers,
  PackageCheck,
  Truck,
  BarChart3,
  Circle,
  RefreshCw,
  ShoppingCart,
  Shirt,
  FlaskConical,
  Sparkles,
  Package,
  TrendingUp,
  Activity,
  Clock,
  Hash,
} from 'lucide-react';
import MetricCard from '@/components/ui/MetricCard';
import ItemWorkflowProgress from './ItemWorkflowProgress';
import { useRealtimeData } from '@/contexts/RealtimeDataContext';

interface DashboardContentProps {
  lang: 'en' | 'hi';
}

interface JobCard {
  id: string;
  jobCardNo: string;
  partyName: string;
  stage: string;
  totalPieces: number;
  completedPieces: number;
  isBlocked: boolean;
  updatedAt: string;
}

const STAGE_CONFIG = [
  { key: 'cutting',         labelEn: 'Cutting',          labelHi: 'कटिंग',          icon: Scissors,    color: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  { key: 'dyeing_printing', labelEn: 'Dyeing/Printing',  labelHi: 'डाइंग/प्रिंटिंग', icon: Layers,      color: 'text-violet-500',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  { key: 'stitching',       labelEn: 'Stitching',        labelHi: 'सिलाई',           icon: Circle,      color: 'text-blue-500',    bg: 'bg-blue-50',    border: 'border-blue-200'   },
  { key: 'finishing',       labelEn: 'Finishing',        labelHi: 'फिनिशिंग',        icon: PackageCheck, color: 'text-teal-500',   bg: 'bg-teal-50',    border: 'border-teal-200'   },
  { key: 'dispatch',        labelEn: 'Dispatch Ready',   labelHi: 'डिस्पैच रेडी',    icon: Truck,       color: 'text-green-600',   bg: 'bg-green-50',   border: 'border-green-200'  },
  { key: 'completed',       labelEn: 'Completed',        labelHi: 'पूरे',             icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200'},
];

const STAGE_KEY_MAP: Record<string, string> = {
  cutting: 'cutting',
  stitching: 'stitching',
  embroidery: 'dyeing_printing',
  finishing: 'finishing',
  qc: 'finishing',
  dispatch_ready: 'dispatch',
  dispatched: 'completed',
};

const TABLE_LABEL_MAP: Record<string, { en: string; hi: string }> = {
  job_cards: { en: 'Job Card', hi: 'जॉब कार्ड' },
  sales_orders: { en: 'Sales Order', hi: 'सेल्स ऑर्डर' },
  cutting_entries: { en: 'Cutting Entry', hi: 'कटिंग एंट्री' },
  stitch_issue_vouchers: { en: 'Stitch Issue', hi: 'स्टिच इश्यू' },
  stitch_receive_vouchers: { en: 'Stitch Receive', hi: 'स्टिच रिसीव' },
  qc_entries: { en: 'QC Entry', hi: 'QC एंट्री' },
  emb_issue_vouchers: { en: 'Emb Issue', hi: 'एम्ब इश्यू' },
  emb_receive_vouchers: { en: 'Emb Receive', hi: 'एम्ब रिसीव' },
  dyeing_processing_entries: { en: 'Dyeing Entry', hi: 'डाइंग एंट्री' },
  fabric_inventory: { en: 'Fabric Inventory', hi: 'फैब्रिक इन्वेंटरी' },
};

function SkeletonCard() {
  return (
    <div className="card-surface p-5 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2 mb-3" />
      <div className="h-8 bg-muted rounded w-1/3" />
    </div>
  );
}

export default function DashboardContent({ lang }: DashboardContentProps) {
  const {
    jobCards: rawCards,
    jobCardsLoading: loading,
    salesOrders,
    salesOrdersLoading,
    refreshAll,
    cuttingMetrics,
    stitchingMetrics,
    qcMetrics,
    embroideryMetrics,
    dyeingMetrics,
    fabricInventoryMetrics,
    metricsLoading,
    recentEvents,
    totalPieces,
    totalUnits,
  } = useRealtimeData();

  const cards: JobCard[] = rawCards.map((c) => ({
    id: c.id,
    jobCardNo: c.jobCardNo,
    partyName: c.partyName,
    stage: c.stage,
    totalPieces: c.totalPieces,
    completedPieces: c.completedPieces,
    isBlocked: c.isBlocked,
    updatedAt: c.updatedAt,
  }));

  const totalCards     = cards.length;
  const blockedCards   = cards.filter((c) => c.isBlocked).length;
  const completedCards = cards.filter((c) => c.stage === 'dispatched').length;
  const activeCards    = totalCards - completedCards;

  const stageCounts = STAGE_CONFIG.map((s) => {
    const matchingCards = cards.filter((c) => {
      const mapped = STAGE_KEY_MAP[c.stage] ?? c.stage;
      return mapped === s.key;
    });
    return {
      ...s,
      count: matchingCards.length,
      pieces: matchingCards.reduce((sum, c) => sum + (c.totalPieces || 0), 0),
    };
  });

  const recentCards = cards.slice(0, 5);

  // Sales order derived
  const totalSalesQty = salesOrders.reduce((s, o) => s + (o.totalQty || 0), 0);
  const pendingSalesOrders = salesOrders.filter((o) => o.status === 'pending' || o.status === 'open').length;

  const isAnyLoading = loading || metricsLoading || salesOrdersLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-700 text-foreground">
            {lang === 'hi' ? 'ERP डैशबोर्ड' : 'ERP Dashboard'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {lang === 'hi' ? 'लाइव डेटा — सभी मॉड्यूल' : 'Live data — all modules'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={isAnyLoading}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title={lang === 'hi' ? 'रिफ्रेश' : 'Refresh all'}
          >
            <RefreshCw size={14} className={isAnyLoading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
          </button>
          <Link href="/job-card-management" className="btn-secondary flex items-center gap-1.5 text-sm">
            <BarChart3 size={14} />
            {lang === 'hi' ? 'सभी जॉब कार्ड' : 'All Job Cards'}
          </Link>
          <Link href="/job-card-management" className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} />
            {lang === 'hi' ? 'नया जॉब कार्ड' : 'New Job Card'}
          </Link>
        </div>
      </div>

      {/* ── Row 1: Top KPIs ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Job Cards */}
          <Link href="/job-card-management" className="lg:col-span-2 block group">
            <MetricCard
              labelEn="Total Job Cards"
              labelHi="कुल जॉब कार्ड"
              value={String(totalCards)}
              subValue={lang === 'hi' ? 'जॉब कार्ड' : 'job cards'}
              trend="neutral"
              trendValue={lang === 'hi' ? 'सभी ऑर्डर' : 'all orders'}
              variant="default"
              icon={<ClipboardList size={18} />}
              lang={lang}
              className="bg-gradient-to-br from-primary/5 to-secondary/30 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full"
            >
              <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="text-lg font-800 tabular-nums text-violet-600">{activeCards}</p>
                  <p className="text-xs text-muted-foreground font-500">{lang === 'hi' ? 'चालू' : 'Active'}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-800 tabular-nums text-green-600">{completedCards}</p>
                  <p className="text-xs text-muted-foreground font-500">{lang === 'hi' ? 'पूरे' : 'Completed'}</p>
                </div>
              </div>
            </MetricCard>
          </Link>

          {/* Total Pieces — main unit quantity (sets/items ordered) */}
          <Link href="/job-card-management" className="block group">
            <MetricCard
              labelEn="Total Pieces"
              labelHi="कुल पीस"
              value={totalPieces.toLocaleString('en-IN')}
              subValue={lang === 'hi' ? 'मुख्य यूनिट' : 'main units'}
              trend="neutral"
              trendValue={lang === 'hi' ? 'सभी जॉब कार्ड' : 'across all cards'}
              variant="default"
              icon={<PackageCheck size={18} />}
              lang={lang}
              className="group-hover:shadow-md transition-shadow duration-150 cursor-pointer"
            />
          </Link>

          {/* Total Units — combined sum of all sub-component quantities */}
          <Link href="/cutting" className="block group">
            <MetricCard
              labelEn="Total Units"
              labelHi="कुल यूनिट"
              value={totalUnits.toLocaleString('en-IN')}
              subValue={lang === 'hi' ? 'सब-कॉम्पोनेंट' : 'sub-components'}
              trend="neutral"
              trendValue={lang === 'hi' ? 'सभी कॉम्पोनेंट' : 'all components'}
              variant="default"
              icon={<Hash size={18} />}
              lang={lang}
              className="group-hover:shadow-md transition-shadow duration-150 cursor-pointer"
            />
          </Link>

          {/* Blocked */}
          <Link href="/job-card-management?filter=blocked" className="block group">
            <MetricCard
              labelEn="Blocked Cards"
              labelHi="रुके हुए कार्ड"
              value={String(blockedCards)}
              subValue={lang === 'hi' ? 'रुके हुए' : 'blocked'}
              trend={blockedCards > 0 ? 'down' : 'neutral'}
              trendValue={blockedCards > 0 ? (lang === 'hi' ? 'ध्यान दें' : 'needs attention') : (lang === 'hi' ? 'सब ठीक है' : 'all clear')}
              variant={blockedCards > 0 ? 'danger' : 'success'}
              icon={<AlertTriangle size={18} />}
              lang={lang}
              className="group-hover:shadow-md transition-shadow duration-150 cursor-pointer"
            >
              {blockedCards === 0 && (
                <p className="text-xs text-success font-600 mt-2">✓ {lang === 'hi' ? 'कोई रुकावट नहीं' : 'No blockages'}</p>
              )}
            </MetricCard>
          </Link>
        </div>
      )}

      {/* ── Row 2: Module Metrics ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-700 text-foreground flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            {lang === 'hi' ? 'मॉड्यूल मेट्रिक्स' : 'Module Metrics'}
          </h3>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {lang === 'hi' ? 'लाइव' : 'Live'}
          </span>
        </div>

        {metricsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">

            {/* Sales Orders */}
            <Link href="/sales-orders" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-indigo-50 rounded-lg">
                    <ShoppingCart size={14} className="text-indigo-600" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'सेल्स ऑर्डर' : 'Sales Orders'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{salesOrders.length}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{totalSalesQty.toLocaleString('en-IN')} {lang === 'hi' ? 'पीस' : 'pcs'}</span>
                  {pendingSalesOrders > 0 && (
                    <span className="text-amber-600 font-600">{pendingSalesOrders} {lang === 'hi' ? 'बाकी' : 'pending'}</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Cutting */}
            <Link href="/cutting?filter=pending" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-orange-50 rounded-lg">
                    <Scissors size={14} className="text-orange-500" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'कटिंग' : 'Cutting'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{cuttingMetrics.totalEntries}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cuttingMetrics.totalPiecesCut.toLocaleString('en-IN')} {lang === 'hi' ? 'यूनिट कटे' : 'units cut'}</span>
                  {cuttingMetrics.pendingEntries > 0 && (
                    <span className="text-amber-600 font-600">{cuttingMetrics.pendingEntries} {lang === 'hi' ? 'बाकी' : 'pending'}</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Stitching */}
            <Link href="/stitching?filter=pending" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <Shirt size={14} className="text-blue-500" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'सिलाई' : 'Stitching'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{stitchingMetrics.totalIssued.toLocaleString('en-IN')}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stitchingMetrics.totalReceived.toLocaleString('en-IN')} {lang === 'hi' ? 'रिसीव' : 'received'}</span>
                  {stitchingMetrics.pendingPieces > 0 && (
                    <span className="text-amber-600 font-600">{stitchingMetrics.pendingPieces.toLocaleString('en-IN')} {lang === 'hi' ? 'बाकी' : 'pending'}</span>
                  )}
                </div>
                {stitchingMetrics.activeOperators > 0 && (
                  <p className="text-xs text-muted-foreground/70 mt-1">{stitchingMetrics.activeOperators} {lang === 'hi' ? 'ऑपरेटर' : 'operators'}</p>
                )}
              </div>
            </Link>

            {/* QC */}
            <Link href="/qc-entry?filter=pending" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-teal-50 rounded-lg">
                    <CheckCircle2 size={14} className="text-teal-600" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'QC जांच' : 'QC'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{qcMetrics.totalEntries}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-green-600 font-600">{qcMetrics.totalPassed.toLocaleString('en-IN')} ✓</span>
                  {qcMetrics.totalFailed > 0 && (
                    <span className="text-red-500 font-600">{qcMetrics.totalFailed} ✕</span>
                  )}
                  {qcMetrics.passRate > 0 && (
                    <span className="text-muted-foreground">{qcMetrics.passRate}%</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Embroidery */}
            <Link href="/embroidery-accessory?tab=issue_vouchers&filter=pending" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-pink-50 rounded-lg">
                    <Sparkles size={14} className="text-pink-500" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'एम्ब्रॉयडरी' : 'Embroidery'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{embroideryMetrics.totalIssueVouchers}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{embroideryMetrics.totalReceiveVouchers} {lang === 'hi' ? 'रिसीव' : 'received'}</span>
                  {embroideryMetrics.pendingVouchers > 0 && (
                    <span className="text-amber-600 font-600">{embroideryMetrics.pendingVouchers} {lang === 'hi' ? 'बाकी' : 'pending'}</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Dyeing */}
            <Link href="/dyeing-printing?filter=pending" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-violet-50 rounded-lg">
                    <FlaskConical size={14} className="text-violet-500" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'डाइंग/प्रिंटिंग' : 'Dyeing/Printing'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{dyeingMetrics.totalEntries}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="text-green-600 font-600">{dyeingMetrics.completedEntries} {lang === 'hi' ? 'पूरे' : 'done'}</span>
                  {dyeingMetrics.pendingEntries > 0 && (
                    <span className="text-amber-600 font-600">{dyeingMetrics.pendingEntries} {lang === 'hi' ? 'बाकी' : 'pending'}</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Fabric Inventory */}
            <Link href="/fabric-inventory" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-amber-50 rounded-lg">
                    <Package size={14} className="text-amber-600" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'फैब्रिक इन्वेंटरी' : 'Fabric Inventory'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">{fabricInventoryMetrics.totalRolls}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{fabricInventoryMetrics.totalMeters.toLocaleString('en-IN')} {lang === 'hi' ? 'मीटर' : 'mtrs'}</span>
                  {fabricInventoryMetrics.lowStockCount > 0 && (
                    <span className="text-red-500 font-600">{fabricInventoryMetrics.lowStockCount} {lang === 'hi' ? 'कम स्टॉक' : 'low stock'}</span>
                  )}
                </div>
              </div>
            </Link>

            {/* Production Progress */}
            <Link href="/production-workflow" className="block group">
              <div className="card-surface p-4 group-hover:shadow-md transition-shadow duration-150 cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-green-50 rounded-lg">
                    <TrendingUp size={14} className="text-green-600" />
                  </div>
                  <p className="text-xs font-600 text-muted-foreground">{lang === 'hi' ? 'प्रोडक्शन' : 'Production'}</p>
                </div>
                <p className="text-2xl font-800 tabular-nums text-foreground">
                  {totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0}%
                </p>
                <div className="mt-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500"
                      style={{ width: totalCards > 0 ? `${(completedCards / totalCards) * 100}%` : '0%' }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{completedCards}/{totalCards} {lang === 'hi' ? 'पूरे' : 'completed'}</p>
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* ── Row 3: Stage breakdown ── */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-700 text-foreground">
              {lang === 'hi' ? 'स्टेज-वार जॉब कार्ड' : 'Stage-wise Job Cards'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === 'hi' ? 'हर स्टेज पर कितने जॉब कार्ड हैं' : 'How many job cards are at each stage'}
            </p>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {lang === 'hi' ? 'लाइव' : 'Live'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stageCounts.map((s) => {
            const StageIcon = s.icon;
            return (
              <Link
                key={s.key}
                href={`/job-card-management?stage=${s.key}`}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border ${s.bg} ${s.border} hover:shadow-sm transition-all duration-150 group`}
              >
                <StageIcon size={20} className={`${s.color} mb-2`} />
                <p className={`text-2xl font-800 tabular-nums ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground font-500 text-center mt-0.5">
                  {lang === 'hi' ? s.labelHi : s.labelEn}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  {s.pieces.toLocaleString('en-IN')} {lang === 'hi' ? 'पीस' : 'pieces'}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Row 4: Recent Job Cards + Recent Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Job Cards */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-700 text-foreground flex items-center gap-2">
              <ClipboardList size={16} className="text-primary" />
              {lang === 'hi' ? 'हाल के जॉब कार्ड' : 'Recent Job Cards'}
            </h3>
            <Link href="/job-card-management" className="text-xs text-primary font-600 flex items-center gap-1 hover:underline">
              {lang === 'hi' ? 'सब देखें' : 'View all'} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
              ))
            ) : recentCards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {lang === 'hi' ? 'कोई जॉब कार्ड नहीं' : 'No job cards yet'}
              </p>
            ) : (
              recentCards.map((card) => {
                const mappedStage = STAGE_KEY_MAP[card.stage] ?? card.stage;
                const stageInfo = STAGE_CONFIG.find((s) => s.key === mappedStage);
                return (
                  <Link
                    key={card.id}
                    href="/job-card-management"
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-600 text-foreground truncate">{card.jobCardNo}</p>
                      <p className="text-xs text-muted-foreground truncate">{card.partyName}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${stageInfo?.bg ?? 'bg-muted'} ${stageInfo?.color ?? 'text-foreground'} ${stageInfo?.border ?? ''} border`}>
                        {lang === 'hi' ? (stageInfo?.labelHi ?? card.stage) : (stageInfo?.labelEn ?? card.stage)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {card.totalPieces} {lang === 'hi' ? 'पीस' : 'pcs'}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-700 text-foreground flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              {lang === 'hi' ? 'हाल की गतिविधि' : 'Recent Activity'}
            </h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              {lang === 'hi' ? 'रियल-टाइम' : 'Real-time'}
            </span>
          </div>
          <div className="space-y-2">
            {recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="p-3 bg-muted rounded-xl mb-3">
                  <Clock size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-600 text-foreground">
                  {lang === 'hi' ? 'कोई गतिविधि नहीं' : 'No activity yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === 'hi' ? 'कोई भी एंट्री होने पर यहाँ दिखेगी' : 'Activity will appear here as entries are made'}
                </p>
              </div>
            ) : (
              recentEvents.map((event) => {
                const tableLabel = TABLE_LABEL_MAP[event.table];
                const label = tableLabel ? (lang === 'hi' ? tableLabel.hi : tableLabel.en) : event.table;
                const eventColor =
                  event.eventType === 'INSERT' ? 'text-green-600 bg-green-50' :
                  event.eventType === 'DELETE'? 'text-red-500 bg-red-50' : 'text-blue-600 bg-blue-50';
                const eventLabel =
                  event.eventType === 'INSERT' ? (lang === 'hi' ? 'नया' : 'New') :
                  event.eventType === 'DELETE' ? (lang === 'hi' ? 'हटाया' : 'Deleted') :
                  (lang === 'hi' ? 'अपडेट' : 'Updated');
                return (
                  <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded ${eventColor} shrink-0`}>
                      {eventLabel}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-600 text-foreground truncate">{event.label}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {event.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Production Progress bars ── */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-700 text-foreground flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            {lang === 'hi' ? 'प्रोडक्शन प्रोग्रेस' : 'Production Progress'}
          </h3>
          <span className="text-xs text-muted-foreground">
            {totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0}% {lang === 'hi' ? 'पूरे' : 'done'}
          </span>
        </div>

        <div className="mb-5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{lang === 'hi' ? 'कुल प्रगति' : 'Overall completion'}</span>
            <span>{completedCards}/{totalCards}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full transition-all duration-500"
              style={{ width: totalCards > 0 ? `${(completedCards / totalCards) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {stageCounts.filter((s) => s.count > 0).map((s) => {
            const pct = totalCards > 0 ? Math.round((s.count / totalCards) * 100) : 0;
            const StageIcon = s.icon;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`flex items-center gap-1.5 font-500 ${s.color}`}>
                    <StageIcon size={12} />
                    {lang === 'hi' ? s.labelHi : s.labelEn}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{s.count} cards · {pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${s.bg.replace('bg-', 'bg-').replace('-50', '-400')}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {stageCounts.every((s) => s.count === 0) && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {lang === 'hi' ? 'कोई डेटा नहीं' : 'No data available'}
            </p>
          )}
        </div>
      </div>

      {/* ── Row 6: Item Workflow Progress ── */}
      <ItemWorkflowProgress lang={lang} />
    </div>
  );
}