'use client';
import {toast} from 'sonner';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye, Package, Search, Pencil, Link2, CheckCircle2, Layers } from 'lucide-react';
import {
  contractorFinishingService,
  ContractorIssueVoucher,
  ContractorReceiveVoucher,
} from '@/lib/services/contractorFinishingService';
import { componentAssemblyService, ComponentAssemblyVoucher } from '@/lib/services/componentAssemblyService';
import { useJobCards } from '@/lib/hooks/useJobCards';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import ContractorIssueModal from './ContractorIssueModal';
import ContractorReceiveModal from './ContractorReceiveModal';
import ComponentConversionModal from './ComponentConversionModal';
import ComponentAssemblyModal from './ComponentAssemblyModal';

type ActiveTab = 'assembly' | 'issue' | 'receive';

function ProcessBadge({ process }: { process: string }) {
  const map: Record<string, string> = {
    Finishing: 'bg-blue-50 text-blue-700',
    Press: 'bg-purple-50 text-purple-700',
    Packing: 'bg-green-50 text-green-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${map[process] || 'bg-muted text-muted-foreground'}`}>
      {process}
    </span>
  );
}

export default function ContractorFinishingContent() {
  const { username,can } = useAuth();
  const { jobCards, refresh: refreshJobCards } = useJobCards();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issue');

  const [showConversion,setShowConversion]=useState(false);

  // Component Assembly
  const [assemblyVouchers, setAssemblyVouchers] = useState<ComponentAssemblyVoucher[]>([]);
  const [assemblyLoading, setAssemblyLoading] = useState(true);
  const [showAssemblyModal, setShowAssemblyModal] = useState(false);
  const [viewAssemblyVoucher, setViewAssemblyVoucher] = useState<ComponentAssemblyVoucher | null>(null);
  const [deleteAssemblyTarget, setDeleteAssemblyTarget] = useState<ComponentAssemblyVoucher | null>(null);
  const [assemblySearch, setAssemblySearch] = useState('');

  // Issue vouchers
  const [issueVouchers, setIssueVouchers] = useState<ContractorIssueVoucher[]>([]);
  const [issueLoading, setIssueLoading] = useState(true);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [deleteIssueTarget, setDeleteIssueTarget] = useState<ContractorIssueVoucher | null>(null);
  const [viewIssueVoucher, setViewIssueVoucher] = useState<ContractorIssueVoucher | null>(null);
  const [editIssueVoucher, setEditIssueVoucher] = useState<ContractorIssueVoucher | null>(null);
  const [issueSearch, setIssueSearch] = useState('');

  // Receive vouchers
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveVouchers, setReceiveVouchers] = useState<any[]>([]);
  const [receiveLoading, setReceiveLoading] = useState(true);
  const [receiveSearch, setReceiveSearch] = useState('');
  const [viewReceiveVoucher, setViewReceiveVoucher] = useState<ContractorReceiveVoucher | null>(null);
  const [editReceiveVoucher, setEditReceiveVoucher] = useState<ContractorReceiveVoucher | null>(null);
  const [deleteReceiveTarget, setDeleteReceiveTarget] = useState<ContractorReceiveVoucher | null>(null);

  const loadAssembly = useCallback(async () => {
    setAssemblyLoading(true);
    try {const data = await componentAssemblyService.getAll();setAssemblyVouchers(data);}
    catch(e){toast.error(e instanceof Error?e.message:String(e));}
    finally{setAssemblyLoading(false);}
  }, []);

  const loadIssue = useCallback(async () => {
    setIssueLoading(true);
    const data = await contractorFinishingService.getIssueVouchers();
    setIssueVouchers(data);
    setIssueLoading(false);
  }, []);

  const loadReceive = useCallback(async () => {
    setReceiveLoading(true);
    const data = await contractorFinishingService.getReceiveVouchers();
    setReceiveVouchers(data);
    setReceiveLoading(false);
  }, []);

  useEffect(() => {
    loadAssembly();
    loadIssue();
    loadReceive();
  }, [loadAssembly, loadIssue, loadReceive]);

  // Realtime: re-fetch whenever any user inserts/updates/deletes from any session
  useRealtimeTable('component_assembly_vouchers', loadAssembly);
  useRealtimeTable('contractor_issue_vouchers', loadIssue);
  useRealtimeTable('contractor_receive_vouchers', loadReceive);
  useRealtimeTable('job_cards', refreshJobCards);

  // Summary metrics
  const totalConverted = assemblyVouchers.filter(v=>v.assemblyKind==='component_conversion').reduce((s,v)=>s+v.totalSetsAssembled,0);
  const totalAssembled = assemblyVouchers.filter(v=>v.assemblyKind!=='component_conversion').reduce((s, v) => s + v.totalSetsAssembled, 0);
  const totalIssued = issueVouchers.reduce((s, v) => s + v.totalIssued, 0);
  const totalReceived = receiveVouchers.reduce((s: number, v: any) => s + v.totalReceived, 0);

  const filteredAssembly = assemblyVouchers.filter((v) => {
    if (!assemblySearch) return true;
    const q = assemblySearch.toLowerCase();
    return (
      v.voucherNo.toLowerCase().includes(q) ||
      v.jobCardRef.toLowerCase().includes(q) ||
      v.finalItemName.toLowerCase().includes(q)
    );
  });

  const filteredIssue = issueVouchers.filter((v) => {
    if (!issueSearch) return true;
    const q = issueSearch.toLowerCase();
    return (
      v.voucherNo.toLowerCase().includes(q) ||
      v.jobCardRef.toLowerCase().includes(q) ||
      v.contractorName.toLowerCase().includes(q) ||
      v.process.toLowerCase().includes(q)
    );
  });

  const filteredReceive = receiveVouchers.filter((v: any) => {
    if (!receiveSearch) return true;
    const q = receiveSearch.toLowerCase();
    return (
      v.voucherNo.toLowerCase().includes(q) ||
      v.jobCardRef.toLowerCase().includes(q) ||
      v.contractorName.toLowerCase().includes(q)
    );
  });

  async function handleDeleteAssembly() {
    if (!deleteAssemblyTarget) return;
    try {
    await componentAssemblyService.delete(deleteAssemblyTarget.id);
    setDeleteAssemblyTarget(null);
    await loadAssembly();
    } catch(e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  async function handleDeleteIssue() {
    if (!deleteIssueTarget) return;
    await contractorFinishingService.deleteIssueVoucher(deleteIssueTarget.id);
    setDeleteIssueTarget(null);
    loadIssue();
  }

  async function handleDeleteReceive() {
    if (!deleteReceiveTarget) return;
    await contractorFinishingService.deleteReceiveVoucher(deleteReceiveTarget.id);
    setDeleteReceiveTarget(null);
    loadReceive();
  }

  const tabs: { key: ActiveTab; label: string; badge?: string }[] = [
    { key: 'issue', label: 'Contractor Issue' },
    { key: 'receive', label: 'Contractor Receive' },
    { key: 'assembly', label: 'Component Assembly', badge: 'New' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-700 text-foreground font-display">Contractor Finishing</h1>
          <p className="text-sm text-muted-foreground font-body mt-0.5">
            Post-stitching finishing workflow — linked to Stitching Receive references
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'assembly' && <button className="btn-secondary" disabled={!can('contractor','create')} onClick={()=>setShowConversion(true)}>New Item from Pending Sub-components</button>}
          {activeTab === 'assembly' && (
            <button
              disabled={!can('contractor','create')} onClick={() => setShowAssemblyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              <Layers size={16} /> New Assembly
            </button>
          )}
          {activeTab === 'issue' && (
            <button
              disabled={!can('contractor','create')} onClick={() => setShowIssueModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Contractor Issue
            </button>
          )}
          {activeTab === 'receive' && (
            <button
              disabled={!can('contractor','create')} onClick={() => setShowReceiveModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Contractor Receive
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-body mb-1">Sets Assembled</p>
          <p className="text-2xl font-700 text-success font-display">{totalAssembled.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalConverted.toLocaleString()} standalone items converted</p>
          <p className="text-xs text-muted-foreground font-body">final ready items assembled</p>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-body mb-1">Total Issued to Contractors</p>
          <p className="text-2xl font-700 text-foreground font-display">{totalIssued.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground font-body">pcs issued for processing</p>
        </div>
        <div className="bg-white border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-body mb-1">Contractor Receive</p>
          <p className="text-2xl font-700 text-foreground font-display">{totalReceived.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground font-body">pcs returned by contractors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-600 transition-colors font-body ${
                activeTab === tab.key
                  ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-600 ${tab.badge === 'New' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Component Assembly Tab ── */}
        {activeTab === 'assembly' && (
          <div className="p-4">
            {/* Info Banner */}
            <div className="mb-4 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
              <Layers size={14} className="text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-primary/80 leading-relaxed font-body">
                <strong>Component Assembly</strong> combines finished sub-components (e.g. Kurta + Pant + Dupatta) into a final Ready Item.
                Each assembled set is recorded in <strong>Finished Goods</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={assemblySearch}
                  onChange={(e) => setAssemblySearch(e.target.value)}
                  placeholder="Search voucher, job card, item..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
            </div>

            {assemblyLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm font-body">Loading...</div>
            ) : filteredAssembly.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Layers size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground font-body">No assembly vouchers yet</p>
                <p className="text-xs text-muted-foreground font-body">Click "New Assembly" to combine finished sub-components into a Ready Item</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Voucher No</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Date</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Job Card</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Final Item</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Sub-Components</th>
                      <th className="text-right py-2 px-3 text-xs font-600 text-muted-foreground font-body">Ready Quantity</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssembly.map((v) => (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-600 text-primary font-body">{v.voucherNo}</td>
                        <td className="py-2.5 px-3 text-muted-foreground font-body">{v.voucherDate}</td>
                        <td className="py-2.5 px-3 font-body">{v.jobCardRef}</td>
                        <td className="py-2.5 px-3 font-600 font-body">{v.finalItemName}</td>
                        <td className="py-2.5 px-3 font-body">
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(v.items.map((i) => i.component))].map((comp) => (
                              <span key={comp} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-600 font-body">
                                {comp}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1 font-700 text-success font-body">
                            <CheckCircle2 size={12} />
                            {v.totalSetsAssembled} {v.assemblyKind === 'component_conversion' ? 'items' : 'sets'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setViewAssemblyVoucher(v)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              disabled={!can('contractor','delete')} onClick={() => setDeleteAssemblyTarget(v)}
                              className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Issue Tab ── */}
        {activeTab === 'issue' && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  placeholder="Search voucher, job card, contractor..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
            </div>

            {issueLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm font-body">Loading...</div>
            ) : filteredIssue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Package size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground font-body">No issue vouchers yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Voucher No</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Date</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Job Card</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Stitch Ref</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Contractor</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Process</th>
                      <th className="text-right py-2 px-3 text-xs font-600 text-muted-foreground font-body">Issued</th>
                      <th className="text-right py-2 px-3 text-xs font-600 text-muted-foreground font-body">Received</th>
                      <th className="text-right py-2 px-3 text-xs font-600 text-muted-foreground font-body">Balance</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssue.map((v) => {
                      const received = v.items.reduce((s, it) => s + it.receivedQty, 0);
                      const bal = v.totalIssued - received;
                      return (
                        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-600 text-primary font-body">{v.voucherNo}</td>
                          <td className="py-2.5 px-3 text-muted-foreground font-body">{v.voucherDate}</td>
                          <td className="py-2.5 px-3 font-body">{v.jobCardRef}</td>
                          <td className="py-2.5 px-3 font-body">
                            {v.stitchReceiveRef ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-600">
                                <Link2 size={10} />{v.stitchReceiveRef}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="py-2.5 px-3 font-body">{v.contractorName}</td>
                          <td className="py-2.5 px-3"><ProcessBadge process={v.process} /></td>
                          <td className="py-2.5 px-3 text-right font-600 font-body">{v.totalIssued}</td>
                          <td className="py-2.5 px-3 text-right text-success font-600 font-body">{received}</td>
                          <td className="py-2.5 px-3 text-right font-body">
                            <span className={bal > 0 ? 'text-warning font-600' : 'text-success font-600'}>{bal}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => setViewIssueVoucher(v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <Eye size={14} />
                              </button>
                              <button onClick={() => setEditIssueVoucher(v)} className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button disabled={!can('contractor','delete')} onClick={() => setDeleteIssueTarget(v)} className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Receive Tab ── */}
        {activeTab === 'receive' && (
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={receiveSearch}
                  onChange={(e) => setReceiveSearch(e.target.value)}
                  placeholder="Search voucher, job card, contractor..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
                />
              </div>
            </div>

            {receiveLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm font-body">Loading...</div>
            ) : filteredReceive.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Package size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground font-body">No receive vouchers yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Voucher No</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Date</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Contractor</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Job Card</th>
                      <th className="text-right py-2 px-3 text-xs font-600 text-muted-foreground font-body">Total Received</th>
                      <th className="text-left py-2 px-3 text-xs font-600 text-muted-foreground font-body">Remarks</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceive.map((v: any) => (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-600 text-primary font-body">{v.voucherNo}</td>
                        <td className="py-2.5 px-3 text-muted-foreground font-body">{v.voucherDate}</td>
                        <td className="py-2.5 px-3 font-body">{v.contractorName}</td>
                        <td className="py-2.5 px-3 font-body">{v.jobCardRef}</td>
                        <td className="py-2.5 px-3 text-right font-600 text-success font-body">{v.totalReceived}</td>
                        <td className="py-2.5 px-3 text-muted-foreground font-body">{v.remarks || '—'}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setViewReceiveVoucher(v)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => setEditReceiveVoucher(v)} className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button disabled={!can('contractor','delete')} onClick={() => setDeleteReceiveTarget(v)} className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Component Assembly Modal ── */}
      {showConversion && <ComponentConversionModal onClose={()=>setShowConversion(false)} onSaved={()=>{setShowConversion(false);void loadAssembly();}}/>}
      {showAssemblyModal && (
        <ComponentAssemblyModal
          onClose={() => setShowAssemblyModal(false)}
          onSaved={() => { setShowAssemblyModal(false); loadAssembly(); }}
        />
      )}

      {/* ── Receive Modal ── */}
      {(showReceiveModal || editReceiveVoucher) && (
        <ContractorReceiveModal
          editVoucher={editReceiveVoucher}
          onClose={() => { setShowReceiveModal(false); setEditReceiveVoucher(null); }}
          onSaved={() => { setShowReceiveModal(false); setEditReceiveVoucher(null); loadIssue(); loadReceive(); }}
        />
      )}

      {/* ── Issue Modal ── */}
      {(showIssueModal || editIssueVoucher) && (
        <ContractorIssueModal
          jobCards={jobCards.map((jc) => ({
            id: jc.id,
            jobCardNo: jc.jobCardNo,
            styleEn: jc.styleEn || '',
            partyName: jc.partyName || '',
            contractor: '',
            colors: jc.colors || [],
            sizes: jc.sizes || [],
          }))}
          editVoucher={editIssueVoucher}
          onClose={() => { setShowIssueModal(false); setEditIssueVoucher(null); }}
          onSaved={() => { setShowIssueModal(false); setEditIssueVoucher(null); loadIssue(); }}
        />
      )}

      {/* ── View Assembly Voucher Detail ── */}
      {viewAssemblyVoucher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-700 font-display">{viewAssemblyVoucher.voucherNo}</h2>
                <p className="text-sm text-muted-foreground font-body">
                  {viewAssemblyVoucher.voucherDate} · Component Assembly
                </p>
              </div>
              <button onClick={() => setViewAssemblyVoucher(null)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground font-body">Job Card:</span> <span className="font-600 font-body">{viewAssemblyVoucher.jobCardRef}</span></div>
                <div><span className="text-muted-foreground font-body">Final Item:</span> <span className="font-600 font-body">{viewAssemblyVoucher.finalItemName}</span></div>
                <div><span className="text-muted-foreground font-body">{viewAssemblyVoucher.assemblyKind==='component_conversion'?'Standalone Items:':'Sets Assembled:'}</span> <span className="font-700 text-success font-body">{viewAssemblyVoucher.totalSetsAssembled}</span></div>
                {viewAssemblyVoucher.styleName && (
                  <div><span className="text-muted-foreground font-body">Style:</span> <span className="font-600 font-body">{viewAssemblyVoucher.styleName}</span></div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Sub-Component</th>
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Size</th>
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Colour</th>
                      <th className="text-right py-2 text-xs font-600 text-muted-foreground font-body">Available</th>
                      <th className="text-right py-2 text-xs font-600 text-success font-body">Qty Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewAssemblyVoucher.items.map((item) => (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="py-2 font-600 font-body">{item.component}</td>
                        <td className="py-2 text-muted-foreground font-body">{item.size || '—'}</td>
                        <td className="py-2 text-muted-foreground font-body">{item.colour || '—'}</td>
                        <td className="py-2 text-right font-body">{item.availableFinishedQty}</td>
                        <td className="py-2 text-right font-700 text-success font-body">{item.qtyUsed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewAssemblyVoucher.remarks && (
                <p className="text-sm text-muted-foreground font-body">Remarks: {viewAssemblyVoucher.remarks}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View Issue Voucher Detail ── */}
      {viewIssueVoucher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-700 font-display">{viewIssueVoucher.voucherNo}</h2>
                <p className="text-sm text-muted-foreground font-body">{viewIssueVoucher.voucherDate} · {viewIssueVoucher.contractorName}</p>
              </div>
              <button onClick={() => setViewIssueVoucher(null)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground font-body">Job Card:</span> <span className="font-600 font-body">{viewIssueVoucher.jobCardRef}</span></div>
                <div><span className="text-muted-foreground font-body">Style No:</span> <span className="font-600 font-body">{viewIssueVoucher.styleNo || '—'}</span></div>
                <div><span className="text-muted-foreground font-body">Process:</span> <ProcessBadge process={viewIssueVoucher.process} /></div>
                <div><span className="text-muted-foreground font-body">Total Issued:</span> <span className="font-600 font-body">{viewIssueVoucher.totalIssued} pcs</span></div>
                {viewIssueVoucher.stitchReceiveRef && (
                  <div><span className="text-muted-foreground font-body">Stitch Ref:</span> <span className="font-600 text-blue-700 font-body">{viewIssueVoucher.stitchReceiveRef}</span></div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Item</th>
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Colour</th>
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Size</th>
                      <th className="text-right py-2 text-xs font-600 text-muted-foreground font-body">Issued</th>
                      <th className="text-right py-2 text-xs font-600 text-muted-foreground font-body">Received</th>
                      <th className="text-right py-2 text-xs font-600 text-muted-foreground font-body">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewIssueVoucher.items.map((it) => (
                      <tr key={it.id} className="border-b border-border/50">
                        <td className="py-2 font-body">{it.item}</td>
                        <td className="py-2 font-body">{it.colour || '—'}</td>
                        <td className="py-2 font-body">{it.size || '—'}</td>
                        <td className="py-2 text-right font-body">{it.issuedQty}</td>
                        <td className="py-2 text-right text-success font-body">{it.receivedQty}</td>
                        <td className="py-2 text-right font-body">
                          <span className={it.balanceQty > 0 ? 'text-warning font-600' : 'text-success font-600'}>{it.balanceQty}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewIssueVoucher.remarks && (
                <p className="text-sm text-muted-foreground font-body">Remarks: {viewIssueVoucher.remarks}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View Receive Voucher Detail ── */}
      {viewReceiveVoucher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-lg font-700 font-display">{viewReceiveVoucher.voucherNo}</h2>
                <p className="text-sm text-muted-foreground font-body">{viewReceiveVoucher.voucherDate} · {viewReceiveVoucher.contractorName}</p>
              </div>
              <button onClick={() => setViewReceiveVoucher(null)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground font-body">Job Card:</span> <span className="font-600 font-body">{viewReceiveVoucher.jobCardRef}</span></div>
                <div><span className="text-muted-foreground font-body">Total Received:</span> <span className="font-600 text-success font-body">{viewReceiveVoucher.totalReceived} pcs</span></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Item</th>
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Colour</th>
                      <th className="text-left py-2 text-xs font-600 text-muted-foreground font-body">Size</th>
                      <th className="text-right py-2 text-xs font-600 text-muted-foreground font-body">Issued</th>
                      <th className="text-right py-2 text-xs font-600 text-muted-foreground font-body">Received Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewReceiveVoucher.items.map((it) => (
                      <tr key={it.id} className="border-b border-border/50">
                        <td className="py-2 font-body">{it.item}</td>
                        <td className="py-2 font-body">{it.colour || '—'}</td>
                        <td className="py-2 font-body">{it.size || '—'}</td>
                        <td className="py-2 text-right font-body">{it.issuedQty}</td>
                        <td className="py-2 text-right text-success font-600 font-body">{it.receivedToday}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {viewReceiveVoucher.remarks && (
                <p className="text-sm text-muted-foreground font-body">Remarks: {viewReceiveVoucher.remarks}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirms ── */}
      {deleteAssemblyTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-700 font-display mb-2">Delete Assembly Voucher?</h3>
            <p className="text-sm text-muted-foreground font-body mb-5">
              Delete <span className="font-600 text-foreground">{deleteAssemblyTarget.voucherNo}</span>? This removes its undispatched ready stock and releases the consumed components. Dispatched stock blocks deletion. A newly created master item remains in the catalog.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteAssemblyTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-600 font-body hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDeleteAssembly} className="flex-1 px-4 py-2 bg-danger text-white rounded-xl text-sm font-600 font-body hover:bg-danger/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteIssueTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-700 font-display mb-2">Delete Issue Voucher?</h3>
            <p className="text-sm text-muted-foreground font-body mb-5">
              Delete <span className="font-600 text-foreground">{deleteIssueTarget.voucherNo}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteIssueTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-600 font-body hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDeleteIssue} className="flex-1 px-4 py-2 bg-danger text-white rounded-xl text-sm font-600 font-body hover:bg-danger/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteReceiveTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-700 font-display mb-2">Delete Receive Voucher?</h3>
            <p className="text-sm text-muted-foreground font-body mb-5">
              Delete <span className="font-600 text-foreground">{deleteReceiveTarget.voucherNo}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteReceiveTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-600 font-body hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleDeleteReceive} className="flex-1 px-4 py-2 bg-danger text-white rounded-xl text-sm font-600 font-body hover:bg-danger/90 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
