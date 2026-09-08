'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  contractorFinishingService,
  ContractorProcess,
  FinishingComponentRow,
  FinishingReceiveVoucher,
  StitchReceiveRef,
} from '@/lib/services/contractorFinishingService';
import { useAuth } from '@/contexts/AuthContext';
import { accountService } from '@/lib/services/accountService';

const PROCESSES: ContractorProcess[] = ['Finishing', 'Press', 'Packing'];

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editVoucher?: FinishingReceiveVoucher | null;
}

function compKey(component: string, size: string, colour: string): string {
  return `${component.toLowerCase()}||${size.toLowerCase()}||${colour.toLowerCase()}`;
}

export default function FinishingReceiveModal({ onClose, onSaved, editVoucher }: Props) {
  const { username } = useAuth();

  // Header fields
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractorName, setContractorName] = useState('');
  const [process, setProcess] = useState<ContractorProcess>('Finishing');
  const [remarks, setRemarks] = useState('');
  const [accountNames, setAccountNames] = useState<string[]>([]);

  // Stitching receive reference selection
  const [stitchRefs, setStitchRefs] = useState<StitchReceiveRef[]>([]);
  const [selectedStitchRefId, setSelectedStitchRefId] = useState('');
  const [selectedStitchRef, setSelectedStitchRef] = useState<StitchReceiveRef | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);

  // Component rows derived from selected stitch receive ref
  const [componentRows, setComponentRows] = useState<FinishingComponentRow[]>([]);
  // Already-finished qty map: key = compKey → already finished in previous vouchers
  const [alreadyFinishedMap, setAlreadyFinishedMap] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Init
  useEffect(() => {
    async function init() {
      const [nextNo, refs, accounts] = await Promise.all([
        contractorFinishingService.getNextFinishingReceiveVoucherNo(),
        contractorFinishingService.getStitchReceiveRefs(),
        accountService.getAll(),
      ]);
      setStitchRefs(refs);
      setAccountNames([...new Set(accounts.map((a) => a.name))].sort());
      if (editVoucher) {
        setVoucherNo(editVoucher.voucherNo);
        setVoucherDate(editVoucher.voucherDate);
        setContractorName(editVoucher.contractorName);
        setProcess(editVoucher.process);
        setRemarks(editVoucher.remarks || '');
        setSelectedStitchRefId(editVoucher.stitchReceiveVoucherId || '');
      } else {
        setVoucherNo(nextNo);
      }
      setLoading(false);
    }
    init();
  }, [editVoucher]);

  // When stitch receive ref changes, load full details with size breakdown
  useEffect(() => {
    if (!selectedStitchRefId) {
      setSelectedStitchRef(null);
      setComponentRows([]);
      setAlreadyFinishedMap({});
      return;
    }
    async function loadRef() {
      setLoadingRef(true);
      const ref = await contractorFinishingService.getStitchReceiveRefWithSizes(selectedStitchRefId);
      setSelectedStitchRef(ref);
      if (ref) {
        // Build component rows: expand size breakdown if available
        const rows: FinishingComponentRow[] = [];
        for (const comp of ref.components) {
          if (comp.sizeBreakdown && comp.sizeBreakdown.length > 0) {
            // One row per size
            for (const sb of comp.sizeBreakdown) {
              if ((sb.qty || 0) <= 0) continue;
              rows.push({
                tempId: `${comp.id}-${sb.size}`,
                stitchReceiveComponentId: comp.id,
                component: comp.component,
                size: sb.size,
                colour: '',
                stitchReceivedQty: sb.qty,
                alreadyFinishedQty: 0,
                pendingQty: sb.qty,
                receivedQty: 0,
              });
            }
          } else {
            // No size breakdown — one row for the component total
            rows.push({
              tempId: comp.id,
              stitchReceiveComponentId: comp.id,
              component: comp.component,
              size: '',
              colour: '',
              stitchReceivedQty: comp.receivedQty,
              alreadyFinishedQty: 0,
              pendingQty: comp.receivedQty,
              receivedQty: 0,
            });
          }
        }

        // Fetch already-finished qty for this stitch receive ref
        const alreadyMap = await contractorFinishingService.getAlreadyFinishedQty(
          ref.jobCardRef,
          ref.voucherNo,
          editVoucher?.id
        );
        setAlreadyFinishedMap(alreadyMap);

        // Apply already-finished to rows
        const updatedRows = rows.map((r) => {
          const key = compKey(r.component, r.size, r.colour);
          const alreadyDone = alreadyMap[key] || 0;
          const pending = Math.max(0, r.stitchReceivedQty - alreadyDone);
          return { ...r, alreadyFinishedQty: alreadyDone, pendingQty: pending };
        });

        // If editing, restore previously entered qty
        if (editVoucher) {
          const editMap: Record<string, number> = {};
          for (const ec of editVoucher.components) {
            editMap[compKey(ec.component, ec.size, ec.colour)] = ec.receivedQty;
          }
          setComponentRows(updatedRows.map((r) => ({
            ...r,
            receivedQty: editMap[compKey(r.component, r.size, r.colour)] || 0,
          })));
        } else {
          setComponentRows(updatedRows);
        }
      }
      setLoadingRef(false);
    }
    loadRef();
  }, [selectedStitchRefId, editVoucher]);

  function updateReceivedQty(tempId: string, value: number) {
    setComponentRows((prev) =>
      prev.map((r) => r.tempId === tempId ? { ...r, receivedQty: Math.max(0, value) } : r)
    );
  }

  // Real-time row validation
  const rowErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const row of componentRows) {
      if ((row.receivedQty || 0) <= 0) continue;
      if (row.receivedQty > row.pendingQty) {
        errors[row.tempId] = `Qty (${row.receivedQty}) exceeds pending qty (${row.pendingQty}). Stitching received: ${row.stitchReceivedQty}, already finished: ${row.alreadyFinishedQty}.`;
      }
    }
    return errors;
  }, [componentRows]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  const totalFinishedQty = componentRows.reduce((s, r) => s + (r.receivedQty || 0), 0);

  async function handleSave() {
    setError(null);
    const newErrors: Record<string, string> = {};
    if (!selectedStitchRefId || !selectedStitchRef) newErrors.stitchRef = 'Please select a Stitching Receive Reference.';
    if (!contractorName.trim()) newErrors.contractor = 'Contractor name is required.';
    if (totalFinishedQty === 0) newErrors.qty = 'Enter received quantity for at least one component.';

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Please fill all required fields before saving.');
      return;
    }
    setFieldErrors({});

    if (hasRowErrors) {
      setError('Please fix quantity errors before saving. Finishing qty cannot exceed stitching received qty.');
      return;
    }

    setSaving(true);
    let result;
    if (editVoucher) {
      result = await contractorFinishingService.updateFinishingReceiveVoucher(
        editVoucher.id,
        {
          voucherDate,
          stitchReceiveRef: selectedStitchRef!.voucherNo,
          stitchReceiveVoucherId: selectedStitchRef!.id,
          jobCardRef: selectedStitchRef!.jobCardRef,
          jobCardId: selectedStitchRef!.jobCardId,
          styleName: selectedStitchRef!.styleName,
          partyName: selectedStitchRef!.partyName,
          contractorName: contractorName.trim(),
          process,
          remarks: remarks.trim() || undefined,
        },
        componentRows,
        username
      );
    } else {
      result = await contractorFinishingService.createFinishingReceiveVoucher(
        {
          voucherNo,
          voucherDate,
          stitchReceiveRef: selectedStitchRef!.voucherNo,
          stitchReceiveVoucherId: selectedStitchRef!.id,
          jobCardRef: selectedStitchRef!.jobCardRef,
          jobCardId: selectedStitchRef!.jobCardId,
          styleName: selectedStitchRef!.styleName,
          partyName: selectedStitchRef!.partyName,
          contractorName: contractorName.trim(),
          process,
          remarks: remarks.trim() || undefined,
        },
        componentRows,
        username
      );
    }
    setSaving(false);
    if (!result) { setError('Failed to save. Please try again.'); return; }
    onSaved();
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
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-700 font-display">
              {editVoucher ? 'Edit Finishing Receive' : 'Finishing Receive'}
            </h2>
            <p className="text-sm text-muted-foreground font-body">
              Record finished goods received from contractor — linked to Stitching Receive
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-danger-bg text-danger text-sm px-4 py-2.5 rounded-xl font-body">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Voucher Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">Voucher No</label>
              <input value={voucherNo} readOnly className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-muted/30 font-body" />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">Date</label>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
              />
            </div>
          </div>

          {/* Stitching Receive Reference — PRIMARY SELECTION */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs font-700 text-blue-700 font-body uppercase tracking-wide">Step 1 — Select Stitching Receive Reference</span>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">
                Stitching Receive Ref <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedStitchRefId}
                  onChange={(e) => {
                    setSelectedStitchRefId(e.target.value);
                    if (e.target.value) setFieldErrors((prev) => ({ ...prev, stitchRef: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body appearance-none pr-8 ${
                    fieldErrors.stitchRef ? 'border-danger ring-1 ring-danger/30' : 'border-border bg-white'
                  }`}
                >
                  <option value="">— Select Stitching Receive Voucher —</option>
                  {stitchRefs.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.voucherNo} | {ref.jobCardRef} | {ref.voucherDate} | {ref.totalPiecesReceived} pcs
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              {fieldErrors.stitchRef && <p className="text-xs text-danger mt-0.5">{fieldErrors.stitchRef}</p>}
              {stitchRefs.length === 0 && (
                <p className="text-xs text-warning mt-1 font-body">No stitching receive vouchers found. Please complete stitching receive first.</p>
              )}
            </div>

            {/* Auto-filled info from selected stitch ref */}
            {selectedStitchRef && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                  <p className="text-xs text-muted-foreground font-body">Job Card</p>
                  <p className="text-sm font-700 font-body text-foreground">{selectedStitchRef.jobCardRef}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                  <p className="text-xs text-muted-foreground font-body">Style</p>
                  <p className="text-sm font-700 font-body text-foreground">{selectedStitchRef.styleName || '—'}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                  <p className="text-xs text-muted-foreground font-body">Total Stitch Rcvd</p>
                  <p className="text-sm font-700 font-body text-success">{selectedStitchRef.totalPiecesReceived} pcs</p>
                </div>
              </div>
            )}
          </div>

          {/* Contractor & Process */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">
                Contractor <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  value={contractorName}
                  onChange={(e) => {
                    setContractorName(e.target.value);
                    if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, contractor: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body appearance-none pr-8 ${
                    fieldErrors.contractor ? 'border-danger ring-1 ring-danger/30' : 'border-border'
                  }`}
                >
                  <option value="">Select Contractor</option>
                  {accountNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              {fieldErrors.contractor && <p className="text-xs text-danger mt-0.5">{fieldErrors.contractor}</p>}
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">Process</label>
              <select
                value={process}
                onChange={(e) => setProcess(e.target.value as ContractorProcess)}
                className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body"
              >
                {PROCESSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Component Rows — Step 2 */}
          {selectedStitchRefId && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-700 text-green-700 font-body uppercase tracking-wide">Step 2 — Enter Received Qty per Component</span>
                {loadingRef && <RefreshCw size={13} className="animate-spin text-muted-foreground ml-1" />}
              </div>

              {!loadingRef && componentRows.length === 0 && (
                <div className="border border-border rounded-xl p-6 text-center text-sm text-muted-foreground font-body">
                  No components found for this stitching receive reference.
                </div>
              )}

              {!loadingRef && componentRows.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Component</th>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Size</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Stitch Rcvd</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Already Finished</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Pending</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-primary font-body">Received Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentRows.map((row) => {
                        const rowErr = rowErrors[row.tempId];
                        const isFullyDone = row.pendingQty === 0;
                        return (
                          <React.Fragment key={row.tempId}>
                            <tr className={`border-t border-border/50 transition-colors ${rowErr ? 'bg-danger-bg/30' : isFullyDone ? 'bg-muted/20' : 'hover:bg-muted/10'}`}>
                              <td className="py-2.5 px-3 font-600 font-body">{row.component}</td>
                              <td className="py-2.5 px-3 text-muted-foreground font-body">
                                {row.size || <span className="text-muted-foreground/50 italic text-xs">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-body">
                                <span className="inline-flex items-center gap-1 text-success font-600">
                                  <CheckCircle2 size={12} />
                                  {row.stitchReceivedQty}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-body">
                                {row.alreadyFinishedQty > 0 ? (
                                  <span className="text-warning font-600">{row.alreadyFinishedQty}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-body">
                                {isFullyDone ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-success font-600">
                                    <CheckCircle2 size={11} /> Done
                                  </span>
                                ) : (
                                  <span className="font-700 text-foreground">{row.pendingQty}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={row.pendingQty}
                                  value={row.receivedQty || ''}
                                  onChange={(e) => {
                                    updateReceivedQty(row.tempId, Number(e.target.value));
                                    if (fieldErrors.qty) setFieldErrors((prev) => ({ ...prev, qty: '' }));
                                  }}
                                  disabled={isFullyDone}
                                  className={`w-24 ml-auto block px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-right font-700 font-body disabled:opacity-50 disabled:cursor-not-allowed ${
                                    rowErr ? 'border-danger ring-1 ring-danger/30' : 'border-primary/40'
                                  }`}
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                            {rowErr && (
                              <tr className="border-t-0">
                                <td colSpan={6} className="px-3 pb-2">
                                  <div className="flex items-start gap-1.5 text-xs text-danger font-body bg-danger-bg/50 rounded-lg px-2 py-1.5">
                                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                                    <span>{rowErr}</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30 border-t border-border">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Total</td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-success font-body">
                          {componentRows.reduce((s, r) => s + r.stitchReceivedQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-warning font-body">
                          {componentRows.reduce((s, r) => s + r.alreadyFinishedQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 font-body">
                          {componentRows.reduce((s, r) => s + r.pendingQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-primary font-body">
                          {totalFinishedQty}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {fieldErrors.qty && <p className="text-xs text-danger mt-1 font-body">{fieldErrors.qty}</p>}
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body resize-none"
              placeholder="Optional remarks..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border flex-shrink-0">
          <div className="text-sm text-muted-foreground font-body">
            Total Finished: <span className="font-700 text-foreground">{totalFinishedQty} pcs</span>
            {selectedStitchRef && (
              <span className="ml-3 text-xs text-muted-foreground">
                from Stitch Ref: <span className="font-600 text-foreground">{selectedStitchRef.voucherNo}</span>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 border border-border rounded-xl text-sm font-600 font-body hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || hasRowErrors}
              className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 font-body hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editVoucher ? 'Update' : 'Save Finishing Receive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
