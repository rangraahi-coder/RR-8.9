'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Eye, Pencil, Trash2, ClipboardList, PackageCheck, User, ChevronDown, ChevronRight, X, Search, BarChart2, Filter } from 'lucide-react';
import {
  stitchingVoucherService,
  StitchIssueVoucher,
  StitchReceiveVoucher,
  StitchAuditEntry,
  StitchOperator,
} from '@/lib/services/stitchingVoucherService';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { useAuth } from '@/contexts/AuthContext';
import StitchIssueModal from './StitchIssueModal';
import StitchReceiveModal from './StitchReceiveModal';
import { useSearchParams } from 'next/navigation';

type ActiveTab = 'issue' | 'receive' | 'operator-reports' | 'audit';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: 'bg-primary/10 text-primary',
    partially_received: 'bg-warning-bg text-warning',
    fully_received: 'bg-success-bg text-success',
    closed: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function StitchingContent() {
  const { username } = useAuth();
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issue');

  // Issue Vouchers
  const [issueVouchers, setIssueVouchers] = useState<StitchIssueVoucher[]>([]);
  const [issueLoading, setIssueLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [editIssueVoucher, setEditIssueVoucher] = useState<StitchIssueVoucher | null>(null);
  const [deleteIssueTarget, setDeleteIssueTarget] = useState<StitchIssueVoucher | null>(null);
  const [viewIssueVoucher, setViewIssueVoucher] = useState<StitchIssueVoucher | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<Set<string>>(new Set());
  const [issueSearch, setIssueSearch] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState<string>('all');

  // Receive Vouchers
  const [receiveVouchers, setReceiveVouchers] = useState<StitchReceiveVoucher[]>([]);
  const [receiveLoading, setReceiveLoading] = useState(true);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [editReceiveVoucher, setEditReceiveVoucher] = useState<StitchReceiveVoucher | null>(null);
  const [deleteReceiveTarget, setDeleteReceiveTarget] = useState<StitchReceiveVoucher | null>(null);
  const [viewReceiveVoucher, setViewReceiveVoucher] = useState<StitchReceiveVoucher | null>(null);
  const [receiveSearch, setReceiveSearch] = useState('');

  // Operator Reports
  const [operators, setOperators] = useState<StitchOperator[]>([]);
  const [selectedReportOperator, setSelectedReportOperator] = useState<string>('all');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  // Audit
  const [auditEntries, setAuditEntries] = useState<StitchAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');

  const loadIssueVouchers = useCallback(async () => {
    setIssueLoading(true);
    const data = await stitchingVoucherService.getIssueVouchers();
    setIssueVouchers(data);
    setIssueLoading(false);
  }, []);

  const loadReceiveVouchers = useCallback(async () => {
    setReceiveLoading(true);
    const data = await stitchingVoucherService.getReceiveVouchers();
    setReceiveVouchers(data);
    setReceiveLoading(false);
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const data = await stitchingVoucherService.getAuditTrail();
    setAuditEntries(data);
    setAuditLoading(false);
  }, []);

  const loadOperators = useCallback(async () => {
    const data = await stitchingVoucherService.getOperators();
    setOperators(data);
  }, []);

  useEffect(() => {
    loadIssueVouchers();
    loadReceiveVouchers();
    loadOperators();
  }, [loadIssueVouchers, loadReceiveVouchers, loadOperators]);

  useEffect(() => {
    if (activeTab === 'audit') loadAudit();
  }, [activeTab, loadAudit]);

  useRealtimeTable('stitch_issue_vouchers', () => { loadIssueVouchers(); loadReceiveVouchers(); });
  useRealtimeTable('stitch_receive_vouchers', () => { loadReceiveVouchers(); loadIssueVouchers(); });
  useRealtimeTable('stitch_operators', loadOperators);
  useRealtimeTable('job_cards', refreshJobCards);

  // Apply URL filter params on mount
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'pending') {
      setIssueStatusFilter('open');
    }
  }, [searchParams]);

  // Summary stats
  const totalIssued = issueVouchers.reduce((s, v) => s + v.totalPieces, 0);
  const totalReceived = receiveVouchers.reduce((s, v) => s + v.totalPiecesReceived, 0);
  const openVouchers = issueVouchers.filter((v) => v.status === 'open' || v.status === 'partially_received').length;
  const fullyReceived = issueVouchers.filter((v) => v.status === 'fully_received').length;

  // Filtered Issue Vouchers
  const filteredIssueVouchers = useMemo(() => {
    return issueVouchers.filter((v) => {
      const matchSearch = !issueSearch ||
        v.voucherNo.toLowerCase().includes(issueSearch.toLowerCase()) ||
        v.jobCardRef.toLowerCase().includes(issueSearch.toLowerCase()) ||
        (v.styleName || '').toLowerCase().includes(issueSearch.toLowerCase()) ||
        v.operatorName.toLowerCase().includes(issueSearch.toLowerCase());
      const matchStatus = issueStatusFilter === 'all' || v.status === issueStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [issueVouchers, issueSearch, issueStatusFilter]);

  // Filtered Receive Vouchers
  const filteredReceiveVouchers = useMemo(() => {
    return receiveVouchers.filter((v) => {
      return !receiveSearch ||
        v.voucherNo.toLowerCase().includes(receiveSearch.toLowerCase()) ||
        v.issueVoucherNo.toLowerCase().includes(receiveSearch.toLowerCase()) ||
        v.jobCardRef.toLowerCase().includes(receiveSearch.toLowerCase()) ||
        v.operatorName.toLowerCase().includes(receiveSearch.toLowerCase());
    });
  }, [receiveVouchers, receiveSearch]);

  // Operator Report Data
  const operatorReportData = useMemo(() => {
    const opMap: Record<string, {
      operatorId: string;
      operatorName: string;
      operatorCode: string;
      department: string;
      totalIssued: number;
      totalReceived: number;
      totalPending: number;
      issueVoucherCount: number;
      receiveVoucherCount: number;
      jobCards: Set<string>;
    }> = {};

    // Build from issue vouchers
    for (const iv of issueVouchers) {
      const dateOk = (!reportDateFrom || iv.voucherDate >= reportDateFrom) &&
        (!reportDateTo || iv.voucherDate <= reportDateTo);
      if (!dateOk) continue;
      const key = iv.operatorId || iv.operatorName;
      if (!opMap[key]) {
        const op = operators.find((o) => o.id === iv.operatorId);
        opMap[key] = {
          operatorId: iv.operatorId || '',
          operatorName: iv.operatorName,
          operatorCode: op?.operatorCode || '—',
          department: op?.department || 'Stitching',
          totalIssued: 0,
          totalReceived: 0,
          totalPending: 0,
          issueVoucherCount: 0,
          receiveVoucherCount: 0,
          jobCards: new Set(),
        };
      }
      opMap[key].totalIssued += iv.totalPieces;
      opMap[key].issueVoucherCount += 1;
      opMap[key].jobCards.add(iv.jobCardRef);
      // Sum pending from components
      for (const c of iv.components) {
        opMap[key].totalPending += c.pendingQty;
      }
    }

    // Build from receive vouchers
    for (const rv of receiveVouchers) {
      const dateOk = (!reportDateFrom || rv.voucherDate >= reportDateFrom) &&
        (!reportDateTo || rv.voucherDate <= reportDateTo);
      if (!dateOk) continue;
      const key = rv.operatorId || rv.operatorName;
      if (!opMap[key]) {
        const op = operators.find((o) => o.id === rv.operatorId);
        opMap[key] = {
          operatorId: rv.operatorId || '',
          operatorName: rv.operatorName,
          operatorCode: op?.operatorCode || '—',
          department: op?.department || 'Stitching',
          totalIssued: 0,
          totalReceived: 0,
          totalPending: 0,
          issueVoucherCount: 0,
          receiveVoucherCount: 0,
          jobCards: new Set(),
        };
      }
      opMap[key].totalReceived += rv.totalPiecesReceived;
      opMap[key].receiveVoucherCount += 1;
      opMap[key].jobCards.add(rv.jobCardRef);
    }

    return Object.values(opMap).filter((op) =>
      selectedReportOperator === 'all' || op.operatorId === selectedReportOperator
    );
  }, [issueVouchers, receiveVouchers, operators, selectedReportOperator, reportDateFrom, reportDateTo]);

  // Filtered Audit
  const filteredAuditEntries = useMemo(() => {
    return auditEntries.filter((a) => {
      const matchType = auditTypeFilter === 'all' || a.transactionType === auditTypeFilter;
      const matchSearch = !auditSearch ||
        a.voucherNo.toLowerCase().includes(auditSearch.toLowerCase()) ||
        a.jobCardRef.toLowerCase().includes(auditSearch.toLowerCase()) ||
        a.operatorName.toLowerCase().includes(auditSearch.toLowerCase()) ||
        a.component.toLowerCase().includes(auditSearch.toLowerCase());
      return matchType && matchSearch;
    });
  }, [auditEntries, auditTypeFilter, auditSearch]);

  function toggleIssueExpand(id: string) {
    setExpandedIssue((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDeleteIssue() {
    if (!deleteIssueTarget) return;
    await stitchingVoucherService.deleteIssueVoucher(deleteIssueTarget.id);
    setDeleteIssueTarget(null);
    await loadIssueVouchers();
  }

  async function handleDeleteReceive() {
    if (!deleteReceiveTarget) return;
    await stitchingVoucherService.deleteReceiveVoucher(deleteReceiveTarget.id);
    setDeleteReceiveTarget(null);
    await Promise.all([loadReceiveVouchers(), loadIssueVouchers()]);
  }

  const jobCardOptions = jobCards.map((jc) => ({
    id: jc.id,
    jobCardNo: jc.jobCardNo,
    styleEn: jc.styleEn,
    partyName: jc.partyName,
    poNo: jc.poNo,
    totalPieces: jc.totalPieces,
    colors: jc.colors,
    sizes: jc.sizes,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Stitching</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Job Card-based Issue &amp; Receive — component-wise, operator-accountable, real-time sync</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditIssueVoucher(null); setShowIssueModal(true); }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} /> New Issue
          </button>
          <button
            onClick={() => { setEditReceiveVoucher(null); setShowReceiveModal(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-success text-white rounded-lg text-sm font-600 hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New Receive
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Issued</p>
          <p className="text-2xl font-700 text-primary mt-1">{totalIssued.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">{issueVouchers.length} vouchers</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Received</p>
          <p className="text-2xl font-700 text-success mt-1">{totalReceived.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">{receiveVouchers.length} vouchers</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Open / Partial</p>
          <p className="text-2xl font-700 text-warning mt-1">{openVouchers}</p>
          <p className="text-xs text-muted-foreground">Pending receive</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Fully Received</p>
          <p className="text-2xl font-700 text-foreground mt-1">{fullyReceived}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit flex-wrap">
        {([
          { key: 'issue', label: 'Issue Vouchers', icon: <ClipboardList size={14} /> },
          { key: 'receive', label: 'Receive Vouchers', icon: <PackageCheck size={14} /> },
          { key: 'operator-reports', label: 'Operator Reports', icon: <BarChart2 size={14} /> },
          { key: 'audit', label: 'Audit Trail', icon: <User size={14} /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-600 transition-colors ${activeTab === tab.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Issue Vouchers Tab */}
      {activeTab === 'issue' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search voucher, job card, style, operator..."
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                className="input-field pl-9 text-sm w-full"
              />
            </div>
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
              {(['all', 'open', 'partially_received', 'fully_received'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setIssueStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors capitalize ${issueStatusFilter === s ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <ClipboardList size={15} className="text-primary" />
              <span className="text-sm font-600 text-foreground">Stitching Issue Vouchers</span>
              <span className="ml-auto text-xs text-muted-foreground">{filteredIssueVouchers.length} of {issueVouchers.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="w-8 px-3 py-3"></th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Voucher No</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Job Card</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Issue Operator</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Total Pcs</th>
                    <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issueLoading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Loading...</td></tr>
                  ) : filteredIssueVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <ClipboardList size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-500">{issueVouchers.length === 0 ? 'No issue vouchers yet' : 'No matching vouchers'}</p>
                        <p className="text-xs mt-1">{issueVouchers.length === 0 ? 'Create a Stitching Issue to get started' : 'Try adjusting your search or filter'}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredIssueVouchers.map((v) => (
                      <React.Fragment key={v.id}>
                        <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-3">
                            {v.components.length > 0 && (
                              <button onClick={() => toggleIssueExpand(v.id)} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
                                {expandedIssue.has(v.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 font-600 text-primary text-xs">{v.voucherNo}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{v.voucherDate}</td>
                          <td className="px-4 py-3 text-xs font-600 text-foreground">{v.jobCardRef}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{v.styleName || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-600 text-foreground">
                              <User size={11} className="text-primary" /> {v.operatorName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-700 text-foreground">{v.totalPieces}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={v.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => setViewIssueVoucher(v)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="View">
                                <Eye size={13} />
                              </button>
                              <button onClick={() => { setEditIssueVoucher(v); setShowIssueModal(true); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setDeleteIssueTarget(v)} className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedIssue.has(v.id) && v.components.length > 0 && (
                          <tr className="border-b border-border/50 bg-muted/10">
                            <td colSpan={9} className="px-6 py-3">
                              <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-2">Component Breakdown</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {v.components.map((c) => (
                                  <div key={c.id} className="bg-card border border-border rounded-lg p-3 text-xs">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-700 text-foreground">{c.component}</span>
                                      <span className={`font-600 ${c.pendingQty === 0 ? 'text-success' : 'text-warning'}`}>
                                        Pending: {c.pendingQty}
                                      </span>
                                    </div>
                                    <div className="flex gap-3 text-muted-foreground">
                                      <span>Issued: <span className="font-600 text-foreground">{c.issuedQty}</span></span>
                                      <span>Received: <span className="font-600 text-foreground">{c.receivedQty}</span></span>
                                    </div>
                                  </div>
                                ))}
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
        </div>
      )}

      {/* Receive Vouchers Tab */}
      {activeTab === 'receive' && (
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by voucher no, issue voucher, job card, operator..."
              value={receiveSearch}
              onChange={(e) => setReceiveSearch(e.target.value)}
              className="input-field pl-9 text-sm w-full"
            />
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <PackageCheck size={15} className="text-success" />
              <span className="text-sm font-600 text-foreground">Stitching Receive Vouchers</span>
              <span className="ml-auto text-xs text-muted-foreground">{filteredReceiveVouchers.length} of {receiveVouchers.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Voucher No</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Issue Voucher</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Job Card</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Receive Operator</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received Pcs</th>
                    <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveLoading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Loading...</td></tr>
                  ) : filteredReceiveVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-muted-foreground">
                        <PackageCheck size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-500">{receiveVouchers.length === 0 ? 'No receive vouchers yet' : 'No matching vouchers'}</p>
                        <p className="text-xs mt-1">{receiveVouchers.length === 0 ? 'Create a Stitching Receive against an Issue Voucher' : 'Try adjusting your search'}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredReceiveVouchers.map((v) => (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-600 text-success text-xs">{v.voucherNo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{v.voucherDate}</td>
                        <td className="px-4 py-3 text-xs font-600 text-primary">{v.issueVoucherNo}</td>
                        <td className="px-4 py-3 text-xs font-600 text-foreground">{v.jobCardRef}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-600 text-foreground">
                            <User size={11} className="text-success" /> {v.operatorName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{v.totalPiecesReceived}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewReceiveVoucher(v)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="View">
                              <Eye size={13} />
                            </button>
                            <button onClick={() => { setEditReceiveVoucher(v); setShowReceiveModal(true); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setDeleteReceiveTarget(v)} className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors" title="Delete">
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
        </div>
      )}

      {/* Operator Reports Tab */}
      {activeTab === 'operator-reports' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-600 text-muted-foreground flex items-center gap-1"><Filter size={11} /> Filter by Operator</label>
              <select
                value={selectedReportOperator}
                onChange={(e) => setSelectedReportOperator(e.target.value)}
                className="input-field text-sm"
              >
                <option value="all">All Operators</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>{op.operatorCode} — {op.operatorName}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Date From</label>
              <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Date To</label>
              <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="input-field text-sm" />
            </div>
            {(reportDateFrom || reportDateTo || selectedReportOperator !== 'all') && (
              <button
                onClick={() => { setReportDateFrom(''); setReportDateTo(''); setSelectedReportOperator('all'); }}
                className="btn-secondary text-xs px-3 py-2"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Operator Summary Cards */}
          {operatorReportData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-500">Operators Active</p>
                <p className="text-2xl font-700 text-primary mt-1">{operatorReportData.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-500">Total Issued</p>
                <p className="text-2xl font-700 text-foreground mt-1">{operatorReportData.reduce((s, o) => s + o.totalIssued, 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-500">Total Received</p>
                <p className="text-2xl font-700 text-success mt-1">{operatorReportData.reduce((s, o) => s + o.totalReceived, 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground font-500">Total Pending</p>
                <p className="text-2xl font-700 text-warning mt-1">{operatorReportData.reduce((s, o) => s + o.totalPending, 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <BarChart2 size={15} className="text-primary" />
              <span className="text-sm font-600 text-foreground">Operator-wise Production Summary</span>
              <span className="ml-auto text-xs text-muted-foreground">{operatorReportData.length} operators</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Operator Code</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Operator Name</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Department</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Issue Vouchers</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Receive Vouchers</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Total Issued</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Total Received</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pending</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Job Cards</th>
                  </tr>
                </thead>
                <tbody>
                  {operatorReportData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <BarChart2 size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-500">No operator data available</p>
                        <p className="text-xs mt-1">Create Issue and Receive vouchers to see operator reports</p>
                      </td>
                    </tr>
                  ) : (
                    operatorReportData.map((op, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-600 text-primary text-xs">{op.operatorCode}</td>
                        <td className="px-4 py-3 font-600 text-foreground text-sm">{op.operatorName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{op.department}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-foreground">{op.issueVoucherCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-foreground">{op.receiveVoucherCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-700 text-foreground">{op.totalIssued.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{op.totalReceived.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-700">
                          <span className={op.totalPending > 0 ? 'text-warning' : 'text-success'}>{op.totalPending.toLocaleString('en-IN')}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{op.jobCards.size}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operator-wise Job Card Detail */}
          {selectedReportOperator !== 'all' && operatorReportData.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <ClipboardList size={15} className="text-primary" />
                <span className="text-sm font-600 text-foreground">Issue Vouchers for Selected Operator</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Voucher No</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Job Card</th>
                      <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style</th>
                      <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Issued</th>
                      <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueVouchers
                      .filter((v) => v.operatorId === selectedReportOperator)
                      .filter((v) => (!reportDateFrom || v.voucherDate >= reportDateFrom) && (!reportDateTo || v.voucherDate <= reportDateTo))
                      .map((v) => (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-600 text-primary text-xs">{v.voucherNo}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{v.voucherDate}</td>
                          <td className="px-4 py-3 text-xs font-600 text-foreground">{v.jobCardRef}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{v.styleName || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-700 text-foreground">{v.totalPieces}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge status={v.status} /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search voucher, job card, operator, component..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="input-field pl-9 text-sm w-full"
              />
            </div>
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
              {(['all', 'issue', 'receive'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAuditTypeFilter(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors capitalize ${auditTypeFilter === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <User size={15} className="text-primary" />
              <span className="text-sm font-600 text-foreground">Operator Audit Trail</span>
              <span className="ml-auto text-xs text-muted-foreground">{filteredAuditEntries.length} of {auditEntries.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Voucher No</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Job Card</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Component</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Operator</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Code</th>
                    <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">By</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">Loading audit trail...</td></tr>
                  ) : filteredAuditEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <User size={36} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-500">No audit entries yet</p>
                        <p className="text-xs mt-1">Audit trail is auto-created on every Issue and Receive</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditEntries.map((a) => (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${a.transactionType === 'issue' ? 'bg-primary/10 text-primary' : 'bg-success-bg text-success'}`}>
                            {a.transactionType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-600 text-foreground">{a.voucherNo}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{a.jobCardRef}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{a.component}</td>
                        <td className="px-4 py-3 text-xs font-600 text-foreground">{a.operatorName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{a.operatorCode || '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-700 text-foreground">{a.quantity}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{a.transactionDate}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{a.performedBy || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && (
        <StitchIssueModal
          jobCards={jobCardOptions}
          onClose={() => { setShowIssueModal(false); setEditIssueVoucher(null); }}
          onSaved={async () => { setShowIssueModal(false); setEditIssueVoucher(null); await loadIssueVouchers(); }}
          editVoucher={editIssueVoucher}
        />
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <StitchReceiveModal
          jobCards={jobCardOptions}
          onClose={() => { setShowReceiveModal(false); setEditReceiveVoucher(null); }}
          onSaved={async () => { setShowReceiveModal(false); setEditReceiveVoucher(null); await Promise.all([loadReceiveVouchers(), loadIssueVouchers()]); }}
          editVoucher={editReceiveVoucher}
        />
      )}

      {/* View Issue Voucher Detail */}
      {viewIssueVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
              <h2 className="text-base font-700 text-foreground">Issue Voucher — {viewIssueVoucher.voucherNo}</h2>
              <button onClick={() => setViewIssueVoucher(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Date:</span> <span className="font-600 text-foreground ml-1">{viewIssueVoucher.voucherDate}</span></div>
                <div><span className="text-muted-foreground">Job Card:</span> <span className="font-600 text-foreground ml-1">{viewIssueVoucher.jobCardRef}</span></div>
                <div><span className="text-muted-foreground">Style:</span> <span className="font-600 text-foreground ml-1">{viewIssueVoucher.styleName || '—'}</span></div>
                <div><span className="text-muted-foreground">Party:</span> <span className="font-600 text-foreground ml-1">{viewIssueVoucher.partyName || '—'}</span></div>
                <div><span className="text-muted-foreground">Issue Operator:</span> <span className="font-600 text-primary ml-1">{viewIssueVoucher.operatorName}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="ml-1"><StatusBadge status={viewIssueVoucher.status} /></span></div>
              </div>
              <div>
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-2">Components</p>
                <div className="flex flex-col gap-2">
                  {viewIssueVoucher.components.map((c) => (
                    <div key={c.id} className="bg-muted/30 rounded-lg px-3 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-700 text-foreground">{c.component}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>Issued: <span className="font-600 text-foreground">{c.issuedQty}</span></span>
                        <span>Received: <span className="font-600 text-success">{c.receivedQty}</span></span>
                        <span>Pending: <span className={`font-600 ${c.pendingQty > 0 ? 'text-warning' : 'text-success'}`}>{c.pendingQty}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {viewIssueVoucher.remarks && (
                <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                  <span className="font-600">Remarks:</span> {viewIssueVoucher.remarks}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Receive Voucher Detail */}
      {viewReceiveVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
              <h2 className="text-base font-700 text-foreground">Receive Voucher — {viewReceiveVoucher.voucherNo}</h2>
              <button onClick={() => setViewReceiveVoucher(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Date:</span> <span className="font-600 text-foreground ml-1">{viewReceiveVoucher.voucherDate}</span></div>
                <div><span className="text-muted-foreground">Issue Voucher:</span> <span className="font-600 text-primary ml-1">{viewReceiveVoucher.issueVoucherNo}</span></div>
                <div><span className="text-muted-foreground">Job Card:</span> <span className="font-600 text-foreground ml-1">{viewReceiveVoucher.jobCardRef}</span></div>
                <div><span className="text-muted-foreground">Style:</span> <span className="font-600 text-foreground ml-1">{viewReceiveVoucher.styleName || '—'}</span></div>
                <div><span className="text-muted-foreground">Receive Operator:</span> <span className="font-600 text-success ml-1">{viewReceiveVoucher.operatorName}</span></div>
                <div><span className="text-muted-foreground">Total Received:</span> <span className="font-700 text-success ml-1">{viewReceiveVoucher.totalPiecesReceived} Pcs</span></div>
              </div>
              <div>
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-2">Components Received</p>
                <div className="flex flex-col gap-2">
                  {viewReceiveVoucher.components.map((c) => (
                    <div key={c.id} className="bg-muted/30 rounded-lg px-3 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-700 text-foreground">{c.component}</span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>Issued: <span className="font-600 text-foreground">{c.issuedQty}</span></span>
                        <span>Received: <span className="font-600 text-success">{c.receivedQty}</span></span>
                        <span>Balance: <span className={`font-600 ${c.balanceQty > 0 ? 'text-warning' : 'text-success'}`}>{c.balanceQty}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {viewReceiveVoucher.remarks && (
                <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
                  <span className="font-600">Remarks:</span> {viewReceiveVoucher.remarks}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Issue Confirm */}
      {deleteIssueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="text-base font-700 text-foreground">Delete Issue Voucher?</h3>
            <p className="text-sm text-muted-foreground">Delete <span className="font-600 text-foreground">{deleteIssueTarget.voucherNo}</span>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteIssueTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteIssue} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-600 hover:opacity-90 transition-opacity">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Receive Confirm */}
      {deleteReceiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="text-base font-700 text-foreground">Delete Receive Voucher?</h3>
            <p className="text-sm text-muted-foreground">Delete <span className="font-600 text-foreground">{deleteReceiveTarget.voucherNo}</span>? This will revert pending quantities on the Issue Voucher.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteReceiveTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteReceive} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-600 hover:opacity-90 transition-opacity">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
