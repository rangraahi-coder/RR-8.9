'use client';
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Clock, User, Package, ChevronRight, Edit3, Flag, ExternalLink, Layers } from 'lucide-react';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { JobCard, JobCardStage } from './JobCardContent';
import { createClient } from '@/lib/supabase/client';
import { ItemComposition } from '@/app/production-batch/data/productionBatchData';

const STAGE_ORDER: JobCardStage[] = [
  'cutting',
  'stitching',
  'embroidery',
  'finishing',
  'qc',
  'dispatch_ready',
  'dispatched',
];

const STAGE_LABELS_HI: Record<JobCardStage, string> = {
  cutting: 'कटाई',
  stitching: 'सिलाई',
  embroidery: 'कढ़ाई',
  finishing: 'फिनिशिंग',
  qc: 'QC जांच',
  dispatch_ready: 'भेजने तैयार',
  dispatched: 'भेज दिया',
};

const STAGE_LABELS_EN: Record<JobCardStage, string> = {
  cutting: 'Cutting',
  stitching: 'Stitching',
  embroidery: 'Embroidery',
  finishing: 'Finishing',
  qc: 'QC Check',
  dispatch_ready: 'Dispatch Ready',
  dispatched: 'Dispatched',
};

const BLOCKAGE_REASONS_EN = [
  'Lace accessories not received',
  'Fabric short',
  'Machine breakdown at contractor',
  'Embroidery thread color mismatch',
  'Buttons/zipper not received',
  'Worker shortage',
  'Power cut — production halted',
];

const BLOCKAGE_REASONS_HI = [
  'लेस एक्सेसरीज़ नहीं आई',
  'कपड़ा कम है',
  'कॉन्ट्रैक्टर की मशीन खराब',
  'कढ़ाई धागे का रंग गलत',
  'बटन/ज़िप नहीं आया',
  'मज़दूर कम हैं',
  'बिजली गई — उत्पादन रुका',
];

interface JobCardDetailDrawerProps {
  jobCard: JobCard;
  lang: 'en' | 'hi';
  onClose: () => void;
  onStageUpdate: (id: string, stage: JobCardStage) => void;
  onBlockageResolve: (id: string) => void;
  onEdit: (jobCard: JobCard) => void;
}

export default function JobCardDetailDrawer({
  jobCard,
  lang,
  onClose,
  onStageUpdate,
  onBlockageResolve,
  onEdit,
}: JobCardDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'stages' | 'blockage' | 'batch'>('overview');
  const [showBlockageForm, setShowBlockageForm] = useState(false);
  const [selectedBlockageReason, setSelectedBlockageReason] = useState(0);
  const [compositions, setCompositions] = useState<ItemComposition[]>([]);

  // Load compositions for this job card
  useEffect(() => {
    async function loadCompositions() {
      try {
        const supabase = createClient();
        const { data: styleData } = await supabase
          .from('item_styles')
          .select('id')
          .eq('job_card_no', jobCard.jobCardNo)
          .maybeSingle();
        if (styleData?.id) {
          const { data } = await supabase
            .from('item_compositions')
            .select('*')
            .eq('style_id', styleData.id)
            .order('sort_order', { ascending: true });
          setCompositions((data || []) as ItemComposition[]);
        }
      } catch {
        // no compositions
      }
    }
    loadCompositions();
  }, [jobCard.jobCardNo]);

  const currentStageIdx = STAGE_ORDER.indexOf(jobCard.stage);
  const allSizes = jobCard.sizes.length > 0 ? jobCard.sizes : [];
  const allColors = jobCard.colors.length > 0 ? jobCard.colors : [];

  // Build size-color matrix using actual size ratios from the linked sales order
  // Each size row's total = sizeRatios[size] (from paramSize), distributed evenly across colors
  const sizeColorMatrix: Record<string, Record<string, number>> = (() => {
    const matrix: Record<string, Record<string, number>> = {};
    const numColors = allColors.length;
    if (allSizes.length === 0 || numColors === 0) return matrix;

    const hasSizeRatios = jobCard.sizeRatios && Object.keys(jobCard.sizeRatios).length > 0;

    allSizes.forEach((size) => {
      matrix[size] = {};
      // Use actual qty from sizeRatios if available, else distribute totalPieces evenly
      const sizeTotal = hasSizeRatios
        ? (jobCard.sizeRatios![size] ?? 0)
        : Math.floor(jobCard.totalPieces / allSizes.length);

      const perColor = Math.floor(sizeTotal / numColors);
      const remainder = sizeTotal - perColor * numColors;

      allColors.forEach((color, ci) => {
        const extra = ci < remainder ? 1 : 0;
        matrix[size][color] = perColor + extra;
      });
    });
    return matrix;
  })();

  const TABS = [
    { id: 'overview', labelEn: 'Overview', labelHi: 'अवलोकन' },
    { id: 'matrix', labelEn: 'Size-Color Matrix', labelHi: 'साइज़-रंग मैट्रिक्स' },
    { id: 'stages', labelEn: 'Stage History', labelHi: 'स्टेज इतिहास' },
    { id: 'blockage', labelEn: 'Blockage', labelHi: 'रुकावट' },
    { id: 'batch', labelEn: 'Production Batch', labelHi: 'प्रोडक्शन बैच' },
  ] as const;

  const pct =
    jobCard.totalPieces > 0
      ? Math.round((jobCard.completedPieces / jobCard.totalPieces) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-modal fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-card">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-800 text-foreground">{jobCard.jobCardNo}</h2>
              <StatusBadge variant={jobCard.stage} lang={lang} />
              {jobCard.isBlocked && (
                <span className="flex items-center gap-1 text-xs font-700 text-danger bg-danger-bg border border-danger-border px-2 py-0.5 rounded-full">
                  <AlertTriangle size={10} />
                  {lang === 'hi' ? 'रुका हुआ' : 'BLOCKED'}
                </span>
              )}
              {compositions.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-600 text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                  <Layers size={10} />
                  {compositions.length}PC
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-500">
              <Link
                href={`/item-master?search=${encodeURIComponent(lang === 'hi' ? jobCard.styleHi : jobCard.styleEn)}`}
                className="text-primary hover:underline font-500"
              >
                {lang === 'hi' ? jobCard.styleHi : jobCard.styleEn}
              </Link>
              {' · '}{jobCard.designCode}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all duration-150 flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 bg-muted/30">
          {TABS.map((tab) => (
            <button
              key={`drawer-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-600 border-b-2 transition-all duration-150 ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {lang === 'hi' ? tab.labelHi : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Blockage alert banner */}
              {jobCard.isBlocked && (
                <div className="p-4 bg-danger-bg border border-danger-border rounded-xl flex items-start gap-3">
                  <AlertTriangle size={18} className="text-danger mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-700 text-danger">
                      {lang === 'hi' ? 'रुकावट: ' : 'Blocked: '}
                      {lang === 'hi' ? jobCard.blockageReasonHi : jobCard.blockageReasonEn}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {jobCard.blockageDays} {lang === 'hi' ? 'दिन से रुका है' : 'days blocked'}
                    </p>
                  </div>
                  <button
                    onClick={() => { onBlockageResolve(jobCard.id); onClose(); }}
                    className="text-xs font-700 text-success bg-success-bg border border-success-border px-3 py-1.5 rounded-lg hover:bg-success/10 transition-all duration-150 flex-shrink-0"
                  >
                    {lang === 'hi' ? 'हल करें' : 'Resolve'}
                  </button>
                </div>
              )}

              {/* Composition banner */}
              {compositions.length > 0 && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers size={15} className="text-purple-600" />
                    <span className="text-sm font-700 text-purple-700">
                      {lang === 'hi' ? 'सेट कम्पोज़िशन' : 'Set Composition'}
                      {' '}— {compositions.map(c => c.component_name).join(' + ')}
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
                  <p className="text-xs text-purple-600 mt-2">
                    {lang === 'hi' ?'प्रत्येक कम्पोनेंट की qty हर स्टेज पर अलग-अलग ट्रैक होती है।' :'Each component tracks its own qty independently at every production stage.'}
                  </p>
                </div>
              )}

              {/* Key info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { labelEn: 'Party Name', labelHi: 'पार्टी का नाम', value: jobCard.partyName, icon: <User size={14} /> },
                  { labelEn: 'PO Number', labelHi: 'PO नंबर', value: jobCard.poNo, icon: <Package size={14} /> },
                  { labelEn: 'Contractor', labelHi: 'कॉन्ट्रैक्टर', value: jobCard.contractor, icon: <User size={14} /> },
                  { labelEn: 'Due Date', labelHi: 'देय तारीख', value: jobCard.dueDate, icon: <Clock size={14} /> },
                  { labelEn: 'Created', labelHi: 'बनाया गया', value: jobCard.createdDate, icon: <Clock size={14} /> },
                  { labelEn: 'Colors', labelHi: 'रंग', value: jobCard.colors.join(', '), icon: <Package size={14} /> },
                ].map((item, idx) => (
                  <div key={`info-${idx}`} className="p-3 bg-muted rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-muted-foreground">{item.icon}</span>
                      <p className="section-label">{lang === 'hi' ? item.labelHi : item.labelEn}</p>
                    </div>
                    <p className="text-sm font-600 text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <div className="p-4 bg-muted rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-700 text-foreground">
                    {lang === 'hi' ? 'उत्पादन प्रगति' : 'Production Progress'}
                  </p>
                  <span className="text-sm font-800 text-primary tabular-nums">{pct}%</span>
                </div>
                <div className="bg-border rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      pct === 100 ? 'bg-success' : pct > 60 ? 'bg-primary' : 'bg-warning'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {jobCard.completedPieces.toLocaleString('en-IN')} {lang === 'hi' ? 'पूरे' : 'done'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {jobCard.totalPieces.toLocaleString('en-IN')} {lang === 'hi' ? 'कुल' : 'total'}
                  </p>
                </div>
              </div>

              {/* Stage progression quick nav */}
              <div className="p-4 bg-muted rounded-xl">
                <p className="section-label mb-3">{lang === 'hi' ? 'अगली स्टेज पर भेजें' : 'Move to Next Stage'}</p>
                <div className="flex gap-2 flex-wrap">
                  {STAGE_ORDER.map((stage, idx) => {
                    const isCurrent = stage === jobCard.stage;
                    const isPast = idx < currentStageIdx;
                    const isNext = idx === currentStageIdx + 1;
                    return (
                      <button
                        key={`stage-btn-${stage}`}
                        onClick={() => {
                          if (isNext) {
                            onStageUpdate(jobCard.id, stage);
                            onClose();
                          }
                        }}
                        disabled={!isNext}
                        className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150 ${
                          isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : isPast
                            ? 'bg-muted text-muted-foreground/50 line-through cursor-default'
                            : isNext
                            ? 'bg-success-bg text-success border border-success-border hover:bg-success/10 cursor-pointer' :'bg-muted text-muted-foreground/40 cursor-not-allowed'
                        }`}
                      >
                        {lang === 'hi' ? STAGE_LABELS_HI[stage] : STAGE_LABELS_EN[stage]}
                        {isNext && <ChevronRight size={10} className="inline ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SIZE-COLOR MATRIX TAB */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-700 text-foreground">
                    {lang === 'hi' ? 'साइज़ × रंग मैट्रिक्स' : 'Size × Color Matrix'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === 'hi' ? 'प्रत्येक सेल में पीस की संख्या' : 'Pieces per size-color combination'}
                  </p>
                </div>
                <button className="btn-ghost flex items-center gap-1.5 text-xs">
                  <Edit3 size={12} />
                  {lang === 'hi' ? 'संपादित करें' : 'Edit Matrix'}
                </button>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="px-4 py-3 text-left">
                        <span className="section-label">{lang === 'hi' ? 'साइज़ / रंग' : 'Size / Color'}</span>
                      </th>
                      {allColors.map((color) => (
                        <th key={`col-${color}`} className="px-3 py-3 text-center">
                          <span className="section-label">{color}</span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center">
                        <span className="section-label">{lang === 'hi' ? 'कुल' : 'Total'}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSizes.map((size, sIdx) => {
                      const rowTotal = allColors.reduce(
                        (sum, color) => sum + (sizeColorMatrix[size]?.[color] ?? 0),
                        0
                      );
                      return (
                        <tr
                          key={`matrix-row-${size}`}
                          className={`border-b border-border ${sIdx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-700 text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {size}
                            </span>
                          </td>
                          {allColors.map((color) => {
                            const val = sizeColorMatrix[size]?.[color] ?? 0;
                            return (
                              <td key={`cell-${size}-${color}`} className="px-3 py-3 text-center">
                                <span
                                  className={`text-sm font-700 tabular-nums ${
                                    val === 0 ? 'text-muted-foreground/40' : 'text-foreground'
                                  }`}
                                >
                                  {val === 0 ? '—' : val}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-800 text-primary tabular-nums">{rowTotal}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Column totals */}
                    <tr className="bg-muted border-t-2 border-border">
                      <td className="px-4 py-3">
                        <span className="section-label">{lang === 'hi' ? 'कुल' : 'Total'}</span>
                      </td>
                      {allColors.map((color) => {
                        const colTotal = allSizes.reduce(
                          (sum, size) => sum + (sizeColorMatrix[size]?.[color] ?? 0),
                          0
                        );
                        return (
                          <td key={`total-${color}`} className="px-3 py-3 text-center">
                            <span className="text-sm font-800 text-primary tabular-nums">{colTotal}</span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className="text-base font-800 text-foreground tabular-nums">
                          {allSizes.reduce(
                            (sum, size) =>
                              sum + allColors.reduce((s2, color) => s2 + (sizeColorMatrix[size]?.[color] ?? 0), 0),
                            0
                          )}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary chips */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-2 bg-muted rounded-lg">
                  <p className="section-label mb-0.5">{lang === 'hi' ? 'साइज़' : 'Sizes'}</p>
                  <p className="text-sm font-700 text-foreground">{jobCard.sizes.join(' · ')}</p>
                </div>
                <div className="px-3 py-2 bg-muted rounded-lg">
                  <p className="section-label mb-0.5">{lang === 'hi' ? 'रंग' : 'Colors'}</p>
                  <p className="text-sm font-700 text-foreground">{jobCard.colors.join(' · ')}</p>
                </div>
                <div className="px-3 py-2 bg-muted rounded-lg">
                  <p className="section-label mb-0.5">{lang === 'hi' ? 'कुल कॉम्बिनेशन' : 'Combinations'}</p>
                  <p className="text-sm font-700 text-foreground">{jobCard.sizes.length * jobCard.colors.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* STAGE HISTORY TAB */}
          {activeTab === 'stages' && (
            <div className="space-y-4">
              <h3 className="text-base font-700 text-foreground">
                {lang === 'hi' ? 'स्टेज इतिहास' : 'Stage History'}
              </h3>
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                {STAGE_ORDER.map((stage, idx) => {
                  const isDone = idx < currentStageIdx;
                  const isCurrent = idx === currentStageIdx;
                  const isPending = idx > currentStageIdx;
                  const stageDates = STAGE_ORDER.map(() => '—');
                  const stageTimes = STAGE_ORDER.map(() => '—');
                  return (
                    <div key={`history-${stage}`} className="flex items-start gap-4 pb-5 relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          isDone
                            ? 'bg-success text-white'
                            : isCurrent
                            ? 'bg-primary text-white ring-4 ring-primary/20' :'bg-muted text-muted-foreground border-2 border-border'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} />
                        ) : isCurrent ? (
                          <Clock size={16} />
                        ) : (
                          <span className="text-xs font-700">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 pt-1.5">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-700 ${isCurrent ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {lang === 'hi' ? STAGE_LABELS_HI[stage] : STAGE_LABELS_EN[stage]}
                          </p>
                          {!isPending && (
                            <span className="text-xs text-muted-foreground font-500">
                              {stageDates[idx]} {stageTimes[idx] !== '—' ? `· ${stageTimes[idx]}` : ''}
                            </span>
                          )}
                        </div>
                        {isCurrent && (
                          <p className="text-xs text-primary font-600 mt-0.5">
                            {lang === 'hi' ? '← अभी यहाँ है' : '← Currently here'}
                          </p>
                        )}
                        {isDone && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {lang === 'hi' ? 'पूरा हो गया' : 'Completed'}
                          </p>
                        )}
                        {isPending && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">
                            {lang === 'hi' ? 'बाकी है' : 'Pending'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BLOCKAGE TAB — keep existing content */}
          {activeTab === 'blockage' && <BlockageTab jobCard={jobCard} lang={lang} onBlockageResolve={onBlockageResolve} onClose={onClose} showBlockageForm={showBlockageForm} setShowBlockageForm={setShowBlockageForm} selectedBlockageReason={selectedBlockageReason} setSelectedBlockageReason={setSelectedBlockageReason} />}

          {/* BATCH TAB */}
          {activeTab === 'batch' && <BatchTab jobCard={jobCard} lang={lang} />}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-card flex items-center gap-3">
          <button
            onClick={() => onEdit(jobCard)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-600 text-foreground hover:bg-muted transition-all duration-150"
          >
            <Edit3 size={14} />
            {lang === 'hi' ? 'संपादित करें' : 'Edit Job Card'}
          </button>
          <Link
            href={`/production-batch/${jobCard.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-600 hover:bg-primary/90 transition-all duration-150"
          >
            <ExternalLink size={14} />
            {lang === 'hi' ? 'प्रोडक्शन बैच' : 'Production Batch'}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Blockage Tab (extracted to keep file clean) ──────────────────────────────
function BlockageTab({ jobCard, lang, onBlockageResolve, onClose, showBlockageForm, setShowBlockageForm, selectedBlockageReason, setSelectedBlockageReason }: {
  jobCard: JobCard;
  lang: 'en' | 'hi';
  onBlockageResolve: (id: string) => void;
  onClose: () => void;
  showBlockageForm: boolean;
  setShowBlockageForm: (v: boolean) => void;
  selectedBlockageReason: number;
  setSelectedBlockageReason: (v: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-700 text-foreground">
          {lang === 'hi' ? 'रुकावट प्रबंधन' : 'Blockage Management'}
        </h3>
        {!jobCard.isBlocked && (
          <button
            onClick={() => setShowBlockageForm(true)}
            className="flex items-center gap-1.5 text-xs font-600 text-warning bg-warning-bg border border-warning-border px-3 py-1.5 rounded-lg hover:bg-warning/10 transition-all duration-150"
          >
            <Flag size={12} />
            {lang === 'hi' ? 'रुकावट दर्ज करें' : 'Flag Blockage'}
          </button>
        )}
      </div>

      {jobCard.isBlocked ? (
        <div className="space-y-4">
          <div className="p-4 bg-danger-bg border border-danger-border rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-danger mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-800 text-danger">
                  {lang === 'hi' ? 'वर्तमान रुकावट' : 'Current Blockage'}
                </p>
                <p className="text-base font-600 text-foreground mt-1">
                  {lang === 'hi' ? jobCard.blockageReasonHi : jobCard.blockageReasonEn}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {jobCard.blockageDays} {lang === 'hi' ? 'दिन से रुका है' : 'days blocked'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { onBlockageResolve(jobCard.id); onClose(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-success text-white rounded-xl text-sm font-700 hover:bg-success/90 transition-all duration-150"
          >
            <CheckCircle2 size={16} />
            {lang === 'hi' ? 'रुकावट हल करें' : 'Mark as Resolved'}
          </button>
        </div>
      ) : showBlockageForm ? (
        <div className="space-y-4">
          <p className="text-sm font-600 text-foreground">
            {lang === 'hi' ? 'रुकावट का कारण चुनें:' : 'Select blockage reason:'}
          </p>
          <div className="space-y-2">
            {(lang === 'hi' ? BLOCKAGE_REASONS_HI : BLOCKAGE_REASONS_EN).map((reason, idx) => (
              <button
                key={`reason-${idx}`}
                onClick={() => setSelectedBlockageReason(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-150 ${
                  selectedBlockageReason === idx
                    ? 'border-warning bg-warning-bg text-warning font-600' :'border-border text-foreground hover:bg-muted'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBlockageForm(false)}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-600 text-foreground hover:bg-muted transition-all duration-150"
            >
              {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>
            <button className="flex-1 px-4 py-2.5 bg-warning text-white rounded-xl text-sm font-700 hover:bg-warning/90 transition-all duration-150">
              {lang === 'hi' ? 'रुकावट दर्ज करें' : 'Flag as Blocked'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 size={40} className="text-success mb-3" />
          <p className="text-sm font-700 text-foreground">
            {lang === 'hi' ? 'कोई रुकावट नहीं' : 'No Active Blockage'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'hi' ? 'उत्पादन सुचारू रूप से चल रहा है' : 'Production is running smoothly'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Batch Tab ────────────────────────────────────────────────────────────────
function BatchTab({ jobCard, lang }: { jobCard: JobCard; lang: 'en' | 'hi' }) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-700 text-foreground">
        {lang === 'hi' ? 'प्रोडक्शन बैच' : 'Production Batch'}
      </h3>
      <div className="p-4 bg-muted rounded-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{lang === 'hi' ? 'बैच नंबर' : 'Batch No.'}</span>
          <span className="text-sm font-700 text-foreground font-mono">PB-{jobCard.id.slice(-6).toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{lang === 'hi' ? 'कुल पीस' : 'Total Pieces'}</span>
          <span className="text-sm font-700 text-foreground tabular-nums">{jobCard.totalPieces.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{lang === 'hi' ? 'वर्तमान स्टेज' : 'Current Stage'}</span>
          <StatusBadge variant={jobCard.stage} lang={lang} />
        </div>
      </div>
      <Link
        href={`/production-batch/${jobCard.id}`}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-700 hover:bg-primary/90 transition-all duration-150"
      >
        <ExternalLink size={14} />
        {lang === 'hi' ? 'पूरा बैच देखें' : 'View Full Production Batch'}
      </Link>
    </div>
  );
}