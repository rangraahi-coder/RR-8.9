'use client';
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Scissors, Info } from 'lucide-react';
import { stitchingVoucherService, StitchOperator, StitchIssueVoucher,  } from '@/lib/services/stitchingVoucherService';
import { cuttingService } from '@/lib/services/cuttingService';
import { useAuth } from '@/contexts/AuthContext';

interface JobCardOption {
  id: string;
  jobCardNo: string;
  styleEn: string;
  partyName: string;
  poNo?: string;
  totalPieces: number;
  colors?: string[];
  sizes?: string[];
}

interface ComponentRow {
  tempId: string;
  component: string;
  issuedQty: number;
  unit: string;
  size: string;
  sizeBreakdown: { size: string; qty: number }[];
  remarks: string;
}

interface Props {
  jobCards: JobCardOption[];
  onClose: () => void;
  onSaved: () => void;
  editVoucher?: StitchIssueVoucher | null;
}

const SUB_COMPONENTS = ['Kurta', 'Pant', 'Dupatta', 'Shirt', 'Yoke', 'Sleeve', 'Collar', 'Pocket', 'Lining', 'Other'];

function makeRow(): ComponentRow {
  return { tempId: `r-${Date.now()}-${Math.random()}`, component: '', issuedQty: 0, unit: 'Pcs', size: '', sizeBreakdown: [], remarks: '' };
}

export default function StitchIssueModal({ jobCards, onClose, onSaved, editVoucher }: Props) {
  const { username } = useAuth();
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedJobCardNo, setSelectedJobCardNo] = useState('');
  const [jobCardInfo, setJobCardInfo] = useState<JobCardOption | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [components, setComponents] = useState<ComponentRow[]>([makeRow()]);
  const [operators, setOperators] = useState<StitchOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // True Quantity: component+size-wise cutting quantities (source of truth)
  const [cuttingQtyMap, setCuttingQtyMap] = useState<{ component: string; size: string; netPieces: number }[]>([]);
  // Already-issued quantities for the selected job card (excluding current edit voucher)
  const [issuedQtyMap, setIssuedQtyMap] = useState<{ component: string; size: string; issuedQty: number }[]>([]);

  // Helper: get the True Quantity for a given component + size combination
  function getTrueQty(component: string, size: string): number {
    if (!component) return Infinity;
    if (cuttingQtyMap.length === 0) return Infinity;
    // If size is specified, look for exact component+size match
    if (size) {
      const match = cuttingQtyMap.find((q) => q.component === component && q.size === size);
      if (match) return match.netPieces;
      // Fallback: sum all sizes for this component
    }
    // No size or no exact match: sum all entries for this component
    const total = cuttingQtyMap
      .filter((q) => q.component === component)
      .reduce((s, q) => s + q.netPieces, 0);
    return total > 0 ? total : Infinity;
  }

  // Helper: get already-issued qty for a given component + size
  function getAlreadyIssuedQty(component: string, size: string): number {
    if (!component) return 0;
    if (size) {
      // Exact match first
      const exact = issuedQtyMap.find((q) => q.component === component && q.size === size);
      if (exact) return exact.issuedQty;
      // Also check entries with no size (issued without size breakdown)
      const noSize = issuedQtyMap.find((q) => q.component === component && !q.size);
      return noSize ? noSize.issuedQty : 0;
    }
    // No size: sum all entries for this component
    return issuedQtyMap
      .filter((q) => q.component === component)
      .reduce((s, q) => s + q.issuedQty, 0);
  }

  // Helper: get remaining issuable qty = cutting qty - already issued qty
  function getRemainingQty(component: string, size: string): number {
    const trueQty = getTrueQty(component, size);
    if (trueQty === Infinity) return Infinity;
    const alreadyIssued = getAlreadyIssuedQty(component, size);
    return Math.max(0, trueQty - alreadyIssued);
  }

  // Fetch cutting quantities whenever job card changes
  async function fetchCuttingQty(jobCardNo: string) {
    if (!jobCardNo) { setCuttingQtyMap([]); return; }
    const data = await cuttingService.getCuttingQtyByComponentSize(jobCardNo);
    setCuttingQtyMap(data);
  }

  // Fetch already-issued quantities for the selected job card
  async function fetchIssuedQty(jobCardNo: string) {
    if (!jobCardNo) { setIssuedQtyMap([]); return; }
    const data = await stitchingVoucherService.getIssuedQtyByJobCard(jobCardNo, editVoucher?.id);
    setIssuedQtyMap(data);
  }

  useEffect(() => {
    async function init() {
      const [nextNo, ops] = await Promise.all([
        editVoucher ? Promise.resolve(editVoucher.voucherNo) : stitchingVoucherService.getNextIssueVoucherNo(),
        stitchingVoucherService.getActiveOperators(),
      ]);
      setVoucherNo(nextNo);
      setOperators(ops);

      if (editVoucher) {
        setVoucherDate(editVoucher.voucherDate);
        setSelectedJobCardNo(editVoucher.jobCardRef);
        const jc = jobCards.find((j) => j.jobCardNo === editVoucher.jobCardRef);
        setJobCardInfo(jc || null);
        setOperatorId(editVoucher.operatorId || '');
        setOperatorName(editVoucher.operatorName);
        setRemarks(editVoucher.remarks || '');
        setComponents(
          editVoucher.components.length > 0
            ? editVoucher.components.map((c) => ({
                tempId: c.id,
                component: c.component,
                issuedQty: c.issuedQty,
                unit: c.unit,
                size: c.sizeBreakdown && c.sizeBreakdown.length === 1 ? c.sizeBreakdown[0].size : '',
                sizeBreakdown: c.sizeBreakdown || [],
                remarks: c.remarks || '',
              }))
            : [makeRow()]
        );
        // Fetch cutting qty for the edit voucher's job card
        await fetchCuttingQty(editVoucher.jobCardRef);
        // Fetch already-issued qty for the edit voucher's job card
        await fetchIssuedQty(editVoucher.jobCardRef);
      }
      setLoading(false);
    }
    init();
  }, [editVoucher, jobCards]);

  function handleJobCardChange(val: string) {
    setSelectedJobCardNo(val);
    const jc = jobCards.find((j) => j.jobCardNo === val);
    setJobCardInfo(jc || null);
    if (val) setFieldErrors((prev) => ({ ...prev, jobCard: '' }));
    // Fetch component+size-wise cutting quantities for the selected job card
    fetchCuttingQty(val);
    // Fetch already-issued qty for the selected job card
    fetchIssuedQty(val);
  }

  function handleOperatorChange(val: string) {
    setOperatorId(val);
    const op = operators.find((o) => o.id === val);
    setOperatorName(op?.operatorName || '');
    if (val) setFieldErrors((prev) => ({ ...prev, operator: '' }));
  }

  function updateRow(tempId: string, field: keyof ComponentRow, value: any) {
    setComponents((prev) => prev.map((r) => {
      if (r.tempId !== tempId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'component' && value) {
        setFieldErrors((prev2) => ({ ...prev2, [`component_${tempId}`]: '' }));
      }
      return updated;
    }));
  }

  const totalPieces = components.reduce((s, c) => s + (c.issuedQty || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!selectedJobCardNo) newErrors.jobCard = 'Job Card is required.';
    if (!operatorId) newErrors.operator = 'Operator is required.';
    components.forEach((c) => {
      if (!c.component) newErrors[`component_${c.tempId}`] = 'Select a component.';
      if (c.issuedQty <= 0) newErrors[`qty_${c.tempId}`] = 'Qty must be > 0.';
      // Check against remaining issuable qty
      if (c.component && c.issuedQty > 0) {
        const remaining = getRemainingQty(c.component, c.size);
        if (remaining !== Infinity && c.issuedQty > remaining) {
          const sizeLabel = c.size ? ` (${c.size})` : '';
          newErrors[`qty_${c.tempId}`] = `Only ${remaining} pcs remaining for ${c.component}${sizeLabel}. Already issued: ${getAlreadyIssuedQty(c.component, c.size)}.`;
        }
      }
    });

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Issue qty exceeds available balance. Please correct the highlighted fields.');
      return;
    }

    setFieldErrors({});
    if (!selectedJobCardNo) { setError('Please select a Job Card.'); return; }
    if (!operatorId) { setError('Operator is mandatory for Issue voucher.'); return; }
    if (components.some((c) => !c.component || c.issuedQty <= 0)) {
      setError('All components must have a name and quantity > 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const jc = jobCards.find((j) => j.jobCardNo === selectedJobCardNo);
      const voucherData = {
        voucherNo,
        voucherDate,
        jobCardId: jc?.id,
        jobCardRef: selectedJobCardNo,
        styleName: jc?.styleEn,
        partyName: jc?.partyName,
        poNo: jc?.poNo,
        operatorId,
        operatorName,
        totalPieces,
        status: 'open' as const,
        remarks,
      };
      const compData = components.map((c) => ({
        component: c.component,
        issuedQty: c.issuedQty,
        unit: c.unit,
        sizeBreakdown: c.size
          ? [{ size: c.size, qty: c.issuedQty }]
          : c.sizeBreakdown.length > 0
          ? c.sizeBreakdown
          : undefined,
        remarks: c.remarks || undefined,
      }));

      let result;
      if (editVoucher) {
        result = await stitchingVoucherService.updateIssueVoucher(editVoucher.id, voucherData, compData, username);
      } else {
        result = await stitchingVoucherService.createIssueVoucher(voucherData, compData, username);
      }

      if (!result) { setError('Failed to save voucher. Please try again.'); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-card rounded-2xl p-8 text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-700 text-foreground">{editVoucher ? 'Edit Issue Voucher' : 'New Stitching Issue'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Issue material component-wise from Job Card</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {error && <div className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">{error}</div>}

          {/* Voucher Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Voucher No</label>
              <input type="text" value={voucherNo} readOnly className="input-field text-sm bg-muted/30 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Date *</label>
              <input type="date" required value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="input-field text-sm" />
            </div>
          </div>

          {/* Job Card */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Job Card *</label>
            <select required value={selectedJobCardNo} onChange={(e) => handleJobCardChange(e.target.value)} className={`input-field text-sm ${fieldErrors.jobCard ? 'border-danger ring-1 ring-danger/30' : ''}`}>
              <option value="">-- Select Job Card --</option>
              {jobCards.map((jc) => (
                <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn} ({jc.partyName})</option>
              ))}
            </select>
            {fieldErrors.jobCard && <p className="text-xs text-danger mt-0.5">{fieldErrors.jobCard}</p>}
          </div>

          {/* Job Card Info Panel */}
          {jobCardInfo && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs">
              <div><span className="text-muted-foreground font-600">Party:</span> <span className="text-foreground font-600 ml-1">{jobCardInfo.partyName}</span></div>
              {jobCardInfo.poNo && <div><span className="text-muted-foreground font-600">PO:</span> <span className="text-foreground ml-1">{jobCardInfo.poNo}</span></div>}
              <div><span className="text-muted-foreground font-600">Total Pcs:</span> <span className="text-primary font-700 ml-1">{jobCardInfo.totalPieces}</span></div>
              {jobCardInfo.colors && jobCardInfo.colors.length > 0 && <div><span className="text-muted-foreground font-600">Colors:</span> <span className="text-foreground ml-1">{jobCardInfo.colors.join(', ')}</span></div>}
              {jobCardInfo.sizes && jobCardInfo.sizes.length > 0 && <div><span className="text-muted-foreground font-600">Sizes:</span> <span className="text-foreground ml-1">{jobCardInfo.sizes.join(', ')}</span></div>}
            </div>
          )}

          {/* Operator — MANDATORY */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground flex items-center gap-1.5">
              Issue Operator *
              <span className="text-[10px] text-primary font-500 bg-primary/10 px-1.5 py-0.5 rounded-md">Mandatory</span>
            </label>
            <select required value={operatorId} onChange={(e) => {
              if (e.target.value === '__add_operator__') {
                window.open('/operator-master', '_blank');
                e.target.value = operatorId;
                return;
              }
              handleOperatorChange(e.target.value);
            }} className={`input-field text-sm ${fieldErrors.operator ? 'border-danger ring-1 ring-danger/30' : ''}`}>
              <option value="">-- Select Operator --</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.operatorCode} — {op.operatorName} ({op.process || op.department})</option>
              ))}
              <option value="__add_operator__">➕ Add Operator Master</option>
            </select>
            {fieldErrors.operator && <p className="text-xs text-danger mt-0.5">{fieldErrors.operator}</p>}
            {operators.length === 0 && (
              <p className="text-xs text-warning flex items-center gap-1"><Info size={11} /> No active operators found. Add operators in Operator Master first.</p>
            )}
          </div>

          {/* Components */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-700 text-foreground">Components to Issue *</p>
              <button type="button" onClick={() => setComponents((p) => [...p, makeRow()])} className="flex items-center gap-1 text-xs text-primary font-600 hover:underline">
                <Plus size={12} /> Add Component
              </button>
            </div>

            {components.map((row) => {
              const remaining = getRemainingQty(row.component, row.size);
              const isExceeded = row.issuedQty > remaining;
              return (
                <div key={row.tempId} className={`border rounded-xl p-4 flex flex-col gap-3 bg-muted/20 ${(fieldErrors[`component_${row.tempId}`] || fieldErrors[`qty_${row.tempId}`]) ? 'border-danger' : 'border-border'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-600 text-muted-foreground">Component *</label>
                      <select value={row.component} onChange={(e) => updateRow(row.tempId, 'component', e.target.value)} className={`input-field text-sm ${fieldErrors[`component_${row.tempId}`] ? 'border-danger' : ''}`}>
                        <option value="">-- Select Component --</option>
                        {SUB_COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {fieldErrors[`component_${row.tempId}`] && <p className="text-xs text-danger mt-0.5">{fieldErrors[`component_${row.tempId}`]}</p>}
                    </div>
                    <div className="flex flex-col gap-1 w-28">
                      <label className="text-xs font-600 text-muted-foreground">Size</label>
                      <select
                        value={row.size}
                        onChange={(e) => updateRow(row.tempId, 'size', e.target.value)}
                        className="input-field text-sm"
                      >
                        <option value="">-- Select Size --</option>
                        {(() => {
                          // Show sizes that have cutting qty > 0 for the selected component
                          const sizesWithQty = row.component
                            ? cuttingQtyMap
                                .filter((q) => q.component === row.component && q.size && q.netPieces > 0)
                                .map((q) => q.size)
                            : [];
                          // Fallback to jobCardInfo sizes if no cutting data yet
                          const displaySizes = sizesWithQty.length > 0
                            ? sizesWithQty
                            : (jobCardInfo?.sizes || []);
                          // Always include saved size even if not in list
                          const allSizes = row.size && !displaySizes.includes(row.size)
                            ? [...displaySizes, row.size]
                            : displaySizes;
                          return allSizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ));
                        })()}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 w-28">
                      <label className="text-xs font-600 text-muted-foreground">
                        Issue Qty *
                        {row.component && getRemainingQty(row.component, row.size) !== Infinity && (() => {
                          const totalRemaining = getRemainingQty(row.component, row.size);
                          // Subtract qty already entered in ALL rows (including this one) for same component+size
                          const otherRowsQty = components
                            .filter((r) => r.tempId !== row.tempId && r.component === row.component && r.size === row.size)
                            .reduce((s, r) => s + (r.issuedQty || 0), 0);
                          const displayLeft = Math.max(0, totalRemaining - (row.issuedQty || 0) - otherRowsQty);
                          return (
                            <span className={`ml-1 text-[10px] font-500 ${displayLeft === 0 ? 'text-danger' : 'text-primary'}`}>
                              / {displayLeft} left
                            </span>
                          );
                        })()}
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max={getRemainingQty(row.component, row.size) !== Infinity ? getRemainingQty(row.component, row.size) : undefined}
                        value={row.issuedQty || ''}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value) || 0;
                          updateRow(row.tempId, 'issuedQty', raw);
                          if (raw > 0) setFieldErrors((prev) => ({ ...prev, [`qty_${row.tempId}`]: '' }));
                        }}
                        className={`input-field text-sm tabular-nums ${fieldErrors[`qty_${row.tempId}`] ? 'border-danger' : (row.component && getRemainingQty(row.component, row.size) !== Infinity && row.issuedQty > getRemainingQty(row.component, row.size) ? 'border-danger' : '')}`}
                        placeholder="0"
                      />
                      {row.component && getRemainingQty(row.component, row.size) === 0 && !fieldErrors[`qty_${row.tempId}`] && (
                        <p className="text-[10px] text-danger mt-0.5 font-500">Fully issued — no qty remaining.</p>
                      )}
                      {fieldErrors[`qty_${row.tempId}`] && <p className="text-xs text-danger mt-0.5">{fieldErrors[`qty_${row.tempId}`]}</p>}
                    </div>
                    <div className="flex flex-col gap-1 w-20">
                      <label className="text-xs font-600 text-muted-foreground">Unit</label>
                      <select value={row.unit} onChange={(e) => updateRow(row.tempId, 'unit', e.target.value)} className="input-field text-sm">
                        <option>Pcs</option><option>Metres</option><option>Set</option>
                      </select>
                    </div>
                    {components.length > 1 && (
                      <button type="button" onClick={() => setComponents((p) => p.filter((r) => r.tempId !== row.tempId))} className="mt-5 p-1.5 rounded-lg hover:bg-danger/10 text-danger">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {isExceeded && (
                    <div className="text-red-500 text-xs mt-1">
                      Issue quantity exceeds remaining available. Please adjust.
                    </div>
                  )}
                </div>
              );
            })}

            {totalPieces > 0 && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
                <Scissors size={13} className="text-primary" />
                <p className="text-xs text-primary font-600">Total Issue Qty: <span className="font-700">{totalPieces} Pcs</span></p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input-field text-sm resize-none" placeholder="Optional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : editVoucher ? 'Update Issue Voucher' : 'Save Issue Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
