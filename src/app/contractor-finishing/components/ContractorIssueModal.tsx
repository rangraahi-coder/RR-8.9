'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  contractorFinishingService,
  ContractorProcess,
  ContractorIssueVoucher,
  StitchReceiveRef,
} from '@/lib/services/contractorFinishingService';
import { useAuth } from '@/contexts/AuthContext';
import { accountService } from '@/lib/services/accountService';

interface JobCardOption {
  id: string;
  jobCardNo: string;
  styleEn: string;
  partyName: string;
  contractor: string;
  colors?: string[];
  sizes?: string[];
}

interface IssueRow {
  tempId: string;
  stitchReceiveComponentId: string;
  component: string;
  size: string;
  colour: string;
  stitchReceivedQty: number;   // total received from stitching for this component+size
  alreadyIssuedQty: number;    // already issued in previous vouchers (excluding current)
  pendingQty: number;          // stitchReceivedQty − alreadyIssuedQty
  issuedQty: number;           // qty being entered in this voucher (UI input)
}

interface Props {
  jobCards: JobCardOption[];
  editVoucher?: ContractorIssueVoucher | null;
  onClose: () => void;
  onSaved: () => void;
}

const PROCESSES: ContractorProcess[] = ['Finishing', 'Press', 'Packing', 'Contractor'];

function compKey(component: string, size: string, colour: string): string {
  return `${(component || '').toLowerCase()}|${(colour || '').toLowerCase()}|${(size || '').toLowerCase()}`;
}

export default function ContractorIssueModal({ jobCards, editVoucher, onClose, onSaved }: Props) {
  const { username } = useAuth();

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
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  // Already-issued qty map: key = compKey → already issued in previous vouchers
  const [alreadyIssuedMap, setAlreadyIssuedMap] = useState<Record<string, number>>({});

  // Map of stitchReceiveVoucherId → total already issued qty (to filter fully-issued refs)
  const [issuedTotalsMap, setIssuedTotalsMap] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Init
  useEffect(() => {
    async function init() {
      const [nextNo, refs, accounts, issuedTotals] = await Promise.all([
        contractorFinishingService.getNextIssueVoucherNo(),
        contractorFinishingService.getStitchReceiveRefs(),
        accountService.getAll(),
        contractorFinishingService.getIssuedTotalsByStitchRef(),
      ]);
      setStitchRefs(refs);
      setIssuedTotalsMap(issuedTotals);
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
      setIssueRows([]);
      setAlreadyIssuedMap({});
      return;
    }
    async function loadRef() {
      setLoadingRef(true);
      const ref = await contractorFinishingService.getStitchReceiveRefWithSizes(selectedStitchRefId);
      setSelectedStitchRef(ref);

      if (ref) {
        // Fetch already-issued qty for this job card (excluding current voucher if editing)
        const issuedMap = await contractorFinishingService.getIssuedQtyByJobCard(
          ref.jobCardRef,
          editVoucher?.id
        );
        setAlreadyIssuedMap(issuedMap);

        // Build issue rows from stitch receive components
        const rows: IssueRow[] = [];
        for (const comp of ref.components) {
          if (comp.sizeBreakdown && comp.sizeBreakdown.length > 0) {
            // Calculate total issued qty from size breakdown to derive proportional received qty per size
            const totalIssuedInBreakdown = comp.sizeBreakdown.reduce((s, sb) => s + (sb.qty || 0), 0);
            const actualReceived = comp.receivedQty; // actual qty received from stitching

            // Distribute actualReceived proportionally across sizes; last size absorbs rounding remainder
            let distributed = 0;
            const sizeRows: IssueRow[] = [];
            for (let i = 0; i < comp.sizeBreakdown.length; i++) {
              const sb = comp.sizeBreakdown[i];
              if ((sb.qty || 0) <= 0) continue;
              const isLast = i === comp.sizeBreakdown.length - 1;
              const proportionalQty = isLast
                ? Math.max(0, actualReceived - distributed)
                : totalIssuedInBreakdown > 0
                  ? Math.round((sb.qty / totalIssuedInBreakdown) * actualReceived)
                  : sb.qty;
              distributed += proportionalQty;
              if (proportionalQty <= 0) continue;
              const key = compKey(comp.component, sb.size, '');
              const alreadyIssued = issuedMap[key] || 0;
              const pending = Math.max(0, proportionalQty - alreadyIssued);
              sizeRows.push({
                tempId: `${comp.id}-${sb.size}`,
                stitchReceiveComponentId: comp.id,
                component: comp.component,
                size: sb.size,
                colour: '',
                stitchReceivedQty: proportionalQty,
                alreadyIssuedQty: alreadyIssued,
                pendingQty: pending,
                issuedQty: 0,
              });
            }
            rows.push(...sizeRows);
          } else {
            const key = compKey(comp.component, '', '');
            const alreadyIssued = issuedMap[key] || 0;
            const pending = Math.max(0, comp.receivedQty - alreadyIssued);
            rows.push({
              tempId: comp.id,
              stitchReceiveComponentId: comp.id,
              component: comp.component,
              size: '',
              colour: '',
              stitchReceivedQty: comp.receivedQty,
              alreadyIssuedQty: alreadyIssued,
              pendingQty: pending,
              issuedQty: 0,
            });
          }
        }

        // If editing, restore previously entered qty
        if (editVoucher) {
          const editMap: Record<string, number> = {};
          for (const it of editVoucher.items) {
            editMap[compKey(it.item, it.size, it.colour)] = it.issuedQty;
          }
          setIssueRows(rows.map((r) => ({
            ...r,
            issuedQty: editMap[compKey(r.component, r.size, r.colour)] || 0,
          })));
        } else {
          setIssueRows(rows);
        }
      }
      setLoadingRef(false);
    }
    loadRef();
  }, [selectedStitchRefId, editVoucher]);

  function updateIssuedQty(tempId: string, value: number) {
    setIssueRows((prev) =>
      prev.map((r) => r.tempId === tempId ? { ...r, issuedQty: Math.max(0, value) } : r)
    );
  }

  // Real-time row validation — matching FinishingReceiveModal rigor
  const rowErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const row of issueRows) {
      if ((row.issuedQty || 0) <= 0) continue;
      if (row.issuedQty > row.pendingQty) {
        errors[row.tempId] = `Qty (${row.issuedQty}) exceeds pending qty (${row.pendingQty}). Stitch received: ${row.stitchReceivedQty}, already issued: ${row.alreadyIssuedQty}.`;
      }
    }
    return errors;
  }, [issueRows]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  const totalIssuedQty = issueRows.reduce((s, r) => s + (r.issuedQty || 0), 0);
  const allRowsFullyIssued = issueRows.length > 0 && issueRows.every((r) => r.pendingQty === 0);

  async function handleSave() {
    setError(null);
    const newErrors: Record<string, string> = {};
    if (!selectedStitchRefId || !selectedStitchRef) newErrors.stitchRef = 'Please select a Stitching Receive Reference.';
    if (!contractorName.trim()) newErrors.contractor = 'Contractor name is required.';
    if (totalIssuedQty === 0) newErrors.qty = 'Enter issued quantity for at least one component.';

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Please fill all required fields before saving.');
      return;
    }
    setFieldErrors({});

    if (hasRowErrors) {
      setError('Please fix quantity errors before saving. Issue qty cannot exceed pending qty.');
      return;
    }

    const activeRows = issueRows.filter((r) => (r.issuedQty || 0) > 0);

    setSaving(true);
    const voucherPayload = {
      voucherNo,
      voucherDate,
      jobCardId: selectedStitchRef!.jobCardId,
      jobCardRef: selectedStitchRef!.jobCardRef,
      styleNo: selectedStitchRef!.styleName || '',
      item: activeRows.map((r) => r.component).join(', '),
      colour: activeRows.map((r) => r.colour).filter(Boolean).join(', '),
      size: activeRows.map((r) => r.size).filter(Boolean).join(', '),
      contractorName: contractorName.trim(),
      process,
      totalIssued: totalIssuedQty,
      stitchReceiveRef: selectedStitchRef!.voucherNo,
      stitchReceiveVoucherId: selectedStitchRef!.id,
      remarks: remarks.trim() || undefined,
      createdBy: editVoucher?.createdBy,
    };

    const itemsPayload = activeRows.map((r) => ({
      item: r.component,
      colour: r.colour,
      size: r.size,
      issuedQty: r.issuedQty,
    }));

    let result;
    if (editVoucher) {
      result = await contractorFinishingService.updateIssueVoucher(editVoucher.id, voucherPayload, itemsPayload, username);
    } else {
      result = await contractorFinishingService.createIssueVoucher(voucherPayload, itemsPayload, username);
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
            <h2 className="text-lg font-700 font-display">{editVoucher ? 'Edit Contractor Issue' : 'Contractor Issue'}</h2>
            <p className="text-sm text-muted-foreground font-body">Issue goods to contractor — linked to Stitching Receive</p>
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
                  {stitchRefs
                    .filter((ref) => {
                      // Always show the currently selected ref (e.g. when editing)
                      if (editVoucher && ref.id === editVoucher.stitchReceiveVoucherId) return true;
                      const totalIssued = issuedTotalsMap[ref.id] || 0;
                      // Hide only if fully issued (partial is fine)
                      return totalIssued < ref.totalPiecesReceived;
                    })
                    .map((ref) => (
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

          {/* Issue Rows — Step 2 */}
          {selectedStitchRefId && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-700 text-green-700 font-body uppercase tracking-wide">Step 2 — Enter Issue Qty per Component</span>
                {loadingRef && <RefreshCw size={13} className="animate-spin text-muted-foreground ml-1" />}
              </div>

              {!loadingRef && issueRows.length === 0 && (
                <div className="border border-border rounded-xl p-6 text-center text-sm text-muted-foreground font-body">
                  No components found for this stitching receive reference.
                </div>
              )}

              {!loadingRef && issueRows.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Component</th>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Size</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Stitch Rcvd</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Already Issued</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Pending</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-primary font-body">Issue Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issueRows.map((row) => {
                        const rowErr = rowErrors[row.tempId];
                        const isFullyIssued = row.pendingQty === 0;
                        return (
                          <React.Fragment key={row.tempId}>
                            <tr className={`border-t border-border/50 transition-colors ${rowErr ? 'bg-danger-bg/30' : isFullyIssued ? 'bg-muted/20' : 'hover:bg-muted/10'}`}>
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
                                {row.alreadyIssuedQty > 0 ? (
                                  <span className="text-warning font-600">{row.alreadyIssuedQty}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-body">
                                {isFullyIssued ? (
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
                                  value={row.issuedQty || ''}
                                  onChange={(e) => {
                                    updateIssuedQty(row.tempId, Number(e.target.value));
                                    if (fieldErrors.qty) setFieldErrors((prev) => ({ ...prev, qty: '' }));
                                  }}
                                  disabled={isFullyIssued}
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
                          {issueRows.reduce((s, r) => s + r.stitchReceivedQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-warning font-body">
                          {issueRows.reduce((s, r) => s + r.alreadyIssuedQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 font-body">
                          {issueRows.reduce((s, r) => s + r.pendingQty, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-primary font-body">
                          {totalIssuedQty}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {fieldErrors.qty && <p className="text-xs text-danger mt-1 font-body">{fieldErrors.qty}</p>}
            </div>
          )}

          {/* Already Fully Issued Warning */}
          {allRowsFullyIssued && !loadingRef && (
            <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 text-warning-foreground text-sm px-4 py-3 rounded-xl font-body">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-warning" />
              <span className="text-warning font-600">This voucher has already been fully issued. No pending quantity remains — issuing again is not allowed.</span>
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
            Total Issued: <span className="font-700 text-foreground">{totalIssuedQty} pcs</span>
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
              disabled={saving || hasRowErrors || allRowsFullyIssued}
              className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 font-body hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editVoucher ? 'Update Issue' : 'Save Issue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
