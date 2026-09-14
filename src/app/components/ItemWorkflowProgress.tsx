'use client';
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, Check } from 'lucide-react';
import {
  fetchWorkflowStatuses,
  upsertWorkflowStatus,
  WorkflowManualStatus,
} from '@/lib/services/workflowStatusService';

// ─── Workflow stages in order ───────────────────────────────────────────────
export const WORKFLOW_STAGES = [
  { key: 'po_sales_order',  labelEn: 'Sales Order', labelHi: 'सेल्स ऑर्डर' },
  { key: 'job_card',        labelEn: 'Job Card',        labelHi: 'जॉब कार्ड' },
  { key: 'pattern',         labelEn: 'Pattern',         labelHi: 'पैटर्न' },
  { key: 'fabric',          labelEn: 'Fabric',          labelHi: 'फैब्रिक' },
  { key: 'pp',              labelEn: 'PP',              labelHi: 'PP' },
  { key: 'size_set',        labelEn: 'Size Set',        labelHi: 'साइज़ सेट' },
  { key: 'cutting',         labelEn: 'Cutting',         labelHi: 'कटिंग' },
  { key: 'accessories',     labelEn: 'Accessories',     labelHi: 'एक्सेसरीज़' },
  { key: 'stitching',       labelEn: 'Stitching',       labelHi: 'सिलाई' },
  { key: 'checking',        labelEn: 'Checking',        labelHi: 'चेकिंग' },
  { key: 'packing',         labelEn: 'Packing',         labelHi: 'पैकिंग' },
  { key: 'ready_goods',     labelEn: 'Ready Goods',     labelHi: 'रेडी गुड्स' },
  { key: 'dispatched',      labelEn: 'Dispatched',      labelHi: 'डिस्पैच' },
] as const;

type StageKey = typeof WORKFLOW_STAGES[number]['key'];

// Stages that are fetchable from manufacturing workflow vouchers (DB-driven)
const FETCHABLE_STAGES = new Set<StageKey>([
  'po_sales_order', 'job_card',
  'cutting', 'accessories', 'stitching', 'checking', 'packing', 'ready_goods', 'dispatched',
]);

// Non-fetchable stages that need manual status tracking (persisted to DB)
const NON_FETCHABLE_STAGES = new Set<StageKey>([
  'pattern', 'fabric', 'pp', 'size_set',
]);

// Status options for non-fetchable stages
const MANUAL_STATUS_OPTIONS = [
  { value: 'in_progress', labelEn: 'In Process',   labelHi: 'चल रहा',      color: 'text-orange-500' },
  { value: 'done',        labelEn: 'Completed',     labelHi: 'पूरा',        color: 'text-green-600' },
  { value: 'blocked',     labelEn: 'Blocked',       labelHi: 'रुका हुआ',    color: 'text-red-500' },
] as const;

type ManualStatus = WorkflowManualStatus;

// Map job_card.stage (DB enum) → which workflow stages are "done"
const STAGE_COMPLETION_MAP: Record<string, StageKey[]> = {
  cutting:        ['cutting'],
  stitching:      ['cutting', 'accessories', 'stitching'],
  embroidery:     ['cutting', 'accessories', 'stitching'],
  finishing:      ['cutting', 'accessories', 'stitching', 'checking'],
  qc:             ['cutting', 'accessories', 'stitching', 'checking'],
  dispatch_ready: ['cutting', 'accessories', 'stitching', 'checking', 'packing', 'ready_goods'],
  dispatched:     ['cutting', 'accessories', 'stitching', 'checking', 'packing', 'ready_goods', 'dispatched'],
};

// Current active stage per DB stage
const STAGE_ACTIVE_MAP: Record<string, StageKey> = {
  cutting:        'cutting',
  stitching:      'stitching',
  embroidery:     'stitching',
  finishing:      'checking',
  qc:             'checking',
  dispatch_ready: 'ready_goods',
  dispatched:     'dispatched',
};

export interface WorkflowItem {
  id: string;
  jobCardNo: string;
  styleName: string;
  partyName: string;
  stage: string;
  totalPieces: number;
  completedPieces: number;
  isBlocked: boolean;
  blockageReason?: string;
  poNo?: string;
}

// ─── Stage status for a single cell ─────────────────────────────────────────
type CellStatus = 'done' | 'active' | 'partial' | 'pending' | 'blocked' | 'manual_done' | 'manual_progress' | 'manual_blocked';

function getCellStatus(
  stageKey: StageKey,
  item: WorkflowItem,
  stageIndex: number,
  manualStatuses: Record<string, ManualStatus>,
): CellStatus {
  // ERP-driven auto stages
  if (stageKey === 'job_card') {
    // Job card exists in ERP → always done
    return 'done';
  }
  if (stageKey === 'po_sales_order') {
    // Sales order punched in ERP if po_no is set
    return item.poNo ? 'done' : 'active';
  }

  // Non-fetchable stages: use manual status from DB
  if (NON_FETCHABLE_STAGES.has(stageKey)) {
    const manualKey = `${item.id}__${stageKey}`;
    const ms = manualStatuses[manualKey];
    if (ms === 'done') return 'manual_done';
    if (ms === 'in_progress') return 'manual_progress';
    if (ms === 'blocked') return 'manual_blocked';
    return 'pending';
  }

  // Fetchable stages: use DB-driven logic from job_card.stage
  const completedStages = STAGE_COMPLETION_MAP[item.stage] ?? [];
  if (completedStages.includes(stageKey)) return 'done';

  const activeStage = STAGE_ACTIVE_MAP[item.stage];
  if (stageKey === activeStage) {
    if (item.isBlocked) return 'blocked';
    const pct = item.totalPieces > 0 ? item.completedPieces / item.totalPieces : 0;
    return pct > 0 ? 'partial' : 'active';
  }
  return 'pending';
}

const CELL_STYLES: Record<CellStatus, string> = {
  done:             'bg-green-500 border-green-600',
  manual_done:      'bg-green-500 border-green-600',
  active:           'bg-orange-400 border-orange-500',
  partial:          'bg-orange-300 border-orange-400',
  manual_progress:  'bg-orange-400 border-orange-500',
  blocked:          'bg-red-500 border-red-600',
  manual_blocked:   'bg-red-500 border-red-600',
  pending:          'bg-gray-100 border-gray-200',
};

// ─── Stage cell with hover tooltip and click menu for non-fetchable stages ──
interface StageCellProps {
  stage: typeof WORKFLOW_STAGES[number];
  stageIndex: number;
  item: WorkflowItem;
  status: CellStatus;
  lang: 'en' | 'hi';
  allItems: WorkflowItem[];
  manualStatuses: Record<string, ManualStatus>;
  onManualStatusChange: (itemId: string, stageKey: StageKey, status: ManualStatus) => void;
  saving: boolean;
}

function StageCell({ stage, stageIndex, item, status, lang, allItems, manualStatuses, onManualStatusChange, saving }: StageCellProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isNonFetchable = NON_FETCHABLE_STAGES.has(stage.key);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  // Build tooltip summary: count items at each manual status for this stage
  const tooltipSummary = useMemo(() => {
    if (!isNonFetchable) return null;
    const counts: Record<ManualStatus, number> = { pending: 0, in_progress: 0, done: 0, blocked: 0 };
    allItems.forEach((it) => {
      const key = `${it.id}__${stage.key}`;
      const ms = manualStatuses[key] ?? 'pending';
      counts[ms]++;
    });
    return counts;
  }, [isNonFetchable, allItems, manualStatuses, stage.key]);

  const currentManualStatus = manualStatuses[`${item.id}__${stage.key}`] ?? 'pending';
  const stageLabel = lang === 'hi' ? stage.labelHi : stage.labelEn;

  if (!isNonFetchable) {
    // Regular fetchable stage cell — color-coded from ERP data
    return (
      <div className="flex flex-col items-center gap-1 flex-1 min-w-[44px]">
        <div
          className={`w-full h-5 rounded border text-center flex items-center justify-center ${CELL_STYLES[status]}`}
          title={`${stageLabel}: ${status}`}
        >
          {status === 'done' && <span className="text-white text-[9px]">✓</span>}
          {status === 'blocked' && <span className="text-white text-[9px]">✕</span>}
          {status === 'partial' && <span className="text-white text-[9px]">~</span>}
        </div>
        <span className={`text-[9px] font-500 text-center leading-tight ${status === 'pending' ? 'text-gray-400' : status === 'done' ? 'text-green-700' : status === 'blocked' ? 'text-red-600' : 'text-orange-600'}`}>
          {stageLabel}
        </span>
      </div>
    );
  }

  // Non-fetchable stage: hover tooltip + click menu — persisted to DB
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-[44px] relative">
      {/* Hover tooltip */}
      {showTooltip && !showMenu && tooltipSummary && (
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-2 shadow-xl whitespace-nowrap pointer-events-none min-w-[120px]">
          <p className="font-600 mb-1 text-[11px]">{stageLabel}</p>
          {tooltipSummary.done > 0 && (
            <p className="text-green-300">✓ Done: {tooltipSummary.done}</p>
          )}
          {tooltipSummary.in_progress > 0 && (
            <p className="text-orange-300">~ In Progress: {tooltipSummary.in_progress}</p>
          )}
          {tooltipSummary.blocked > 0 && (
            <p className="text-red-300">✕ Blocked: {tooltipSummary.blocked}</p>
          )}
          {tooltipSummary.pending > 0 && (
            <p className="text-gray-400">○ Pending: {tooltipSummary.pending}</p>
          )}
          <p className="text-gray-400 mt-1 text-[9px]">{lang === 'hi' ? 'क्लिक करें अपडेट के लिए' : 'Click to update'}</p>
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Stage cell button */}
      <button
        ref={buttonRef}
        className={`w-full h-5 rounded border text-center flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 ${CELL_STYLES[status]} ${saving ? 'opacity-60' : ''}`}
        title={`${stageLabel}: ${currentManualStatus} — click to update`}
        disabled={saving}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(false);
          if (!showMenu && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPos({
              top: rect.bottom + window.scrollY + 4,
              left: rect.left + window.scrollX + rect.width / 2,
            });
          }
          setShowMenu((v) => !v);
        }}
      >
        {status === 'manual_done' && <span className="text-white text-[9px]">✓</span>}
        {status === 'manual_blocked' && <span className="text-white text-[9px]">✕</span>}
        {status === 'manual_progress' && <span className="text-white text-[9px]">~</span>}
        {status === 'pending' && <span className="text-gray-400 text-[9px]">·</span>}
      </button>

      <span className={`text-[9px] font-500 text-center leading-tight ${
        status === 'pending' ? 'text-gray-400' :
        status === 'manual_done' ? 'text-green-700' :
        status === 'manual_blocked' ? 'text-red-600' :
        status === 'manual_progress' ? 'text-orange-600' : 'text-gray-400'
      }`}>
        {stageLabel}
      </span>

      {/* Fixed-position popup menu — escapes overflow clipping */}
      {showMenu && menuPos && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            transform: 'translateX(-50%)',
            zIndex: 9999,
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
        >
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-[10px] font-700 text-gray-700">{stageLabel}</p>
            <p className="text-[9px] text-gray-400 truncate">{item.styleName}</p>
          </div>
          {MANUAL_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors text-left ${opt.color}`}
              onClick={(e) => {
                e.stopPropagation();
                onManualStatusChange(item.id, stage.key, opt.value as ManualStatus);
                setShowMenu(false);
              }}
            >
              <span className="w-3 h-3 flex items-center justify-center shrink-0">
                {currentManualStatus === opt.value && <Check size={10} />}
              </span>
              {lang === 'hi' ? opt.labelHi : opt.labelEn}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single item row ─────────────────────────────────────────────────────────
function WorkflowRow({
  item,
  lang,
  allItems,
  manualStatuses,
  onManualStatusChange,
  savingKeys,
}: {
  item: WorkflowItem;
  lang: 'en' | 'hi';
  allItems: WorkflowItem[];
  manualStatuses: Record<string, ManualStatus>;
  onManualStatusChange: (itemId: string, stageKey: StageKey, status: ManualStatus) => void;
  savingKeys: Set<string>;
}) {
  const completedCount = (STAGE_COMPLETION_MAP[item.stage] ?? []).length;
  const totalStages = WORKFLOW_STAGES.length;
  const pct = Math.round((completedCount / totalStages) * 100);

  return (
    <div className="border border-border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
      {/* Item header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/item-master?search=${encodeURIComponent(item.styleName)}`}
              className="text-sm font-700 text-primary hover:underline truncate"
            >
              {item.styleName || item.jobCardNo}
            </Link>
            <Link
              href={`/production-batch/${item.id}`}
              className="text-xs font-500 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full shrink-0 hover:bg-primary/20 hover:underline transition-colors"
              title="View all ERP entries for this job card"
            >
              {item.jobCardNo}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.partyName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.isBlocked ? (
            <span className="flex items-center gap-1 text-xs font-600 text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} />
              {lang === 'hi' ? 'रुका हुआ' : 'Blocked'}
            </span>
          ) : pct === 100 ? (
            <span className="flex items-center gap-1 text-xs font-600 text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={10} />
              {lang === 'hi' ? 'पूरा' : 'Done'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-600 text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
              <Clock size={10} />
              {pct}%
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {item.completedPieces}/{item.totalPieces} {lang === 'hi' ? 'पीस' : 'pcs'}
          </span>
        </div>
      </div>

      {/* Workflow stages bar */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {WORKFLOW_STAGES.map((stage, idx) => {
          const status = getCellStatus(stage.key, item, idx, manualStatuses);
          const savingKey = `${item.id}__${stage.key}`;
          return (
            <StageCell
              key={stage.key}
              stage={stage}
              stageIndex={idx}
              item={item}
              status={status}
              lang={lang}
              allItems={allItems}
              manualStatuses={manualStatuses}
              onManualStatusChange={onManualStatusChange}
              saving={savingKeys.has(savingKey)}
            />
          );
        })}
      </div>

      {/* Blockage reason */}
      {item.isBlocked && item.blockageReason && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={10} />
          {item.blockageReason}
        </p>
      )}
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-green-500 inline-block" />
        {lang === 'hi' ? 'पूरा' : 'Completed'}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
        {lang === 'hi' ? 'आंशिक / चल रहा' : 'Partial / In Progress'}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-red-500 inline-block" />
        {lang === 'hi' ? 'रुका हुआ' : 'Blocked / Stuck'}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" />
        {lang === 'hi' ? 'बाकी' : 'Pending'}
      </span>
      <span className="flex items-center gap-1.5 text-gray-400 italic">
        {lang === 'hi' ? '· PP/Pattern: क्लिक करें अपडेट के लिए' : '· PP/Pattern/manual stages: click to update'}
      </span>
    </div>
  );
}

// ─── Main exported component ─────────────────────────────────────────────────
interface ItemWorkflowProgressProps {
  lang: 'en' | 'hi';
}

export default function ItemWorkflowProgress({ lang }: ItemWorkflowProgressProps) {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | 'blocked' | 'active' | 'done'>('all');

  // Manual statuses persisted to DB: key = `${itemId}__${stageKey}`
  const [manualStatuses, setManualStatuses] = useState<Record<string, ManualStatus>>({});
  // Track which keys are currently being saved (optimistic UI)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  // ── Fetch job cards from ERP ────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('job_cards')
        .select('id, job_card_no, style_en, style_hi, party_name, stage, total_pieces, completed_pieces, is_blocked, blockage_reason_en, blockage_reason_hi, po_no')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        const mapped: WorkflowItem[] = data.map((row: any) => ({
          id: row.id,
          jobCardNo: row.job_card_no,
          styleName: lang === 'hi' ? (row.style_hi || row.style_en || row.job_card_no) : (row.style_en || row.job_card_no),
          partyName: row.party_name,
          stage: row.stage,
          totalPieces: row.total_pieces || 0,
          completedPieces: row.completed_pieces || 0,
          isBlocked: row.is_blocked || false,
          blockageReason: lang === 'hi' ? (row.blockage_reason_hi || row.blockage_reason_en) : row.blockage_reason_en,
          poNo: row.po_no || '',
        }));
        setItems(mapped);
        setLastRefreshed(new Date());

        // Fetch persisted manual statuses for all loaded job cards
        const ids = mapped.map((m) => m.id);
        if (ids.length > 0) {
          const statusMap = await fetchWorkflowStatuses(ids);
          setManualStatuses(statusMap);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [lang]);

  // ── Handle manual status change: optimistic update + DB persist ─────────
  const handleManualStatusChange = useCallback(
    async (itemId: string, stageKey: StageKey, status: ManualStatus) => {
      const key = `${itemId}__${stageKey}`;

      // Optimistic update
      setManualStatuses((prev) => ({ ...prev, [key]: status }));
      setSavingKeys((prev) => new Set(prev).add(key));

      try {
        await upsertWorkflowStatus(itemId, stageKey, status);
      } catch {
        // Revert on failure
        setManualStatuses((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } finally {
        setSavingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    []
  );

  // ── Initial load + real-time subscriptions ───────────────────────────────
  useEffect(() => {
    fetchItems();

    const supabase = createClient();

    // Subscribe to job_cards changes (ERP voucher-driven stages)
    const jobCardsChannel = supabase
      .channel('job_cards_workflow')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_cards' }, () => {
        fetchItems();
      })
      .subscribe();

    // Subscribe to workflow_statuses changes (manual stage updates from any session)
    const workflowStatusChannel = supabase
      .channel('workflow_statuses_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_card_workflow_statuses' },
        (payload) => {
          const record = (payload.new && Object.keys(payload.new).length > 0)
            ? (payload.new as any)
            : (payload.old as any);
          if (record?.job_card_id && record?.stage_key) {
            const key = `${record.job_card_id}__${record.stage_key}`;
            if (payload.eventType === 'DELETE') {
              setManualStatuses((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            } else {
              setManualStatuses((prev) => ({
                ...prev,
                [key]: record.status as ManualStatus,
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobCardsChannel);
      supabase.removeChannel(workflowStatusChannel);
    };
  }, [lang]);

  const filtered = items.filter((item) => {
    if (filter === 'blocked') return item.isBlocked;
    if (filter === 'done') return item.stage === 'dispatched';
    if (filter === 'active') return !item.isBlocked && item.stage !== 'dispatched';
    return true;
  });

  const blockedCount = items.filter((i) => i.isBlocked).length;
  const doneCount = items.filter((i) => i.stage === 'dispatched').length;
  const activeCount = items.filter((i) => !i.isBlocked && i.stage !== 'dispatched').length;

  return (
    <div className="card-surface p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-700 text-foreground">
            {lang === 'hi' ? 'आइटम वर्कफ़्लो प्रोग्रेस' : 'Item Workflow Progress'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'hi' ?'हर आइटम का Sales Order से Dispatch तक का स्टेटस — ERP से लाइव' :'Real-time status from Sales Order to Dispatch — live from ERP'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {lang === 'hi' ? 'अपडेट:' : 'Updated:'}{' '}
              {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchItems}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            title={lang === 'hi' ? 'रिफ्रेश' : 'Refresh'}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: 'all',     labelEn: `All (${items.length})`,       labelHi: `सभी (${items.length})` },
          { key: 'active',  labelEn: `Active (${activeCount})`,     labelHi: `चालू (${activeCount})` },
          { key: 'blocked', labelEn: `Blocked (${blockedCount})`,   labelHi: `रुके (${blockedCount})` },
          { key: 'done',    labelEn: `Dispatched (${doneCount})`,   labelHi: `डिस्पैच (${doneCount})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`text-xs px-3 py-1 rounded-full font-600 transition-colors ${
              filter === f.key
                ? f.key === 'blocked' ? 'bg-red-500 text-white'
                  : f.key === 'done'? 'bg-green-500 text-white' :'bg-primary text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {lang === 'hi' ? f.labelHi : f.labelEn}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mb-4">
        <Legend lang={lang} />
      </div>

      {/* Items list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="flex gap-0.5">
                {WORKFLOW_STAGES.map((_, idx) => (
                  <div key={idx} className="flex-1 h-5 bg-muted rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm">
            {lang === 'hi' ? 'कोई आइटम नहीं मिला' : 'No items found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((item) => (
            <WorkflowRow
              key={item.id}
              item={item}
              lang={lang}
              allItems={items}
              manualStatuses={manualStatuses}
              onManualStatusChange={handleManualStatusChange}
              savingKeys={savingKeys}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {lang === 'hi'
            ? `${filtered.length} आइटम दिख रहे हैं`
            : `Showing ${filtered.length} items`}
        </p>
        <Link
          href="/job-card-management"
          className="text-xs text-primary font-600 hover:underline"
        >
          {lang === 'hi' ? 'सभी जॉब कार्ड देखें →' : 'View all job cards →'}
        </Link>
      </div>
    </div>
  );
}
