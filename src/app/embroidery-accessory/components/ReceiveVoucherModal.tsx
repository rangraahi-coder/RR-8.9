'use client';
import React, { useState, useEffect } from 'react';
import { X, Layers, Package, AlertCircle, CheckCircle, Info, Scissors, AlertTriangle } from 'lucide-react';
import { embroideryVoucherService, EmbIssueVoucher, EmbReceiveVoucher, ReceiveFabricItem, ReceiveAccessoryItem, ReceiveCuttingItem } from '@/lib/services/embroideryVoucherService';

const SUB_COMPONENTS = ['Yoke', 'Border', 'Front Palla', 'Back Palla', 'Kurta', 'Pant', 'Dupatta', 'Shirt', 'Sleeve', 'Collar', 'Pocket', 'Cuff', 'Placket', 'Gusset', 'Other'];

const RECEIVE_UNITS = ['Pcs', 'Metre', 'Metres', 'Yoke', 'Kg', 'Grams', 'Dozen', 'Set', 'Other'];

const REJECTION_REASONS = [
  'Embroidery defect',
  'Wrong design',
  'Thread break',
  'Colour mismatch',
  'Accessory missing',
  'Size mismatch',
  'Fabric damage',
  'Stain / soiling',
  'Incomplete work',
  'Other',
];

interface Props {
  issueVouchers: EmbIssueVoucher[];
  preSelectedIssueId?: string;
  onClose: () => void;
  onSaved: () => void;
  editVoucher?: EmbReceiveVoucher | null;
}

export default function ReceiveVoucherModal({ issueVouchers, preSelectedIssueId, onClose, onSaved, editVoucher }: Props) {
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIssueId, setSelectedIssueId] = useState(preSelectedIssueId || '');
  const [selectedIssue, setSelectedIssue] = useState<EmbIssueVoucher | null>(null);
  const [fabricItems, setFabricItems] = useState<ReceiveFabricItem[]>([]);
  const [accessoryItems, setAccessoryItems] = useState<ReceiveAccessoryItem[]>([]);
  const [cuttingItems, setCuttingItems] = useState<ReceiveCuttingItem[]>([]);
  const [receiveOperatorName, setReceiveOperatorName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const eligibleVouchers = issueVouchers.filter(
    (v) => v.status === 'open' || v.status === 'partially_received' || (editVoucher && v.id === editVoucher.issueVoucherId)
  );

  useEffect(() => {
    if (editVoucher) {
      setVoucherNo(editVoucher.voucherNo);
      setVoucherDate(editVoucher.voucherDate);
      setSelectedIssueId(editVoucher.issueVoucherId);
      const issue = issueVouchers.find((v) => v.id === editVoucher.issueVoucherId) || null;
      setSelectedIssue(issue);
      setFabricItems((editVoucher.fabricItems || []).map((f) => ({ ...f, receiveUnit: f.receiveUnit || f.unit, rejectedQty: (f as any).rejectedQty || 0, rejectionReason: (f as any).rejectionReason || '' })));
      setAccessoryItems((editVoucher.accessoryItems || []).map((a) => ({ ...a, receiveUnit: a.receiveUnit || a.unit, rejectedQty: (a as any).rejectedQty || 0, rejectionReason: (a as any).rejectionReason || '' })));
      setCuttingItems((editVoucher.cuttingItems || []).map((c) => ({ ...c, receiveUnit: c.receiveUnit || c.unit, rejectedPieces: (c as any).rejectedPieces || 0, rejectionReason: (c as any).rejectionReason || '' })));
      setReceiveOperatorName((editVoucher as any).receiveOperatorName || '');
      setRemarks(editVoucher.remarks || '');
    } else {
      embroideryVoucherService.getNextReceiveVoucherNo().then(setVoucherNo);
    }
  }, []);

  useEffect(() => {
    if (!editVoucher && preSelectedIssueId) {
      loadIssueVoucherItems(preSelectedIssueId);
    }
  }, [preSelectedIssueId]);

  async function loadIssueVoucherItems(issueId: string) {
    setSelectedIssueId(issueId);
    setFabricItems([]);
    setAccessoryItems([]);
    setCuttingItems([]);
    if (!issueId) { setSelectedIssue(null); return; }

    setLoadingItems(true);
    const issue = issueVouchers.find((v) => v.id === issueId) || null;
    setSelectedIssue(issue);

    if (issue) {
      const [fabrics, accessories, cuttings] = await Promise.all([
        embroideryVoucherService.buildReceiveFabricItems(issue),
        embroideryVoucherService.buildReceiveAccessoryItems(issue),
        embroideryVoucherService.buildReceiveCuttingItems(issue),
      ]);
      setFabricItems(fabrics.map((f) => ({ ...f, rejectedQty: 0, rejectionReason: '' })));
      setAccessoryItems(accessories.map((a) => ({ ...a, rejectedQty: 0, rejectionReason: '' })));
      setCuttingItems(cuttings.map((c) => ({ ...c, rejectedPieces: 0, rejectionReason: '' })));
    }
    setLoadingItems(false);
  }

  async function handleIssueVoucherSelect(issueId: string) {
    await loadIssueVoucherItems(issueId);
    if (issueId) setFieldErrors((prev) => ({ ...prev, issueVoucher: '' }));
  }

  // ── Fabric item updates ────────────────────────────────────────────────────
  function updateFabricReceived(i: number, val: number) {
    setFabricItems((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f;
        const sameUnit = (f.receiveUnit || f.unit) === f.unit;
        const rejected = (f as any).rejectedQty || 0;
        const maxReceive = sameUnit ? Math.max(0, f.balanceQty - rejected) : undefined;
        const received = maxReceive !== undefined ? Math.min(Math.max(0, val), maxReceive) : Math.max(0, val);
        return { ...f, receivedQty: received };
      })
    );
  }

  function updateFabricRejected(i: number, val: number) {
    setFabricItems((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f;
        const sameUnit = (f.receiveUnit || f.unit) === f.unit;
        const rejected = sameUnit ? Math.min(Math.max(0, val), f.balanceQty) : Math.max(0, val);
        // Reduce received if rejected + received > balance
        const newReceived = sameUnit ? Math.min(f.receivedQty, Math.max(0, f.balanceQty - rejected)) : f.receivedQty;
        return { ...f, rejectedQty: rejected, receivedQty: newReceived };
      })
    );
  }

  function updateFabricReceiveUnit(i: number, unit: string) {
    setFabricItems((prev) =>
      prev.map((f, idx) => idx === i ? { ...f, receiveUnit: unit } : f)
    );
  }

  function updateFabricRejectionReason(i: number, reason: string) {
    setFabricItems((prev) =>
      prev.map((f, idx) => idx === i ? { ...f, rejectionReason: reason } : f)
    );
  }

  // ── Accessory item updates ─────────────────────────────────────────────────
  function updateAccessoryReceived(i: number, val: number) {
    setAccessoryItems((prev) =>
      prev.map((a, idx) => {
        if (idx !== i) return a;
        const sameUnit = (a.receiveUnit || a.unit) === a.unit;
        const rejected = (a as any).rejectedQty || 0;
        const maxReceive = sameUnit ? Math.max(0, a.balanceQty - rejected) : undefined;
        const received = maxReceive !== undefined ? Math.min(Math.max(0, val), maxReceive) : Math.max(0, val);
        return { ...a, receivedQty: received };
      })
    );
  }

  function updateAccessoryRejected(i: number, val: number) {
    setAccessoryItems((prev) =>
      prev.map((a, idx) => {
        if (idx !== i) return a;
        const sameUnit = (a.receiveUnit || a.unit) === a.unit;
        const rejected = sameUnit ? Math.min(Math.max(0, val), a.balanceQty) : Math.max(0, val);
        const newReceived = sameUnit ? Math.min(a.receivedQty, Math.max(0, a.balanceQty - rejected)) : a.receivedQty;
        return { ...a, rejectedQty: rejected, receivedQty: newReceived };
      })
    );
  }

  function updateAccessoryReceiveUnit(i: number, unit: string) {
    setAccessoryItems((prev) =>
      prev.map((a, idx) => idx === i ? { ...a, receiveUnit: unit } : a)
    );
  }

  function updateAccessoryRejectionReason(i: number, reason: string) {
    setAccessoryItems((prev) =>
      prev.map((a, idx) => idx === i ? { ...a, rejectionReason: reason } : a)
    );
  }

  // ── Cutting item updates ───────────────────────────────────────────────────
  function updateCuttingReceived(i: number, val: number) {
    setCuttingItems((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c;
        const sameUnit = (c.receiveUnit || c.unit) === c.unit;
        const rejected = (c as any).rejectedPieces || 0;
        const maxReceive = sameUnit ? Math.max(0, c.balancePieces - rejected) : undefined;
        const received = maxReceive !== undefined ? Math.min(Math.max(0, val), maxReceive) : Math.max(0, val);
        return { ...c, receivedPieces: received };
      })
    );
  }

  function updateCuttingRejected(i: number, val: number) {
    setCuttingItems((prev) =>
      prev.map((c, idx) => {
        if (idx !== i) return c;
        const sameUnit = (c.receiveUnit || c.unit) === c.unit;
        const rejected = sameUnit ? Math.min(Math.max(0, val), c.balancePieces) : Math.max(0, val);
        const newReceived = sameUnit ? Math.min(c.receivedPieces, Math.max(0, c.balancePieces - rejected)) : c.receivedPieces;
        return { ...c, rejectedPieces: rejected, receivedPieces: newReceived };
      })
    );
  }

  function updateCuttingReceiveUnit(i: number, unit: string) {
    setCuttingItems((prev) =>
      prev.map((c, idx) => idx === i ? { ...c, receiveUnit: unit } : c)
    );
  }

  function updateCuttingCharge(i: number, val: number) {
    setCuttingItems((prev) =>
      prev.map((c, idx) => idx === i ? { ...c, cuttingCharge: val >= 0 ? val : 0 } : c)
    );
  }

  function updateCuttingRejectionReason(i: number, reason: string) {
    setCuttingItems((prev) =>
      prev.map((c, idx) => idx === i ? { ...c, rejectionReason: reason } : c)
    );
  }

  function addManualCuttingItem() {
    setCuttingItems((prev) => [...prev, {
      component: 'Yoke',
      issuedPieces: 0,
      receivedPieces: 0,
      balancePieces: 9999,
      unit: 'Pcs',
      receiveUnit: 'Pcs',
      rejectedPieces: 0,
      rejectionReason: '',
    } as any]);
  }

  function updateManualCuttingItem(i: number, field: keyof ReceiveCuttingItem, val: string | number) {
    setCuttingItems((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }

  function removeCuttingItem(i: number) {
    setCuttingItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const hasFabric = fabricItems.length > 0;
  const hasAccessory = accessoryItems.length > 0;
  const hasCutting = cuttingItems.length > 0;
  const isCuttingIssue = selectedIssue?.issueType === 'cutting';

  const totalFabricIssued = fabricItems.reduce((s, f) => s + f.issuedQty, 0);
  const totalFabricReceiving = fabricItems.reduce((s, f) => s + (f.receivedQty || 0), 0);
  const totalFabricRejected = fabricItems.reduce((s, f) => s + ((f as any).rejectedQty || 0), 0);
  const totalAccIssued = accessoryItems.reduce((s, a) => s + a.issuedQty, 0);
  const totalAccReceiving = accessoryItems.reduce((s, a) => s + (a.receivedQty || 0), 0);
  const totalAccRejected = accessoryItems.reduce((s, a) => s + ((a as any).rejectedQty || 0), 0);
  const totalCuttingReceiving = cuttingItems.reduce((s, c) => s + (c.receivedPieces || 0), 0);
  const totalCuttingRejected = cuttingItems.reduce((s, c) => s + ((c as any).rejectedPieces || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const newErrors: Record<string, string> = {};
    if (!selectedIssue && !editVoucher) newErrors.issueVoucher = 'Please select an Issue Voucher.';

    const anyFabricReceived = fabricItems.some((f) => f.receivedQty > 0);
    const anyAccReceived = accessoryItems.some((a) => a.receivedQty > 0);
    const anyCuttingReceived = cuttingItems.some((c) => c.receivedPieces > 0);
    const anyFabricRejected = fabricItems.some((f) => (f as any).rejectedQty > 0);
    const anyAccRejected = accessoryItems.some((a) => (a as any).rejectedQty > 0);
    const anyCuttingRejected = cuttingItems.some((c) => (c as any).rejectedPieces > 0);

    if (!anyFabricReceived && !anyAccReceived && !anyCuttingReceived && !anyFabricRejected && !anyAccRejected && !anyCuttingRejected) {
      newErrors.receiveQty = 'Please enter received or rejected quantity for at least one item.';
    }

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Please fill all required fields before saving.');
      return;
    }
    setFieldErrors({});

    if (!selectedIssue && !editVoucher) { setError('Please select an Issue Voucher.'); return; }

    const enrichedFabricItems = fabricItems
      .filter((f) => f.receivedQty > 0 || (f as any).rejectedQty > 0)
      .map((f) => ({ ...f, receiveUnit: f.receiveUnit || f.unit }));
    const enrichedAccessoryItems = accessoryItems
      .filter((a) => a.receivedQty > 0 || (a as any).rejectedQty > 0)
      .map((a) => ({ ...a, receiveUnit: a.receiveUnit || a.unit }));
    const enrichedCuttingItems = cuttingItems
      .filter((c) => c.receivedPieces > 0 || (c as any).rejectedPieces > 0)
      .map((c) => ({ ...c, receiveUnit: c.receiveUnit || c.unit }));

    if (editVoucher) {
      const totalPiecesReceived = enrichedCuttingItems.reduce((s, c) => s + (c.receivedPieces || 0), 0);
      // When editing, save ALL items (including zero-qty ones) so DB reflects actual current state
      const allFabricItems = fabricItems.map((f) => ({ ...f, receiveUnit: f.receiveUnit || f.unit }));
      const allAccessoryItems = accessoryItems.map((a) => ({ ...a, receiveUnit: a.receiveUnit || a.unit }));
      const allCuttingItems = cuttingItems.map((c) => ({ ...c, receiveUnit: c.receiveUnit || c.unit }));
      const ok = await embroideryVoucherService.updateReceiveVoucher(editVoucher.id, {
        voucherDate,
        remarks,
        receiveOperatorName: receiveOperatorName || undefined,
        fabricItems: allFabricItems,
        accessoryItems: allAccessoryItems,
        cuttingItems: allCuttingItems,
        totalPiecesReceived,
      });
      setSaving(false);
      if (!ok) { setError('Failed to update Receive Voucher. Please try again.'); return; }
      onSaved();
      return;
    }

    const result = await embroideryVoucherService.createReceiveVoucher({
      voucherNo,
      voucherDate,
      issueVoucherId: selectedIssue!.id,
      issueVoucherNo: selectedIssue!.voucherNo,
      jobCardRef: selectedIssue!.jobCardRef,
      styleName: selectedIssue!.styleName,
      partyName: selectedIssue!.partyName,
      operatorName: selectedIssue!.operatorName,
      receiveOperatorName: receiveOperatorName || undefined,
      fabricItems: enrichedFabricItems,
      accessoryItems: enrichedAccessoryItems,
      cuttingItems: enrichedCuttingItems,
      totalPiecesReceived: totalCuttingReceiving,
      remarks,
    });
    setSaving(false);

    if (!result) { setError('Failed to save Receive Voucher. Please try again.'); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-700 text-foreground font-display">{editVoucher ? `Edit Receive Voucher — ${editVoucher.voucherNo}` : 'New Receive Voucher'}</h2>
            <p className="text-xs text-muted-foreground font-body mt-0.5">Record material / cutting received back against an Issue Challan</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-danger-bg border border-danger/20 rounded-xl text-sm text-danger font-body flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-body text-blue-700">
            <Info size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>Flexible Unit Receiving:</strong> The receive unit can differ from the issue unit.
              You can also record <strong>Rejected Qty</strong> for items that were returned with defects — rejected pieces will be tracked separately and won't be added to stock.
            </span>
          </div>

          {/* Voucher No & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Voucher No</label>
              <input
                type="text" value={voucherNo} readOnly
                className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body bg-muted/30 text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Date *</label>
              <input
                type="date" value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                required
                className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Receive Operator */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Received By (Operator Name)</label>
            <input
              type="text"
              value={receiveOperatorName}
              onChange={(e) => setReceiveOperatorName(e.target.value)}
              placeholder="e.g. Amit, Rahul…"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Issue Voucher Selection */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Issue Challan / Voucher No *</label>
            <select
              value={selectedIssueId}
              onChange={(e) => handleIssueVoucherSelect(e.target.value)}
              required
              className={`w-full border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.issueVoucher ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
            >
              <option value="">— Select Issue Challan —</option>
              {eligibleVouchers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.voucherNo} — {v.operatorName}{v.jobCardRef ? ` | ${v.jobCardRef}` : ''} [{v.status === 'open' ? 'Open' : 'Partial'}]
                  {v.issueSource === 'processed_cutting' ? ' [Re-Issue]' : ''}
                </option>
              ))}
            </select>
            {fieldErrors.issueVoucher && <p className="text-xs text-danger mt-0.5">{fieldErrors.issueVoucher}</p>}
            {eligibleVouchers.length === 0 && (
              <p className="text-xs text-warning font-body mt-1">No open Issue Challans found. Create an Issue Voucher first.</p>
            )}
          </div>

          {/* Auto-filled Issue Voucher Info */}
          {selectedIssue && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs font-700 text-primary font-body uppercase tracking-wide flex items-center gap-1">
                <CheckCircle size={11} /> Issue Challan Details
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-body">
                <div><span className="text-muted-foreground font-600">Issue Operator:</span> <span className="text-foreground font-600">{selectedIssue.operatorName}</span></div>
                {selectedIssue.jobCardRef && <div><span className="text-muted-foreground font-600">Job Card:</span> <span className="text-foreground">{selectedIssue.jobCardRef}</span></div>}
                {selectedIssue.styleName && <div><span className="text-muted-foreground font-600">Style:</span> <span className="text-foreground">{selectedIssue.styleName}</span></div>}
                {selectedIssue.partyName && <div><span className="text-muted-foreground font-600">Party:</span> <span className="text-foreground">{selectedIssue.partyName}</span></div>}
                <div>
                  <span className="text-muted-foreground font-600">Issue Type:</span>{' '}
                  <span className="text-foreground capitalize">
                    {selectedIssue.issueSource === 'processed_cutting' ? 'Re-Issue (Processed Cutting)' : 'Fresh Cutting Issue'}
                  </span>
                </div>
                {selectedIssue.processType && (
                  <div><span className="text-muted-foreground font-600">Process:</span> <span className="text-foreground capitalize">{selectedIssue.processType.replace(/_/g, ' ')}</span></div>
                )}
                <div>
                  <span className="text-muted-foreground font-600">Status:</span>{' '}
                  <span className={`font-600 ${selectedIssue.status === 'open' ? 'text-warning' : 'text-primary'}`}>
                    {selectedIssue.status === 'open' ? 'Open' : 'Partially Received'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {loadingItems && (
            <div className="p-4 text-center text-sm text-muted-foreground font-body">Loading issued items…</div>
          )}

          {selectedIssue && !loadingItems && (hasFabric || hasAccessory || hasCutting) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-body text-amber-700">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                Receiving against Issue Challan <strong>{selectedIssue.voucherNo}</strong>.
                Enter <strong>Receive Qty</strong> for accepted pieces and <strong>Rejected Qty</strong> for defective/rejected pieces.
                {hasCutting && ' Accepted cutting pieces will be added to Cutting Stock; rejected pieces are tracked separately.'}
              </span>
            </div>
          )}

          {/* ── Fabric Items to Receive ── */}
          {!loadingItems && hasFabric && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                  <Layers size={12} /> Fabric Items
                </label>
                <div className="text-xs font-body text-muted-foreground flex items-center gap-3">
                  <span>Accepted: <span className="text-success font-600">{totalFabricReceiving.toFixed(3)}</span></span>
                  {totalFabricRejected > 0 && <span>Rejected: <span className="text-danger font-600">{totalFabricRejected.toFixed(3)}</span></span>}
                  <span className="text-muted-foreground">/ Issued: {totalFabricIssued.toFixed(3)}</span>
                </div>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Fabric</th>
                      <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Balance</th>
                      <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Receive Qty *</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body"><span className="text-primary font-700">Recv Unit</span></th>
                      <th className="text-right px-3 py-2 font-600 text-danger font-body">Rejected Qty</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fabricItems.map((f, i) => {
                      const receiveUnit = f.receiveUnit || f.unit;
                      const unitChanged = receiveUnit !== f.unit;
                      const rejected = (f as any).rejectedQty || 0;
                      return (
                        <tr key={i} className={`border-t border-border ${f.balanceQty === 0 && !unitChanged ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 font-body font-600">{f.fabricName}</td>
                          <td className="px-3 py-2 text-right font-body">{f.issuedQty}</td>
                          <td className="px-3 py-2 font-body text-muted-foreground">{f.unit}</td>
                          <td className="px-3 py-2 text-right font-body text-warning font-600">
                            {unitChanged ? <span className="text-blue-500 italic text-xs">—</span> : f.balanceQty}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="0.001"
                              value={f.receivedQty || ''}
                              onChange={(e) => updateFabricReceived(i, parseFloat(e.target.value) || 0)}
                              disabled={f.balanceQty === 0 && !unitChanged}
                              className="w-20 border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20 ml-auto block disabled:opacity-40"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={receiveUnit}
                              onChange={(e) => updateFabricReceiveUnit(i, e.target.value)}
                              className={`w-full border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20 ${unitChanged ? 'border-primary bg-primary/5 text-primary font-700' : 'border-border'}`}
                            >
                              {RECEIVE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="0.001"
                              value={rejected || ''}
                              onChange={(e) => updateFabricRejected(i, parseFloat(e.target.value) || 0)}
                              disabled={f.balanceQty === 0 && !unitChanged}
                              className="w-20 border border-danger/30 rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-danger/20 ml-auto block bg-red-50 disabled:opacity-40"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {rejected > 0 ? (
                              <select
                                value={(f as any).rejectionReason || ''}
                                onChange={(e) => updateFabricRejectionReason(i, e.target.value)}
                                className="w-full border border-danger/30 rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-danger/20 bg-red-50"
                              >
                                <option value="">— Reason —</option>
                                {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Accessory Items to Receive ── */}
          {!loadingItems && hasAccessory && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                  <Package size={12} /> Accessory / Material Items
                </label>
                <div className="text-xs font-body text-muted-foreground flex items-center gap-3">
                  <span>Accepted: <span className="text-success font-600">{totalAccReceiving}</span></span>
                  {totalAccRejected > 0 && <span>Rejected: <span className="text-danger font-600">{totalAccRejected}</span></span>}
                  <span className="text-muted-foreground">/ Issued: {totalAccIssued}</span>
                </div>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Item</th>
                      <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                      <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Balance</th>
                      <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Receive Qty *</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body"><span className="text-primary font-700">Recv Unit</span></th>
                      <th className="text-right px-3 py-2 font-600 text-danger font-body">Rejected Qty</th>
                      <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessoryItems.map((a, i) => {
                      const receiveUnit = a.receiveUnit || a.unit;
                      const unitChanged = receiveUnit !== a.unit;
                      const rejected = (a as any).rejectedQty || 0;
                      return (
                        <tr key={i} className={`border-t border-border ${a.balanceQty === 0 && !unitChanged ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 font-body font-600">{a.name}</td>
                          <td className="px-3 py-2 text-right font-body">{a.issuedQty}</td>
                          <td className="px-3 py-2 font-body text-muted-foreground">{a.unit}</td>
                          <td className="px-3 py-2 text-right font-body text-warning font-600">
                            {unitChanged ? <span className="text-blue-500 italic text-xs">—</span> : a.balanceQty}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="0.01"
                              value={a.receivedQty || ''}
                              onChange={(e) => updateAccessoryReceived(i, parseFloat(e.target.value) || 0)}
                              disabled={a.balanceQty === 0 && !unitChanged}
                              className="w-20 border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20 ml-auto block disabled:opacity-40"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={receiveUnit}
                              onChange={(e) => updateAccessoryReceiveUnit(i, e.target.value)}
                              className={`w-full border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20 ${unitChanged ? 'border-primary bg-primary/5 text-primary font-700' : 'border-border'}`}
                            >
                              {RECEIVE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="0.01"
                              value={rejected || ''}
                              onChange={(e) => updateAccessoryRejected(i, parseFloat(e.target.value) || 0)}
                              disabled={a.balanceQty === 0 && !unitChanged}
                              className="w-20 border border-danger/30 rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-danger/20 ml-auto block bg-red-50 disabled:opacity-40"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            {rejected > 0 ? (
                              <select
                                value={(a as any).rejectionReason || ''}
                                onChange={(e) => updateAccessoryRejectionReason(i, e.target.value)}
                                className="w-full border border-danger/30 rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-danger/20 bg-red-50"
                              >
                                <option value="">— Reason —</option>
                                {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Cutting / Pieces Received ── */}
          {!loadingItems && selectedIssue && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                  <Scissors size={12} /> Embroidery-Received Components
                  <span className="ml-1 px-1.5 py-0.5 bg-success/10 text-success rounded text-xs font-600">→ Accepted goes to Cutting Stock</span>
                </label>
                {!isCuttingIssue && (
                  <button type="button" onClick={addManualCuttingItem} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-lg">
                    + Add Component (Yoke / Border / Palla…)
                  </button>
                )}
              </div>
              {!isCuttingIssue && !hasCutting && (
                <div className="mb-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-body text-amber-700">
                  <Info size={13} className="mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Important:</strong> Click <strong>"+ Add Component"</strong> above to record the embroidery-processed components received back (e.g. Yoke, Border, Front Palla). Accepted pieces will be added to Cutting Stock; rejected pieces are tracked separately.
                  </span>
                </div>
              )}
              {hasCutting ? (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Component / Part</th>
                        {isCuttingIssue && <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Issued</th>}
                        {isCuttingIssue && <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Issue Unit</th>}
                        {isCuttingIssue && <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Balance</th>}
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Receive Qty *</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body"><span className="text-primary font-700">Recv Unit</span></th>
                        <th className="text-right px-3 py-2 font-600 text-danger font-body">Rejected Qty</th>
                        <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Rejection Reason</th>
                        <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">
                          <span className="text-orange-600 font-700">{isCuttingIssue ? 'Cut Charges (₹)' : 'Emb Charges (₹)'}</span>
                        </th>
                        {!isCuttingIssue && <th className="px-2 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cuttingItems.map((c, i) => {
                        const receiveUnit = c.receiveUnit || c.unit;
                        const unitChanged = receiveUnit !== c.unit;
                        const rejected = (c as any).rejectedPieces || 0;
                        return (
                          <tr key={i} className={`border-t border-border ${isCuttingIssue && c.balancePieces === 0 && !unitChanged ? 'opacity-50' : ''}`}>
                            <td className="px-3 py-2 font-body font-600">
                              {isCuttingIssue ? c.component : (
                                <select
                                  value={c.component}
                                  onChange={(e) => updateManualCuttingItem(i, 'component', e.target.value)}
                                  className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                                >
                                  {SUB_COMPONENTS.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                                </select>
                              )}
                            </td>
                            {isCuttingIssue && <td className="px-3 py-2 text-right font-body">{c.issuedPieces}</td>}
                            {isCuttingIssue && <td className="px-3 py-2 font-body text-muted-foreground">{c.unit}</td>}
                            {isCuttingIssue && (
                              <td className="px-3 py-2 text-right font-body text-warning font-600">
                                {unitChanged ? <span className="text-blue-500 italic text-xs">—</span> : c.balancePieces}
                              </td>
                            )}
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="1"
                                value={c.receivedPieces || ''}
                                onChange={(e) => isCuttingIssue
                                  ? updateCuttingReceived(i, parseInt(e.target.value) || 0)
                                  : updateManualCuttingItem(i, 'receivedPieces', parseInt(e.target.value) || 0)
                                }
                                disabled={isCuttingIssue && c.balancePieces === 0 && !unitChanged}
                                className="w-20 border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20 ml-auto block disabled:opacity-40"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={receiveUnit}
                                onChange={(e) => isCuttingIssue
                                  ? updateCuttingReceiveUnit(i, e.target.value)
                                  : updateManualCuttingItem(i, 'receiveUnit', e.target.value)
                                }
                                className={`w-full border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20 ${unitChanged ? 'border-primary bg-primary/5 text-primary font-700' : 'border-border'}`}
                              >
                                {RECEIVE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="1"
                                value={rejected || ''}
                                onChange={(e) => isCuttingIssue
                                  ? updateCuttingRejected(i, parseInt(e.target.value) || 0)
                                  : updateManualCuttingItem(i, 'rejectedPieces' as any, parseInt(e.target.value) || 0)
                                }
                                disabled={isCuttingIssue && c.balancePieces === 0 && !unitChanged}
                                className="w-20 border border-danger/30 rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-danger/20 ml-auto block bg-red-50 disabled:opacity-40"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              {rejected > 0 ? (
                                <select
                                  value={(c as any).rejectionReason || ''}
                                  onChange={(e) => updateCuttingRejectionReason(i, e.target.value)}
                                  className="w-full border border-danger/30 rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-danger/20 bg-red-50"
                                >
                                  <option value="">— Reason —</option>
                                  {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number" min="0" step="0.01"
                                value={c.cuttingCharge ?? ''}
                                onChange={(e) => isCuttingIssue
                                  ? updateCuttingCharge(i, parseFloat(e.target.value) || 0)
                                  : updateManualCuttingItem(i, 'cuttingCharge', parseFloat(e.target.value) || 0)
                                }
                                className="w-20 border border-orange-200 rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-orange-300 ml-auto block bg-orange-50 placeholder-orange-300"
                                placeholder="0.00"
                              />
                              <div className="text-xs text-orange-400 text-right mt-0.5 font-body">per pc</div>
                            </td>
                            {!isCuttingIssue && (
                              <td className="px-2 py-1.5 text-center">
                                <button type="button" onClick={() => removeCuttingItem(i)} className="text-danger hover:text-danger/70">
                                  <X size={12} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(totalCuttingReceiving > 0 || totalCuttingRejected > 0) && (
                    <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center gap-4 text-xs font-body flex-wrap">
                      {totalCuttingReceiving > 0 && (
                        <>
                          <span className="text-muted-foreground">Accepted:</span>
                          <span className="text-success font-700">{totalCuttingReceiving} pcs → Cutting Stock</span>
                        </>
                      )}
                      {totalCuttingRejected > 0 && (
                        <>
                          <span className="text-muted-foreground ml-2">|</span>
                          <span className="text-muted-foreground ml-1 flex items-center gap-1"><AlertTriangle size={11} className="text-danger" /> Rejected:</span>
                          <span className="text-danger font-700">{totalCuttingRejected} pcs</span>
                        </>
                      )}
                      {cuttingItems.some((c) => (c.cuttingCharge ?? 0) > 0) && (
                        <>
                          <span className="text-muted-foreground ml-2">|</span>
                          <span className="text-muted-foreground ml-1">Charges:</span>
                          <span className="text-orange-600 font-700">
                            ₹{cuttingItems.reduce((s, c) => s + (c.cuttingCharge ?? 0), 0).toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground font-body">
                    {isCuttingIssue
                      ? 'No cutting items to receive (all already received).'
                      : 'Click "+ Add Component" to record cutting pieces received back.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No items message */}
          {selectedIssue && !loadingItems && !hasFabric && !hasAccessory && !hasCutting && (
            <div className="p-4 text-center bg-success-bg border border-success/20 rounded-xl">
              <CheckCircle size={20} className="mx-auto text-success mb-2" />
              <p className="text-sm font-600 text-success font-body">All items from this Issue Challan have been fully received.</p>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Any notes…"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground font-body transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedIssue || (!hasFabric && !hasAccessory && !hasCutting)}
              className="px-5 py-2 bg-success text-white rounded-xl text-sm font-600 font-body hover:bg-success/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : editVoucher ? 'Update Receive Voucher' : 'Save Receive Voucher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
