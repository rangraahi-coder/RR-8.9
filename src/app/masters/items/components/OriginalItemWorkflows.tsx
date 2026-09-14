'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Tag,
  Layers,
  Search,
  Upload,
  Scissors,
  Wrench,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ImageIcon,
  Pencil,
  X,
  Check,
  Link as LinkIcon,
  Plus,
  Trash2,
  GripVertical,
  GitMerge,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
const createClient = () => supabase;
interface ItemComposition { id: string; style_id: string; component_name: string; component_name_normalized: string; qty_per_set: number; unit: string; sort_order: number; notes: string; }
import { toast } from 'sonner';
import { saveOriginalItem, recoverPendingItemSave, PendingItemSaveError } from '@/lib/supabase/services/originalItemSave';

type DetailCategory = 'fabric_material' | 'product_composition' | 'manufacturing_work' | 'accessory_raw_material' | 'production_sub_unit';

interface DetailLine {
  id: string;
  category: DetailCategory;
  material_name: string;
  material_name_normalized: string;
  quantity: number | null;
  unit: string;
  secondary_quantity: number | null;
  secondary_unit: string;
  notes: string;
  source_text: string;
  source_row: number;
  review_status: string;
  review_note: string;
  import_key: string;
}

export interface Variant {
  id: string;
  job_card_no: string;
  style_no: string;
  set_type: string;
  colour: string;
  colour_normalized: string;
  variant_status: string;
  match_level: string;
  import_key: string;
  source_row_start: number;
  source_row_end: number;
  import_source: string;
  updated_at: string;
  variant_image_url: string;
  measurement_sheet_url?: string;
  item_styles: { item_name?: string; id: string; job_card_no: string; design_code: string; style_no: string; set_type: string; linked_job_card_id: string | null } | null;
  item_detail_lines: DetailLine[];
}

const CATEGORY_META: Record<DetailCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  fabric_material: { label: 'Fabric / Material', icon: <Scissors size={13} />, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  product_composition: { label: 'Product Composition', icon: <Package size={13} />, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  manufacturing_work: { label: 'Manufacturing Work', icon: <Wrench size={13} />, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  accessory_raw_material: { label: 'Accessories / Raw Materials', icon: <ShoppingBag size={13} />, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  production_sub_unit: { label: 'Production Sub-component', icon: <Package size={13} />, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
};

const REVIEW_BADGE: Record<string, string> = {
  ok: 'bg-green-100 text-green-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
  quantity_required: 'bg-red-100 text-red-700',
  ambiguous_match: 'bg-orange-100 text-orange-700',
};

const COLOUR_OPTIONS = [
  'RED', 'BLUE', 'GREEN', 'NAVY', 'MAROON', 'WHITE', 'BLACK', 'PINK',
  'YELLOW', 'PEACH', 'CREAM', 'OFF WHITE', 'MUSTARD', 'ORANGE', 'PURPLE',
  'GREY', 'MULTI', 'BROWN', 'BEIGE', 'TEAL', 'CORAL', 'MAGENTA', 'INDIGO',
  'RUST', 'OLIVE', 'LAVENDER', 'TURQUOISE', 'BURGUNDY', 'CHARCOAL',
];

const UNIT_OPTIONS = ['Pcs', 'Mtr', 'Kg', 'Set', 'Pair', 'Dozen', 'Gram', 'Litre', 'Roll', 'Bundle'];

const COMPONENT_NAMES = ['Kurta', 'Pant', 'Dupatta', 'Top', 'Bottom', 'Jacket', 'Blouse', 'Skirt', 'Shirt', 'Trouser', 'Lehenga', 'Choli', 'Odhni'];

// ─── Set Type Options ─────────────────────────────────────────────────────────
const SET_TYPE_OPTIONS = ['3PC', '2PC', '1PC', 'CUSTOM'] as const;

const SET_TYPE_COMPONENTS: Record<string, { name: string; qty: number; unit: string }[]> = {
  '3PC': [
    { name: 'Kurta', qty: 1, unit: 'Pcs' },
    { name: 'Pant', qty: 1, unit: 'Pcs' },
    { name: 'Dupatta', qty: 1, unit: 'Pcs' },
  ],
  '2PC': [
    { name: 'Kurta', qty: 1, unit: 'Pcs' },
    { name: 'Pant', qty: 1, unit: 'Pcs' },
  ],
  '1PC': [
    { name: 'Kurta', qty: 1, unit: 'Pcs' },
  ],
};

// ─── Composition Manager ──────────────────────────────────────────────────────

function CompositionManager({ styleId, setType }: { styleId: string; setType: string }) {
  const [compositions, setCompositions] = useState<ItemComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnit, setNewUnit] = useState('Pcs');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadCompositions = useCallback(async () => {
    setLoading(true);
    setSaveError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('item_compositions')
      .select('*')
      .eq('style_id', styleId)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Failed to load compositions:', error.message);
    }
    setCompositions((data || []) as ItemComposition[]);
    setLoading(false);
  }, [styleId]);

  useEffect(() => {
    loadCompositions();
  }, [loadCompositions]);

  async function addComposition() {
    if (!newName.trim()) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('item_compositions')
      .insert({
        style_id: styleId,
        component_name: newName.trim(),
        component_name_normalized: newName.trim().toLowerCase(),
        qty_per_set: parseInt(newQty) || 1,
        unit: newUnit.trim() || 'Pcs',
        sort_order: compositions.length,
        notes: '',
      })
      .select()
      .single();
    if (!error && data) {
      setCompositions((prev) => [...prev, data as ItemComposition]);
      setNewName('');
      setNewQty('1');
      setNewUnit('Pcs');
      setAddingNew(false);
    } else if (error) {
      setSaveError(error.message || 'Failed to save. Please try again.');
    }
    setSaving(false);
  }

  async function deleteComposition(id: string) {
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase.from('item_compositions').delete().eq('id', id);
    if (!error) {
      setCompositions((prev) => prev.filter((c) => c.id !== id));
    } else {
      setSaveError(error.message || 'Failed to delete. Please try again.');
    }
  }

  function startEdit(comp: ItemComposition) {
    setEditingId(comp.id);
    setEditName(comp.component_name);
    setEditQty(String(comp.qty_per_set));
    setEditUnit(comp.unit);
    setSaveError(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('item_compositions')
      .update({
        component_name: editName.trim(),
        component_name_normalized: editName.trim().toLowerCase(),
        qty_per_set: parseInt(editQty) || 1,
        unit: editUnit.trim() || 'Pcs',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      setCompositions((prev) => prev.map((c) => c.id === id ? data as ItemComposition : c));
    } else if (error) {
      setSaveError(error.message || 'Failed to update. Please try again.');
    }
    setEditingId(null);
    setSaving(false);
  }

  const totalPcsPerSet = compositions.reduce((s, c) => s + c.qty_per_set, 0);

  return (
    <div className="border border-purple-200 rounded-xl overflow-hidden bg-purple-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center gap-2">
          <Package size={13} className="text-purple-700" />
          <span className="text-xs font-semibold text-purple-700">Production Sub-components (Composition)</span>
          {compositions.length > 0 && (
            <span className="text-xs text-purple-600 opacity-70">
              ({compositions.length} components · {totalPcsPerSet} pcs/set)
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAddingNew(true); setSaveError(null); }}
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium transition-colors"
        >
          <Plus size={11} />
          Add Sub-component
        </button>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {/* Info banner */}
        {setType && (
          <div className="flex items-start gap-2 px-2.5 py-2 bg-purple-100/60 border border-purple-200 rounded-lg mb-2">
            <Package size={12} className="text-purple-600 mt-0.5 shrink-0" />
            <p className="text-xs text-purple-700">
              <span className="font-semibold">{setType}</span> — define each sub-unit below. Each component tracks its own qty at every production stage (cutting, stitching, QC, finishing).
            </p>
          </div>
        )}

        {/* Quick-add suggested components based on set type */}
        {setType && SET_TYPE_COMPONENTS[setType] && compositions.length === 0 && !addingNew && !loading && (
          <div className="px-2.5 py-2.5 bg-purple-50 border border-purple-200 rounded-lg mb-2">
            <p className="text-xs font-semibold text-purple-700 mb-2">Quick Add for {setType}</p>
            <div className="flex flex-wrap gap-1.5">
              {SET_TYPE_COMPONENTS[setType].map((comp) => (
                <button
                  key={comp.name}
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setSaving(true);
                    setSaveError(null);
                    const supabase = createClient();
                    const { data, error } = await supabase
                      .from('item_compositions')
                      .insert({
                        style_id: styleId,
                        component_name: comp.name,
                        component_name_normalized: comp.name.toLowerCase(),
                        qty_per_set: comp.qty,
                        unit: comp.unit,
                        sort_order: compositions.length,
                        notes: '',
                      })
                      .select()
                      .single();
                    if (!error && data) {
                      setCompositions((prev) => [...prev, data as ItemComposition]);
                    } else if (error) {
                      setSaveError(error.message || 'Failed to save.');
                    }
                    setSaving(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-purple-300 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
                >
                  <Plus size={10} />
                  {comp.name}
                </button>
              ))}
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  const comps = SET_TYPE_COMPONENTS[setType];
                  setSaving(true);
                  setSaveError(null);
                  const supabase = createClient();
                  const inserts = comps.map((comp, idx) => ({
                    style_id: styleId,
                    component_name: comp.name,
                    component_name_normalized: comp.name.toLowerCase(),
                    qty_per_set: comp.qty,
                    unit: comp.unit,
                    sort_order: idx,
                    notes: '',
                  }));
                  const { data, error } = await supabase
                    .from('item_compositions')
                    .insert(inserts)
                    .select();
                  if (!error && data) {
                    setCompositions(data as ItemComposition[]);
                  } else if (error) {
                    setSaveError(error.message || 'Failed to save.');
                  }
                  setSaving(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
              >
                <Plus size={10} />
                Add All
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {saveError && (
          <div className="flex items-center gap-2 px-2.5 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertTriangle size={12} className="shrink-0" />
            <span>{saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={11} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-purple-600 text-xs">
            <RefreshCw size={12} className="animate-spin" />
            Loading compositions…
          </div>
        ) : compositions.length === 0 && !addingNew ? (
          <div className="py-4 text-center">
            <Package size={24} className="mx-auto text-purple-300 mb-1.5" />
            <p className="text-xs text-purple-600 font-medium">No sub-components defined</p>
            <p className="text-xs text-purple-500 mt-0.5">
              Add components like Kurta, Pant, Dupatta for a 3PC set
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {compositions.map((comp, idx) => (
              <div key={comp.id} className="flex items-center gap-2 px-2.5 py-2 bg-white border border-purple-100 rounded-lg group">
                <GripVertical size={12} className="text-purple-300 shrink-0" />
                <span className="text-xs text-purple-500 w-5 shrink-0 tabular-nums">{idx + 1}.</span>
                {editingId === comp.id ? (
                  <>
                    <select
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 min-w-0"
                      autoFocus
                    >
                      <option value="">-- Component --</option>
                      {COMPONENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="number"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-14 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 text-center"
                      min={1}
                    />
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-16 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button
                      onClick={(e) => { e.stopPropagation(); saveEdit(comp.id); }}
                      type="button"
                      disabled={saving}
                      className="p-1 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      type="button"
                      className="p-1 rounded border border-border text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-800">{comp.component_name}</span>
                    <span className="text-xs text-purple-600 font-semibold tabular-nums">{comp.qty_per_set}</span>
                    <span className="text-xs text-slate-500">{comp.unit}</span>
                    <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">per set</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(comp); }}
                      type="button"
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteComposition(comp.id); }}
                      type="button"
                      className="p-1 rounded text-slate-500 hover:text-danger hover:bg-danger-bg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new row */}
        {addingNew && (
          <div className="flex items-center gap-2 px-2.5 py-2 bg-white border border-purple-300 rounded-lg">
            <Plus size={12} className="text-purple-400 shrink-0" />
            <select
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 min-w-0"
              autoFocus
            >
              <option value="">-- Component --</option>
              {COMPONENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-14 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 text-center"
              min={1}
              placeholder="Qty"
            />
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="w-16 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button
              onClick={(e) => { e.stopPropagation(); addComposition(); }}
              type="button"
              disabled={saving || !newName.trim()}
              className="p-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAddingNew(false); setSaveError(null); }}
              type="button"
              className="p-1 rounded border border-border text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Summary footer */}
        {compositions.length > 0 && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-purple-100/50 rounded-lg mt-1">
            <span className="text-xs text-purple-600 font-medium">Total per set</span>
            <span className="text-xs font-bold text-purple-700 tabular-nums">{totalPcsPerSet} pcs</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Qty Editor ────────────────────────────────────────────────────────

function InlineQtyEditor({
  line,
  onSaved,
}: {
  line: DetailLine;
  onSaved: (id: string, qty: number | null) => void;
}) {
  const [value, setValue] = useState<string>(line.quantity != null ? String(line.quantity) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setValue(line.quantity != null ? String(line.quantity) : '');
  }, [line.quantity]);

  async function persist(raw: string) {
    const parsed = raw.trim() === '' ? null : Number(raw);
    if (parsed === line.quantity) return; // no change
    setSaving(true);
    setError(false);
    const supabase = createClient();
    const { error: err } = await supabase
      .from('item_detail_lines')
      .update({ quantity: parsed, updated_at: new Date().toISOString() })
      .eq('id', line.id);
    setSaving(false);
    if (err) {
      setError(true);
      setValue(line.quantity != null ? String(line.quantity) : '');
    } else {
      setSaved(true);
      onSaved(line.id, parsed);
      setTimeout(() => setSaved(false), 1200);
    }
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <input
        type="number"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(false); setSaved(false); }}
        onBlur={(e) => persist(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        onClick={(e) => e.stopPropagation()}
        className={`w-16 px-1.5 py-0.5 border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums text-center transition-colors ${
          error ? 'border-red-400 bg-red-50' : saved ? 'border-green-400 bg-green-50' : 'border-border'
        }`}
        placeholder="—"
        min={0}
        step="any"
      />
      {saving && <RefreshCw size={10} className="animate-spin text-slate-500 shrink-0" />}
      {saved && !saving && <Check size={10} className="text-green-600 shrink-0" />}
      {error && !saving && <AlertTriangle size={10} className="text-red-500 shrink-0" />}
      {line.unit && <span className="text-xs text-slate-500 shrink-0">{line.unit}</span>}
    </div>
  );
}

// ─── Variant Card Detail Lines ─────────────────────────────────────────────────

const CARD_CATEGORIES: DetailCategory[] = ['fabric_material', 'accessory_raw_material', 'manufacturing_work'];

export function VariantCardDetailLines({
  lines,
  onQtySaved,
}: {
  lines: DetailLine[];
  onQtySaved: (lineId: string, qty: number | null) => void;
}) {
  const relevant = lines.filter((l) => CARD_CATEGORIES.includes(l.category));
  if (relevant.length === 0) return null;

  const grouped = relevant.reduce<Partial<Record<DetailCategory, DetailLine[]>>>((acc, l) => {
    if (!acc[l.category]) acc[l.category] = [];
    acc[l.category]!.push(l);
    return acc;
  }, {});

  return (
    <div className="px-4 pb-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      {CARD_CATEGORIES.map((cat) => {
        const catLines = grouped[cat];
        if (!catLines || catLines.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat} className={`rounded-lg border overflow-hidden ${meta.bg}`}>
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-b ${meta.bg}`}>
              <span className={meta.color}>{meta.icon}</span>
              <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
              <span className={`text-xs ${meta.color} opacity-60`}>({catLines.length})</span>
            </div>
            <div className="px-2.5 py-1.5 space-y-1">
              {catLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2 min-w-0">
                  <span className="flex-1 text-xs text-slate-800 truncate min-w-0">{line.material_name_normalized || line.material_name}</span>
                  <InlineQtyEditor line={line} onSaved={onQtySaved} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Image Upload Component ───────────────────────────────────────────────────

function ItemImage({ variantId, imageUrl, colour, styleNo, onSaved }: {
  variantId: string;
  imageUrl: string;
  colour: string;
  styleNo: string;
  onSaved?: (newUrl: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'url' | 'upload'>('view');
  const [inputUrl, setInputUrl] = useState(imageUrl);
  const [currentUrl, setCurrentUrl] = useState(imageUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentUrl(imageUrl);
    setInputUrl(imageUrl);
    setImgError(false);
  }, [imageUrl]);

  async function persistUrl(url: string) {
    const supabase = createClient();
    await supabase
      .from('item_variants')
      .update({ variant_image_url: url, updated_at: new Date().toISOString() })
      .eq('id', variantId);
    setCurrentUrl(url);
    setImgError(false);
    onSaved?.(url);
  }

  async function saveUrl() {
    setSaving(true);
    await persistUrl(inputUrl.trim());
    setSaving(false);
    setMode('view');
  }

  async function handleFileUpload(file: File) {
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const safeName = `${styleNo || variantId}_${colour.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
      const path = `variants/${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('item-images')
        .upload(path, file, { upsert: true, cacheControl: '3600' });

      if (uploadErr) {
        setUploadError(`Upload failed: ${uploadErr.message}`);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(path);

      await persistUrl(publicUrl);
      setMode('view');
    } catch (err: unknown) {
      setUploadError(`Upload error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  function cancelEdit() {
    setInputUrl(currentUrl);
    setMode('view');
    setUploadError('');
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Image display */}
      <div className="relative w-full aspect-[3/4] max-w-[160px] rounded-xl overflow-hidden border border-border bg-slate-100/30 flex items-center justify-center group">
        {currentUrl && !imgError ? (
          <>
            
            <img
              src={currentUrl}
              alt={`${colour} variant item image`}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <button
              onClick={() => setMode('upload')}
              className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Change image"
            >
              <Pencil size={11} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setMode('upload')}
            className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors p-4 w-full h-full"
          >
            <ImageIcon size={28} className="opacity-40" />
            <span className="text-xs text-center leading-tight">
              {imgError ? 'Image failed' : 'No image'}
              <br />
              <span className="text-primary text-xs">Click to upload</span>
            </span>
          </button>
        )}
      </div>

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="flex flex-col gap-2 max-w-[280px]">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-slate-100/30'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-1.5">
                <RefreshCw size={20} className="animate-spin text-primary" />
                <p className="text-xs text-slate-500">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload size={20} className="text-slate-500" />
                <p className="text-xs text-slate-800 font-medium">Drop image here</p>
                <p className="text-xs text-slate-500">or click to browse</p>
                <p className="text-xs text-slate-500/60">JPG, PNG, WEBP · max 5 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={() => setMode('url')}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <LinkIcon size={11} />
            Paste image URL instead
          </button>

          {uploadError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{uploadError}</p>
          )}

          <button
            onClick={cancelEdit}
            className="flex items-center justify-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X size={10} />
            Cancel
          </button>
        </div>
      )}

      {/* URL mode */}
      {mode === 'url' && (
        <div className="flex flex-col gap-1.5 max-w-[280px]">
          <p className="text-xs text-slate-500 font-medium">Paste image URL:</p>
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveUrl();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveUrl}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
              Save
            </button>
            <button
              onClick={() => setMode('upload')}
              className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Upload size={10} />
              Upload file
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <X size={10} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────

function MeasurementSheet({ variantId, initialUrl }: { variantId: string; initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl || '');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    if (busy) return;
    const allowed = ['pdf','xls','xlsx','csv','jpg','jpeg','png','webp'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowed.includes(ext) || file.size > 10 * 1024 * 1024) { toast.error('Choose a PDF, spreadsheet or image under 10 MB.'); return; }
    setBusy(true);
    try {
      const path = `sheets/${variantId}_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('item-images').upload(path, file);
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('item-images').getPublicUrl(path);
      const saved = await supabase.from('item_variants').update({ measurement_sheet_url: data.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', variantId).select('id').single();
      if (saved.error) throw new Error(saved.error.message);
      setUrl(data.publicUrl); toast.success('Measurement sheet saved');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Sheet upload failed'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  return <div className="mt-3 flex flex-col gap-2">
    {/^https?:\/\//.test(url) && <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View measurement sheet</a>}
    <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? 'Uploading…' : url ? 'Replace measurement sheet' : 'Add measurement sheet'}</button>
    <input ref={inputRef} className="hidden" type="file" accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp" onChange={e => { const file=e.target.files?.[0]; if(file) void upload(file); }} />
  </div>;
}

export function ItemDetailModal({
  variant,
  onClose,
  onImageSaved,
  onVariantUpdated,
}: {
  variant: Variant;
  onClose: () => void;
  onImageSaved: (variantId: string, newUrl: string) => void;
  onVariantUpdated?: (updated: Partial<Variant> & { id: string }) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editColour, setEditColour] = useState(variant.colour);
  const [editStyleNo, setEditStyleNo] = useState(variant.style_no || '');
  const [editSetType, setEditSetType] = useState(variant.set_type || '');
  const [editLines, setEditLines] = useState<DetailLine[]>(variant.item_detail_lines);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const grouped = groupLinesByCategory(editMode ? editLines : variant.item_detail_lines);
  const reviewCount = variant.item_detail_lines.filter((l) => l.review_status !== 'ok').length;

  function startEdit() {
    setEditColour(variant.colour);
    setEditStyleNo(variant.style_no || '');
    setEditSetType(variant.set_type || '');
    setEditLines(variant.item_detail_lines.map((l) => ({ ...l })));
    setSaveError('');
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSaveError('');
  }

  function updateLine(id: string, field: keyof DetailLine, value: string | number | null) {
    setEditLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  async function saveEdit() {
    if (!editColour.trim()) {
      setSaveError('Colour is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const supabase = createClient();

      const changedLines = editLines.filter(line => {
        const original = variant.item_detail_lines.find(l => l.id === line.id);
        return !original || ['material_name_normalized','quantity','unit','secondary_quantity','secondary_unit','notes']
          .some(field => original[field as keyof DetailLine] !== line[field as keyof DetailLine]);
      });
      const { error } = await supabase.rpc('edit_original_item_variant', {
        p_variant_id: variant.id,
        p_header: { colour: editColour.trim(), style_no: editStyleNo.trim(), set_type: editSetType.trim() },
        p_lines: changedLines.map(line => ({ id: line.id, material_name_normalized: line.material_name_normalized,
          quantity: line.quantity, unit: line.unit, secondary_quantity: line.secondary_quantity,
          secondary_unit: line.secondary_unit, notes: line.notes })),
      });
      if (error) throw new Error(error.message);

      onVariantUpdated?.({
        id: variant.id,
        colour: editColour.trim(),
        style_no: editStyleNo.trim() || '',
        set_type: editSetType.trim() || '',
        item_detail_lines: editLines,
      });
      setEditMode(false);
    } catch (err: unknown) {
      setSaveError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editMode) cancelEdit();
        else onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, editMode]);

  const matchBadge = (level: string, status: string) => {
    if (status === 'linked' || level === 'exact_variant') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={10} />Linked to Existing Item</span>;
    }
    if (level === 'parent_match') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Layers size={10} />Parent Matched</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"><Tag size={10} />Created from RANGRAAHI Import</span>;
  };

  const displayColour = editMode ? editColour : variant.colour;
  const displayStyleNo = editMode ? editStyleNo : (variant.style_no || '');
  const styleId = variant.item_styles?.id || '';
  const setType = editMode ? editSetType : (variant.set_type || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-xl shadow-modal w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-border">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-100/20 shrink-0">
          <div className="flex items-center gap-3">
            {variant.variant_image_url ? (
              <img
                src={variant.variant_image_url}
                alt={`${variant.colour} thumbnail`}
                className="w-9 h-11 object-cover rounded-lg border border-border shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-9 h-11 rounded-lg border border-dashed border-border bg-slate-100/30 flex items-center justify-center shrink-0">
                <ImageIcon size={14} className="text-slate-500/40" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-800">{displayStyleNo || displayColour}</h2>
              {variant.colour && (
                <p className="text-xs text-slate-500 font-mono">{displayColour}</p>
              )}
            </div>
            {(editMode ? editSetType : variant.set_type) && (
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                {editMode ? editSetType : variant.set_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              >
                <Pencil size={13} />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body — scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Save error */}
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertTriangle size={13} />
              {saveError}
            </div>
          )}

          {/* Image + Meta row */}
          <div className="flex gap-6 flex-wrap">
            {/* Item image */}
            <div className="shrink-0">
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Item Image</p>
              <ItemImage
                variantId={variant.id}
                imageUrl={variant.variant_image_url || ''}
                colour={variant.colour}
                styleNo={variant.style_no || ''}
                onSaved={(url) => onImageSaved(variant.id, url)}
              />
              <MeasurementSheet variantId={variant.id} initialUrl={variant.measurement_sheet_url} />
            </div>

            {/* Meta info */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Primary info */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 font-medium">Item Details</p>
                {editMode ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 font-medium">Colour <span className="text-red-500">*</span></label>
                      <select
                        value={editColour}
                        onChange={(e) => setEditColour(e.target.value)}
                        className="px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">— Select Colour —</option>
                        {COLOUR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 font-medium">Style No.</label>
                      <input
                        type="text"
                        value={editStyleNo}
                        onChange={(e) => setEditStyleNo(e.target.value)}
                        className="px-2.5 py-1.5 border border-border rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="e.g. RNG-001"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 font-medium">Set Type</label>
                      <select
                        value={editSetType}
                        onChange={(e) => setEditSetType(e.target.value)}
                        className="px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">— Select —</option>
                        {SET_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Colour</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{variant.colour}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Style No.</p>
                      <p className="text-sm font-medium text-slate-800 font-mono mt-0.5">{variant.style_no || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Set Type</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{variant.set_type || '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status + match */}
              <div className="flex items-center gap-2 flex-wrap">
                {matchBadge(variant.match_level, variant.variant_status)}
                {reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    <AlertTriangle size={10} />
                    {reviewCount} lines need review
                  </span>
                )}
              </div>

              {/* Reference info */}
              <div className="border-t border-border/50 pt-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 font-medium">Reference Info</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-500">Job Card Ref: </span>
                    <span className="text-slate-800 font-medium">{variant.job_card_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Source Rows: </span>
                    <span className="text-slate-800 font-medium">{variant.source_row_start}–{variant.source_row_end}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Updated: </span>
                    <span className="text-slate-800 font-medium">{new Date(variant.updated_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Source: </span>
                    <span className="text-slate-800 font-medium">{variant.import_source}</span>
                  </div>
                  {variant.item_styles?.linked_job_card_id && (
                    <div>
                      <span className="text-slate-500">Linked JC: </span>
                      <Link
                        href={`/job-cards`}
                        className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        JC {variant.job_card_no} <ExternalLink size={10} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Production Sub-components (Composition Manager) ── */}
          {styleId && (
            <CompositionManager styleId={styleId} setType={setType} />
          )}

          {/* Detail sections by category */}
          {(Object.keys(CATEGORY_META) as DetailCategory[]).map((cat) => {
            const lines = grouped[cat];
            if (!lines || lines.length === 0) return null;
            const meta = CATEGORY_META[cat];

            // Skip product_composition category — handled by CompositionManager above
            if (cat === 'product_composition') return null;

            return (
              <div key={cat} className={`border rounded-xl overflow-hidden ${meta.bg}`}>
                <div className={`flex items-center gap-2 px-3 py-2 border-b ${meta.bg}`}>
                  <span className={meta.color}>{meta.icon}</span>
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className={`text-xs ${meta.color} opacity-70`}>({lines.length})</span>
                </div>

                {cat === 'accessory_raw_material' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left px-3 py-2 font-medium text-slate-500">Material</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-500">Qty</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-500">Unit</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-500">2nd Qty</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-500">2nd Unit</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-500">Status</th>
                          {!editMode && <th className="text-left px-3 py-2 font-medium text-slate-500">Source Text</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id} className="border-b border-border/30 last:border-0">
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {editMode ? (
                                <input
                                  type="text"
                                  value={line.material_name_normalized}
                                  onChange={(e) => updateLine(line.id, 'material_name_normalized', e.target.value)}
                                  className="w-full px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]"
                                />
                              ) : line.material_name_normalized}
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {editMode ? (
                                <input
                                  type="number"
                                  value={line.quantity ?? ''}
                                  onChange={(e) => updateLine(line.id, 'quantity', e.target.value === '' ? null : Number(e.target.value))}
                                  className="w-20 px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  placeholder="—"
                                />
                              ) : (line.quantity ?? <span className="text-slate-500 italic">—</span>)}
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {editMode ? (
                                <select
                                  value={line.unit}
                                  onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                                  className="w-20 px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                  <option value="">—</option>
                                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              ) : (line.unit || <span className="text-slate-500 italic">—</span>)}
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {editMode ? (
                                <input
                                  type="number"
                                  value={line.secondary_quantity ?? ''}
                                  onChange={(e) => updateLine(line.id, 'secondary_quantity', e.target.value === '' ? null : Number(e.target.value))}
                                  className="w-20 px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  placeholder="—"
                                />
                              ) : (line.secondary_quantity ?? <span className="text-slate-500 italic">—</span>)}
                            </td>
                            <td className="px-3 py-2 text-slate-800">
                              {editMode ? (
                                <select
                                  value={line.secondary_unit}
                                  onChange={(e) => updateLine(line.id, 'secondary_unit', e.target.value)}
                                  className="w-20 px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                  <option value="">—</option>
                                  {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                              ) : (line.secondary_unit || <span className="text-slate-500 italic">—</span>)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${REVIEW_BADGE[line.review_status] || 'bg-gray-100 text-gray-600'}`}>
                                {line.review_status === 'quantity_required' && <AlertTriangle size={9} />}
                                {line.review_status.replace('_', ' ')}
                              </span>
                              {line.review_note && (
                                <p className="text-slate-500 mt-0.5 text-xs">{line.review_note}</p>
                              )}
                            </td>
                            {!editMode && <td className="px-3 py-2 text-slate-500 font-mono">{line.source_text}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-2">
                    {lines.map((line) => (
                      editMode ? (
                        <div key={line.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1.5 border-b border-border/30 last:border-0">
                          <div className="sm:col-span-2 flex flex-col gap-0.5">
                            <label className="text-xs text-slate-500">Material</label>
                            <input
                              type="text"
                              value={line.material_name_normalized}
                              onChange={(e) => updateLine(line.id, 'material_name_normalized', e.target.value)}
                              className="px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs text-slate-500">Qty</label>
                            <input
                              type="number"
                              value={line.quantity ?? ''}
                              onChange={(e) => updateLine(line.id, 'quantity', e.target.value === '' ? null : Number(e.target.value))}
                              className="px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                              placeholder="—"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-xs text-slate-500">Unit</label>
                            <select
                              value={line.unit}
                              onChange={(e) => updateLine(line.id, 'unit', e.target.value)}
                              className="px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              <option value="">—</option>
                              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          {line.review_status !== 'ok' && (
                            <div className="sm:col-span-4">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${REVIEW_BADGE[line.review_status]}`}>
                                <AlertTriangle size={9} />
                                {line.review_status.replace('_', ' ')}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div key={line.id} className="flex items-center justify-between">
                          <span className="text-sm text-slate-800">{line.material_name_normalized}</span>
                          {line.review_status !== 'ok' && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${REVIEW_BADGE[line.review_status]}`}>
                              <AlertTriangle size={9} />
                              {line.review_status.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Helper (used by modal, defined outside to avoid re-creation) ─────────────

function groupLinesByCategory(lines: DetailLine[]) {
  const groups: Partial<Record<DetailCategory, DetailLine[]>> = {};
  for (const line of lines) {
    if (!groups[line.category]) groups[line.category] = [];
    groups[line.category]!.push(line);
  }
  return groups;
}

// ─── Merge Duplicates Modal ───────────────────────────────────────────────────

interface DuplicateGroup {
  styleName: string;
  styles: Array<{
    id: string;
    job_card_no: string;
    design_code: string;
    style_no: string;
    set_type: string;
    linked_job_card_id: string | null;
    primary_image_url: string;
    variantCount: number;
    compositionCount: number;
  }>;
  keeperId: string; // the one we keep (most complete)
  duplicateIds: string[]; // the ones we delete
}

export function MergeDuplicatesModal({ onClose, onMerged }: { onClose: () => void; onMerged: () => void }) {
  const [scanning, setScanning] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeResult, setMergeResult] = useState<{ merged: number; removed: number } | null>(null);

  useEffect(() => {
    async function scan() {
      setScanning(true);
      const supabase = createClient();

      // Fetch all item_styles with variant and composition counts
      const { data: styles, error } = await supabase
        .from('item_styles')
        .select('id, job_card_no, design_code, style_no, set_type, linked_job_card_id, primary_image_url')
        .order('created_at', { ascending: true });

      if (error || !styles) {
        setMergeError(error?.message || 'Could not scan items');
        setScanning(false);
        return;
      }

      // Count variants per style
      const { data: variantCounts, error: variantCountError } = await supabase
        .from('item_variants')
        .select('style_id');

      // Count compositions per style
      const { data: compositionCounts, error: compositionCountError } = await supabase
        .from('item_compositions')
        .select('style_id');

      if (variantCountError || compositionCountError) { setMergeError(variantCountError?.message || compositionCountError?.message || 'Count failed'); setScanning(false); return; }
      const variantMap: Record<string, number> = {};
      for (const v of variantCounts || []) {
        variantMap[v.style_id] = (variantMap[v.style_id] || 0) + 1;
      }
      const compositionMap: Record<string, number> = {};
      for (const c of compositionCounts || []) {
        compositionMap[c.style_id] = (compositionMap[c.style_id] || 0) + 1;
      }

      // Group by job_card_no (style name)
      const nameMap: Record<string, typeof styles> = {};
      for (const s of styles) {
        const key = (s.job_card_no || '').trim().toLowerCase();
        if (!key) continue;
        if (!nameMap[key]) nameMap[key] = [];
        nameMap[key].push(s);
      }

      const duplicateGroups: DuplicateGroup[] = [];
      for (const [, group] of Object.entries(nameMap)) {
        if (group.length < 2) continue;

        // Score each style: more variants + compositions + filled fields = higher score
        const scored = group.map((s) => {
          const vCount = variantMap[s.id] || 0;
          const cCount = compositionMap[s.id] || 0;
          const fieldScore =
            (s.design_code ? 1 : 0) +
            (s.style_no ? 1 : 0) +
            (s.set_type ? 1 : 0) +
            (s.linked_job_card_id ? 2 : 0) +
            (s.primary_image_url ? 1 : 0);
          return { ...s, variantCount: vCount, compositionCount: cCount, score: vCount * 3 + cCount * 2 + fieldScore };
        });

        // Sort descending by score — first is keeper
        scored.sort((a, b) => b.score - a.score);
        const keeper = scored[0];
        const duplicates = scored.slice(1);

        duplicateGroups.push({
          styleName: group[0].job_card_no,
          styles: scored.map(({ score: _s, ...rest }) => rest),
          keeperId: keeper.id,
          duplicateIds: duplicates.map((d) => d.id),
        });
      }

      setGroups(duplicateGroups);
      setScanning(false);
    }
    scan();
  }, []);

  async function executeMerge() {
    if (groups.length === 0 || merging) return;
    setMerging(true); setMergeError('');
    try {
      const { data, error } = await supabase.rpc('merge_original_item_styles', {
        p_groups: groups.map(g => ({ keeperId: g.keeperId, duplicateIds: g.duplicateIds })),
      });
      if (error) throw new Error(error.message);
      setMergeResult(data as { merged: number; removed: number });
    } catch (err) { setMergeError(err instanceof Error ? err.message : 'Merge failed'); }
    finally { setMerging(false); }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !merging) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-xl shadow-modal w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-100/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <GitMerge size={18} className="text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">Merge Duplicate Items</h2>
              <p className="text-xs text-slate-500">Same style name → combine into one record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={merging}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {scanning ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-500">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm">Scanning for duplicates…</span>
            </div>
          ) : mergeResult ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
              <p className="text-base font-semibold text-slate-800">Merge Complete</p>
              <p className="text-sm text-slate-500 text-center">
                Merged <span className="font-semibold text-slate-800">{mergeResult.merged}</span> duplicate style{mergeResult.merged !== 1 ? 's' : ''} into their primary records.
                <br />
                Removed <span className="font-semibold text-slate-800">{mergeResult.removed}</span> duplicate entr{mergeResult.removed !== 1 ? 'ies' : 'y'}.
              </p>
              <button
                onClick={() => { onMerged(); onClose(); }}
                className="mt-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Done — Refresh Item Master
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
              <p className="text-sm font-semibold text-slate-800">No duplicates found</p>
              <p className="text-xs text-slate-500">All item master records have unique style names.</p>
            </div>
          ) : (
            <>
              {/* Error */}
              {mergeError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  {mergeError}
                </div>
              )}

              {/* Info banner */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold mb-0.5">Found {groups.length} duplicate group{groups.length !== 1 ? 's' : ''}</p>
                  <p>The <span className="font-semibold">✓ Keep</span> record (most complete) will absorb all variants and compositions from duplicates. Duplicate records will be deleted.</p>
                </div>
              </div>

              {/* Duplicate groups */}
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group.styleName} className="border border-border rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-slate-100/30 border-b border-border">
                      <span className="text-sm font-semibold text-slate-800">{group.styleName}</span>
                      <span className="ml-2 text-xs text-slate-500">{group.styles.length} records → will become 1</span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {group.styles.map((style) => {
                        const isKeeper = style.id === group.keeperId;
                        return (
                          <div key={style.id} className={`flex items-center gap-3 px-3 py-2.5 ${isKeeper ? 'bg-green-50/60' : 'bg-red-50/30'}`}>
                            <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isKeeper ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {isKeeper ? '✓' : '×'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${isKeeper ? 'text-green-700' : 'text-red-600'}`}>
                                  {isKeeper ? 'Keep' : 'Remove'}
                                </span>
                                {style.design_code && <span className="text-xs text-slate-500 font-mono">{style.design_code}</span>}
                                {style.style_no && <span className="text-xs text-slate-500">{style.style_no}</span>}
                                {style.set_type && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{style.set_type}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                <span>{style.variantCount} variant{style.variantCount !== 1 ? 's' : ''}</span>
                                <span>{style.compositionCount} composition{style.compositionCount !== 1 ? 's' : ''}</span>
                                {style.linked_job_card_id && <span className="text-blue-600">linked to JC</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!scanning && !mergeResult && groups.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-slate-100/10 shrink-0">
            <button
              onClick={onClose}
              disabled={merging}
              className="px-4 py-2 border border-border rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={executeMerge}
              disabled={merging}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {merging ? (
                <><RefreshCw size={14} className="animate-spin" />Merging…</>
              ) : (
                <><GitMerge size={14} />Merge {groups.reduce((s, g) => s + g.duplicateIds.length, 0)} Duplicate{groups.reduce((s, g) => s + g.duplicateIds.length, 0) !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Item Modal ───────────────────────────────────────────────────────────

export function NewItemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [colour, setColour] = useState('');
  const [styleNo, setStyleNo] = useState('');
  const [setType, setSetType] = useState('');
  const [saving, setSaving] = useState(false);
  const requestKey = useRef(`manual_${crypto.randomUUID()}`);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState('');

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageDragOver, setImageDragOver] = useState(false);
  const [imageError, setImageError] = useState('');
  const newItemFileInputRef = useRef<HTMLInputElement>(null);

  // Measurement sheet upload state
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetError, setSheetError] = useState('');
  const [sheetDragOver, setSheetDragOver] = useState(false);
  const sheetFileInputRef = useRef<HTMLInputElement>(null);

  // Detail lines state
  type NewLine = { id: string; category: DetailCategory; material_name_normalized: string; quantity: string; unit: string; secondary_quantity: string; secondary_unit: string };
  const [lines, setLines] = useState<NewLine[]>([]);
  const [addingCategory, setAddingCategory] = useState<DetailCategory | ''>('');

  // Production Sub-components (Composition) state — separate from detail lines
  type NewComposition = { id: string; component_name: string; qty_per_set: string; unit: string };
  const [compositions, setCompositions] = useState<NewComposition[]>([]);
  const [addingSubUnit, setAddingSubUnit] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubQty, setNewSubQty] = useState('1');
  const [newSubUnit, setNewSubUnit] = useState('Pcs');

  function handleImageFileSelect(file: File) {
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5 MB.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function onNewItemFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageFileSelect(file);
  }

  function onNewItemDrop(e: React.DragEvent) {
    e.preventDefault();
    setImageDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFileSelect(file);
  }

  function removeSelectedImage() {
    setImageFile(null);
    setImagePreview('');
    setImageError('');
    if (newItemFileInputRef.current) newItemFileInputRef.current.value = '';
  }

  function handleSheetFileSelect(file: File) {
    setSheetError('');
    const allowed = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|xls|xlsx|csv|jpg|jpeg|png|webp)$/i)) {
      setSheetError('Allowed: PDF, Excel, CSV, or image files.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSheetError('File must be under 10 MB.');
      return;
    }
    setSheetFile(file);
  }

  function onSheetFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleSheetFileSelect(file);
  }

  function onSheetDrop(e: React.DragEvent) {
    e.preventDefault();
    setSheetDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSheetFileSelect(file);
  }

  function removeSelectedSheet() {
    setSheetFile(null);
    setSheetError('');
    if (sheetFileInputRef.current) sheetFileInputRef.current.value = '';
  }

  function addLine(cat: DetailCategory) {
    setLines((prev) => [
      ...prev,
      { id: `new-${Date.now()}-${Math.random()}`, category: cat, material_name_normalized: '', quantity: '', unit: '', secondary_quantity: '', secondary_unit: '' },
    ]);
    setAddingCategory('');
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, field: keyof NewLine, value: string) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function addSubUnit() {
    if (!newSubName.trim()) return;
    setCompositions((prev) => [
      ...prev,
      { id: `sub-${Date.now()}-${Math.random()}`, component_name: newSubName.trim(), qty_per_set: newSubQty || '1', unit: newSubUnit || 'Pcs' },
    ]);
    setNewSubName('');
    setNewSubQty('1');
    setNewSubUnit('Pcs');
    setAddingSubUnit(false);
  }

  function removeSubUnit(id: string) {
    setCompositions((prev) => prev.filter((c) => c.id !== id));
  }

  function quickAddSubUnits(comps: { name: string; qty: number; unit: string }[]) {
    setCompositions(comps.map((c, idx) => ({
      id: `sub-quick-${idx}-${Date.now()}`,
      component_name: c.name,
      qty_per_set: String(c.qty),
      unit: c.unit,
    })));
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !savingRef.current) onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !savingRef.current) onClose();
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!colour.trim()) { setSaveError('Colour is required.'); return; }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const supabase = createClient();

      const importKey = requestKey.current;
      const variantKey = `${importKey}_${colour.trim().replace(/\s+/g, '_').toUpperCase()}`;
      const result = await saveOriginalItem({
        job_card_no: styleNo.trim() || colour.trim(),
        design_code: styleNo.trim() || colour.trim(),
        style_no: styleNo.trim() || null, set_type: setType.trim() || null,
        import_key: importKey,
        _compositions: compositions.map((c, idx) => ({
          component_name: c.component_name, qty_per_set: Number(c.qty_per_set),
          unit: c.unit || 'Pcs', sort_order: idx,
        })),
      }, [{
        colour: colour.trim(), style_no: styleNo.trim(), set_type: setType.trim(), import_key: variantKey,
        _details: lines.filter(l => l.material_name_normalized.trim()).map((l, idx) => ({
          category: l.category, material_name: l.material_name_normalized.trim(),
          material_name_normalized: l.material_name_normalized.trim(),
          quantity: l.quantity || null, unit: l.unit.trim() || '',
          secondary_quantity: l.secondary_quantity || null, secondary_unit: l.secondary_unit.trim() || '',
          notes: '', source_text: l.material_name_normalized.trim(), source_row: idx,
          import_key: `${variantKey}_line_${idx}`,
        })),
      }]);
      const variantData = { id: result.variant_ids[0] };

      // 2b. Upload image if selected
      if (imageFile && variantData?.id) {
        try {
          const ext = imageFile.name.split('.').pop() || 'jpg';
          const safeName = `${styleNo.trim() || variantData.id}_${colour.trim().replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
          const path = `variants/${safeName}`;
          const { error: uploadErr } = await supabase.storage
            .from('item-images')
            .upload(path, imageFile, { upsert: true, cacheControl: '3600' });
          if (uploadErr) toast.warning(`Item saved, image upload failed: ${uploadErr.message}`);
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path);
            await supabase.from('item_variants').update({ variant_image_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', variantData.id);
          }
        } catch { toast.warning('Item saved, but its image was not uploaded. Open the item to retry.'); }
      }

      // 2c. Upload measurement sheet if selected
      if (sheetFile && variantData?.id) {
        try {
          const ext = sheetFile.name.split('.').pop() || 'pdf';
          const safeName = `sheets/${styleNo.trim() || variantData.id}_${colour.trim().replace(/\s+/g, '_')}_sheet_${Date.now()}.${ext}`;
          const { error: sheetUploadErr } = await supabase.storage
            .from('item-images')
            .upload(safeName, sheetFile, { upsert: true, cacheControl: '3600' });
          if (sheetUploadErr) toast.warning(`Item saved, measurement-sheet upload failed: ${sheetUploadErr.message}`);
          if (!sheetUploadErr) {
            const { data: { publicUrl: sheetUrl } } = supabase.storage.from('item-images').getPublicUrl(safeName);
            await supabase.from('item_variants').update({ measurement_sheet_url: sheetUrl, updated_at: new Date().toISOString() }).eq('id', variantData.id);
          }
        } catch { toast.warning('Item saved, but its measurement sheet was not uploaded.'); }
      }

      onCreated();
      onClose();
    } catch (err: unknown) {
      setSaveError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof PendingItemSaveError) {
        toast.error(err.message, { duration: Infinity, action: { label: 'Recover previous save', onClick: () => {
          if (savingRef.current) return;
          savingRef.current = true; setSaving(true);
          void recoverPendingItemSave().then(() => {
            toast.success('Previous item save confirmed. Open the saved item to check attachments or make further changes.');
            onCreated(); onClose();
          }).catch((e: unknown) => setSaveError(e instanceof Error ? e.message : 'Recovery failed'))
            .finally(() => { savingRef.current = false; setSaving(false); });
        } } });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const groupedLines = lines.reduce<Partial<Record<DetailCategory, NewLine[]>>>((acc, l) => {
    if (!acc[l.category]) acc[l.category] = [];
    acc[l.category]!.push(l);
    return acc;
  }, {});

  const totalPcsPerSet = compositions.reduce((s, c) => s + (parseInt(c.qty_per_set) || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-slate-100/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-11 rounded-lg border border-dashed border-border bg-slate-100/30 flex items-center justify-center shrink-0">
              <Package size={16} className="text-slate-500/50" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">New Item</h2>
              <p className="text-xs text-slate-500">Create a new item manually</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? 'Saving…' : 'Create Item'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertTriangle size={13} />
              {saveError}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">Item Image <span className="normal-case text-slate-500/60">(optional)</span></p>
            {imagePreview ? (
              <div className="flex items-start gap-3">
                <div className="relative w-[100px] h-[130px] rounded-xl overflow-hidden border border-border bg-slate-100/30 shrink-0">
                  
                  <img src={imagePreview} alt="Item preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs text-slate-800 font-medium">{imageFile?.name}</p>
                  <p className="text-xs text-slate-500">{imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ''}</p>
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={10} />
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => newItemFileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <Upload size={10} />
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                onDragLeave={() => setImageDragOver(false)}
                onDrop={onNewItemDrop}
                onClick={() => newItemFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors max-w-[280px] ${
                  imageDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-slate-100/30'
                }`}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Upload size={20} className="text-slate-500" />
                  <p className="text-xs text-slate-800 font-medium">Drop image here</p>
                  <p className="text-xs text-slate-500">or click to browse</p>
                  <p className="text-xs text-slate-500/60">JPG, PNG, WEBP · max 5 MB</p>
                </div>
              </div>
            )}
            <input
              ref={newItemFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onNewItemFileChange}
            />
            {imageError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mt-2 max-w-[280px]">{imageError}</p>
            )}
          </div>

          {/* Measurement Sheet Upload */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">Measurement Sheet <span className="normal-case text-slate-500/60">(optional)</span></p>
            {sheetFile ? (
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-[100px] h-[80px] rounded-xl border border-border bg-slate-100/30 shrink-0">
                  <Layers size={28} className="text-slate-500" />
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs text-slate-800 font-medium">{sheetFile.name}</p>
                  <p className="text-xs text-slate-500">{`${(sheetFile.size / 1024).toFixed(0)} KB`}</p>
                  <button
                    type="button"
                    onClick={removeSelectedSheet}
                    className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={10} />
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => sheetFileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-md text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <Upload size={10} />
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setSheetDragOver(true); }}
                onDragLeave={() => setSheetDragOver(false)}
                onDrop={onSheetDrop}
                onClick={() => sheetFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors max-w-[280px] ${
                  sheetDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-slate-100/30'
                }`}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Layers size={20} className="text-slate-500" />
                  <p className="text-xs text-slate-800 font-medium">Drop sheet here</p>
                  <p className="text-xs text-slate-500">or click to browse</p>
                  <p className="text-xs text-slate-500/60">PDF, Excel, CSV, Image · max 10 MB</p>
                </div>
              </div>
            )}
            <input
              ref={sheetFileInputRef}
              type="file"
              accept=".pdf,.xls,.xlsx,.csv,image/*"
              className="hidden"
              onChange={onSheetFileChange}
            />
            {sheetError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mt-2 max-w-[280px]">{sheetError}</p>
            )}
          </div>

          {/* Core Fields */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-medium">Item Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">Colour <span className="text-red-500">*</span></label>
                <select
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  className="px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                >
                  <option value="">— Select Colour —</option>
                  {COLOUR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">Style No.</label>
                <input
                  type="text"
                  value={styleNo}
                  onChange={(e) => setStyleNo(e.target.value)}
                  className="px-2.5 py-1.5 border border-border rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. RNG-001"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">Set Type</label>
                <select
                  value={setType}
                  onChange={(e) => setSetType(e.target.value)}
                  className="px-2.5 py-1.5 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Select —</option>
                  {SET_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Production Sub-components (Composition) — matches CompositionManager style */}
          <div className="border border-purple-200 rounded-xl overflow-hidden bg-purple-50">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-purple-200 bg-purple-50">
              <div className="flex items-center gap-2">
                <Package size={13} className="text-purple-700" />
                <span className="text-xs font-semibold text-purple-700">Production Sub-components (Composition)</span>
                {compositions.length > 0 && (
                  <span className="text-xs text-purple-600 opacity-70">
                    ({compositions.length} components · {totalPcsPerSet} pcs/set)
                  </span>
                )}
              </div>
              <button
                onClick={() => setAddingSubUnit(true)}
                type="button"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium transition-colors"
              >
                <Plus size={11} />
                Add Sub-component
              </button>
            </div>

            <div className="px-3 py-2 space-y-1.5">
              {/* Info banner when set type is selected */}
              {setType && (
                <div className="flex items-start gap-2 px-2.5 py-2 bg-purple-100/60 border border-purple-200 rounded-lg mb-2">
                  <Package size={12} className="text-purple-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-purple-700">
                    <span className="font-semibold">{setType}</span> — define each sub-unit below. Each component tracks its own qty at every production stage (cutting, stitching, QC, finishing).
                  </p>
                </div>
              )}

              {/* Quick-add suggestions based on set type */}
              {setType && SET_TYPE_COMPONENTS[setType] && compositions.length === 0 && !addingSubUnit && (
                <div className="px-2.5 py-2.5 bg-purple-50 border border-purple-200 rounded-lg mb-2">
                  <p className="text-xs font-semibold text-purple-700 mb-2">Quick Add for {setType}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SET_TYPE_COMPONENTS[setType].map((comp) => (
                      <button
                        key={comp.name}
                        type="button"
                        onClick={() => setCompositions((prev) => [
                          ...prev,
                          { id: `sub-quick-${comp.name}-${Date.now()}`, component_name: comp.name, qty_per_set: String(comp.qty), unit: comp.unit },
                        ])}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-purple-300 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
                      >
                        <Plus size={10} />
                        {comp.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => quickAddSubUnits(SET_TYPE_COMPONENTS[setType])}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
                    >
                      <Plus size={10} />
                      Add All
                    </button>
                  </div>
                </div>
              )}

              {/* Composition list */}
              {compositions.length === 0 && !addingSubUnit ? (
                <div className="py-4 text-center">
                  <Package size={24} className="mx-auto text-purple-300 mb-1.5" />
                  <p className="text-xs text-purple-600 font-medium">No sub-components defined</p>
                  <p className="text-xs text-purple-500 mt-0.5">
                    Add components like Kurta, Pant, Dupatta for a 3PC set
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {compositions.map((comp, idx) => (
                    <div key={comp.id} className="flex items-center gap-2 px-2.5 py-2 bg-white border border-purple-100 rounded-lg group">
                      <GripVertical size={12} className="text-purple-300 shrink-0" />
                      <span className="text-xs text-purple-500 w-5 shrink-0 tabular-nums">{idx + 1}.</span>
                      <span className="flex-1 text-sm font-medium text-slate-800">{comp.component_name}</span>
                      <span className="text-xs text-purple-600 font-semibold tabular-nums">{comp.qty_per_set}</span>
                      <span className="text-xs text-slate-500">{comp.unit}</span>
                      <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">per set</span>
                      <button
                        onClick={() => removeSubUnit(comp.id)}
                        type="button"
                        className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new sub-unit row */}
              {addingSubUnit && (
                <div className="flex items-center gap-2 px-2.5 py-2 bg-white border border-purple-300 rounded-lg">
                  <Plus size={12} className="text-purple-400 shrink-0" />
                  <select
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="flex-1 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 min-w-0"
                    autoFocus
                  >
                    <option value="">-- Component --</option>
                    {COMPONENT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="number"
                    value={newSubQty}
                    onChange={(e) => setNewSubQty(e.target.value)}
                    className="w-14 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 text-center"
                    min={1}
                    placeholder="Qty"
                  />
                  <select
                    value={newSubUnit}
                    onChange={(e) => setNewSubUnit(e.target.value)}
                    className="w-16 px-2 py-1 border border-purple-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button
                    onClick={addSubUnit}
                    type="button"
                    disabled={!newSubName.trim()}
                    className="p-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    onClick={() => { setAddingSubUnit(false); setNewSubName(''); setNewSubQty('1'); setNewSubUnit('Pcs'); }}
                    type="button"
                    className="p-1 rounded border border-border text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {/* Summary footer */}
              {compositions.length > 0 && (
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-purple-100/50 rounded-lg mt-1">
                  <span className="text-xs text-purple-600 font-medium">Total per set</span>
                  <span className="text-xs font-bold text-purple-700 tabular-nums">{totalPcsPerSet} pcs</span>
                </div>
              )}
            </div>
          </div>

          {/* Detail Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Specifications / Detail Lines</p>
              <span className="text-xs text-slate-500">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Grouped lines by category */}
            {(Object.keys(CATEGORY_META) as DetailCategory[]).map((cat) => {
              if (cat === 'product_composition' || cat === 'production_sub_unit') return null;
              const catLines = groupedLines[cat] || [];
              const meta = CATEGORY_META[cat];
              if (catLines.length === 0) return null;
              return (
                <div key={cat} className={`border rounded-xl overflow-hidden mb-3 ${meta.bg}`}>
                  <div className={`flex items-center gap-2 px-3 py-2 border-b ${meta.bg}`}>
                    <span className={meta.color}>{meta.icon}</span>
                    <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className={`text-xs ${meta.color} opacity-70`}>({catLines.length})</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {catLines.map((line) => (
                      <div key={line.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={line.material_name_normalized}
                          onChange={(e) => updateLine(line.id, 'material_name_normalized', e.target.value)}
                          placeholder="Material name"
                          className="px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add line buttons — exclude product_composition and production_sub_unit */}
            <div className="flex flex-wrap gap-2 mt-2">
              {(Object.keys(CATEGORY_META) as DetailCategory[]).filter((c) => c !== 'product_composition' && c !== 'production_sub_unit').map((cat) => {
                const meta = CATEGORY_META[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => addLine(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${meta.bg} ${meta.color} border-current/20 hover:opacity-80`}
                  >
                    <Plus size={11} />
                    Add {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column headers hint */}
          {lines.length > 0 && (
            <div className="grid grid-cols-[1fr_60px_80px_60px_auto] gap-2 px-0.5">
              {['Material Name', 'Unit', '2nd Qty', '2nd Unit', ''].map((h, i) => (
                <span key={i} className="text-xs text-slate-500/60 font-medium">{h}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete Item Modal ────────────────────────────────────────────────────────

interface DependencyRef {
  type: string;
  label: string;
  ref: string;
}

export function DeleteItemModal({
  variant,
  onClose,
  onDeleted,
}: {
  variant: Variant;
  onClose: () => void;
  onDeleted: (variantId: string) => void;
}) {
  const [checking, setChecking] = useState(true);
  const [dependencies, setDependencies] = useState<DependencyRef[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [dependencyError, setDependencyError] = useState('');

  useEffect(() => {
    async function checkDependencies() {
      setChecking(true);
      const supabase = createClient();
      const refs: DependencyRef[] = [];
      const jobCardNo = variant.job_card_no;
      const styleName = variant.style_no || variant.job_card_no;
      const styleId = variant.item_styles?.id;

      // 1. Check job_cards referencing this job_card_no
      const { data: jobCards } = await supabase
        .from('job_cards')
        .select('id, job_card_no, stage, party_name')
        .eq('job_card_no', jobCardNo).throwOnError();
      for (const jc of jobCards || []) {
        refs.push({
          type: 'Job Card',
          label: `Job Card #${jc.job_card_no} — ${jc.party_name || ''} (Stage: ${jc.stage})`,
          ref: jc.job_card_no,
        });
      }

      // 2. Check sales_order_items referencing this item
      const { data: soItems } = await supabase
        .from('sales_order_items')
        .select('id, item_name, sales_order_id')
        .ilike('item_name', `%${styleName}%`).throwOnError();
      for (const soi of soItems || []) {
        refs.push({
          type: 'Sales Order',
          label: `Sales Order Item: "${soi.item_name}"`,
          ref: soi.sales_order_id,
        });
      }

      // 3. Check production_batches referencing this job_card_no or style_name
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, batch_no, job_card_no, style_name, current_stage')
        .or(`job_card_no.eq.${jobCardNo},style_name.ilike.%${styleName}%`).throwOnError();
      for (const b of batches || []) {
        refs.push({
          type: 'Production Batch',
          label: `Batch #${b.batch_no} — ${b.style_name || b.job_card_no} (Stage: ${b.current_stage})`,
          ref: b.batch_no,
        });
      }

      // 4. Check stitching_entries referencing this job_card_ref or style_name
      const { data: stitchEntries } = await supabase
        .from('stitching_entries')
        .select('id, entry_no, style_name, job_card_ref')
        .or(`job_card_ref.eq.${jobCardNo},style_name.ilike.%${styleName}%`).throwOnError();
      for (const se of stitchEntries || []) {
        refs.push({
          type: 'Stitching Entry',
          label: `Stitching Entry #${se.entry_no} — ${se.style_name}`,
          ref: se.entry_no,
        });
      }

      // 5. Check qc_entries referencing this job_card_ref or style_name
      const { data: qcEntries } = await supabase
        .from('qc_entries')
        .select('id, entry_no, style_name, job_card_ref')
        .or(`job_card_ref.eq.${jobCardNo},style_name.ilike.%${styleName}%`).throwOnError();
      for (const qe of qcEntries || []) {
        refs.push({
          type: 'QC Entry',
          label: `QC Entry #${qe.entry_no} — ${qe.style_name}`,
          ref: qe.entry_no,
        });
      }

      // 6. Check item_compositions linked to the style (only if this is the last variant)
      if (styleId) {
        const { data: otherVariants } = await supabase
          .from('item_variants')
          .select('id')
          .eq('style_id', styleId)
          .neq('id', variant.id).throwOnError();
        // If no other variants, deleting this variant will also delete the style + compositions
        // We still allow it — compositions are child records and will be cascade-deleted or deleted explicitly
        // But if there ARE other variants, we just delete this variant only
        if (otherVariants && otherVariants.length === 0) {
          const { data: comps } = await supabase
            .from('item_compositions')
            .select('id, component_name')
            .eq('style_id', styleId).throwOnError();
          if (comps && comps.length > 0) {
            // Compositions exist but they belong to the style — we'll delete them as part of style deletion
            // This is NOT a blocking dependency, just informational — handled in delete flow
          }
        }
      }

      setDependencies(refs);
      setChecking(false);
    }
    checkDependencies().catch((err: unknown) => { setDependencyError(err instanceof Error ? err.message : 'Dependency check failed'); setChecking(false); });
  }, [variant]);

  async function handleDelete() {
    if (checking || dependencyError || dependencies.length > 0 || deleting) return;
    setDeleting(true); setDeleteError('');
    try {
      const { error } = await supabase.rpc('delete_original_item_variant', { p_variant_id: variant.id });
      if (error) throw new Error(error.message);
      onDeleted(variant.id); onClose();
    } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setDeleting(false); }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !deleting) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, deleting]);

  const isBlocked = dependencies.length > 0;

  // Group dependencies by type
  const grouped = dependencies.reduce<Record<string, DependencyRef[]>>((acc, d) => {
    if (!acc[d.type]) acc[d.type] = [];
    acc[d.type].push(d);
    return acc;
  }, {});

  const TYPE_COLORS: Record<string, string> = {
    'Job Card': 'bg-blue-50 border-blue-200 text-blue-700',
    'Sales Order': 'bg-green-50 border-green-200 text-green-700',
    'Production Batch': 'bg-orange-50 border-orange-200 text-orange-700',
    'Stitching Entry': 'bg-purple-50 border-purple-200 text-purple-700',
    'QC Entry': 'bg-rose-50 border-rose-200 text-rose-700',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-xl shadow-modal w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-red-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Trash2 size={16} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Delete Item</h2>
              <p className="text-xs text-slate-500 font-mono">
                {variant.style_no || variant.job_card_no} — {variant.colour}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {dependencyError && <p className="text-sm text-red-600">Dependency check failed: {dependencyError}. Close and retry; deletion is blocked.</p>}
          {checking ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm">Checking dependencies…</span>
            </div>
          ) : isBlocked ? (
            <>
              {/* Blocked state */}
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <ShieldAlert size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Cannot Delete — Active References Found</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    This item is referenced in {dependencies.length} record{dependencies.length !== 1 ? 's' : ''} across the system.
                    Remove all dependencies before deleting.
                  </p>
                </div>
              </div>

              {/* Dependency list grouped by type */}
              <div className="space-y-3">
                {Object.entries(grouped).map(([type, refs]) => (
                  <div key={type} className={`border rounded-xl overflow-hidden ${TYPE_COLORS[type] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                    <div className={`flex items-center gap-2 px-3 py-2 border-b ${TYPE_COLORS[type] || 'bg-gray-50 border-gray-200'}`}>
                      <AlertTriangle size={12} />
                      <span className="text-xs font-semibold">{type}</span>
                      <span className="text-xs opacity-70">({refs.length})</span>
                    </div>
                    <div className="px-3 py-2 space-y-1 bg-white/60">
                      {refs.map((r, i) => (
                        <p key={i} className="text-xs text-slate-800 py-0.5">{r.label}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 text-center">
                Go to the relevant modules and remove or reassign these references first.
              </p>
            </>
          ) : (
            <>
              {/* Confirmation state */}
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">Confirm Permanent Deletion</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    This action cannot be undone. The following will be permanently deleted:
                  </p>
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-100/20 border-b border-border">
                  <div className="flex items-center gap-3">
                    {variant.variant_image_url ? (
                      <img
                        src={variant.variant_image_url}
                        alt={`${variant.colour} thumbnail`}
                        className="w-8 h-10 object-cover rounded border border-border shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-8 h-10 rounded border border-dashed border-border bg-slate-100/30 flex items-center justify-center shrink-0">
                        <ImageIcon size={12} className="text-slate-500/40" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{variant.style_no || variant.job_card_no}</p>
                      <p className="text-xs text-slate-500 font-mono">{variant.colour}</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Trash2 size={11} className="text-red-500 shrink-0" />
                    <span>Variant record (colour: <span className="font-medium text-slate-800">{variant.colour}</span>)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Trash2 size={11} className="text-red-500 shrink-0" />
                    <span>{variant.item_detail_lines.length} detail line{variant.item_detail_lines.length !== 1 ? 's' : ''} (fabric, accessories, manufacturing)</span>
                  </div>
                  {variant.item_styles && (
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle size={11} className="shrink-0" />
                      <span>If this is the last variant, the parent style record and its compositions will also be deleted.</span>
                    </div>
                  )}
                </div>
              </div>

              {deleteError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  {deleteError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-slate-100/10 shrink-0">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 border border-border rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {isBlocked ? 'Close' : 'Cancel'}
          </button>
          {!checking && !dependencyError && !isBlocked && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? (
                <><RefreshCw size={14} className="animate-spin" />Deleting…</>
              ) : (
                <><Trash2 size={14} />Delete Permanently</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

