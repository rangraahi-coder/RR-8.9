'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Package, RefreshCw, Info } from 'lucide-react';

import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';
import { contractorFinishingService, FinishedGoodsEntry } from '@/lib/services/contractorFinishingService';

interface FinishedGoodsContentProps {
  lang?: 'en' | 'hi';
}

export default function FinishedGoodsContent({ lang = 'en' }: FinishedGoodsContentProps) {
  const [items, setItems] = useState<FinishedGoodsEntry[]>([]);
  const [error,setError]=useState('');
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {const data = await contractorFinishingService.getFinishedGoodsByComponentAssembly();
    setItems(data);
    setError('');}catch(e){setError(e instanceof Error?e.message:'Ready stock could not load');}finally{setLoading(false);}
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Realtime: refresh when finished_goods or dispatch_vouchers table changes
  useRealtimeTable('finished_goods', loadItems);
  useRealtimeTable('dispatch_vouchers', loadItems);
  useRealtimeTable('component_assembly_vouchers', loadItems);

  const totalAssembled = items.reduce((s, i) => s + i.totalPieces, 0);
  const totalAvailable = items.reduce((s, i) => s + i.availableForDispatch, 0);
  const totalDispatched = items.reduce((s, i) => s + i.dispatchedPieces, 0);

  const statusColor: Record<string, string> = {
    available: 'bg-success-bg text-success border border-success-border',
    partial: 'bg-warning-bg text-warning border border-warning-border',
    dispatched: 'bg-muted text-muted-foreground border border-border',
  };

  return (
    <div className="flex flex-col gap-6">
<p role="alert" className="text-red-600">{error}</p>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Finished Goods Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ready Items assembled via Component Assembly — auto-updated by assembly &amp; dispatch</p>
        </div>
        <button onClick={loadItems} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors text-muted-foreground self-start sm:self-auto" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total SKUs</p>
          <p className="text-2xl font-700 text-foreground mt-1">{items.length}</p>
          <p className="text-xs text-muted-foreground">Ready Item Entries</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Assembled</p>
          <p className="text-2xl font-700 text-primary mt-1">{totalAssembled.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Sets Created</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Available Stock</p>
          <p className="text-2xl font-700 text-success mt-1">{totalAvailable.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Ready for Dispatch</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Dispatched</p>
          <p className="text-2xl font-700 text-muted-foreground mt-1">{totalDispatched.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Issued Out</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <Info size={16} className="text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-primary/80 leading-relaxed space-y-1">
          <p><strong>Read-only inventory view.</strong> Quantities are managed automatically:</p>
          <p>• <strong>Component Assembly completed</strong> → Qty added to Finished Goods</p>
          <p>• <strong>Dispatch issued</strong> → Qty deducted from Finished Goods</p>
          <p>Balance = Total Assembled − Total Dispatched</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Package size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Ready Items Inventory</span>
          <span className="ml-auto text-xs text-muted-foreground">{items.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">#</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Item Name</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Colour</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Size</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Job Card</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Assembly Voucher</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Assembled</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Available</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Dispatched</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-muted-foreground">
                    <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-40" />
                    <p className="text-sm">Loading finished goods inventory...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-muted-foreground">
                    <Package size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No finished goods yet</p>
                    <p className="text-xs mt-1 max-w-sm mx-auto">
                      Ready Items will appear here automatically after a <strong>Component Assembly</strong> is completed in Contractor Finishing.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 font-600 text-foreground">{item.item || item.styleName || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.colour || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.size || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.jobCardRef || '—'}</td>
                    <td className="px-4 py-3 text-xs text-primary font-500">{item.sourceVoucherNo || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-700 text-foreground">{item.totalPieces.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{item.availableForDispatch.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{item.dispatchedPieces.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.dateAdded}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusColor[item.status] || statusColor['available']}`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
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
