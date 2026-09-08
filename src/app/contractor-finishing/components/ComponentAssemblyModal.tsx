'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertCircle, CheckCircle2, Layers, Package } from 'lucide-react';
import {
  componentAssemblyService,
  AssemblyComponentRow,
  FinishingStockRow,
} from '@/lib/services/componentAssemblyService';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

interface JobCardOption {
  jobCardRef: string;
  styleName?: string;
  partyName?: string;
  jobCardId?: string;
}

export default function ComponentAssemblyModal({ onClose, onSaved }: Props) {
  const { username } = useAuth();

  const saveRef = useRef(false);
  const requestRef = useRef<string | null>(null);
  const [composition, setComposition] = useState<{component: string; qtyPerSet: number}[]>([]);

  // Header fields
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  // Job card selection
  const [jobCardOptions, setJobCardOptions] = useState<JobCardOption[]>([]);
  const [selectedJobCardRef, setSelectedJobCardRef] = useState('');
  const [selectedJobCard, setSelectedJobCard] = useState<JobCardOption | null>(null);

  // Final item name
  const [finalItemName, setFinalItemName] = useState('');

  // Finishing stock / sub-components
  const [finishingStock, setFinishingStock] = useState<FinishingStockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Assembly component rows (one per component+size+colour)
  const [componentRows, setComponentRows] = useState<AssemblyComponentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Init
  useEffect(() => {
    async function init() {
      try {
      const [nextNo, jobCards] = await Promise.all([
        componentAssemblyService.getNextVoucherNo(),
        componentAssemblyService.getJobCardsWithFinishingStock(),
      ]);
      setVoucherNo(nextNo);
      setJobCardOptions(jobCards);
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setLoading(false); }
    }
    init();
  }, []);

  // When job card changes, load finishing stock
  useEffect(() => {
    if (!selectedJobCardRef) {
      setFinishingStock([]);
      setComponentRows([]);
      setSelectedJobCard(null);
      return;
    }
    const jc = jobCardOptions.find((j) => j.jobCardRef === selectedJobCardRef) || null;
    setSelectedJobCard(jc);
    // Auto-fill final item name from style name
    if (jc?.styleName && !finalItemName) {
      setFinalItemName(jc.styleName);
    }

    async function loadStock() {
      setLoadingStock(true);
      try {
      setError(null);
      const [stock, required] = await Promise.all([componentAssemblyService.getFinishingStockByJobCard(selectedJobCardRef), componentAssemblyService.getComposition(selectedJobCardRef)]);
      setComposition(required);
      setFinishingStock(stock);
      // Build component rows from finishing stock
      const rows: AssemblyComponentRow[] = stock.map((s) => ({
        component: s.component,
        size: s.size,
        colour: s.colour,
        availableFinishedQty: s.pendingQty,
        qtyUsed: 0,
      }));
      setComponentRows(rows);
      } catch (e) { setComposition([]); setComponentRows([]); setError(e instanceof Error ? e.message : String(e)); }
      finally { setLoadingStock(false); }
    }
    loadStock();
  }, [selectedJobCardRef, jobCardOptions]);

  function updateQtyUsed(idx: number, value: number) {
    setComponentRows((prev) =>
      prev.map((r, i) => i === idx ? { ...r, qtyUsed: Math.max(0, value) } : r)
    );
  }

  // Row-level validation
  const rowErrors = useMemo(() => {
    const errors: Record<number, string> = {};
    componentRows.forEach((row, idx) => {
      if ((row.qtyUsed || 0) <= 0) return;
      if (row.qtyUsed > row.availableFinishedQty) {
        errors[idx] = `Qty (${row.qtyUsed}) exceeds available finished qty (${row.availableFinishedQty})`;
      }
    });
    return errors;
  }, [componentRows]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  const activeRows = componentRows.filter((r) => (r.qtyUsed || 0) > 0);
  const norm = (s: string) => s.trim().toLowerCase();
  const ratios = composition.map(c => activeRows.filter(r => norm(r.component) === norm(c.component)).reduce((n,r) => n+r.qtyUsed,0) / c.qtyPerSet);
  const complete = ratios.length > 0 && ratios.every(n => Number.isInteger(n) && n > 0 && n === ratios[0]) && activeRows.every(r => composition.some(c => norm(c.component) === norm(r.component)));
  const totalSetsAssembled = complete ? ratios[0] : 0;

  const stockGroups = [...new Map(componentRows.map(r => [`${norm(r.size)}|${norm(r.colour)}`, {size: r.size, colour: r.colour}])).values()];
  function fillCompleteSets(size: string, colour: string) {
    const matching = componentRows.filter(r => norm(r.size) === norm(size) && norm(r.colour) === norm(colour));
    const count = composition.length ? Math.min(...composition.map(c => Math.floor(matching.filter(r => norm(r.component) === norm(c.component)).reduce((n,r) => n+r.availableFinishedQty,0)/c.qtyPerSet))) : 0;
    if (!count) { setError('There are not enough finished components for one complete set in this size/colour.'); return; }
    setError(null);
    setComponentRows(rows => rows.map(r => {
      const c = composition.find(c => norm(c.component) === norm(r.component));
      return {...r, qtyUsed: c && norm(r.size) === norm(size) && norm(r.colour) === norm(colour) ? count*c.qtyPerSet : 0};
    }));
  }

  // Group components by name for display (show distinct component names)
  const componentNames = [...new Set(componentRows.map((r) => r.component))];

  async function handleSave() {
    if (saveRef.current) return;
    setError(null);
    const newErrors: Record<string, string> = {};
    if (!selectedJobCardRef) newErrors.jobCard = 'Please select a Job Card.';
    if (!finalItemName.trim()) newErrors.finalItem = 'Final item name is required (e.g. 3-Piece Kurta Set).';
    if (activeRows.length === 0) newErrors.qty = 'Enter assembly quantity for at least one sub-component.';

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Please fill all required fields before saving.');
      return;
    }
    setFieldErrors({});

    if (!complete) { setError('Enter all required components in their qty-per-set ratio. Incomplete sets cannot become ready items.'); return; }
    if (activeRows.some(r => norm(r.size) !== norm(activeRows[0].size) || norm(r.colour) !== norm(activeRows[0].colour))) { setError('Assemble one size and colour per voucher.'); return; }
    if (hasRowErrors) {
      setError('Please fix quantity errors before saving.');
      return;
    }

    saveRef.current = true;
    requestRef.current ||= crypto.randomUUID();
    setSaving(true);
    try {
    const result = await componentAssemblyService.create(
      {
        voucherNo,
        voucherDate,
        jobCardRef: selectedJobCardRef,
        jobCardId: selectedJobCard?.jobCardId,
        styleName: selectedJobCard?.styleName,
        partyName: selectedJobCard?.partyName,
        finalItemName: finalItemName.trim(),
        colour: activeRows[0]?.colour || '',
        size: activeRows[0]?.size || '',
        remarks: remarks.trim() || undefined,
      },
      componentRows,
      username, requestRef.current
    );
    if (!result) { setError('Failed to save. Please try again.'); return; }
    requestRef.current = null;
    onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { saveRef.current = false; setSaving(false); }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-sm text-muted-foreground font-body">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-700 font-display">Component Assembly Voucher</h2>
              <p className="text-xs text-muted-foreground font-body">Combine finished sub-components into a final Ready Item</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {composition.length > 0 && <p className="text-sm text-muted-foreground">Required per set: {composition.map(c => `${c.component} × ${c.qtyPerSet}`).join(', ')}. Only complete sets become ready stock.</p>}
          {composition.length > 0 && stockGroups.map(g => <button type="button" key={`${g.size}|${g.colour}`} className="mr-2 px-3 py-2 text-xs rounded-xl border border-primary/30 text-primary" onClick={() => fillCompleteSets(g.size,g.colour)}>Fill complete sets — {[g.size,g.colour].filter(Boolean).join(' / ') || 'Unspecified size/colour'}</button>)}
          <p className="text-xs text-muted-foreground">Only the entered quantities are consumed. Surplus components remain available for the next assembly.</p>
          {/* Voucher Header */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Voucher No</label>
              <input
                value={voucherNo}
                readOnly
                className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-muted/30 font-body text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Date</label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
              />
            </div>
          </div>

          {/* Job Card Selection */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">
              Job Card <span className="text-danger">*</span>
            </label>
            <select
              value={selectedJobCardRef}
              onChange={(e) => setSelectedJobCardRef(e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body ${fieldErrors.jobCard ? 'border-danger' : 'border-border'}`}
            >
              <option value="">— Select Job Card with finished sub-components —</option>
              {jobCardOptions.map((jc) => (
                <option key={jc.jobCardRef} value={jc.jobCardRef}>
                  {jc.jobCardRef}{jc.styleName ? ` — ${jc.styleName}` : ''}{jc.partyName ? ` (${jc.partyName})` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.jobCard && <p className="text-xs text-danger mt-1 font-body">{fieldErrors.jobCard}</p>}
            {jobCardOptions.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1 font-body">No job cards with finished sub-components found. Complete Finishing Receive first.</p>
            )}
          </div>

          {/* Final Item Name */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">
              Final Item Name <span className="text-danger">*</span>
            </label>
            <input
              value={finalItemName}
              onChange={(e) => setFinalItemName(e.target.value)}
              placeholder="e.g. 3-Piece Kurta Set"
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body ${fieldErrors.finalItem ? 'border-danger' : 'border-border'}`}
            />
            {fieldErrors.finalItem && <p className="text-xs text-danger mt-1 font-body">{fieldErrors.finalItem}</p>}
            <p className="text-xs text-muted-foreground mt-1 font-body">This will be the name of the assembled Ready Item in Finished Goods.</p>
          </div>

          {/* Sub-Components Table */}
          {selectedJobCardRef && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package size={14} className="text-primary" />
                <span className="text-sm font-600 text-foreground font-body">Finished Sub-Components</span>
                {selectedJobCard?.styleName && (
                  <span className="text-xs text-muted-foreground font-body">— {selectedJobCard.styleName}</span>
                )}
              </div>

              {loadingStock ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground font-body">Loading sub-components...</div>
              ) : componentRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 bg-muted/20 rounded-xl border border-border">
                  <Package size={28} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground font-body">No finished sub-components found for this job card.</p>
                  <p className="text-xs text-muted-foreground font-body">Complete Finishing Receive for all sub-components first.</p>
                </div>
              ) : (
                <>
                  {/* Component summary chips */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {componentNames.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-600 bg-primary/10 text-primary font-body">
                        <CheckCircle2 size={11} />
                        {name}
                      </span>
                    ))}
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left px-3 py-2.5 text-xs font-600 text-muted-foreground font-body">Sub-Component</th>
                          <th className="text-left px-3 py-2.5 text-xs font-600 text-muted-foreground font-body">Size</th>
                          <th className="text-left px-3 py-2.5 text-xs font-600 text-muted-foreground font-body">Colour</th>
                          <th className="text-right px-3 py-2.5 text-xs font-600 text-muted-foreground font-body">Available (Finished)</th>
                          <th className="text-right px-3 py-2.5 text-xs font-600 text-primary font-body">Qty to Assemble</th>
                        </tr>
                      </thead>
                      <tbody>
                        {componentRows.map((row, idx) => (
                          <tr key={`${row.component}-${row.size}-${row.colour}-${idx}`} className="border-b border-border/50 last:border-0">
                            <td className="px-3 py-2.5 font-600 text-foreground font-body">{row.component || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground font-body">{row.size || '—'}</td>
                            <td className="px-3 py-2.5 text-muted-foreground font-body">{row.colour || '—'}</td>
                            <td className="px-3 py-2.5 text-right font-600 text-success font-body">{row.availableFinishedQty ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={row.availableFinishedQty}
                                  value={row.qtyUsed || ''}
                                  onChange={(e) => updateQtyUsed(idx, parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className={`w-24 px-2 py-1.5 text-sm text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-body ${rowErrors[idx] ? 'border-danger bg-danger-bg/20' : 'border-border'}`}
                                />
                                {rowErrors[idx] && (
                                  <p className="text-xs text-danger font-body max-w-[200px] text-right">{rowErrors[idx]}</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Assembly Summary */}
                  {activeRows.length > 0 && (
                    <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-primary" />
                        <span className="text-sm font-600 text-primary font-body">
                          Assembly Result: <span className="text-lg">{totalSetsAssembled}</span> complete set{totalSetsAssembled !== 1 ? 's' : ''} of "{finalItemName || 'Final Item'}"
                        </span>
                      </div>
                      <p className="text-xs text-primary/70 mt-1 font-body">
                        Sets assembled = minimum qty across all sub-components ({activeRows.map((r) => `${r.component}: ${r.qtyUsed}`).join(', ')})
                      </p>
                    </div>
                  )}
                </>
              )}
              {fieldErrors.qty && <p className="text-xs text-danger mt-2 font-body">{fieldErrors.qty}</p>}
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Optional remarks..."
              className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger-border rounded-xl">
              <AlertCircle size={14} className="text-danger mt-0.5 shrink-0" />
              <p className="text-xs text-danger font-body">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-5 border-t border-border sticky bottom-0 bg-white">
          <div className="text-xs text-muted-foreground font-body">
            {activeRows.length > 0 && !hasRowErrors && (
              <span className="text-success font-600">
                ✓ {totalSetsAssembled} set{totalSetsAssembled !== 1 ? 's' : ''} ready to assemble
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-sm font-600 font-body hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || hasRowErrors}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 font-body hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <><Layers size={14} /> Assemble Components</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
