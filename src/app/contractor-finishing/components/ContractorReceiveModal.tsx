'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import {
  contractorFinishingService,
  PendingContractorItem,
  ContractorReceiveVoucher,
} from '@/lib/services/contractorFinishingService';
import { useAuth } from '@/contexts/AuthContext';
import { accountService } from '@/lib/services/accountService';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editVoucher?: ContractorReceiveVoucher | null;
}

export default function ContractorReceiveModal({ onClose, onSaved, editVoucher }: Props) {
  const { username } = useAuth();
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractorName, setContractorName] = useState('');
  const [jobCardRef, setJobCardRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [jobCardOptions, setJobCardOptions] = useState<string[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingContractorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function init() {
      const [nextNo, accounts] = await Promise.all([
        contractorFinishingService.getNextReceiveVoucherNo(),
        accountService.getAll(),
      ]);
      if (editVoucher) {
        setVoucherNo(editVoucher.voucherNo);
        setVoucherDate(editVoucher.voucherDate);
        setContractorName(editVoucher.contractorName);
        setJobCardRef(editVoucher.jobCardRef);
        setRemarks(editVoucher.remarks || '');
      } else {
        setVoucherNo(nextNo);
      }
      setAccountNames([...new Set(accounts.map((a) => a.name))].sort());
      setLoading(false);
    }
    init();
  }, [editVoucher]);

  // When contractor changes, load their job cards from issue vouchers
  useEffect(() => {
    if (!contractorName) { setJobCardOptions([]); setJobCardRef(''); setPendingItems([]); return; }
    async function loadJobCards() {
      const jcs = await contractorFinishingService.getJobCardsWithPendingItems(contractorName);
      setJobCardOptions(jcs);
      if (!editVoucher) {
        setJobCardRef('');
        setPendingItems([]);
      }
    }
    loadJobCards();
  }, [contractorName, editVoucher]);

  // When job card changes, load pending items
  useEffect(() => {
    if (!contractorName || !jobCardRef) { setPendingItems([]); return; }
    async function loadPending() {
      setLoadingItems(true);
      const items = await contractorFinishingService.getPendingItemsByContractorAndJobCard(contractorName, jobCardRef);
      setPendingItems(items);
      setLoadingItems(false);
    }
    loadPending();
  }, [contractorName, jobCardRef]);

  function updateReceivedToday(issueItemId: string, value: number) {
    setPendingItems((prev) =>
      prev.map((it) =>
        it.issueItemId === issueItemId
          ? { ...it, receivedToday: Math.max(0, value) }
          : it
      )
    );
    if (fieldErrors.receiveQty) setFieldErrors((prev) => ({ ...prev, receiveQty: '' }));
  }

  // Real-time row validation — matching FinishingReceiveModal rigor
  const rowErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const it of pendingItems) {
      if ((it.receivedToday || 0) <= 0) continue;
      if (it.receivedToday > it.balance) {
        errors[it.issueItemId] = `Qty (${it.receivedToday}) exceeds balance (${it.balance}). Issued: ${it.totalIssued}, already received: ${it.alreadyReceived}.`;
      }
    }
    return errors;
  }, [pendingItems]);

  const hasRowErrors = Object.keys(rowErrors).length > 0;
  const totalReceivedToday = pendingItems.reduce((s, it) => s + (it.receivedToday || 0), 0);

  async function handleSave() {
    setError(null);
    const newErrors: Record<string, string> = {};
    if (!contractorName) newErrors.contractor = 'Please select a contractor.';
    if (!jobCardRef) newErrors.jobCard = 'Please select a job card.';
    if (totalReceivedToday === 0) newErrors.receiveQty = 'Enter received quantity for at least one item.';

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Please fill all required fields before saving.');
      return;
    }
    setFieldErrors({});

    if (hasRowErrors) {
      setError('Please fix quantity errors before saving. Received qty cannot exceed balance.');
      return;
    }

    setSaving(true);
    const result = await contractorFinishingService.createReceiveVoucher(
      { voucherNo, voucherDate, contractorName, jobCardRef, remarks: remarks.trim() || undefined },
      pendingItems,
      username
    );
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
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-lg font-700 font-display">{editVoucher ? 'Edit Contractor Receive' : 'Daily Contractor Receive'}</h2>
            <p className="text-sm text-muted-foreground font-body">{editVoucher ? 'Update received quantities' : 'Record goods received from contractor today'}</p>
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

          {/* Contractor & Job Card */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">Contractor <span className="text-danger">*</span></label>
              <div className="relative">
                <select
                  value={contractorName}
                  onChange={(e) => {
                    setContractorName(e.target.value);
                    if (e.target.value) setFieldErrors((prev) => ({ ...prev, contractor: '' }));
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body appearance-none pr-8 ${fieldErrors.contractor ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
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
              <label className="block text-xs font-600 text-muted-foreground mb-1.5 font-body">Job Card <span className="text-danger">*</span></label>
              {jobCardOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={jobCardRef}
                    onChange={(e) => {
                      setJobCardRef(e.target.value);
                      if (e.target.value) setFieldErrors((prev) => ({ ...prev, jobCard: '' }));
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body appearance-none pr-8 ${fieldErrors.jobCard ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
                  >
                    <option value="">Select Job Card</option>
                    {jobCardOptions.map((jc) => <option key={jc} value={jc}>{jc}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              ) : (
                <input
                  value={jobCardRef}
                  onChange={(e) => {
                    setJobCardRef(e.target.value);
                    if (e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, jobCard: '' }));
                  }}
                  placeholder={contractorName ? 'No issued job cards found' : 'Select contractor first'}
                  disabled={!contractorName}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-body disabled:opacity-50 disabled:cursor-not-allowed ${fieldErrors.jobCard ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
                />
              )}
              {fieldErrors.jobCard && <p className="text-xs text-danger mt-0.5">{fieldErrors.jobCard}</p>}
            </div>
          </div>

          {/* Pending Items Table */}
          {contractorName && jobCardRef && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-700 text-green-700 font-body uppercase tracking-wide">Pending Items with Contractor</span>
                {loadingItems && <RefreshCw size={13} className="animate-spin text-muted-foreground ml-1" />}
              </div>

              {!loadingItems && pendingItems.length === 0 ? (
                <div className="border border-border rounded-xl p-6 text-center text-sm text-muted-foreground font-body">
                  No pending items found for this contractor and job card.
                </div>
              ) : !loadingItems && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Item</th>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Colour</th>
                        <th className="text-left py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Size</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Total Issued</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Already Rcvd</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Balance</th>
                        <th className="text-right py-2.5 px-3 text-xs font-600 text-primary font-body">Received Today</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingItems.map((it) => {
                        const rowErr = rowErrors[it.issueItemId];
                        const isFullyReceived = it.balance === 0;
                        return (
                          <React.Fragment key={it.issueItemId}>
                            <tr className={`border-t border-border/50 transition-colors ${rowErr ? 'bg-danger-bg/30' : isFullyReceived ? 'bg-muted/20' : 'hover:bg-muted/10'}`}>
                              <td className="py-2.5 px-3 font-600 font-body">{it.item}</td>
                              <td className="py-2.5 px-3 text-muted-foreground font-body">{it.colour || '—'}</td>
                              <td className="py-2.5 px-3 text-muted-foreground font-body">{it.size || '—'}</td>
                              <td className="py-2.5 px-3 text-right font-body">
                                <span className="inline-flex items-center gap-1 text-success font-600">
                                  <CheckCircle2 size={12} />
                                  {it.totalIssued}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-body">
                                {it.alreadyReceived > 0 ? (
                                  <span className="text-warning font-600">{it.alreadyReceived}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-body">
                                {isFullyReceived ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-success font-600">
                                    <CheckCircle2 size={11} /> Done
                                  </span>
                                ) : (
                                  <span className="font-700 text-foreground">{it.balance}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  type="number"
                                  min={0}
                                  max={it.balance}
                                  value={it.receivedToday || ''}
                                  onChange={(e) => updateReceivedToday(it.issueItemId, Number(e.target.value))}
                                  disabled={isFullyReceived}
                                  className={`w-24 ml-auto block px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-right font-700 font-body disabled:opacity-50 disabled:cursor-not-allowed ${
                                    rowErr ? 'border-danger ring-1 ring-danger/30' : 'border-primary/40'
                                  }`}
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                            {rowErr && (
                              <tr className="border-t-0">
                                <td colSpan={7} className="px-3 pb-2">
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
                        <td colSpan={3} className="py-2.5 px-3 text-xs font-600 text-muted-foreground font-body">Total</td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-success font-body">
                          {pendingItems.reduce((s, it) => s + it.totalIssued, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-warning font-body">
                          {pendingItems.reduce((s, it) => s + it.alreadyReceived, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 font-body">
                          {pendingItems.reduce((s, it) => s + it.balance, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-700 text-primary font-body">
                          {totalReceivedToday}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {fieldErrors.receiveQty && (
                <p className="text-xs text-danger mt-1 font-body">{fieldErrors.receiveQty}</p>
              )}
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
          <p className="text-sm text-muted-foreground font-body">
            Received Today: <span className="font-700 text-foreground">{totalReceivedToday} pcs</span>
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 border border-border rounded-xl text-sm font-600 font-body hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || hasRowErrors}
              className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 font-body hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editVoucher ? 'Update Receive' : 'Save Receive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
