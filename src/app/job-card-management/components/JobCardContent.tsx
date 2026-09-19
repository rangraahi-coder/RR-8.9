'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Filter, Download, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, Eye, Edit3, Trash2, ClipboardList, X, Layers } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import JobCardDetailDrawer from './JobCardDetailDrawer';
import CreateJobCardModal from './CreateJobCardModal';
import AuditBadge from '@/components/ui/AuditBadge';
import { toast } from 'sonner';

import { jobCardService } from '@/lib/services/jobCardService';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';

export type JobCardStage =
  | 'cutting' |'stitching' |'embroidery' |'finishing' |'qc' |'dispatch_ready' |'dispatched';

export interface JobCard {
  id: string;
  jobCardNo: string;
  styleEn: string;
  styleHi: string;
  designCode: string;
  partyName: string;
  contractor: string;
  stage: JobCardStage;
  totalPieces: number;
  completedPieces: number;
  isBlocked: boolean;
  blockageReasonEn?: string;
  blockageReasonHi?: string;
  blockageDays?: number;
  dueDate: string;
  poNo: string;
  createdDate: string;
  colors: string[];
  sizes: string[];
  sizeRatios?: Record<string, number>; // size → qty from sales order paramSize
  salesOrderId?: string | null; // FK to sales_orders — enables automatic status reversal on delete/edit
  // Audit trail
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

type SortField = 'jobCardNo' | 'partyName' | 'contractor' | 'stage' | 'totalPieces' | 'dueDate';
type SortDir = 'asc' | 'desc';

interface JobCardContentProps {
  lang: 'en' | 'hi';
  searchQuery?: string;
}

export default function JobCardContent({ lang, searchQuery = '' }: JobCardContentProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('jobCardNo');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailCard, setDetailCard] = useState<JobCard | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editCard, setEditCard] = useState<JobCard | null>(null);

  async function loadJobCards() {
    setLoading(true);
    try {
      let data = await jobCardService.getAll();
      setJobCards(data);
    } catch {
      setJobCards([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobCards();
  }, []);

  // Realtime: re-fetch whenever any user inserts/updates/deletes a job card
  useRealtimeTable('job_cards', loadJobCards);

  const STAGES = [
    { value: 'all', labelEn: 'All Stages', labelHi: 'सभी स्टेज' },
    { value: 'cutting', labelEn: 'Cutting', labelHi: 'कटाई' },
    { value: 'stitching', labelEn: 'Stitching', labelHi: 'सिलाई' },
    { value: 'embroidery', labelEn: 'Embroidery', labelHi: 'कढ़ाई' },
    { value: 'finishing', labelEn: 'Finishing', labelHi: 'फिनिशिंग' },
    { value: 'qc', labelEn: 'QC', labelHi: 'QC जांच' },
    { value: 'dispatch_ready', labelEn: 'Dispatch Ready', labelHi: 'भेजने तैयार' },
    { value: 'dispatched', labelEn: 'Dispatched', labelHi: 'भेज दिया' },
  ];

  const filtered = useMemo(() => {
    let data = jobCards;
    const effectiveSearch = searchQuery || search;
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      data = data.filter(
        (j) =>
          j.jobCardNo.toLowerCase().includes(q) ||
          j.styleEn.toLowerCase().includes(q) ||
          j.styleHi.includes(q) ||
          j.partyName.toLowerCase().includes(q) ||
          j.contractor.toLowerCase().includes(q) ||
          j.poNo.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'all') {
      data = data.filter((j) => j.stage === stageFilter);
    }
    if (blockedOnly) {
      data = data.filter((j) => j.isBlocked);
    }
    data = [...data].sort((a, b) => {
      let aVal: string | number = a[sortField] as string | number;
      let bVal: string | number = b[sortField] as string | number;
      if (sortField === 'totalPieces') {
        aVal = a.totalPieces;
        bVal = b.totalPieces;
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [jobCards, search, searchQuery, stageFilter, blockedOnly, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((j) => j.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await jobCardService.deleteMany(ids);
    setJobCards((prev) => prev.filter((j) => !selectedIds.has(j.id)));
    toast.success(`${selectedIds.size} ${lang === 'hi' ? 'जॉब कार्ड हटाए गए' : 'job cards deleted'}`);
    setSelectedIds(new Set());
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp size={10} className={sortField === field && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground/40'} />
      <ChevronDown size={10} className={sortField === field && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground/40'} />
    </span>
  );

  const progressPct = (jc: JobCard) =>
    jc.totalPieces > 0 ? Math.round((jc.completedPieces / jc.totalPieces) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-700 text-foreground">
            {lang === 'hi' ? 'जॉब कार्ड प्रबंधन' : 'Job Card Management'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lang === 'hi'
              ? `${filtered.length} जॉब कार्ड · ${jobCards.filter((j) => j.isBlocked).length} रुके हुए`
              : `${filtered.length} job cards · ${jobCards.filter((j) => j.isBlocked).length} blocked`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info(lang === 'hi' ? 'एक्सपोर्ट हो रहा है...' : 'Exporting...')}
            className="btn-ghost flex items-center gap-1.5 text-sm"
          >
            <Download size={14} />
            {lang === 'hi' ? 'एक्सपोर्ट' : 'Export'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus size={14} />
            {lang === 'hi' ? 'नया जॉब कार्ड' : 'New Job Card'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-surface p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              placeholder={lang === 'hi' ? 'जॉब कार्ड नं, स्टाइल, पार्टी खोजें...' : 'Search job card no, style, party...'}
              className="input-field pl-9"
            />
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {STAGES.map((s) => (
                <button
                  key={`stage-filter-${s.value}`}
                  onClick={() => { setStageFilter(s.value); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150 ${
                    stageFilter === s.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {lang === 'hi' ? s.labelHi : s.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Blocked toggle */}
          <button
            onClick={() => { setBlockedOnly(!blockedOnly); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150 flex-shrink-0 ${
              blockedOnly
                ? 'bg-danger-bg text-danger border border-danger-border' :'bg-muted text-muted-foreground hover:bg-secondary'
            }`}
          >
            <AlertTriangle size={12} />
            {lang === 'hi' ? 'रुके हुए' : 'Blocked Only'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-primary"
                  />
                </th>
                {[
                  { key: 'jobCardNo' as SortField, labelEn: 'Job Card No', labelHi: 'जॉब कार्ड नं' },
                  { key: 'partyName' as SortField, labelEn: 'Party', labelHi: 'पार्टी' },
                  { key: 'contractor' as SortField, labelEn: 'Contractor', labelHi: 'कॉन्ट्रैक्टर' },
                  { key: 'stage' as SortField, labelEn: 'Stage', labelHi: 'स्टेज' },
                  { key: 'totalPieces' as SortField, labelEn: 'Pieces', labelHi: 'पीस' },
                ].map((col) => (
                  <th
                    key={`th-${col.key}`}
                    className="px-4 py-3 text-left cursor-pointer hover:bg-secondary/50 transition-all duration-150"
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="section-label flex items-center">
                      {lang === 'hi' ? col.labelHi : col.labelEn}
                      <SortIcon field={col.key} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left">
                  <span className="section-label">{lang === 'hi' ? 'रुकावट' : 'Blockage'}</span>
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:bg-secondary/50" onClick={() => toggleSort('dueDate')}>
                  <span className="section-label flex items-center">
                    {lang === 'hi' ? 'देय तारीख' : 'Due Date'} <SortIcon field="dueDate" />
                  </span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="section-label">{lang === 'hi' ? 'प्रगति' : 'Progress'}</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="section-label">{lang === 'hi' ? 'किसने किया' : 'By'}</span>
                </th>
                <th className="w-24 px-4 py-3">
                  <span className="section-label">{lang === 'hi' ? 'कार्रवाई' : 'Actions'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-2">
                    <EmptyState
                      icon={<ClipboardList size={32} />}
                      titleEn="No Job Cards Found"
                      titleHi="कोई जॉब कार्ड नहीं मिला"
                      descEn="No job cards match your current filters. Create a new job card to get started."
                      descHi="आपके फ़िल्टर से कोई जॉब कार्ड नहीं मिला। नया जॉब कार्ड बनाएं।"
                      action={
                        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                          <Plus size={14} />
                          {lang === 'hi' ? 'नया जॉब कार्ड बनाएं' : 'Create Job Card'}
                        </button>
                      }
                      lang={lang}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((jc, rowIdx) => {
                  const pct = progressPct(jc);
                  const isSelected = selectedIds.has(jc.id);
                  const isOverdue = jc.dueDate <= '31/07/2026' && jc.stage !== 'dispatched';
                  return (
                    <tr
                      key={jc.id}
                      className={`border-b border-border transition-all duration-150 cursor-pointer group ${
                        isSelected ? 'bg-primary/5' : rowIdx % 2 === 0 ? 'bg-card hover:bg-muted/50' : 'bg-muted/20 hover:bg-muted/50'
                      }`}
                      onClick={() => setDetailCard(jc)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(jc.id)}
                          className="w-4 h-4 accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-700 text-foreground">{jc.jobCardNo}</p>
                          <Link
                            href={`/item-master?search=${encodeURIComponent(jc.designCode)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline font-500 truncate max-w-[140px] text-left block"
                          >
                            {lang === 'hi' ? jc.styleHi : jc.styleEn}
                          </Link>
                          <p className="text-xs text-muted-foreground/70">{jc.designCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-600 text-foreground">{jc.partyName}</p>
                        <p className="text-xs text-muted-foreground">{jc.poNo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-500 text-foreground truncate max-w-[140px]">{jc.contractor}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={jc.stage} lang={lang} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-700 text-foreground tabular-nums">
                          {jc.completedPieces.toLocaleString('en-IN')}
                          <span className="text-muted-foreground font-500">/{jc.totalPieces.toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lang === 'hi' ? `${jc.colors.length} रंग · ${jc.sizes.length} साइज़` : `${jc.colors.length} colors · ${jc.sizes.length} sizes`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {jc.isBlocked ? (
                          <div className="flex items-start gap-1.5">
                            <AlertTriangle size={14} className="text-danger mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-600 text-danger leading-tight">
                                {lang === 'hi' ? jc.blockageReasonHi : jc.blockageReasonEn}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {jc.blockageDays}{lang === 'hi' ? ' दिन' : 'd'} {lang === 'hi' ? 'रुका' : 'blocked'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-success">
                            <CheckCircle2 size={14} />
                            <span className="text-xs font-600">{lang === 'hi' ? 'ठीक है' : 'Clear'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-600 tabular-nums ${isOverdue ? 'text-danger' : 'text-foreground'}`}>
                          {jc.dueDate}
                        </span>
                        {isOverdue && (
                          <p className="text-xs text-danger font-600">
                            {lang === 'hi' ? 'देर हो गई' : 'Overdue'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 bg-border rounded-full h-1.5 w-16">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-success' : pct > 50 ? 'bg-primary' : 'bg-warning'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-600 text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <AuditBadge
                          createdBy={jc.createdBy}
                          createdAt={jc.createdAt}
                          updatedBy={jc.updatedBy}
                          updatedAt={jc.updatedAt}
                          variant="compact"
                        />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                          <button
                            onClick={() => setDetailCard(jc)}
                            title={lang === 'hi' ? 'देखें' : 'View details'}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all duration-150"
                          >
                            <Eye size={14} />
                          </button>
                          <Link
                            href={`/production-batch/${jc.id}`}
                            title={lang === 'hi' ? 'प्रोडक्शन बैच' : 'Production Batch'}
                            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Layers size={14} />
                          </Link>
                          <button
                            title={lang === 'hi' ? 'संपादित करें' : 'Edit job card'}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all duration-150"
                            onClick={() => setEditCard(jc)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            title={lang === 'hi' ? 'हटाएं — यह पूर्ववत नहीं होगा' : 'Delete — this cannot be undone'}
                            className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-all duration-150"
                            onClick={async () => {
                              const ok = await jobCardService.delete(jc.id);
                              if (ok) {
                                setJobCards((prev) => prev.filter((j) => j.id !== jc.id));
                                toast.success(lang === 'hi' ? `${jc.jobCardNo} हटाया गया` : `${jc.jobCardNo} deleted`);
                              } else {
                                toast.error(lang === 'hi' ? 'हटाने में त्रुटि' : 'Failed to delete');
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 slide-up">
          <div className="flex items-center gap-3 bg-foreground text-background px-5 py-3 rounded-2xl shadow-modal">
            <span className="text-sm font-700">
              {selectedIds.size} {lang === 'hi' ? 'चुने गए' : 'selected'}
            </span>
            <div className="w-px h-4 bg-background/30" />
            <button
              onClick={() => toast.info(lang === 'hi' ? 'स्टेज बदलें...' : 'Change stage...')}
              className="text-sm font-600 hover:text-secondary transition-colors"
            >
              {lang === 'hi' ? 'स्टेज बदलें' : 'Change Stage'}
            </button>
            <button
              onClick={handleBulkDelete}
              className="text-sm font-600 text-danger hover:text-red-400 transition-colors"
            >
              {lang === 'hi' ? 'हटाएं' : 'Delete'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1 hover:bg-background/20 rounded-lg transition-all duration-150"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailCard && (
        <JobCardDetailDrawer
          jobCard={detailCard}
          lang={lang}
          onClose={() => setDetailCard(null)}
          onStageUpdate={(id, stage) => {
            setJobCards((prev) =>
              prev.map((j) => (j.id === id ? { ...j, stage } : j))
            );
            toast.success(lang === 'hi' ? 'स्टेज अपडेट हो गई' : 'Stage updated');
          }}
          onBlockageResolve={(id) => {
            setJobCards((prev) =>
              prev.map((j) =>
                j.id === id ? { ...j, isBlocked: false, blockageReasonEn: undefined, blockageReasonHi: undefined } : j
              )
            );
            toast.success(lang === 'hi' ? 'रुकावट हटाई गई' : 'Blockage resolved');
          }}
          onEdit={(card) => {
            setDetailCard(null);
            setEditCard(card);
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobCardModal
          lang={lang}
          onClose={() => setShowCreateModal(false)}
          onCreate={async (savedCard) => {
            // Modal already saved to Supabase — just refresh the list and close
            await loadJobCards();
            setShowCreateModal(false);
            toast.success(lang === 'hi' ? `${savedCard.jobCardNo} बनाया गया!` : `${savedCard.jobCardNo} created!`);
          }}
        />
      )}

      {/* Edit Modal */}
      {editCard && (
        <CreateJobCardModal
          lang={lang}
          editCard={editCard}
          onClose={() => setEditCard(null)}
          onCreate={async (updatedCard) => {
            // Modal already called jobCardService.update() — re-fetch from Supabase
            // to ensure the entire ERP sees the latest data
            await loadJobCards();
            setEditCard(null);
            toast.success(lang === 'hi' ? `${updatedCard.jobCardNo} अपडेट हो गया!` : `${updatedCard.jobCardNo} updated!`);
          }}
        />
      )}
    </div>
  );
}