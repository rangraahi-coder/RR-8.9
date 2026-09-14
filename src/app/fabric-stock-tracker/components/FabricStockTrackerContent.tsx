'use client';
import React, { useState, useMemo } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Plus,
  Search,
  X,
  ChevronDown,
  ClipboardList,
  ArrowDownToLine,
  ShoppingCart,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  FABRIC_STOCK_LEDGER,
  INBOUND_RECEIPTS,
  PURCHASE_ORDERS,
  SHORTAGE_ALERTS,
  FABRIC_PARTIES,
  FabricStockLedger,
  InboundReceipt,
  PurchaseOrder,
} from '../data/fabricStockTrackerData';

type TabType = 'stock' | 'receipts' | 'shortages' | 'po';
type StockView = 'party' | 'color';

const CATEGORY_COLORS: Record<string, string> = {
  JK: 'bg-blue-100 text-blue-700',
  MALMAL: 'bg-purple-100 text-purple-700',
  RAYON: 'bg-green-100 text-green-700',
  YUFTA: 'bg-amber-100 text-amber-700',
  KERI_PRINT: 'bg-rose-100 text-rose-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Inbound Receipt Modal ────────────────────────────────────────────────────
interface ReceiptModalProps {
  onClose: () => void;
  onSave: (r: InboundReceipt) => void;
  receipts: InboundReceipt[];
}

function ReceiptModal({ onClose, onSave, receipts }: ReceiptModalProps) {
  const [form, setForm] = useState({
    date: '2026-08-04',
    partyId: FABRIC_PARTIES.length > 0 ? FABRIC_PARTIES[0].id : '',
    fabricName: '',
    colorName: '',
    category: 'JK',
    poReference: '',
    orderedQty: '',
    receivedQty: '',
    unit: 'Metre',
    ratePerUnit: '',
    remarks: '',
  });

  const CATEGORIES = ['JK', 'MALMAL', 'RAYON', 'YUFTA', 'KERI_PRINT', 'OTHER'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ordered = parseFloat(form.orderedQty) || 0;
    const received = parseFloat(form.receivedQty) || 0;
    const rate = parseFloat(form.ratePerUnit) || 0;
    const party = FABRIC_PARTIES.find((p) => p.id === form.partyId);
    const status: InboundReceipt['status'] =
      received > ordered ? 'excess' : received >= ordered ? 'full' : 'partial';
    const newReceipt: InboundReceipt = {
      id: `ir-${receipts.length + 1}`,
      receiptNo: `RCP-${String(receipts.length + 1).padStart(4, '0')}`,
      date: form.date,
      partyId: form.partyId,
      partyName: party?.name || '',
      fabricName: form.fabricName,
      colorName: form.colorName,
      category: form.category,
      poReference: form.poReference || undefined,
      orderedQty: ordered,
      receivedQty: received,
      unit: form.unit,
      ratePerUnit: rate,
      totalAmount: received * rate,
      status,
      remarks: form.remarks || undefined,
    };
    onSave(newReceipt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-700 text-foreground flex items-center gap-2">
            <ArrowDownToLine size={16} className="text-primary" />
            Record Inbound Receipt
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Date *</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Category *</label>
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Party / Supplier *</label>
            <select required value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} className="input-field text-sm">
              {FABRIC_PARTIES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Fabric Name *</label>
              <input type="text" required placeholder='e.g. 60*60 JK ONLINE 63"' value={form.fabricName} onChange={(e) => setForm({ ...form, fabricName: e.target.value })} className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Color *</label>
              <input type="text" required placeholder="e.g. Black, Blue, Rust" value={form.colorName} onChange={(e) => setForm({ ...form, colorName: e.target.value })} className="input-field text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">PO Reference</label>
            <input type="text" placeholder="e.g. PO-0001" value={form.poReference} onChange={(e) => setForm({ ...form, poReference: e.target.value })} className="input-field text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Ordered Qty *</label>
              <input type="number" required min="0" step="0.01" placeholder="0.00" value={form.orderedQty} onChange={(e) => setForm({ ...form, orderedQty: e.target.value })} className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Received Qty *</label>
              <input type="number" required min="0" step="0.01" placeholder="0.00" value={form.receivedQty} onChange={(e) => setForm({ ...form, receivedQty: e.target.value })} className="input-field text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 text-muted-foreground">Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field text-sm">
                <option>Metre</option>
                <option>Kg</option>
                <option>Yard</option>
              </select>
            </div>
          </div>
          {form.orderedQty && form.receivedQty && parseFloat(form.receivedQty) < parseFloat(form.orderedQty) && (
            <div className="flex items-center gap-2 bg-warning-bg border border-warning-border rounded-lg px-3 py-2">
              <TrendingDown size={14} className="text-warning flex-shrink-0" />
              <p className="text-xs text-warning font-500">
                Short by {(parseFloat(form.orderedQty) - parseFloat(form.receivedQty)).toFixed(2)} {form.unit}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Rate per Unit (₹)</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.ratePerUnit} onChange={(e) => setForm({ ...form, ratePerUnit: e.target.value })} className="input-field text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-600 text-muted-foreground">Remarks</label>
            <textarea rows={2} placeholder="Optional notes..." value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save Receipt</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stock Row ────────────────────────────────────────────────────────────────
function StockRow({ item }: { item: FabricStockLedger }) {
  const isShort = item.availableStock <= 0;
  const isLow = !isShort && item.currentStock < item.minStockLevel * 1.2;
  return (
    <tr className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${isShort ? 'bg-danger-bg/30' : ''}`}>
      <td className="px-4 py-2.5 font-500 text-foreground text-xs">{item.fabricName}</td>
      <td className="px-4 py-2.5 text-xs text-foreground">{item.colorName}</td>
      <td className="px-4 py-2.5">
        <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>{item.category}</span>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-600 text-foreground text-xs">{fmt(item.currentStock)}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-warning text-xs">{fmt(item.reservedForJobCards)}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums font-700 text-xs ${isShort ? 'text-danger' : isLow ? 'text-warning' : 'text-success'}`}>
        {isShort ? `−${fmt(Math.abs(item.availableStock))}` : fmt(item.availableStock)}
      </td>
      <td className="px-4 py-2.5">
        {isShort ? (
          <span className="flex items-center gap-1 text-xs font-600 text-danger"><AlertTriangle size={11} /> Shortage</span>
        ) : isLow ? (
          <span className="flex items-center gap-1 text-xs font-600 text-warning"><TrendingDown size={11} /> Low</span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-600 text-success"><CheckCircle2 size={11} /> OK</span>
        )}
      </td>
    </tr>
  );
}

// ─── Stock Tab ────────────────────────────────────────────────────────────────
interface StockTabProps {
  stockView: StockView;
  setStockView: (v: StockView) => void;
  search: string;
  setSearch: (s: string) => void;
}

function StockTab({ stockView, setStockView, search, setSearch }: StockTabProps) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FABRIC_STOCK_LEDGER.filter(
      (s) =>
        s.fabricName.toLowerCase().includes(q) ||
        s.colorName.toLowerCase().includes(q) ||
        s.partyName.toLowerCase().includes(q)
    );
  }, [search]);

  const byParty = useMemo(() => {
    const map: Record<string, FabricStockLedger[]> = {};
    filtered.forEach((s) => {
      if (!map[s.partyName]) map[s.partyName] = [];
      map[s.partyName].push(s);
    });
    return map;
  }, [filtered]);

  const byColor = useMemo(() => {
    const map: Record<string, FabricStockLedger[]> = {};
    filtered.forEach((s) => {
      if (!map[s.colorName]) map[s.colorName] = [];
      map[s.colorName].push(s);
    });
    return map;
  }, [filtered]);

  const totalStock = filtered.reduce((s, f) => s + f.currentStock, 0);
  const totalAvailable = filtered.reduce((s, f) => s + Math.max(0, f.availableStock), 0);
  const shortageCount = filtered.filter((f) => f.availableStock <= 0).length;

  const tableHead = (
    <thead>
      <tr className="border-b border-border/50">
        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground">Fabric</th>
        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground">Color</th>
        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground">Category</th>
        <th className="text-right px-4 py-2.5 text-xs font-600 text-muted-foreground">Stock</th>
        <th className="text-right px-4 py-2.5 text-xs font-600 text-muted-foreground">Reserved</th>
        <th className="text-right px-4 py-2.5 text-xs font-600 text-muted-foreground">Available</th>
        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground">Status</th>
      </tr>
    </thead>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Stock</p>
          <p className="text-2xl font-700 text-primary mt-1">{fmt(totalStock)}</p>
          <p className="text-xs text-muted-foreground">Metres</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Available</p>
          <p className="text-2xl font-700 text-success mt-1">{fmt(totalAvailable)}</p>
          <p className="text-xs text-muted-foreground">Metres (unreserved)</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Parties</p>
          <p className="text-2xl font-700 text-foreground mt-1">{Object.keys(byParty).length}</p>
          <p className="text-xs text-muted-foreground">Suppliers / Processors</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Shortage Items</p>
          <p className={`text-2xl font-700 mt-1 ${shortageCount > 0 ? 'text-danger' : 'text-success'}`}>{shortageCount}</p>
          <p className="text-xs text-muted-foreground">Below available</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search fabric, color, party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setStockView('party')}
            className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors ${stockView === 'party' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Party-wise
          </button>
          <button
            onClick={() => setStockView('color')}
            className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors ${stockView === 'color' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Color-wise
          </button>
        </div>
      </div>

      {stockView === 'party' && (
        <div className="flex flex-col gap-4">
          {Object.entries(byParty).map(([party, items]) => {
            const partyTotal = items.reduce((s, i) => s + i.currentStock, 0);
            return (
              <div key={party} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Package size={13} className="text-primary" />
                    </div>
                    <span className="text-sm font-700 text-foreground">{party}</span>
                    <span className="text-xs text-muted-foreground">({items.length} items)</span>
                  </div>
                  <span className="text-sm font-700 text-primary tabular-nums">{fmt(partyTotal)} m</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    {tableHead}
                    <tbody>
                      {items.map((item) => <StockRow key={item.id} item={item} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stockView === 'color' && (
        <div className="flex flex-col gap-4">
          {Object.entries(byColor).map(([color, items]) => {
            const colorTotal = items.reduce((s, i) => s + i.currentStock, 0);
            return (
              <div key={color} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/20 border border-primary/40" />
                    <span className="text-sm font-700 text-foreground">{color}</span>
                    <span className="text-xs text-muted-foreground">({items.length} items)</span>
                  </div>
                  <span className="text-sm font-700 text-primary tabular-nums">{fmt(colorTotal)} m</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    {tableHead}
                    <tbody>
                      {items.map((item) => <StockRow key={item.id} item={item} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Receipts Tab ─────────────────────────────────────────────────────────────
function ReceiptsTab({ receipts }: { receipts: InboundReceipt[] }) {
  const statusStyle: Record<InboundReceipt['status'], string> = {
    full: 'bg-success-bg text-success border border-success-border',
    partial: 'bg-warning-bg text-warning border border-warning-border',
    excess: 'bg-blue-50 text-blue-700 border border-blue-200',
  };
  const statusLabel: Record<InboundReceipt['status'], string> = {
    full: 'Full',
    partial: 'Partial',
    excess: 'Excess',
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ArrowDownToLine size={15} className="text-primary" />
        <span className="text-sm font-600 text-foreground">Inbound Receipts</span>
        <span className="ml-auto text-xs text-muted-foreground">{receipts.length} records</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Receipt No</th>
              <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Party</th>
              <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Fabric / Color</th>
              <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">PO Ref</th>
              <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Ordered</th>
              <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
              <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Amount (₹)</th>
              <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-muted-foreground">
                  <ArrowDownToLine size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No receipts recorded yet</p>
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-600 text-primary text-xs">{r.receiptNo}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-3 text-xs font-500 text-foreground">{r.partyName}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-500 text-foreground">{r.fabricName}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      {r.colorName}
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-600 ${CATEGORY_COLORS[r.category] || 'bg-gray-100 text-gray-600'}`}>{r.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.poReference || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-foreground">{fmt(r.orderedQty)} {r.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs font-600 text-foreground">{fmt(r.receivedQty)} {r.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs font-600 text-foreground">
                    ₹{r.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusStyle[r.status]}`}>{statusLabel[r.status]}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shortages Tab ────────────────────────────────────────────────────────────
function ShortagesTab() {
  return (
    <div className="flex flex-col gap-4">
      {SHORTAGE_ALERTS.length === 0 ? (
        <div className="bg-success-bg border border-success-border rounded-xl p-8 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-success opacity-60" />
          <p className="text-sm font-600 text-success">No shortages detected</p>
          <p className="text-xs text-muted-foreground mt-1">All fabric stock is sufficient for open job cards</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-danger flex-shrink-0" />
            <p className="text-sm font-600 text-danger">
              {SHORTAGE_ALERTS.length} shortage{SHORTAGE_ALERTS.length > 1 ? 's' : ''} blocking job cards
            </p>
          </div>
          {SHORTAGE_ALERTS.map((alert) => (
            <div key={alert.id} className={`bg-card border rounded-xl p-5 ${alert.severity === 'critical' ? 'border-danger/40' : 'border-warning/40'}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-700 ${alert.severity === 'critical' ? 'bg-danger-bg text-danger border border-danger-border' : 'bg-warning-bg text-warning border border-warning-border'}`}>
                      {alert.severity === 'critical' ? '🔴 Critical' : '🟡 Warning'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${CATEGORY_COLORS[alert.category] || 'bg-gray-100 text-gray-600'}`}>{alert.category}</span>
                  </div>
                  <h3 className="text-sm font-700 text-foreground">{alert.fabricName}</h3>
                  <p className="text-xs text-muted-foreground">{alert.colorName} · {alert.partyName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">Shortage</p>
                  <p className="text-xl font-700 text-danger">−{fmt(alert.shortageQty)}</p>
                  <p className="text-xs text-muted-foreground">{alert.unit}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Current Stock</p>
                  <p className="text-base font-700 text-foreground mt-0.5">{fmt(alert.currentStock)}</p>
                  <p className="text-xs text-muted-foreground">{alert.unit}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Required</p>
                  <p className="text-base font-700 text-warning mt-0.5">{fmt(alert.requiredQty)}</p>
                  <p className="text-xs text-muted-foreground">{alert.unit}</p>
                </div>
                <div className="bg-danger-bg rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Short by</p>
                  <p className="text-base font-700 text-danger mt-0.5">{fmt(alert.shortageQty)}</p>
                  <p className="text-xs text-muted-foreground">{alert.unit}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-600 text-muted-foreground mb-2">Blocked Job Cards ({alert.blockedJobCards.length})</p>
                <div className="flex flex-wrap gap-2">
                  {alert.blockedJobCards.map((jc) => (
                    <span key={jc} className="flex items-center gap-1 px-2 py-1 bg-danger-bg border border-danger-border rounded-lg text-xs font-600 text-danger">
                      <ClipboardList size={10} />
                      {jc}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── PO Reconciliation Tab ────────────────────────────────────────────────────
function POTab() {
  const [filter, setFilter] = useState<'all' | 'open' | 'partial' | 'overdue' | 'closed'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return PURCHASE_ORDERS;
    return PURCHASE_ORDERS.filter((po) => po.status === filter);
  }, [filter]);

  const openCount = PURCHASE_ORDERS.filter((p) => p.status === 'open' || p.status === 'partial').length;
  const overdueCount = PURCHASE_ORDERS.filter((p) => p.status === 'overdue').length;
  const closedCount = PURCHASE_ORDERS.filter((p) => p.status === 'closed').length;
  const totalPending = PURCHASE_ORDERS.reduce((s, p) => s + p.pendingQty, 0);

  const statusStyle: Record<PurchaseOrder['status'], string> = {
    open: 'bg-blue-50 text-blue-700 border border-blue-200',
    partial: 'bg-warning-bg text-warning border border-warning-border',
    closed: 'bg-success-bg text-success border border-success-border',
    overdue: 'bg-danger-bg text-danger border border-danger-border',
  };

  const statusIcon: Record<PurchaseOrder['status'], React.ReactNode> = {
    open: <Clock size={10} />,
    partial: <TrendingDown size={10} />,
    closed: <CheckCircle2 size={10} />,
    overdue: <XCircle size={10} />,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Open / Partial</p>
          <p className="text-2xl font-700 text-warning mt-1">{openCount}</p>
          <p className="text-xs text-muted-foreground">POs pending</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Overdue</p>
          <p className={`text-2xl font-700 mt-1 ${overdueCount > 0 ? 'text-danger' : 'text-success'}`}>{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Past expected date</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Closed</p>
          <p className="text-2xl font-700 text-success mt-1">{closedCount}</p>
          <p className="text-xs text-muted-foreground">Fully received</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Pending Qty</p>
          <p className="text-2xl font-700 text-foreground mt-1">{fmt(totalPending)}</p>
          <p className="text-xs text-muted-foreground">Metres awaited</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'open', 'partial', 'overdue', 'closed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-colors capitalize ${filter === f ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            {f === 'all' ? 'All POs' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">PO No</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Party</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Fabric / Color</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Ordered</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pending</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Expected</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No purchase orders found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((po) => (
                  <tr key={po.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${po.status === 'overdue' ? 'bg-danger-bg/20' : ''}`}>
                    <td className="px-4 py-3 font-600 text-primary text-xs">{po.poNo}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{po.date}</td>
                    <td className="px-4 py-3 text-xs font-500 text-foreground">{po.partyName}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-500 text-foreground">{po.fabricName}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        {po.colorName}
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-600 ${CATEGORY_COLORS[po.category] || 'bg-gray-100 text-gray-600'}`}>{po.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-foreground">{fmt(po.orderedQty)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs font-600 text-success">{fmt(po.receivedQty)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums text-xs font-700 ${po.pendingQty > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{fmt(po.pendingQty)}</td>
                    <td className={`px-4 py-3 text-xs ${po.status === 'overdue' ? 'text-danger font-600' : 'text-muted-foreground'}`}>{po.expectedDate}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 w-fit ${statusStyle[po.status]}`}>
                        {statusIcon[po.status]}
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FabricStockTrackerContent() {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [stockView, setStockView] = useState<StockView>('party');
  const [search, setSearch] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receipts, setReceipts] = useState<InboundReceipt[]>([...INBOUND_RECEIPTS]);

  const criticalCount = SHORTAGE_ALERTS.filter((a) => a.severity === 'critical').length;
  const overduePoCount = PURCHASE_ORDERS.filter((p) => p.status === 'overdue').length;

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number; badgeDanger?: boolean }[] = [
    { id: 'stock', label: 'Stock Ledger', icon: <Package size={14} /> },
    { id: 'receipts', label: 'Inbound Receipts', icon: <ArrowDownToLine size={14} />, badge: receipts.length },
    { id: 'shortages', label: 'Shortages', icon: <AlertTriangle size={14} />, badge: SHORTAGE_ALERTS.length, badgeDanger: SHORTAGE_ALERTS.length > 0 },
    { id: 'po', label: 'PO Reconciliation', icon: <ShoppingCart size={14} />, badge: overduePoCount + PURCHASE_ORDERS.filter((p) => p.status === 'open').length, badgeDanger: overduePoCount > 0 },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Fabric Stock Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Party-wise &amp; color-wise stock · Receipts · Shortage flags · PO reconciliation</p>
        </div>
        <button
          onClick={() => setShowReceiptModal(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={14} />
          Record Receipt
        </button>
      </div>

      {criticalCount > 0 && (
        <button
          type="button"
          className="flex items-center gap-3 bg-danger-bg border border-danger-border rounded-xl px-4 py-3 w-full text-left hover:bg-danger/10 transition-colors"
          onClick={() => setActiveTab('shortages')}
        >
          <AlertTriangle size={16} className="text-danger flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-700 text-danger">
              {criticalCount} critical shortage{criticalCount > 1 ? 's' : ''} blocking job cards
            </p>
            <p className="text-xs text-muted-foreground">Click to view details</p>
          </div>
          <ChevronDown size={14} className="text-danger -rotate-90" />
        </button>
      )}

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-600 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-xs font-700 px-1.5 py-0.5 rounded-full ${tab.badgeDanger ? 'bg-danger text-white' : 'bg-info text-white'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'stock' && (
        <StockTab stockView={stockView} setStockView={setStockView} search={search} setSearch={setSearch} />
      )}
      {activeTab === 'receipts' && <ReceiptsTab receipts={receipts} />}
      {activeTab === 'shortages' && <ShortagesTab />}
      {activeTab === 'po' && <POTab />}

      {showReceiptModal && (
        <ReceiptModal
          onClose={() => setShowReceiptModal(false)}
          onSave={(r) => {
            setReceipts((prev) => [r, ...prev]);
            setShowReceiptModal(false);
          }}
          receipts={receipts}
        />
      )}
    </div>
  );
}
