'use client';
import React, { useState, useEffect } from 'react';
import { X, Plus, Layers, Package, AlertTriangle, CheckCircle, Scissors, Info } from 'lucide-react';
import {
  embroideryVoucherService,
  IssueFabricItem,
  IssueAccessoryItem,
  IssueCuttingItem,
  IssueSource,
  CuttingStockItem,
  EmbIssueVoucher,
} from '@/lib/services/embroideryVoucherService';
import { fabricInventoryService } from '@/lib/services/fabricInventoryService';
import { accountService } from '@/lib/services/accountService';
import { cuttingMasterService } from '@/lib/services/cuttingMasterService';
import { FabricStockItem } from '@/app/fabric-inventory/data/fabricStockData';
import { Account } from '@/app/account-master/data/accountsData';

const ACCESSORY_UNITS = ['Pcs', 'Metres', 'Dozen', 'Set', 'Kg', 'Grams'];
const SUB_COMPONENTS = ['Kurta', 'Pant', 'Dupatta', 'Shirt', 'Yoke', 'Sleeve', 'Collar', 'Pocket', 'Other'];

const PROCESS_TYPES = [
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'yoke_embroidery', label: 'Yoke Embroidery' },
  { value: 'handwork', label: 'Handwork' },
  { value: 'recutting', label: 'Re-Cutting' },
  { value: 'matching', label: 'Matching Verification' },
  { value: 'verification', label: 'Verification' },
  { value: 'cutting_master', label: 'Cutting Master' },
  { value: 'accessory_sorting', label: 'Accessory Sorting' },
  { value: 'other', label: 'Other Process' },
];

const ISSUED_TO_TYPES = [
  { value: 'operator', label: 'Operator / Vendor' },
  { value: 'cutting_master', label: 'Cutting Master' },
  { value: 'employee', label: 'Employee' },
  { value: 'department', label: 'Department' },
];

interface JobCardOption {
  id: string;
  jobCardNo: string;
  styleEn: string;
  partyName: string;
  poNo?: string;
  designCode?: string;
  totalPieces: number;
  colors?: string[];
  sizes?: string[];
}

interface Props {
  jobCards: JobCardOption[];
  onClose: () => void;
  onSaved: () => void;
  editVoucher?: EmbIssueVoucher | null;
}

function groupFabricsByName(fabrics: FabricStockItem[]): Record<string, FabricStockItem[]> {
  return fabrics.reduce((acc, f) => {
    if (!acc[f.fabricName]) acc[f.fabricName] = [];
    acc[f.fabricName].push(f);
    return acc;
  }, {} as Record<string, FabricStockItem[]>);
}

export default function IssueVoucherModal({ jobCards, onClose, onSaved, editVoucher }: Props) {
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedJobCardNo, setSelectedJobCardNo] = useState('');
  const [jobCardInfo, setJobCardInfo] = useState<JobCardOption | null>(null);
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [issueSource, setIssueSource] = useState<IssueSource>('fresh_cutting');
  const [issueType, setIssueType] = useState<'fabric' | 'accessory' | 'both' | 'cutting' | 'part_component'>('fabric');
  const [processType, setProcessType] = useState('embroidery');
  const [issuedToType, setIssuedToType] = useState('operator');
  const [fabricItems, setFabricItems] = useState<IssueFabricItem[]>([]);
  const [accessoryItems, setAccessoryItems] = useState<IssueAccessoryItem[]>([]);
  const [cuttingItems, setCuttingItems] = useState<IssueCuttingItem[]>([]);
  const [selectedCuttingStockId, setSelectedCuttingStockId] = useState('');
  const [remarks, setRemarks] = useState('');

  const [fabrics, setFabrics] = useState<FabricStockItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cuttingMasters, setCuttingMasters] = useState<string[]>([]);
  const [cuttingStock, setCuttingStock] = useState<CuttingStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function init() {
      const [nextNo, fabricData, accountData, stockData, mastersData] = await Promise.all([
        editVoucher ? Promise.resolve(editVoucher.voucherNo) : embroideryVoucherService.getNextIssueVoucherNo(),
        fabricInventoryService.getAll(),
        accountService.getAll(),
        embroideryVoucherService.getAvailableCuttingStock(),
        cuttingMasterService.getAll(),
      ]);
      setVoucherNo(nextNo);
      setFabrics(fabricData.filter((f) => f.stockQty > 0));
      setAccounts(accountData);
      setCuttingStock(stockData);
      setCuttingMasters(mastersData.map((m) => m.name));

      if (editVoucher) {
        setVoucherDate(editVoucher.voucherDate);
        setSelectedJobCardNo(editVoucher.jobCardRef || '');
        const jc = jobCards.find((j) => j.jobCardNo === editVoucher.jobCardRef) || null;
        setJobCardInfo(jc);
        setOperatorId(editVoucher.operatorId || '');
        setOperatorName(editVoucher.operatorName || '');
        setIssueSource(editVoucher.issueSource || 'fresh_cutting');
        setIssueType(editVoucher.issueType || 'fabric');
        setProcessType(editVoucher.processType || 'embroidery');
        setIssuedToType(editVoucher.issuedToType || 'operator');
        setFabricItems(editVoucher.fabricItems || []);
        setAccessoryItems(editVoucher.accessoryItems || []);
        setCuttingItems(editVoucher.cuttingItems || []);
        setSelectedCuttingStockId(editVoucher.cuttingStockId || '');
        setRemarks(editVoucher.remarks || '');
      }

      setLoading(false);
    }
    init();
  }, []);

  // Reload cutting stock when job card changes
  useEffect(() => {
    if (selectedJobCardNo && issueSource === 'processed_cutting') {
      embroideryVoucherService.getAllCuttingStockByJobCard(selectedJobCardNo).then((stock) => {
        setCuttingStock(stock.filter((s) => s.availablePieces > 0 && (s.status === 'available' || s.status === 'partially_issued')));
      });
    }
  }, [selectedJobCardNo, jobCards, issueSource]);

  const fabricsByName = groupFabricsByName(fabrics);
  const fabricNames = Object.keys(fabricsByName).sort();

  function handleJobCardChange(jobCardNo: string) {
    setSelectedJobCardNo(jobCardNo);
    const jc = jobCards.find((j) => j.jobCardNo === jobCardNo) || null;
    setJobCardInfo(jc);
    setSelectedCuttingStockId('');
    setCuttingItems([]);
    if (jobCardNo) setFieldErrors((prev) => ({ ...prev, jobCard: '' }));
  }

  function handleOperatorChange(val: string) {
    const acc = accounts.find((a) => a.id === val);
    if (acc) {
      setOperatorId(acc.id);
      setOperatorName(acc.name);
    } else {
      setOperatorId('');
      setOperatorName(val);
    }
    if (val) setFieldErrors((prev) => ({ ...prev, operator: '' }));
  }

  function handleIssueSourceChange(src: IssueSource) {
    setIssueSource(src);
    if (src === 'fresh_cutting') {
      setIssueType('fabric');
      setCuttingItems([]);
      setSelectedCuttingStockId('');
    } else {
      setIssueType('cutting');
      setFabricItems([]);
      setAccessoryItems([]);
    }
  }

  function handleCuttingStockSelect(stockId: string) {
    setSelectedCuttingStockId(stockId);
    const stock = cuttingStock.find((s) => s.id === stockId);
    if (stock) {
      setCuttingItems([{
        component: stock.component || 'Cutting',
        description: stock.description,
        pieces: stock.availablePieces,
        unit: stock.unit || 'Pcs',
      }]);
    } else {
      setCuttingItems([]);
    }
  }

  // ── Fabric Items ────────────────────────────────────────────────────────────
  function addFabricItem() {
    setFabricItems((prev) => [...prev, { fabricId: '', fabricName: '', rollId: '', rollName: '', issuedQty: 0, unit: 'Metre' }]);
  }
  function removeFabricItem(i: number) {
    setFabricItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateFabricItem(i: number, field: keyof IssueFabricItem, val: string | number) {
    setFabricItems((prev) =>
      prev.map((f, idx) => {
        if (idx !== i) return f;
        if (field === 'fabricName') {
          const rolls = fabricsByName[val as string] || [];
          const first = rolls[0];
          return {
            ...f,
            fabricName: val as string,
            fabricId: first?.id || '',
            rollId: first?.id || '',
            rollName: first?.fabricName || '',
            unit: first?.unit || 'Metre',
          };
        }
        if (field === 'rollId') {
          const roll = fabrics.find((r) => r.id === val);
          return { ...f, rollId: val as string, rollName: roll?.fabricName || '', unit: roll?.unit || f.unit };
        }
        return { ...f, [field]: val };
      })
    );
  }

  // ── Accessory Items ─────────────────────────────────────────────────────────
  function addAccessoryItem() {
    setAccessoryItems((prev) => [...prev, { name: '', qty: 0, unit: 'Pcs' }]);
  }
  function removeAccessoryItem(i: number) {
    setAccessoryItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateAccessoryItem(i: number, field: keyof IssueAccessoryItem, val: string | number) {
    setAccessoryItems((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  }

  // ── Cutting Items ───────────────────────────────────────────────────────────
  function addCuttingItem() {
    setCuttingItems((prev) => [...prev, { component: 'Kurta', pieces: 0, unit: 'Pcs' }]);
  }
  function removeCuttingItem(i: number) {
    setCuttingItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateCuttingItem(i: number, field: keyof IssueCuttingItem, val: string | number) {
    setCuttingItems((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }

  const showFabric = issueSource === 'fresh_cutting' && (issueType === 'fabric' || issueType === 'both');
  const showAccessory = issueSource === 'fresh_cutting' && (issueType === 'accessory' || issueType === 'both');
  const showCutting = issueSource === 'processed_cutting' || (issueSource === 'fresh_cutting' && issueType === 'part_component');

  function getStockWarning(fi: IssueFabricItem): string | null {
    if (!fi.rollId) return null;
    const roll = fabrics.find((r) => r.id === fi.rollId);
    if (!roll) return null;
    if (fi.issuedQty > roll.stockQty) {
      return `Exceeds available stock (${roll.stockQty} ${roll.unit})`;
    }
    return null;
  }

  const selectedStock = cuttingStock.find((s) => s.id === selectedCuttingStockId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const newErrors: Record<string, string> = {};
    if (!selectedJobCardNo) newErrors.jobCard = 'Job Card is required.';
    if (!operatorName) newErrors.operator = 'Operator / Issued To is required.';
    if (issueSource === 'fresh_cutting') {
      if (showFabric && fabricItems.length === 0) newErrors.fabricItems = 'Add at least one fabric item.';
      if (showAccessory && accessoryItems.length === 0) newErrors.accessoryItems = 'Add at least one accessory item.';
    } else {
      if (cuttingItems.length === 0) newErrors.cuttingItems = 'Add at least one cutting item.';
    }

    if (Object.values(newErrors).some(Boolean)) {
      setFieldErrors(newErrors);
      setError('Please fill all required fields before saving.');
      return;
    }
    setFieldErrors({});

    if (!selectedJobCardNo) { setError('Please select a Job Card.'); return; }
    if (!operatorName) { setError('Please select an Operator / Issued To person.'); return; }

    if (issueSource === 'fresh_cutting') {
      if (showFabric && fabricItems.length === 0) { setError('Add at least one fabric item for fabric issue.'); return; }
      if (showFabric) {
        for (const f of fabricItems) {
          if (!f.fabricId || !f.rollId) { setError('Please select fabric and roll for all fabric rows.'); return; }
          if (f.issuedQty <= 0) { setError('Issued quantity must be > 0 for all fabric rows.'); return; }
          const roll = fabrics.find((r) => r.id === f.rollId);
          if (roll && f.issuedQty > roll.stockQty) {
            setError(`Issued qty for "${f.fabricName}" exceeds available stock of ${roll.stockQty} ${roll.unit}.`);
            return;
          }
        }
      }
      if (showAccessory && accessoryItems.length === 0) { setError('Add at least one accessory item.'); return; }
      if (showAccessory) {
        for (const a of accessoryItems) {
          if (!a.name.trim()) { setError('Accessory name is required for all rows.'); return; }
          if (a.qty <= 0) { setError('Accessory quantity must be > 0.'); return; }
        }
      }
      if (issueType === 'part_component') {
        if (cuttingItems.length === 0) { setError('Add at least one item part / component to issue.'); return; }
        for (const c of cuttingItems) {
          if (!c.component.trim()) { setError('Component name is required for all rows.'); return; }
          if (c.pieces <= 0) { setError('Pieces must be > 0 for all rows.'); return; }
        }
      }
    } else {
      // processed_cutting
      if (cuttingItems.length === 0) { setError('Add at least one cutting item to issue.'); return; }
      for (const c of cuttingItems) {
        if (!c.component.trim()) { setError('Component name is required for all cutting rows.'); return; }
        if (c.pieces <= 0) { setError('Pieces must be > 0 for all cutting rows.'); return; }
      }
      if (selectedCuttingStockId && selectedStock) {
        const totalPieces = cuttingItems.reduce((s, c) => s + c.pieces, 0);
        if (totalPieces > selectedStock.availablePieces) {
          setError(`Total pieces (${totalPieces}) exceeds available cutting stock (${selectedStock.availablePieces} pcs).`);
          return;
        }
      }
    }

    setSaving(true);

    if (editVoucher) {
      const ok = await embroideryVoucherService.updateIssueVoucherWithRecalc(editVoucher.id, editVoucher, {
        voucherDate,
        operatorId,
        operatorName,
        issuedToName: operatorName,
        issuedToType,
        processType,
        remarks,
        fabricItems: showFabric ? fabricItems.filter((f) => f.fabricId && f.rollId) : editVoucher.fabricItems,
        accessoryItems: showAccessory ? accessoryItems.filter((a) => a.name.trim()) : editVoucher.accessoryItems,
        cuttingItems: showCutting ? cuttingItems.filter((c) => c.component.trim() && c.pieces > 0) : editVoucher.cuttingItems,
      });
      setSaving(false);
      if (!ok) { setError('Failed to update Issue Voucher. Please try again.'); return; }
      onSaved();
      return;
    }

    const result = await embroideryVoucherService.createIssueVoucher({
      voucherNo,
      voucherDate,
      jobCardRef: jobCardInfo?.jobCardNo || '',
      jobCardId: jobCardInfo?.id || '',
      styleName: jobCardInfo?.styleEn || '',
      partyName: jobCardInfo?.partyName || '',
      poNo: (jobCardInfo as any)?.poNo || '',
      designCode: jobCardInfo?.designCode || '',
      totalPieces: jobCardInfo?.totalPieces || 0,
      colors: jobCardInfo?.colors || [],
      sizes: jobCardInfo?.sizes || [],
      operatorId,
      operatorName,
      issueType: showCutting ? 'cutting' : issueType,
      issueSource,
      processType,
      issuedToName: operatorName,
      issuedToType,
      cuttingStockId: selectedCuttingStockId,
      fabricItems: showFabric ? fabricItems.filter((f) => f.fabricId && f.rollId) : [],
      accessoryItems: showAccessory ? accessoryItems.filter((a) => a.name.trim()) : [],
      cuttingItems: showCutting ? cuttingItems.filter((c) => c.component.trim() && c.pieces > 0) : [],
      status: 'open',
      remarks,
    });
    setSaving(false);

    if (!result) { setError('Failed to save Issue Voucher. Please try again.'); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-700 text-foreground font-display">{editVoucher ? `Edit Issue Voucher — ${editVoucher.voucherNo}` : 'New Issue Voucher'}</h2>
            <p className="text-xs text-muted-foreground font-body mt-0.5">Issue fabric / material / cutting to operator or vendor</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground font-body">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 bg-danger-bg border border-danger/20 rounded-xl text-sm text-danger font-body flex items-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            {/* ── Issue Source (Two Options) ── */}
            <div>
              <label className="block text-xs font-700 text-muted-foreground font-body mb-2 uppercase tracking-wide">Issue Type *</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex flex-col gap-1.5 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                  issueSource === 'fresh_cutting' ?'border-primary bg-primary/5' :'border-border hover:border-primary/40'
                }`}>
                  <input
                    type="radio"
                    name="issueSource"
                    value="fresh_cutting"
                    checked={issueSource === 'fresh_cutting'}
                    onChange={() => handleIssueSourceChange('fresh_cutting')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <Layers size={16} className={issueSource === 'fresh_cutting' ? 'text-primary' : 'text-muted-foreground'} />
                    <span className={`text-sm font-700 font-body ${issueSource === 'fresh_cutting' ? 'text-primary' : 'text-foreground'}`}>
                      Fresh Cutting Issue
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">
                    Issue newly cut pieces / fabric for further processing (embroidery, handwork, etc.)
                  </p>
                </label>
                <label className={`flex flex-col gap-1.5 p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                  issueSource === 'processed_cutting' ?'border-success bg-success/5' :'border-border hover:border-success/40'
                }`}>
                  <input
                    type="radio"
                    name="issueSource"
                    value="processed_cutting"
                    checked={issueSource === 'processed_cutting'}
                    onChange={() => handleIssueSourceChange('processed_cutting')}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <Scissors size={16} className={issueSource === 'processed_cutting' ? 'text-success' : 'text-muted-foreground'} />
                    <span className={`text-sm font-700 font-body ${issueSource === 'processed_cutting' ? 'text-success' : 'text-foreground'}`}>
                      Processed Cutting / Emb. Received
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">
                    Re-issue cutting already received back from embroidery / handwork for further process
                  </p>
                </label>
              </div>
            </div>

            {/* Voucher No & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Voucher No</label>
                <input
                  type="text"
                  value={voucherNo}
                  readOnly
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body bg-muted/30 text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Date *</label>
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  required
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Process Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Process / Purpose *</label>
                <select
                  value={processType}
                  onChange={(e) => setProcessType(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {PROCESS_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Issued To Type *</label>
                <select
                  value={issuedToType}
                  onChange={(e) => setIssuedToType(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {ISSUED_TO_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Job Card */}
            <div>
              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Job Card *</label>
              <select
                value={selectedJobCardNo}
                onChange={(e) => handleJobCardChange(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.jobCard ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
              >
                <option value="">— Select Job Card —</option>
                {jobCards.map((jc) => (
                  <option key={jc.id} value={jc.jobCardNo}>{jc.jobCardNo} — {jc.styleEn}</option>
                ))}
              </select>
              {fieldErrors.jobCard && <p className="text-xs text-danger mt-0.5">{fieldErrors.jobCard}</p>}
            </div>

            {/* Job Card Auto-fill Info Panel */}
            {jobCardInfo && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 space-y-2">
                <p className="text-xs font-700 text-primary font-body uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle size={11} /> Job Card Details (Auto-filled)
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-body">
                  <div><span className="text-muted-foreground font-600">Party:</span> <span className="text-foreground font-600">{jobCardInfo.partyName}</span></div>
                  <div><span className="text-muted-foreground font-600">Style:</span> <span className="text-foreground">{jobCardInfo.styleEn}</span></div>
                  <div><span className="text-muted-foreground font-600">Total Pcs:</span> <span className="text-primary font-700">{jobCardInfo.totalPieces}</span></div>
                  {jobCardInfo.designCode && <div><span className="text-muted-foreground font-600">Design:</span> <span className="text-foreground">{jobCardInfo.designCode}</span></div>}
                  {jobCardInfo.poNo && <div><span className="text-muted-foreground font-600">PO No:</span> <span className="text-foreground">{jobCardInfo.poNo}</span></div>}
                  {(jobCardInfo.colors || []).length > 0 && (
                    <div><span className="text-muted-foreground font-600">Colors:</span> <span className="text-foreground">{(jobCardInfo.colors || []).join(', ')}</span></div>
                  )}
                  {(jobCardInfo.sizes || []).length > 0 && (
                    <div><span className="text-muted-foreground font-600">Sizes:</span> <span className="text-foreground">{(jobCardInfo.sizes || []).join(', ')}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Operator / Issued To */}
            <div>
              <label className="block text-xs font-600 text-muted-foreground font-body mb-1">
                {issuedToType === 'cutting_master' ? 'Cutting Master' : issuedToType === 'employee' ? 'Employee' : issuedToType === 'department' ? 'Department' : 'Operator / Vendor'} *
              </label>
              {issuedToType === 'cutting_master' ? (
                <select
                  value={operatorName}
                  onChange={(e) => { setOperatorId(''); setOperatorName(e.target.value); if (e.target.value) setFieldErrors((prev) => ({ ...prev, operator: '' })); }}
                  required
                  className={`w-full border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.operator ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
                >
                  <option value="">— Select Cutting Master —</option>
                  {cuttingMasters.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={operatorId || operatorName}
                  onChange={(e) => handleOperatorChange(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20 ${fieldErrors.operator ? 'border-danger ring-1 ring-danger/30' : 'border-border'}`}
                >
                  <option value="">— Select from Account Master —</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              )}
              {fieldErrors.operator && <p className="text-xs text-danger mt-0.5">{fieldErrors.operator}</p>}
              {issuedToType === 'cutting_master' && cuttingMasters.length === 0 && (
                <p className="text-xs text-warning font-body mt-1">No cutting masters found. Add cutting masters in Cutting Master first.</p>
              )}
            </div>

            {/* ── PROCESSED CUTTING: Cutting Stock Selection ── */}
            {showCutting && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-success/5 border border-success/20 rounded-xl text-xs font-body text-success">
                  <Info size={13} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Select from cutting stock that has already been received back into the system against an Issue Challan.
                    The system will track this re-issue against the original challan for complete traceability.
                  </span>
                </div>

                {/* Cutting Stock Selector */}
                <div>
                  <label className="block text-xs font-600 text-muted-foreground font-body mb-1">
                    Select Cutting Stock (optional — or add manually below)
                  </label>
                  <select
                    value={selectedCuttingStockId}
                    onChange={(e) => handleCuttingStockSelect(e.target.value)}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Select from available cutting stock —</option>
                    {cuttingStock.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.component} | {s.jobCardRef || 'No JC'} | {s.styleName || '—'} | Available: {s.availablePieces} pcs
                        {s.receiveVoucherNo ? ` | Rcv: ${s.receiveVoucherNo}` : ''}
                      </option>
                    ))}
                  </select>
                  {cuttingStock.length === 0 && (
                    <p className="text-xs text-warning font-body mt-1">
                      No cutting stock available. Receive cutting first via a Receive Voucher, then re-issue from here.
                    </p>
                  )}
                </div>

                {/* Selected Stock Info */}
                {selectedStock && (
                  <div className="bg-success/5 border border-success/20 rounded-xl px-4 py-3">
                    <p className="text-xs font-700 text-success font-body uppercase tracking-wide mb-2">Cutting Stock Details</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-body">
                      <div><span className="text-muted-foreground font-600">Component:</span> <span className="text-foreground font-600">{selectedStock.component}</span></div>
                      <div><span className="text-muted-foreground font-600">Total Pcs:</span> <span className="text-foreground">{selectedStock.totalPieces}</span></div>
                      <div><span className="text-muted-foreground font-600">Available:</span> <span className="text-success font-700">{selectedStock.availablePieces} pcs</span></div>
                      <div><span className="text-muted-foreground font-600">Already Issued:</span> <span className="text-warning">{selectedStock.issuedPieces} pcs</span></div>
                      {selectedStock.receiveVoucherNo && <div><span className="text-muted-foreground font-600">Received via:</span> <span className="text-foreground">{selectedStock.receiveVoucherNo}</span></div>}
                      {selectedStock.issueVoucherNo && <div><span className="text-muted-foreground font-600">Original Issue:</span> <span className="text-foreground">{selectedStock.issueVoucherNo}</span></div>}
                    </div>
                  </div>
                )}

                {/* Cutting Items to Issue */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                      <Scissors size={12} /> Cutting Items to Issue
                    </label>
                    <button type="button" onClick={addCuttingItem} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1">
                      <Plus size={12} /> Add Row
                    </button>
                  </div>
                  {cuttingItems.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl p-4 text-center">
                      <p className="text-xs text-muted-foreground font-body">Select cutting stock above or click &quot;Add Row&quot; to add cutting items manually.</p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Component / Part</th>
                            <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Description</th>
                            <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Pieces *</th>
                            <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cuttingItems.map((ci, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-2 py-1.5">
                                <select
                                  value={ci.component}
                                  onChange={(e) => updateCuttingItem(i, 'component', e.target.value)}
                                  className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                                >
                                  {SUB_COMPONENTS.map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={ci.description || ''}
                                  onChange={(e) => updateCuttingItem(i, 'description', e.target.value)}
                                  placeholder="Optional"
                                  className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={ci.pieces || ''}
                                  onChange={(e) => updateCuttingItem(i, 'pieces', parseInt(e.target.value) || 0)}
                                  className="w-20 border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20 ml-auto block"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <select
                                  value={ci.unit}
                                  onChange={(e) => updateCuttingItem(i, 'unit', e.target.value)}
                                  className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                                >
                                  {ACCESSORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button type="button" onClick={() => removeCuttingItem(i)} className="text-danger hover:text-danger/70">
                                  <X size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selectedStock && cuttingItems.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs font-body">
                      <span className="text-muted-foreground">Total issuing:</span>
                      <span className={`font-700 ${cuttingItems.reduce((s, c) => s + c.pieces, 0) > selectedStock.availablePieces ? 'text-danger' : 'text-success'}`}>
                        {cuttingItems.reduce((s, c) => s + c.pieces, 0)} pcs
                      </span>
                      <span className="text-muted-foreground">/ Available: {selectedStock.availablePieces} pcs</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── FRESH CUTTING: Issue Type ── */}
            {issueSource === 'fresh_cutting' && (
              <div>
                <label className="block text-xs font-600 text-muted-foreground font-body mb-2">Material Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'fabric', label: 'Fabric Only', icon: <Layers size={14} /> },
                    { value: 'accessory', label: 'Accessory Only', icon: <Package size={14} /> },
                    { value: 'both', label: 'Fabric + Accessory', icon: <span className="text-xs">⊕</span> },
                    { value: 'part_component', label: 'Item Part / Component', icon: <Scissors size={14} /> },
                  ] as const).map((t) => (
                    <label key={t.value} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-colors text-sm font-600 font-body ${
                      issueType === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}>
                      <input type="radio" name="issueType" value={t.value} checked={issueType === t.value} onChange={() => setIssueType(t.value)} className="sr-only" />
                      {t.icon}
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Fabric Items */}
            {showFabric && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                    <Layers size={12} /> Fabric Items to Issue
                  </label>
                  <button type="button" onClick={addFabricItem} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Fabric
                  </button>
                </div>
                {fabricItems.length === 0 && (
                  <div className="border border-dashed border-border rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground font-body">Click &quot;Add Fabric&quot; to add fabric items from inventory.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {fabricItems.map((fi, i) => {
                    const availableRolls = fi.fabricName ? (fabricsByName[fi.fabricName] || []) : [];
                    const selectedRoll = fabrics.find((f) => f.id === fi.rollId);
                    const stockWarning = getStockWarning(fi);
                    return (
                      <div key={i} className={`border rounded-xl p-3 relative ${stockWarning ? 'border-warning bg-warning-bg/30' : 'border-border bg-muted/10'}`}>
                        <button type="button" onClick={() => removeFabricItem(i)} className="absolute top-2 right-2 text-danger hover:text-danger/70">
                          <X size={13} />
                        </button>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Fabric *</label>
                            <select
                              value={fi.fabricName}
                              onChange={(e) => updateFabricItem(i, 'fabricName', e.target.value)}
                              className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20"
                            >
                              <option value="">— Select Fabric —</option>
                              {fabricNames.map((name) => <option key={name} value={name}>{name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">
                              Roll *
                              {selectedRoll && (
                                <span className={`ml-1 font-400 ${selectedRoll.stockQty > 0 ? 'text-success' : 'text-danger'}`}>
                                  (Stock: {selectedRoll.stockQty} {selectedRoll.unit})
                                </span>
                              )}
                            </label>
                            <select
                              value={fi.rollId}
                              onChange={(e) => updateFabricItem(i, 'rollId', e.target.value)}
                              disabled={!fi.fabricName}
                              className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                            >
                              <option value="">— Select Roll —</option>
                              {availableRolls.map((roll) => (
                                <option key={roll.id} value={roll.id}>
                                  Roll #{roll.id.slice(-6)} — {roll.stockQty} {roll.unit} available
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Issued Qty *</label>
                            <input
                              type="number" min="0" step="0.001"
                              value={fi.issuedQty || ''}
                              onChange={(e) => updateFabricItem(i, 'issuedQty', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className={`w-full border rounded-lg px-2 py-1.5 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20 ${stockWarning ? 'border-warning' : 'border-border'}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-600 text-muted-foreground font-body mb-1">Unit</label>
                            <input
                              type="text" value={fi.unit} readOnly
                              className="w-full border border-border rounded-lg px-2 py-1.5 text-xs font-body bg-muted/30 text-muted-foreground"
                            />
                          </div>
                        </div>
                        {stockWarning && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-warning font-body">
                            <AlertTriangle size={11} /> {stockWarning}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Accessory Items */}
            {showAccessory && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-700 text-muted-foreground font-body uppercase tracking-wide flex items-center gap-1">
                    <Package size={12} /> Accessory / Material Items
                  </label>
                  <button type="button" onClick={addAccessoryItem} className="text-xs text-primary font-600 font-body hover:underline flex items-center gap-1">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                {accessoryItems.length === 0 && (
                  <div className="border border-dashed border-border rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground font-body">Click &quot;Add Item&quot; to add accessory or material items.</p>
                  </div>
                )}
                {accessoryItems.length > 0 && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Item Name</th>
                          <th className="text-right px-3 py-2 font-600 text-muted-foreground font-body">Qty</th>
                          <th className="text-left px-3 py-2 font-600 text-muted-foreground font-body">Unit</th>
                          <th className="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessoryItems.map((a, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <input type="text" value={a.name} onChange={(e) => updateAccessoryItem(i, 'name', e.target.value)}
                                placeholder="e.g. Buttons, Thread, Lace"
                                className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" min="0" step="0.01" value={a.qty || ''} onChange={(e) => updateAccessoryItem(i, 'qty', parseFloat(e.target.value) || 0)}
                                className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body text-right focus:outline-none focus:ring-1 focus:ring-primary/20" placeholder="0" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={a.unit} onChange={(e) => updateAccessoryItem(i, 'unit', e.target.value)}
                                className="w-full border border-border rounded-lg px-2 py-1 text-xs font-body focus:outline-none focus:ring-1 focus:ring-primary/20">
                                {ACCESSORY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button type="button" onClick={() => removeAccessoryItem(i)} className="text-danger hover:text-danger/70">
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                disabled={saving}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 font-body hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : editVoucher ? 'Update Issue Voucher' : 'Save Issue Voucher'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
