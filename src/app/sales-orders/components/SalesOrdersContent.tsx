'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, ChevronUp, ChevronDown, Eye, FileText, Building2, User, X, Package, Plus, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { SalesOrder } from '../data/salesOrdersData';
import NewSalesOrderModal from './NewSalesOrderModal';
import { salesOrderService } from '@/lib/services/salesOrderService';
import AuditBadge from '@/components/ui/AuditBadge';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';

interface SalesOrdersContentProps {
  lang: 'en' | 'hi';
}

type SortField = 'date' | 'vchNo' | 'partyName' | 'totalQty' | 'totalAmount';
type SortDir = 'asc' | 'desc';

function formatAmount(n: number): string {
  if (n === 0) return '—';
  return '₹' + n.toLocaleString('en-IN');
}

function parseDateForSort(d: string): number {
  const [dd, mm, yyyy] = d.split('-');
  return parseInt(yyyy + mm + dd);
}

function getStatusLabel(status: string | undefined, lang: 'en' | 'hi'): { label: string; className: string } {
  const s = status || 'pending';
  if (s === 'in_production') {
    return {
      label: lang === 'hi' ? 'उत्पादन में' : 'In Production',
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
    };
  }
  if (s === 'completed') {
    return {
      label: lang === 'hi' ? 'पूर्ण' : 'Completed',
      className: 'bg-green-50 text-green-700 border border-green-200',
    };
  }
  // pending (default)
  return {
    label: lang === 'hi' ? 'पेंडिंग' : 'Pending',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
}

export default function SalesOrdersContent({ lang }: SalesOrdersContentProps) {
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState<'all' | 'external' | 'self'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_production' | 'completed'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<SalesOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const PAGE_SIZE = 12;

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        let data = await salesOrderService.getAll();
        setOrders(data);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  // Realtime: re-fetch whenever any user adds/edits/deletes a sales order
  useRealtimeTable('sales_orders', async () => {
    try {
      let data = await salesOrderService.getAll();
      setOrders(data);
    } catch {}
  });

  const filtered = useMemo(() => {
    let data = [...orders];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (o) =>
          o.vchNo.toLowerCase().includes(q) ||
          o.partyName.toLowerCase().includes(q) ||
          o.items.some((i) => i.itemName.toLowerCase().includes(q))
      );
    }
    if (partyFilter !== 'all') {
      data = data.filter((o) => o.partyType === partyFilter);
    }
    if (statusFilter !== 'all') {
      data = data.filter((o) => {
        const effectiveStatus = o.status || 'pending';
        return effectiveStatus === statusFilter;
      });
    }
    data.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = parseDateForSort(a.date) - parseDateForSort(b.date);
      } else if (sortField === 'totalQty') {
        cmp = a.totalQty - b.totalQty;
      } else if (sortField === 'totalAmount') {
        cmp = a.totalAmount - b.totalAmount;
      } else {
        cmp = (a[sortField] as string).localeCompare(b[sortField] as string);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [search, partyFilter, statusFilter, sortField, sortDir, orders]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp size={10} className={sortField === field && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground/40'} />
      <ChevronDown size={10} className={sortField === field && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground/40'} />
    </span>
  );

  const totalOrderValue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalPieces = orders.reduce((s, o) => s + o.totalQty, 0);
  const selfOrders = orders.filter((o) => o.partyType === 'self').length;
  const externalOrders = orders.filter((o) => o.partyType === 'external').length;
  const pendingCount = orders.filter((o) => !o.status || o.status === 'pending').length;
  const inProductionCount = orders.filter((o) => o.status === 'in_production').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  const handleDeleteConfirm = async () => {
    if (!deleteOrder) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const ok = await salesOrderService.delete(deleteOrder.id);
      if (ok) {
        setOrders((prev) => prev.filter((o) => o.id !== deleteOrder.id));
        setDeleteOrder(null);
        if (selectedOrder?.id === deleteOrder.id) setSelectedOrder(null);
      } else {
        setDeleteError(lang === 'hi' ? 'डिलीट नहीं हो सका। पुनः प्रयास करें।' : 'Could not delete. Please try again.');
      }
    } catch {
      setDeleteError(lang === 'hi' ? 'अज्ञात त्रुटि' : 'Unknown error');
    } finally {
      setDeleting(false);
    }
  };

  const reloadOrders = async () => {
    try {
      let data = await salesOrderService.getAll();
      setOrders(data);
    } catch {}
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-700 text-foreground">
            {lang === 'hi' ? 'सेल्स ऑर्डर / Sales Orders' : 'Sales Orders'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lang === 'hi'
              ? `रंगराही क्रिएशन्स — अप्रैल से जुलाई 2026`
              : 'Rangraahi Creations — April to July 2026'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg font-500">
            {lang === 'hi' ? `${orders.length} वाउचर` : `${orders.length} Vouchers`}
          </span>
          <Link
            href="/job-card-management"
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileText size={13} />
            {lang === 'hi' ? 'जॉब कार्ड देखें' : 'View Job Cards'}
          </Link>
          <button
            onClick={() => setShowNewOrder(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus size={13} />
            {lang === 'hi' ? 'नया ऑर्डर' : 'New Sales Order'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/sales-orders" className="card-surface p-4 block hover:shadow-md transition-shadow duration-150 group">
          <p className="text-xs text-muted-foreground font-500 mb-1">
            {lang === 'hi' ? 'कुल ऑर्डर' : 'Total Orders'}
          </p>
          <p className="text-2xl font-700 text-foreground group-hover:text-primary transition-colors">{orders.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'hi' ? `${orders.length} वाउचर नंबर` : `${orders.length} Voucher Numbers`}
          </p>
        </Link>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground font-500 mb-1">
            {lang === 'hi' ? 'कुल राशि' : 'Total Value'}
          </p>
          <p className="text-xl font-700 text-primary">₹{(totalOrderValue / 100000).toFixed(1)}L</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'hi' ? 'कुल बिक्री मूल्य' : 'Total Sales Value'}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground font-500 mb-1">
            {lang === 'hi' ? 'पेंडिंग ऑर्डर' : 'Pending Orders'}
          </p>
          <p className="text-2xl font-700 text-amber-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'hi' ? `${inProductionCount} उत्पादन में · ${completedCount} पूर्ण` : `${inProductionCount} In Production · ${completedCount} Completed`}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground font-500 mb-1">
            {lang === 'hi' ? 'पार्टी' : 'Parties'}
          </p>
          <p className="text-2xl font-700 text-foreground">3</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'hi' ? `${externalOrders} बाहरी · ${selfOrders} स्वयं` : `${externalOrders} External · ${selfOrders} Self`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-surface p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={lang === 'hi' ? 'वाउचर नं, पार्टी, आइटम खोजें...' : 'Search voucher no, party, item...'}
              className="input-field pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted-foreground flex-shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: 'all', en: 'All', hi: 'सभी' },
                { value: 'external', en: 'External', hi: 'बाहरी' },
                { value: 'self', en: 'Self (Rangraahi)', hi: 'स्वयं (रंगराही)' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setPartyFilter(f.value as 'all' | 'external' | 'self'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150 ${
                    partyFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {lang === 'hi' ? f.hi : f.en}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: 'all', en: 'All Status', hi: 'सभी स्थिति' },
                { value: 'pending', en: 'Pending', hi: 'पेंडिंग' },
                { value: 'in_production', en: 'In Production', hi: 'उत्पादन में' },
                { value: 'completed', en: 'Completed', hi: 'पूर्ण' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value as 'all' | 'pending' | 'in_production' | 'completed'); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150 ${
                    statusFilter === f.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {lang === 'hi' ? f.hi : f.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                  <button onClick={() => toggleSort('date')} className="flex items-center">
                    {lang === 'hi' ? 'तारीख' : 'Date'}<SortIcon field="date" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                  <button onClick={() => toggleSort('vchNo')} className="flex items-center">
                    {lang === 'hi' ? 'वाउचर नं' : 'Voucher No'}<SortIcon field="vchNo" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">
                  <button onClick={() => toggleSort('partyName')} className="flex items-center">
                    {lang === 'hi' ? 'पार्टी' : 'Party'}<SortIcon field="partyName" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground hidden md:table-cell">
                  {lang === 'hi' ? 'आइटम' : 'Item(s)'}
                </th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">
                  {lang === 'hi' ? 'स्थिति' : 'Status'}
                </th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">
                  <button onClick={() => toggleSort('totalQty')} className="flex items-center ml-auto">
                    {lang === 'hi' ? 'नग' : 'Qty'}<SortIcon field="totalQty" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">
                  <button onClick={() => toggleSort('totalAmount')} className="flex items-center ml-auto">
                    {lang === 'hi' ? 'राशि' : 'Amount'}<SortIcon field="totalAmount" />
                  </button>
                </th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">
                  {lang === 'hi' ? 'क्रिया' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    <Loader2 size={18} className="animate-spin mx-auto mb-2" />
                    {lang === 'hi' ? 'लोड हो रहा है...' : 'Loading...'}
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    {lang === 'hi' ? 'कोई ऑर्डर नहीं मिला' : 'No orders found'}
                  </td>
                </tr>
              ) : (
                paginated.map((order, idx) => {
                  const statusInfo = getStatusLabel(order.status, lang);
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? '' : 'bg-muted/10'
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-500 whitespace-nowrap">
                        {order.date}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-xs font-600 text-primary font-mono hover:underline"
                        >
                          {order.vchNo}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {order.partyType === 'self' ? (
                            <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <User size={10} className="text-primary" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Building2 size={10} className="text-blue-600" />
                            </span>
                          )}
                          <span className="text-xs font-500 text-foreground">{order.partyName}</span>
                          {order.partyType === 'self' && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-600">
                              {lang === 'hi' ? 'स्वयं' : 'Self'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="max-w-[200px]">
                          {order.items.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : order.items.length === 1 ? (
                            <Link
                              href={`/item-master?search=${encodeURIComponent(order.items[0].itemName)}`}
                              className="text-xs text-primary hover:underline truncate block text-left"
                            >
                              {order.items[0].itemName}
                            </Link>
                          ) : (
                            <Link
                              href={`/item-master?search=${encodeURIComponent(order.items[0].itemName)}`}
                              className="text-xs text-primary hover:underline text-left"
                            >
                              {order.items[0].itemName}
                              <span className="text-muted-foreground ml-1">+{order.items.length - 1} {lang === 'hi' ? 'और' : 'more'}</span>
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-600 text-foreground">{order.totalQty.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-600 ${order.totalAmount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {formatAmount(order.totalAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                            title={lang === 'hi' ? 'विवरण देखें' : 'View Details'}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => setEditOrder(order)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition-all"
                            title={lang === 'hi' ? 'संपादित करें' : 'Edit'}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { setDeleteOrder(order); setDeleteError(null); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-all"
                            title={lang === 'hi' ? 'हटाएं' : 'Delete'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {lang === 'hi'
                ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} / ${filtered.length}`
                : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg bg-muted text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {lang === 'hi' ? 'पिछला' : 'Prev'}
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                      p === page ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs rounded-lg bg-muted text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {lang === 'hi' ? 'अगला' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Sales Order Modal */}
      {showNewOrder && (
        <NewSalesOrderModal
          lang={lang}
          onClose={() => setShowNewOrder(false)}
          onSaved={reloadOrders}
        />
      )}

      {/* Edit Sales Order Modal */}
      {editOrder && (
        <NewSalesOrderModal
          lang={lang}
          editOrder={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={async () => {
            await reloadOrders();
            setEditOrder(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setDeleteOrder(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-700 text-foreground text-base">
                  {lang === 'hi' ? 'ऑर्डर हटाएं?' : 'Delete Sales Order?'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === 'hi'
                    ? `वाउचर ${deleteOrder.vchNo} (${deleteOrder.partyName}) को स्थायी रूप से हटाया जाएगा। यह क्रिया वापस नहीं की जा सकती।`
                    : `Voucher ${deleteOrder.vchNo} (${deleteOrder.partyName}) will be permanently deleted. This action cannot be undone.`}
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2.5">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-600 py-2.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    {lang === 'hi' ? 'हटाया जा रहा है...' : 'Deleting...'}
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    {lang === 'hi' ? 'हाँ, हटाएं' : 'Yes, Delete'}
                  </>
                )}
              </button>
              <button
                onClick={() => setDeleteOrder(null)}
                disabled={deleting}
                className="btn-secondary text-sm px-5 disabled:opacity-60"
              >
                {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedOrder(null)} />
          <div className="w-full max-w-lg bg-card border-l border-border h-full overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <div>
                <h3 className="font-700 text-foreground text-base">
                  {lang === 'hi' ? 'ऑर्डर विवरण' : 'Order Details'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{selectedOrder.vchNo}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">{lang === 'hi' ? 'तारीख' : 'Date'}</p>
                  <p className="text-sm font-600 text-foreground">{selectedOrder.date}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">{lang === 'hi' ? 'वाउचर नं' : 'Voucher No'}</p>
                  <p className="text-sm font-600 text-foreground font-mono">{selectedOrder.vchNo}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">{lang === 'hi' ? 'पार्टी' : 'Party'}</p>
                  <div className="flex items-center gap-2">
                    {selectedOrder.partyType === 'self' ? (
                      <User size={14} className="text-primary" />
                    ) : (
                      <Building2 size={14} className="text-blue-600" />
                    )}
                    <p className="text-sm font-600 text-foreground">{selectedOrder.partyName}</p>
                    {selectedOrder.partyType === 'self' && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-600">
                        {lang === 'hi' ? 'स्वयं का ब्रांड' : 'Own Brand'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package size={14} className="text-muted-foreground" />
                  <p className="text-sm font-600 text-foreground">
                    {lang === 'hi' ? `आइटम (${selectedOrder.items.length})` : `Items (${selectedOrder.items.length})`}
                  </p>
                </div>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="bg-muted/40 rounded-xl p-3">
                      <Link
                        href={`/item-master?search=${encodeURIComponent(item.itemName)}`}
                        className="text-sm font-600 text-primary hover:underline mb-1 block"
                      >
                        {item.itemName}
                      </Link>
                      {item.paramSize && (
                        <p className="text-xs text-muted-foreground mb-1">
                          <span className="font-500">{lang === 'hi' ? 'साइज़: ' : 'Sizes: '}</span>
                          {item.paramSize}
                        </p>
                      )}
                      {item.paramColour && (
                        <p className="text-xs text-muted-foreground mb-1">
                          <span className="font-500">{lang === 'hi' ? 'रंग: ' : 'Colour: '}</span>
                          {item.paramColour}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {item.qty.toLocaleString('en-IN')} {item.unit}
                          {item.price > 0 && ` × ₹${item.price}`}
                        </span>
                        <span className="text-xs font-600 text-foreground">
                          {item.amount > 0 ? `₹${item.amount.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">{lang === 'hi' ? 'कुल नग' : 'Total Qty'}</span>
                  <span className="text-sm font-700 text-foreground">{selectedOrder.totalQty.toLocaleString('en-IN')} {lang === 'hi' ? 'नग' : 'Pcs'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{lang === 'hi' ? 'कुल राशि' : 'Total Amount'}</span>
                  <span className="text-base font-700 text-primary">{formatAmount(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Audit Trail */}
              {(selectedOrder.createdBy || selectedOrder.updatedBy) && (
                <div className="bg-muted/40 rounded-xl p-3 border border-border">
                  <p className="text-xs font-600 text-muted-foreground mb-2">{lang === 'hi' ? 'ऑडिट ट्रेल' : 'Audit Trail'}</p>
                  <AuditBadge
                    createdBy={selectedOrder.createdBy}
                    createdAt={selectedOrder.createdAt}
                    updatedBy={selectedOrder.updatedBy}
                    updatedAt={selectedOrder.updatedAt}
                    variant="block"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setEditOrder(selectedOrder); setSelectedOrder(null); }}
                  className="flex-1 btn-primary text-sm flex items-center justify-center gap-1.5"
                >
                  <Pencil size={14} />
                  {lang === 'hi' ? 'संपादित करें' : 'Edit Order'}
                </button>
                <button
                  onClick={() => { setDeleteOrder(selectedOrder); setSelectedOrder(null); setDeleteError(null); }}
                  className="px-4 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-600 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  {lang === 'hi' ? 'हटाएं' : 'Delete'}
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="btn-secondary text-sm px-4"
                >
                  {lang === 'hi' ? 'बंद करें' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
