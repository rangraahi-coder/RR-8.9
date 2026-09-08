'use client';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Clock, CheckCircle2, AlertCircle, ChevronDown, Package, Layers, X, Calendar } from 'lucide-react';
import { printerFabricService, PrinterFabricIssue, PrinterFabricReceipt } from '@/lib/services/printerFabricService';
import { accountService } from '@/lib/services/accountService';

interface PrinterLedgerContentProps {
  searchQuery?:string;
  lang?: 'en' | 'hi';
}

type TabType = 'overview' | 'issues' | 'receipts';
type StatusFilter = 'all' | 'pending' | 'partial' | 'settled';

interface PrinterSummary {
  printerAccount: string;
  totalIssued: number;
  totalReceived: number;
  totalPending: number;
  issueCount: number;
  receiptCount: number;
  pendingIssues: number;
  partialIssues: number;
  settledIssues: number;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  settled: { label: 'Settled', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

function StatusBadge({ status }: { status: 'pending' | 'partial' | 'settled' }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function PrinterLedgerContent({ lang = 'hi' }: PrinterLedgerContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [issues, setIssues] = useState<PrinterFabricIssue[]>([]);
  const [receipts, setReceipts] = useState<PrinterFabricReceipt[]>([]);
  const [printerAccounts, setPrinterAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [selectedPrinter, setSelectedPrinter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [allIssues, allReceipts, accounts] = await Promise.all([
        printerFabricService.getAllIssues(),
        printerFabricService.getAllReceipts(),
        accountService.getAll(),
      ]);
      setIssues(allIssues);
      setReceipts(allReceipts);
      // Extract unique printer names from accounts (processor/printer type) + from existing issues
      const fromAccounts = accounts
        .filter((a: any) => a.accountType === 'processor' || a.accountType === 'printer' || a.accountType === 'vendor')
        .map((a: any) => a.accountName as string);
      const fromIssues = allIssues.map((i) => i.printerAccount);
      const unique = Array.from(new Set([...fromAccounts, ...fromIssues])).filter(Boolean).sort();
      setPrinterAccounts(unique);
    } catch (e) {
      console.error('[PrinterLedger] loadData error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useRealtimeTable('printer_fabric_issues',loadData);
  useRealtimeTable('printer_fabric_receipts',loadData);

  // ─── Derived: per-printer summaries ───────────────────────────────────────
  const printerSummaries: PrinterSummary[] = React.useMemo(() => {
    const map = new Map<string, PrinterSummary>();
    for (const issue of issues) {
      const key = issue.printerAccount;
      if (!map.has(key)) {
        map.set(key, {
          printerAccount: key,
          totalIssued: 0, totalReceived: 0, totalPending: 0,
          issueCount: 0, receiptCount: 0,
          pendingIssues: 0, partialIssues: 0, settledIssues: 0,
        });
      }
      const s = map.get(key)!;
      s.totalIssued += issue.qtyIssued;
      s.totalReceived += issue.qtyReceived;
      s.totalPending += issue.qtyPending;
      s.issueCount += 1;
      if (issue.status === 'pending') s.pendingIssues += 1;
      else if (issue.status === 'partial') s.partialIssues += 1;
      else s.settledIssues += 1;
    }
    for (const receipt of receipts) {
      const key = receipt.printerAccount;
      if (!map.has(key)) {
        map.set(key, {
          printerAccount: key,
          totalIssued: 0, totalReceived: 0, totalPending: 0,
          issueCount: 0, receiptCount: 0,
          pendingIssues: 0, partialIssues: 0, settledIssues: 0,
        });
      }
      map.get(key)!.receiptCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [issues, receipts]);

  // ─── Filtered issues ──────────────────────────────────────────────────────
  const filteredIssues = React.useMemo(() => {
    return issues.filter((issue) => {
      if (selectedPrinter !== 'all' && issue.printerAccount !== selectedPrinter) return false;
      if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
      if (dateFrom && issue.date < dateFrom) return false;
      if (dateTo && issue.date > dateTo) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !issue.issueNo.toLowerCase().includes(q) &&
          !issue.printerAccount.toLowerCase().includes(q) &&
          !(issue.fabricName || '').toLowerCase().includes(q) &&
          !issue.grayFabricRef.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [issues, selectedPrinter, statusFilter, dateFrom, dateTo, searchQuery]);

  // ─── Filtered receipts ────────────────────────────────────────────────────
  const filteredReceipts = React.useMemo(() => {
    return receipts.filter((receipt) => {
      if (selectedPrinter !== 'all' && receipt.printerAccount !== selectedPrinter) return false;
      if (dateFrom && receipt.date < dateFrom) return false;
      if (dateTo && receipt.date > dateTo) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !receipt.receiptNo.toLowerCase().includes(q) &&
          !receipt.printerAccount.toLowerCase().includes(q) &&
          !(receipt.fabricName || '').toLowerCase().includes(q) &&
          !receipt.grayFabricRef.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [receipts, selectedPrinter, dateFrom, dateTo, searchQuery]);

  // ─── Global totals ────────────────────────────────────────────────────────
  const globalTotals = React.useMemo(() => ({
    totalIssued: issues.reduce((s, i) => s + i.qtyIssued, 0),
    totalReceived: issues.reduce((s, i) => s + i.qtyReceived, 0),
    totalPending: issues.reduce((s, i) => s + i.qtyPending, 0),
    pendingCount: issues.filter((i) => i.status === 'pending').length,
    partialCount: issues.filter((i) => i.status === 'partial').length,
    settledCount: issues.filter((i) => i.status === 'settled').length,
  }), [issues]);

  const clearFilters = () => {
    setSelectedPrinter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = selectedPrinter !== 'all' || statusFilter !== 'all' || searchQuery || dateFrom || dateTo;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-body">Loading printer ledger…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-700 text-foreground font-display">Printer Fabric Ledger</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-body">
            All fabric issues, receipts, and pending balances per printer account
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-600 text-muted-foreground hover:bg-muted transition-colors font-body"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Global Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide">Total Issued</p>
          <p className="text-xl font-700 text-foreground font-display">{globalTotals.totalIssued.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground font-body">meters</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide">Total Received</p>
          <p className="text-xl font-700 text-emerald-600 font-display">{globalTotals.totalReceived.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground font-body">meters</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide">Total Pending</p>
          <p className="text-xl font-700 text-amber-600 font-display">{globalTotals.totalPending.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground font-body">meters</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide">Pending Issues</p>
          <p className="text-xl font-700 text-amber-600 font-display">{globalTotals.pendingCount}</p>
          <p className="text-xs text-muted-foreground font-body">vouchers</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide">Partial</p>
          <p className="text-xl font-700 text-blue-600 font-display">{globalTotals.partialCount}</p>
          <p className="text-xs text-muted-foreground font-body">vouchers</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-4 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide">Settled</p>
          <p className="text-xl font-700 text-emerald-600 font-display">{globalTotals.settledCount}</p>
          <p className="text-xs text-muted-foreground font-body">vouchers</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        {(['overview', 'issues', 'receipts'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-600 transition-all font-body capitalize ${
              activeTab === tab
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'overview' ? 'Account Overview' : tab === 'issues' ? 'Fabric Issues' : 'Fabric Receipts'}
          </button>
        ))}
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white rounded-2xl border border-border p-4 flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by voucher no., fabric, printer…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Printer Account */}
        <div className="relative min-w-[180px]">
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          >
            <option value="all">All Printers</option>
            {printerAccounts.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Status Filter (only for issues tab) */}
        {activeTab === 'issues' && (
          <div className="relative min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="settled">Settled</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <span className="text-muted-foreground text-sm">–</span>
          <div className="relative">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-border text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-600 text-danger hover:bg-danger-bg transition-colors font-body"
          >
            <X size={13} />
            Clear
          </button>
        )}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          {printerSummaries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center gap-3 text-center">
              <Package size={40} className="text-muted-foreground/40" />
              <p className="text-base font-600 text-foreground font-display">No printer accounts found</p>
              <p className="text-sm text-muted-foreground font-body">Issue fabric to a printer to see their account here.</p>
            </div>
          ) : (
            printerSummaries
              .filter((s) => selectedPrinter === 'all' || s.printerAccount === selectedPrinter)
              .map((summary) => (
                <div key={summary.printerAccount} className="bg-white rounded-2xl border border-border overflow-hidden">
                  {/* Account Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Layers size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-base font-700 text-foreground font-display">{summary.printerAccount}</p>
                        <p className="text-xs text-muted-foreground font-body">
                          {summary.issueCount} issue{summary.issueCount !== 1 ? 's' : ''} · {summary.receiptCount} receipt{summary.receiptCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {/* Settlement status pill */}
                    <div className="flex items-center gap-2">
                      {summary.pendingIssues > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-600 bg-amber-100 text-amber-700 border border-amber-200">
                          <Clock size={11} />
                          {summary.pendingIssues} Pending
                        </span>
                      )}
                      {summary.partialIssues > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-600 bg-blue-100 text-blue-700 border border-blue-200">
                          <AlertCircle size={11} />
                          {summary.partialIssues} Partial
                        </span>
                      )}
                      {summary.settledIssues > 0 && summary.pendingIssues === 0 && summary.partialIssues === 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-600 bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} />
                          All Settled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balance Grid */}
                  <div className="grid grid-cols-3 divide-x divide-border/60">
                    <div className="px-5 py-4">
                      <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide mb-1">Fabric Issued</p>
                      <p className="text-lg font-700 text-foreground font-display">{summary.totalIssued.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground font-body">meters</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide mb-1">Fabric Received</p>
                      <p className="text-lg font-700 text-emerald-600 font-display">{summary.totalReceived.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground font-body">meters</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs text-muted-foreground font-body font-600 uppercase tracking-wide mb-1">Balance Pending</p>
                      <p className={`text-lg font-700 font-display ${summary.totalPending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {summary.totalPending.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">meters</p>
                    </div>
                  </div>

                  {/* Per-issue breakdown for this printer */}
                  {issues.filter((i) => i.printerAccount === summary.printerAccount).length > 0 && (
                    <div className="border-t border-border/60">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="text-left px-5 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Issue No.</th>
                              <th className="text-left px-4 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Date</th>
                              <th className="text-left px-4 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Fabric</th>
                              <th className="text-right px-4 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Issued</th>
                              <th className="text-right px-4 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Received</th>
                              <th className="text-right px-4 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Pending</th>
                              <th className="text-center px-4 py-2.5 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {issues
                              .filter((i) => i.printerAccount === summary.printerAccount)
                              .map((issue) => (
                                <tr key={issue.id} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-5 py-3 font-600 text-foreground font-body">{issue.issueNo}</td>
                                  <td className="px-4 py-3 text-muted-foreground font-body">{issue.date}</td>
                                  <td className="px-4 py-3 font-body">
                                    <p className="font-600 text-foreground">{issue.fabricName || issue.grayFabricRef}</p>
                                    {issue.fabricName && <p className="text-xs text-muted-foreground">{issue.grayFabricRef}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-right font-600 text-foreground font-body">{issue.qtyIssued.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right font-600 text-emerald-600 font-body">{issue.qtyReceived.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-right font-700 font-body">
                                    <span className={issue.qtyPending > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                                      {issue.qtyPending.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <StatusBadge status={issue.status} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine size={16} className="text-primary" />
              <p className="text-base font-700 text-foreground font-display">Fabric Issues to Printers</p>
            </div>
            <p className="text-sm text-muted-foreground font-body">{filteredIssues.length} record{filteredIssues.length !== 1 ? 's' : ''}</p>
          </div>
          {filteredIssues.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <ArrowUpFromLine size={36} className="text-muted-foreground/30" />
              <p className="text-sm font-600 text-muted-foreground font-body">No fabric issues found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Issue No.</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Printer Account</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Fabric</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Issued (m)</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Received (m)</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Pending (m)</th>
                    <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredIssues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-700 text-primary font-body">{issue.issueNo}</td>
                      <td className="px-4 py-3 text-muted-foreground font-body whitespace-nowrap">{issue.date}</td>
                      <td className="px-4 py-3 font-600 text-foreground font-body">{issue.printerAccount}</td>
                      <td className="px-4 py-3 font-body">
                        <p className="font-600 text-foreground">{issue.fabricName || issue.grayFabricRef}</p>
                        {issue.fabricName && <p className="text-xs text-muted-foreground">{issue.grayFabricRef}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-600 text-foreground font-body">{issue.qtyIssued.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-600 text-emerald-600 font-body">{issue.qtyReceived.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-700 font-body">
                        <span className={issue.qtyPending > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {issue.qtyPending.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={issue.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-body text-xs max-w-[160px] truncate">{issue.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-border">
                    <td colSpan={4} className="px-5 py-3 font-700 text-foreground font-body text-xs uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-700 text-foreground font-body">
                      {filteredIssues.reduce((s, i) => s + i.qtyIssued, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-700 text-emerald-600 font-body">
                      {filteredIssues.reduce((s, i) => s + i.qtyReceived, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-700 text-amber-600 font-body">
                      {filteredIssues.reduce((s, i) => s + i.qtyPending, 0).toFixed(2)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownToLine size={16} className="text-emerald-600" />
              <p className="text-base font-700 text-foreground font-display">Fabric Receipts from Printers</p>
            </div>
            <p className="text-sm text-muted-foreground font-body">{filteredReceipts.length} record{filteredReceipts.length !== 1 ? 's' : ''}</p>
          </div>
          {filteredReceipts.length === 0 ? (
            <div className="p-12 flex flex-col items-center gap-3 text-center">
              <ArrowDownToLine size={36} className="text-muted-foreground/30" />
              <p className="text-sm font-600 text-muted-foreground font-body">No fabric receipts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Receipt No.</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Printer Account</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Fabric (Issued)</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Qty Received (m)</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Processed Fabric</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Processed Qty (m)</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Shortage</th>
                    <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Shrinkage (m / %)</th>
                    <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground font-body uppercase tracking-wide">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-700 text-emerald-700 font-body">{receipt.receiptNo}</td>
                      <td className="px-4 py-3 text-muted-foreground font-body whitespace-nowrap">{receipt.date}</td>
                      <td className="px-4 py-3 font-600 text-foreground font-body">{receipt.printerAccount}</td>
                      <td className="px-4 py-3 font-body">
                        <p className="font-600 text-foreground">{receipt.fabricName || receipt.grayFabricRef}</p>
                        {receipt.fabricName && <p className="text-xs text-muted-foreground">{receipt.grayFabricRef}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-600 text-foreground font-body">{receipt.qtyReceived.toFixed(2)}</td>
                      <td className="px-4 py-3 font-600 text-foreground font-body">{receipt.processedFabricName || '—'}</td>
                      <td className="px-4 py-3 text-right font-600 text-foreground font-body">{receipt.processedQty.toFixed(2)}<div className="text-xs text-muted-foreground">Grey consumed: {(receipt.greyConsumed??receipt.qtyReceived).toFixed(3)} m</div></td>
                      <td className="px-4 py-3 text-right font-body">
                        <span className={(receipt.shortage || 0) > 0 ? 'text-red-600 font-600' : 'text-muted-foreground'}>
                          {(receipt.shortage || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-body">
                        <span className={(receipt.shrinkage || 0) > 0 ? 'text-orange-600 font-600' : 'text-muted-foreground'}>
                          {(receipt.shrinkage || 0).toFixed(3)} m ({receipt.shrinkagePercent??0}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-body text-xs max-w-[160px] truncate">{receipt.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-border">
                    <td colSpan={4} className="px-5 py-3 font-700 text-foreground font-body text-xs uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-700 text-foreground font-body">
                      {filteredReceipts.reduce((s, r) => s + r.qtyReceived, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-700 text-foreground font-body">
                      {filteredReceipts.reduce((s, r) => s + r.processedQty, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-700 text-red-600 font-body">
                      {filteredReceipts.reduce((s, r) => s + (r.shortage || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-700 text-orange-600 font-body">
                      {filteredReceipts.reduce((s, r) => s + (r.shrinkage || 0), 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
