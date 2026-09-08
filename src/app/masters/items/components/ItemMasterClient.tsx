'use client';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/erp/PageHeader';
import { TableSkeleton } from '@/components/erp/LoadingSkeleton';
import { Plus, Search, RefreshCw, Pencil, Trash2, ChevronDown, ChevronRight, Upload, GitMerge } from 'lucide-react';
import { getImportedVariants } from '@/lib/services/itemImportService';
import { supabase } from '@/lib/supabase/client';
import {
  ItemDetailModal, NewItemModal, DeleteItemModal, MergeDuplicatesModal,
  VariantCardDetailLines, type Variant,
} from './OriginalItemWorkflows';

export default function ItemMasterClient() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Variant | null>(null);
  const [deleting, setDeleting] = useState<Variant | null>(null);
  const [merging, setMerging] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setVariants(await getImportedVariants() as unknown as Variant[]); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load items'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get('search') || '');
    void load();
    const channel = supabase.channel(`item-master-${crypto.randomUUID()}`);
    for (const table of ['item_styles', 'item_variants', 'item_detail_lines', 'item_compositions']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void load(); });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);
  const patchVariant = (patch: Partial<Variant> & { id: string }) => {
    setVariants(rows => rows.map(v => v.id === patch.id ? { ...v, ...patch } : v));
    setSelected(v => v?.id === patch.id ? { ...v, ...patch } : v);
  };
  useRealtimeTable('item_variants',load);
  const q = search.trim().toLowerCase();
  const filtered = variants.filter(v => !q || [v.job_card_no, v.style_no, v.colour, v.item_styles?.design_code, v.item_styles?.item_name,
    ...v.item_detail_lines.map(l => l.material_name_normalized || l.material_name)]
    .some(value => (value || '').toLowerCase().includes(q)));

  return <>
    <PageHeader title="Item Master" breadcrumbs={[{ label: 'KurtiERP' }, { label: 'Masters' }, { label: 'Item Master' }]}
      actions={<div className="flex flex-wrap items-center gap-2">
        <Link href="/masters/items/import" className="btn-secondary"><Upload size={15} />Import</Link>
        <button className="btn-secondary" onClick={() => setMerging(true)}><GitMerge size={15} />Merge duplicates</button>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Add Item</button>
      </div>} />
    <div className="card mb-4 p-4">
      <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-lg px-3 py-2 flex-1 min-w-48 max-w-sm">
        <Search size={14} className="text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job card, style, colour or material..."
          className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full" />
      </div>
    </div>
    <div className="card p-0 overflow-hidden">
      {error ? <div className="flex flex-col items-center gap-3 py-16">
        <p className="text-sm text-red-600 font-semibold">{error}</p>
        <button onClick={() => void load()} className="btn-secondary text-xs"><RefreshCw size={14} />Retry</button>
      </div> : <div className="overflow-x-auto"><table className="w-full">
        <thead className="bg-slate-50 border-b border-border"><tr>
          {['Job Card No', 'Design Code', 'Style No', 'Set Type', 'Colour', 'Actions'].map(h => <th className="table-th" key={h}>{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {loading ? <tr><td colSpan={6}><TableSkeleton rows={5} cols={6} /></td></tr> : filtered.length === 0 ?
            <tr><td colSpan={6} className="py-16 text-center text-sm text-slate-500">No items found.</td></tr> :
            filtered.map(v => <React.Fragment key={v.id}>
              <tr className="table-row-hover group">
                <td className="table-td font-mono text-xs font-bold text-primary">{v.job_card_no}</td>
                <td className="table-td font-semibold text-slate-700">{v.item_styles?.design_code || '—'}{v.item_styles?.item_name && <div className="text-xs font-normal text-slate-500">{v.item_styles.item_name}</div>}</td>
                <td className="table-td text-slate-500">{v.style_no || '—'}</td>
                <td className="table-td"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{v.set_type || '—'}</span></td>
                <td className="table-td text-slate-500">{v.colour}</td>
                <td className="table-td"><div className="flex items-center gap-1">
                  <button title="View / edit item" onClick={() => setSelected(v)} className="p-1.5 rounded text-slate-400 hover:text-primary hover:bg-primary/10"><Pencil size={14} /></button>
                  <button title="Delete this colour variant" onClick={() => setDeleting(v)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                  <button title="Show material quantities" onClick={() => setExpanded(id => id === v.id ? null : v.id)} className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">{expanded === v.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                </div></td>
              </tr>
              {expanded === v.id && <tr><td colSpan={6} className="p-3"><VariantCardDetailLines lines={v.item_detail_lines}
                onQtySaved={(id, quantity) => patchVariant({ id: v.id, item_detail_lines: v.item_detail_lines.map(l => l.id === id ? { ...l, quantity } : l) })} /></td></tr>}
            </React.Fragment>)}
        </tbody>
      </table></div>}
    </div>
    {!loading && !error && <div className="mt-3 text-xs text-slate-400 text-right px-1">Showing {filtered.length} of {variants.length} colour variants</div>}
    {creating && <NewItemModal onClose={() => setCreating(false)} onCreated={() => void load()} />}
    {selected && <ItemDetailModal key={selected.id} variant={selected} onClose={() => setSelected(null)}
      onImageSaved={(id, variant_image_url) => patchVariant({ id, variant_image_url })} onVariantUpdated={patchVariant} />}
    {deleting && <DeleteItemModal key={deleting.id} variant={deleting} onClose={() => setDeleting(null)}
      onDeleted={id => { setDeleting(null); if (selected?.id === id) setSelected(null); void load(); }} />}
    {merging && <MergeDuplicatesModal onClose={() => { setMerging(false); void load(); }} onMerged={() => void load()} />}
  </>;
}
