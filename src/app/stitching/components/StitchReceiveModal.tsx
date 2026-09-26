'use client';
import {reportFieldIssue} from '@/lib/issueNavigation';
import {erpErrorMessage} from '@/lib/erpError';
import {createClient} from '@/lib/supabase/client';
import SearchableSelect from '@/components/SearchableSelect';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import {
  stitchingVoucherService,
  StitchOperator,
  StitchIssueVoucher,
  StitchReceiveVoucher,
  StitchReceiveComponent,
} from '@/lib/services/stitchingVoucherService';
import { useAuth } from '@/contexts/AuthContext';

interface JobCardOption {
  id: string;
  jobCardNo: string;
  styleEn: string;
  partyName: string;
  poNo?: string;
  totalPieces: number;
}

interface Props {
  jobCards: JobCardOption[];
  onClose: () => void;
  onSaved: () => void;
  editVoucher?: StitchReceiveVoucher | null;
}

interface ReceiveRow {
  issueComponentId: string;
  component: string;
  issuedQty: number;
  alreadyReceived: number;
  pendingQty: number;
  receiveQty: number;
  unit: string;
  overrideAllowed: boolean;
  stitchingChargePerPc: number;
  rateFromCutting?: boolean;
  sizeBreakdown?: { size: string; qty: number }[];
}

export default function StitchReceiveModal({ jobCards, onClose, onSaved, editVoucher }: Props) {
  const { username } = useAuth();
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [allIssueVouchers, setAllIssueVouchers] = useState<StitchIssueVoucher[]>([]);
  const [selectedJobCardNo, setSelectedJobCardNo] = useState('');
  const [selectedIssueVoucherId, setSelectedIssueVoucherId] = useState('');
  const [selectedIssueVoucher, setSelectedIssueVoucher] = useState<StitchIssueVoucher | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [quality,setQuality]=useState<'normal'|'rework'|'final_reject'>(editVoucher?.qualityStatus||'normal');
  const [qualityReason,setQualityReason]=useState(editVoucher?.qualityReason||'');
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const [operators, setOperators] = useState<StitchOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [committedId,setCommittedId]=useState('');
  const [error, setErrorState] = useState<string | null>(null);
  const formRef=useRef<HTMLFormElement>(null),saveInFlight=useRef(false);
  function setError(message:string|null,field?:string){setErrorState(message);if(message)requestAnimationFrame(()=>{const form=formRef.current;if(!form)return;const target=field?form.querySelector<HTMLElement>(`[data-receive-field="${field}"]`):form.querySelector<HTMLElement>('[data-save-feedback]');reportFieldIssue(message,target||form);});}

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Receive flow is operator-first. Every downstream option must belong to the selected operator.
  const operatorIssueVouchers = useMemo(() => {
    if (!operatorId) return [];
    return allIssueVouchers.filter(
      (iv) =>
        iv.operatorId === operatorId &&
        iv.status !== 'fully_received' &&
        iv.status !== 'closed'
    );
  }, [allIssueVouchers, operatorId]);

  // Job cards are derived only from open issue vouchers linked to the selected operator.
  const jobCardsWithOpenVouchers = useMemo(() => {
    const jobCardNos = new Set(operatorIssueVouchers.map((iv) => iv.jobCardRef));
    return jobCards.filter((jc) => jobCardNos.has(jc.jobCardNo));
  }, [operatorIssueVouchers, jobCards]);

  // Issue vouchers are further narrowed by the selected job card.
  const filteredIssueVouchers = useMemo(() => {
    if (!operatorId) return [];
    if (!selectedJobCardNo) return operatorIssueVouchers;
    return operatorIssueVouchers.filter((iv) => iv.jobCardRef === selectedJobCardNo);
  }, [operatorId, operatorIssueVouchers, selectedJobCardNo]);

  async function loadIssueWithRates(id:string) {
    const iv=await stitchingVoucherService.getIssueVoucherById(id);
    if(!iv)return null;
    const {data,error}=await createClient().rpc('erp_receive_stitch_rates',{p_issue_id:id});
    if(error)throw error;
    return {...iv,components:iv.components.map(ic=>({...ic,stitchingRate:data?.find((r:{id:string;rate:number|null})=>r.id===ic.id)?.rate??undefined}))};
  }

  useEffect(() => {
    async function init() {
      const [nextNo, ops, ivs] = await Promise.all([
        editVoucher ? Promise.resolve(editVoucher.voucherNo) : stitchingVoucherService.getNextReceiveVoucherNo(),
        stitchingVoucherService.getActiveOperators(),
        stitchingVoucherService.getIssueVouchers(),
      ]);
      setVoucherNo(nextNo);
      setOperators(ops);
      setAllIssueVouchers(ivs);

      if (editVoucher) {
        setVoucherDate(editVoucher.voucherDate);
        setSelectedIssueVoucherId(editVoucher.issueVoucherId);
        setOperatorId(editVoucher.operatorId || '');
        setOperatorName(editVoucher.operatorName);
        setRemarks(editVoucher.remarks || '');

        const iv = await loadIssueWithRates(editVoucher.issueVoucherId);
        if (iv) {
          setSelectedJobCardNo(iv.jobCardRef);
          setSelectedIssueVoucher(iv);
          const editRows: ReceiveRow[] = iv.components.map((ic) => {
            const existingReceive = editVoucher.components.find((rc) => rc.issueComponentId === ic.id);
            const alreadyReceived = ic.receivedQty - ((existingReceive?.receivedQty || 0)+(existingReceive?.reworkQty||0));
            return {
              issueComponentId: ic.id,
              component: ic.component,
              issuedQty: ic.issuedQty,
              alreadyReceived,
              pendingQty: ic.issuedQty - alreadyReceived,
              receiveQty: (existingReceive?.receivedQty || 0)+(existingReceive?.reworkQty||0),
              unit: ic.unit,
              overrideAllowed: false,
              stitchingChargePerPc: existingReceive?.stitchingChargePerPc ?? ic.stitchingRate ?? 0,
              rateFromCutting: Number(ic.stitchingRate) > 0,
              sizeBreakdown: ic.sizeBreakdown,
            };
          });
          setRows(editRows);
        }
      }
      setLoading(false);
    }
    init().catch(e=>{setError(e?.message||'Stitching rates could not load');setLoading(false);});
  }, [editVoucher?.id]);

  function handleJobCardChange(val: string) {
    setSelectedJobCardNo(val);
    // Reset issue voucher selection when job card changes
    setSelectedIssueVoucherId('');
    setSelectedIssueVoucher(null);
    setRows([]);
    if (val) setFieldErrors((prev) => ({ ...prev, jobCard: '' }));
  }

  async function handleIssueVoucherChange(id: string) {
    setSelectedIssueVoucherId(id);
    if (id) setFieldErrors((prev) => ({ ...prev, issueVoucher: '' }));
    if (!id) { setSelectedIssueVoucher(null); setRows([]); return; }
    setRows([]);
    let iv:StitchIssueVoucher|null;
    try {iv=await loadIssueWithRates(id);}catch(e){setSelectedIssueVoucher(null);setError(e instanceof Error?e.message:'Stitching rates could not load');return;}
    setSelectedIssueVoucher(iv);
    if (iv) {
      // Auto-fill job card if not already set
      if (!selectedJobCardNo) setSelectedJobCardNo(iv.jobCardRef);
      setRows(iv.components.map((ic) => ({
        issueComponentId: ic.id,
        component: ic.component,
        issuedQty: ic.issuedQty,
        alreadyReceived: ic.receivedQty,
        pendingQty: ic.pendingQty,
        receiveQty: 0,
        unit: ic.unit,
        overrideAllowed: false,
        stitchingChargePerPc: ic.stitchingRate || 0,
        rateFromCutting: Number(ic.stitchingRate) > 0,
        sizeBreakdown: ic.sizeBreakdown,
      })));
    }
  }

  function handleOperatorChange(val: string) {
    setOperatorId(val);
    const op = operators.find((o) => o.id === val);
    setOperatorName(op?.operatorName || '');

    // Operator is the parent filter. Changing it must clear every dependent selection.
    setSelectedJobCardNo('');
    setSelectedIssueVoucherId('');
    setSelectedIssueVoucher(null);
    setRows([]);
    setFieldErrors((prev) => ({
      ...prev,
      operator: val ? '' : prev.operator,
      jobCard: '',
      issueVoucher: '',
    }));
  }

  function updateReceiveQty(issueComponentId: string, qty: number) {
    setRows((prev) => prev.map((r) => {
      if (r.issueComponentId !== issueComponentId) return r;
      return { ...r, receiveQty: qty };
    }));
  }

  function updateChargePerPc(issueComponentId: string, charge: number) {
    setRows((prev) => prev.map((r) => {
      if (r.issueComponentId !== issueComponentId) return r;
      return { ...r, stitchingChargePerPc: charge };
    }));
  }

  function toggleOverride(issueComponentId: string) {
    setRows((prev) => prev.map((r) =>
      r.issueComponentId === issueComponentId ? { ...r, overrideAllowed: !r.overrideAllowed } : r
    ));
  }

  const totalReceiving = rows.reduce((s, r) => s + (r.receiveQty || 0), 0);
  const totalStitchingCharges = quality!=='normal'?0:rows.reduce((s, r) => s + (r.receiveQty || 0) * (r.stitchingChargePerPc || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if(saveInFlight.current||committedId)return;
    const newErrors: Record<string, string> = {};
    if(quality!=='normal'&&!qualityReason.trim())newErrors.qualityReason='Enter a rejection / rework reason.';
    if(editVoucher?.components.some(c=>c.reworkSourceComponentId)){setError('Use the rework completion history to review this linked receipt. Editing it here is not supported.');return;}

    if (!selectedIssueVoucherId) newErrors.issueVoucher = 'Please select an Issue Voucher.';
    if (!operatorId) newErrors.operator = 'Receive Operator is required.';
    if(quality==='normal'&&rows.some(r=>r.receiveQty>0&&(!Number.isFinite(r.stitchingChargePerPc)||r.stitchingChargePerPc<=0)))newErrors.rate='Set the component Stitching Price in Job Card and reopen this voucher.';
    if (totalReceiving <= 0) newErrors.receiveQty = 'At least one component must have a receive quantity > 0.';

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      for(const [field,message] of Object.entries(newErrors))setError(message,field);
      return;
    }

    setFieldErrors({});
    if (!selectedIssueVoucherId) { setError('Please select an Issue Voucher.'); return; }
    if (!operatorId) { setError('Receive Operator is mandatory.'); return; }
    if(quality==='normal'&&rows.some(r=>r.receiveQty>0&&(!Number.isFinite(r.stitchingChargePerPc)||r.stitchingChargePerPc<=0)))newErrors.rate='Set the component Stitching Price in Job Card and reopen this voucher.';
    if (totalReceiving <= 0) { setError('At least one component must have a receive quantity > 0.'); return; }

    // Validate over-receive
    for (const r of rows) {
      if (r.receiveQty > r.pendingQty) {
        setError(`Component "${r.component}": Receive qty (${r.receiveQty}) exceeds pending qty (${r.pendingQty}). Review the linked issue and earlier receipts.`, `qty-${r.issueComponentId}`);
        return;
      }
    }

    saveInFlight.current=true;
    setSaving(true);
    setError(null);
    try {
      const iv = selectedIssueVoucher;
      const voucherData = {
        voucherNo,
        voucherDate,
        issueVoucherId: selectedIssueVoucherId,
        issueVoucherNo: iv?.voucherNo || '',
        jobCardRef: iv?.jobCardRef || '',
        styleName: iv?.styleName,
        partyName: iv?.partyName,
        operatorId,
        operatorName,
        qualityStatus: quality, qualityReason: qualityReason.trim(),
        totalPiecesReceived: quality==='rework'?0:totalReceiving,
        totalStitchingCharges,
        remarks,
      };

      const compData: Omit<StitchReceiveComponent, 'id' | 'receiveVoucherId'>[] = rows
        .filter((r) => r.receiveQty > 0)
        .map((r) => ({
          issueComponentId: r.issueComponentId,
          component: r.component,
          issuedQty: r.issuedQty,
          receivedQty: quality==='rework'?0:r.receiveQty,
          reworkQty: quality==='rework'?r.receiveQty:0,
          balanceQty: Math.max(0, r.pendingQty - r.receiveQty),
          unit: r.unit,
          stitchingChargePerPc: quality==='normal'?(r.stitchingChargePerPc || 0):0,
          totalStitchingCharge: quality==='normal'?(r.receiveQty || 0) * (r.stitchingChargePerPc || 0):0,
        }));

      let result;
      if (editVoucher) {
        result = await stitchingVoucherService.updateReceiveVoucher(editVoucher.id, voucherData, compData, username);
      } else {
        result = await stitchingVoucherService.createReceiveVoucher(voucherData, compData, username);
      }

      if (!result) { setError('Failed to save receive voucher. Please try again.'); return; }
      onSaved();
    } catch(e) {
      if((e as {committedId?:string}).committedId)setCommittedId((e as {committedId:string}).committedId);
      setError(erpErrorMessage(e));
    } finally {
      saveInFlight.current=false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="erp-modal-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-card rounded-2xl p-8 text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="erp-modal-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-modal w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-700 text-foreground">{editVoucher ? 'Edit Receive Voucher' : 'New Stitching Receive'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Select Job Card → Issue Voucher → Receive component-wise</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {error && <div data-save-feedback tabIndex={-1} className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Voucher No{!editVoucher?' (preview · assigned on save)':''}</label>
              <input type="text" value={voucherNo} readOnly className="input-field text-sm bg-muted/30 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Date *</label>
              <input type="date" required value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="input-field text-sm" />
            </div>
          </div>

          {/* Step 1: Receive Operator — parent filter for the entire voucher */}
          {/* Receive Operator */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground flex items-center gap-1.5">
              Step 1: Select Receive Operator *
              <span className="text-[10px] text-primary font-500 bg-primary/10 px-1.5 py-0.5 rounded-md">This controls all options below</span>
            </label>
            <SearchableSelect data-receive-field="operator" required value={operatorId} onChange={(e) => handleOperatorChange(e.target.value)} className={`input-field text-sm ${fieldErrors.operator ? 'border-danger ring-1 ring-danger/30' : ''}`}>
              <option value="">-- Select Receive Operator --</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>{op.operatorCode} — {op.operatorName} ({op.process || op.department})</option>
              ))}
            </SearchableSelect>
            {fieldErrors.operator && <p className="text-xs text-danger mt-0.5">{fieldErrors.operator}</p>}
            {operators.length === 0 && (
              <p className="text-xs text-warning flex items-center gap-1"><Info size={11} /> No active operators found. Add operators in Operator Master first.</p>
            )}
          </div>



          {/* Step 2: Job Card Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground flex items-center gap-1.5">
              Step 2: Select Job Card
              <span className="text-[10px] text-muted-foreground font-400 bg-muted px-1.5 py-0.5 rounded-md">Only job cards issued to selected operator</span>
            </label>
            <SearchableSelect
              value={selectedJobCardNo}
              onChange={(e) => handleJobCardChange(e.target.value)}
              className="input-field text-sm"
              disabled={!!editVoucher || !operatorId}
            >
              <option value="">{operatorId ? '-- Select Job Card --' : '-- Select operator first --'}</option>
              {jobCardsWithOpenVouchers.map((jc) => (
                <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn} ({jc.partyName})</option>
              ))}
            </SearchableSelect>
            {operatorId && jobCardsWithOpenVouchers.length === 0 && !editVoucher && (
              <p className="text-xs text-warning flex items-center gap-1"><Info size={11} /> No open stitching issues are linked to this operator.</p>
            )}
          </div>

          {/* Step 3: Issue Voucher Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Step 3: Select Issue Voucher *</label>
            <SearchableSelect
              required
              data-receive-field="issueVoucher" value={selectedIssueVoucherId}
              onChange={(e) => handleIssueVoucherChange(e.target.value)}
              className={`input-field text-sm ${fieldErrors.issueVoucher ? 'border-danger ring-1 ring-danger/30' : ''}`}
              disabled={!!editVoucher || !operatorId}
            >
              <option value="">{operatorId ? '-- Select Issue Voucher --' : '-- Select operator first --'}</option>
              {filteredIssueVouchers.map((iv) => (
                <option key={iv.id} value={iv.id}>
                  {iv.voucherNo} — JC: {iv.jobCardRef} ({iv.styleName || 'N/A'}) [{iv.status.replace(/_/g, ' ')}]
                </option>
              ))}
            </SearchableSelect>
            {fieldErrors.issueVoucher && <p className="text-xs text-danger mt-0.5">{fieldErrors.issueVoucher}</p>}
            {operatorId && filteredIssueVouchers.length === 0 && !editVoucher && (
              <p className="text-xs text-warning flex items-center gap-1"><Info size={11} /> No open issue vouchers are linked to this operator.</p>
            )}
          </div>

          {/* Issue Voucher Info */}
          {selectedIssueVoucher && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs">
              <div><span className="text-muted-foreground font-600">Job Card:</span> <span className="text-foreground font-600 ml-1">{selectedIssueVoucher.jobCardRef}</span></div>
              {selectedIssueVoucher.styleName && <div><span className="text-muted-foreground font-600">Style:</span> <span className="text-foreground ml-1">{selectedIssueVoucher.styleName}</span></div>}
              <div><span className="text-muted-foreground font-600">Issue Operator:</span> <span className="text-foreground ml-1">{selectedIssueVoucher.operatorName}</span></div>
              <div><span className="text-muted-foreground font-600">Total Issued:</span> <span className="text-primary font-700 ml-1">{selectedIssueVoucher.totalPieces} Pcs</span></div>
              <div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 ${
                  selectedIssueVoucher.status === 'open' ? 'bg-primary/10 text-primary' :
                  selectedIssueVoucher.status === 'partially_received' ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success'
                }`}>
                  {selectedIssueVoucher.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}

          <section className="rounded-xl border p-3 space-y-3">
            <label className="block text-sm font-semibold">Receipt treatment
              <SearchableSelect disabled={!!editVoucher||saving} value={quality} onChange={e=>setQuality(e.target.value as typeof quality)} className="input-field mt-1"><option value="normal">Normal Accepted — payable, moves forward</option><option value="rework">Repair / Rework — hold, not yet payable</option><option value="final_reject">Final Reject — moves forward, stitching ₹0</option></SearchableSelect>
            </label>
            <p className="text-xs text-muted-foreground">Each receipt records one treatment. Use another receipt for quantities with a different treatment. Complete held repairs from Rework Pending.</p>
            {quality!=='normal'&&<label className="block text-sm">Reason *<input data-receive-field="qualityReason" required value={qualityReason} onChange={e=>setQualityReason(e.target.value)} className="input-field mt-1"/></label>}
          </section>
          {/* Component-wise Receive */}
          {rows.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-700 text-foreground">Step 4: Component-wise Receive</p>
              <div data-receive-field="receiveQty" tabIndex={-1} className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-muted/40 border border-border rounded-lg">
                      <th className="text-left px-3 py-2 text-xs font-600 text-muted-foreground">Component</th>
                      <th className="text-left px-3 py-2 text-xs font-600 text-muted-foreground">Size</th>
                      <th className="text-right px-3 py-2 text-xs font-600 text-muted-foreground">Issued</th>
                      <th className="text-right px-3 py-2 text-xs font-600 text-muted-foreground">Received</th>
                      <th className="text-right px-3 py-2 text-xs font-600 text-muted-foreground">Pending</th>
                      <th className="text-right px-3 py-2 text-xs font-600 text-muted-foreground">Receive Now</th>
                      <th className="text-right px-3 py-2 text-xs font-600 text-muted-foreground">Rate/Pc (₹)</th>
                      <th className="text-right px-3 py-2 text-xs font-600 text-muted-foreground">Charges (₹)</th>
                      <th className="text-center px-3 py-2 text-xs font-600 text-muted-foreground">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isOver = r.receiveQty > r.pendingQty;
                      const sizeLabel = r.sizeBreakdown && r.sizeBreakdown.length > 0
                        ? r.sizeBreakdown.map((s) => s.size).join(', ')
                        : '—';
                      const lineCharge = quality!=='normal'?0:(r.receiveQty || 0) * (r.stitchingChargePerPc || 0);
                      return (
                        <tr key={r.issueComponentId} className="border-b border-border/50">
                          <td className="px-3 py-2.5 font-600 text-foreground text-xs">{r.component}</td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{sizeLabel}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{r.issuedQty}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{r.alreadyReceived}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-600 text-warning">{r.pendingQty}</td>
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              data-receive-field={`qty-${r.issueComponentId}`} aria-label={`${r.component} receive quantity`} value={r.receiveQty || ''}
                              onChange={(e) => updateReceiveQty(r.issueComponentId, parseInt(e.target.value) || 0)}
                              className={`input-field text-sm tabular-nums w-24 text-right ${isOver && !r.overrideAllowed ? 'border-danger' : ''}`}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              data-receive-field="rate" readOnly value={quality==='normal'?(r.stitchingChargePerPc || ''):0}
                              title="Rate from Stitching Issue / Job Card; edit rates only in Job Card"
                              onChange={(e) => updateChargePerPc(r.issueComponentId, parseFloat(e.target.value) || 0)}
                              className="input-field text-sm tabular-nums w-24 text-right"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-xs font-600 text-primary">
                            {`₹${lineCharge.toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {isOver && <AlertTriangle size={13} className="text-danger mx-auto"/>}
                            {!isOver && r.receiveQty > 0 && r.receiveQty === r.pendingQty && (
                              <CheckCircle size={13} className="text-success mx-auto" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalReceiving > 0 && (
                <div className="flex items-center justify-between gap-2 bg-success-bg border border-success-border rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={13} className="text-success" />
                    <p className="text-xs text-success font-600">Total Receiving: <span className="font-700">{totalReceiving} Pcs</span></p>
                  </div>
                  {totalStitchingCharges > 0 && (
                    <p className="text-xs text-primary font-600">Total Stitching Charges: <span className="font-700">₹{totalStitchingCharges.toFixed(2)}</span></p>
                  )}
                </div>
              )}
              {fieldErrors.receiveQty && <p className="text-xs text-danger mt-0.5">{fieldErrors.receiveQty}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Remarks</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input-field text-sm resize-none" placeholder="Optional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving||!!committedId} className="btn-primary flex-1">
              {saving ? 'Saving...' : editVoucher ? 'Update Receive Voucher' : 'Save Receive Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
