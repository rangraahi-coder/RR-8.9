'use client';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, FileText, Package, ChevronDown, Search, Loader2 } from 'lucide-react';
import { SalesOrder, SalesOrderItem } from '../data/salesOrdersData';
import { salesOrderService } from '@/lib/services/salesOrderService';
import { accountService } from '@/lib/services/accountService';
import { Account } from '../../account-master/data/accountsData';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NewSalesOrderModalProps {
  lang: 'en' | 'hi';
  onClose: () => void;
  onSaved: () => void;
  editOrder?: SalesOrder | null; // if provided, modal is in edit mode
}

interface ItemRow {
  itemName: string;
  paramSize: string;
  paramColour: string;
  sizeRows: { size: string; qty: string }[];
  qty: string;
  unit: string;
  price: string;
}

const emptyItem = (): ItemRow => ({
  itemName: '',
  paramSize: '',
  paramColour: '',
  sizeRows: [],
  qty: '',
  unit: 'Pcs.',
  price: '',
});

// Parse a paramSize string like "S/50, M/100" into sizeRows
function parseSizeToRows(paramSize: string): { size: string; qty: string }[] {
  if (!paramSize) return [];
  const parts = paramSize.split(',').map((s) => s.trim()).filter(Boolean);
  const rows = parts.map((p) => {
    const [size, qty] = p.split('/');
    return { size: size?.trim() || '', qty: qty?.trim() || '' };
  });
  // If any part doesn't have a slash, treat as plain text (no rows)
  if (rows.some((r) => !r.qty)) return [];
  return rows;
}

export default function NewSalesOrderModal({ lang, onClose, onSaved, editOrder }: NewSalesOrderModalProps) {
  const router = useRouter();
  const { username } = useAuth();
  const isEdit = !!editOrder;

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Convert DD-MM-YYYY to YYYY-MM-DD for date input
  function toInputDate(d: string): string {
    if (!d) return todayStr;
    if (d.includes('-') && d.length === 10) {
      const parts = d.split('-');
      if (parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return d;
  }

  const [date, setDate] = useState(isEdit ? toInputDate(editOrder!.date) : todayStr);
  const [vchNo, setVchNo] = useState(isEdit ? editOrder!.vchNo : '');
  const [partyName, setPartyName] = useState(isEdit ? editOrder!.partyName : '');
  const [partyType, setPartyType] = useState<'external' | 'self'>(isEdit ? editOrder!.partyType : 'external');
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (isEdit && editOrder!.items.length > 0) {
      return editOrder!.items.map((it) => {
        const sizeRows = parseSizeToRows(it.paramSize);
        return {
          itemName: it.itemName,
          paramSize: sizeRows.length === 0 ? it.paramSize : '',
          paramColour: it.paramColour || '',
          sizeRows,
          qty: String(it.qty),
          unit: it.unit,
          price: it.price > 0 ? String(it.price) : '',
        };
      });
    }
    return [emptyItem()];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const savingRef=useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [partySearch, setPartySearch] = useState('');
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const partyDropdownRef = useRef<HTMLDivElement>(null);
  const partyButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [itemNames, setItemNames] = useState<string[]>([]);
  const [itemNamesLoading, setItemNamesLoading] = useState(true);

  const refreshAccounts=async()=>{try{setAllAccounts(await accountService.getAll());}catch(e){setSaveError((e as Error).message||'Accounts could not load');}};
  const refreshItemNames=async()=>{setItemNamesLoading(true);try{const{data,error}=await createClient().from('item_styles').select('item_name,design_code,job_card_no,style_no,set_type').order('design_code');if(error)throw error;setItemNames(Array.from(new Set((data??[]).map(s=>s.item_name||s.design_code||s.style_no||s.job_card_no).filter(Boolean))).sort());}catch(e){setSaveError((e as Error).message||'Items could not load');}finally{setItemNamesLoading(false);}};
  useEffect(()=>{void refreshAccounts();void refreshItemNames();},[]);
  useRealtimeTable('accounts',refreshAccounts);useRealtimeTable('item_styles',refreshItemNames);

  const debtors = allAccounts
    .filter((a) => a.parentGroup === 'Sundry Debtors')
    .map((a) => a.name)
    .sort((a, b) => a.localeCompare(b));

  const creditors = allAccounts
    .filter((a) => a.parentGroup === 'Sundry Creditors')
    .map((a) => a.name)
    .sort((a, b) => a.localeCompare(b));

  const filteredDebtors = debtors.filter((name) =>
    name.toLowerCase().includes(partySearch.toLowerCase())
  );
  const filteredCreditors = creditors.filter((name) =>
    name.toLowerCase().includes(partySearch.toLowerCase())
  );
  const totalFiltered = filteredDebtors.length + filteredCreditors.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        partyDropdownRef.current && !partyDropdownRef.current.contains(e.target as Node) &&
        partyButtonRef.current && !partyButtonRef.current.contains(e.target as Node)
      ) {
        setPartyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openPartyDropdown = () => {
    if (partyButtonRef.current) {
      const rect = partyButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 280;
      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
          maxHeight: Math.min(dropdownHeight, spaceBelow - 8),
        });
      } else {
        setDropdownStyle({
          position: 'fixed',
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
          maxHeight: Math.min(dropdownHeight, spaceAbove - 8),
        });
      }
    }
    setPartyDropdownOpen((prev) => !prev);
    setPartySearch('');
  };

  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addSizeRow = (itemIdx: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === itemIdx ? { ...it, sizeRows: [...it.sizeRows, { size: '', qty: '' }] } : it
      )
    );
  };

  const removeSizeRow = (itemIdx: number, sizeIdx: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== itemIdx) return it;
        const newRows = it.sizeRows.filter((_, si) => si !== sizeIdx);
        return { ...it, sizeRows: newRows };
      })
    );
  };

  const updateSizeRow = (itemIdx: number, sizeIdx: number, field: 'size' | 'qty', value: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== itemIdx) return it;
        const newRows = it.sizeRows.map((sr, si) =>
          si === sizeIdx ? { ...sr, [field]: value } : sr
        );
        return { ...it, sizeRows: newRows };
      })
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!date.trim()) errs.date = lang === 'hi' ? 'तारीख आवश्यक है' : 'Date is required';
    if (!vchNo.trim()) errs.vchNo = lang === 'hi' ? 'वाउचर नं आवश्यक है' : 'Voucher No is required';
    if (!partyName.trim()) errs.partyName = lang === 'hi' ? 'पार्टी नाम आवश्यक है' : 'Party name is required';
    items.forEach((it, i) => {
      if (!it.itemName.trim()) errs[`item_name_${i}`] = lang === 'hi' ? 'आइटम नाम आवश्यक है' : 'Item name required';
      if (!it.qty || isNaN(Number(it.qty)) || Number(it.qty) <= 0)
        errs[`item_qty_${i}`] = lang === 'hi' ? 'मान्य मात्रा दर्ज करें' : 'Enter valid qty';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if(savingRef.current||!validate())return;
    savingRef.current=true;
    setSaving(true);
    setSaveError(null);

    try {
      const parsedItems: SalesOrderItem[] = items.map((it) => {
        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        const sizeBreakup = it.sizeRows.length > 0
          ? it.sizeRows.filter((sr) => sr.size.trim()).map((sr) => `${sr.size}/${sr.qty || 0}`).join(', ')
          : it.paramSize.trim();
        return {
          itemName: it.itemName.trim(),
          paramSize: sizeBreakup,
          paramColour: it.paramColour.trim(),
          qty,
          unit: it.unit || 'Pcs.',
          price,
          amount: qty * price,
        };
      });

      const totalQty = parsedItems.reduce((s, i) => s + i.qty, 0);
      const totalAmount = parsedItems.reduce((s, i) => s + i.amount, 0);

      const orderPayload = {
        date,
        vchNo: vchNo.trim(),
        partyName: partyName.trim(),
        partyType,
        items: parsedItems,
        totalQty,
        totalAmount,
        jobCardNo: editOrder?.jobCardNo || '',
        status: (editOrder?.status || 'pending') as 'pending' | 'in_production' | 'completed',
      };

      let success = false;
      if (isEdit && editOrder) {
        const updated = await salesOrderService.update(editOrder.id, orderPayload, username);
        success = !!updated;
      } else {
        const saved = await salesOrderService.create(orderPayload, username);
        success = !!saved;
      }

      if (!success) {
        setSaveError(
          lang === 'hi' ? 'सेव नहीं हो सका। कृपया पुनः प्रयास करें।' : 'Failed to save. Please try again.'
        );
        return;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || (lang === 'hi' ? 'अज्ञात त्रुटि' : 'Unknown error'));
    } finally {
      savingRef.current=false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText size={15} className="text-primary" />
            </div>
            <div>
              <h3 className="font-700 text-foreground text-base">
                {isEdit
                  ? (lang === 'hi' ? 'ऑर्डर संपादित करें' : 'Edit Sales Order')
                  : (lang === 'hi' ? 'नया सेल्स ऑर्डर' : 'New Sales Order')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? (lang === 'hi' ? `वाउचर ${editOrder!.vchNo} अपडेट करें` : `Update voucher ${editOrder!.vchNo}`)
                  : (lang === 'hi' ? 'ऑर्डर विवरण भरें' : 'Fill in order details')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Save error banner */}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-500">
              {saveError}
            </div>
          )}

          {/* Order Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">
                {lang === 'hi' ? 'तारीख' : 'Date'} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`input-field ${errors.date ? 'border-red-400' : ''}`}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            {/* Voucher No */}
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">
                {lang === 'hi' ? 'वाउचर नं' : 'Voucher No'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vchNo}
                onChange={(e) => setVchNo(e.target.value)}
                placeholder={lang === 'hi' ? 'जैसे TPO-4300' : 'e.g. TPO-4300'}
                className={`input-field font-mono ${errors.vchNo ? 'border-red-400' : ''}`}
              />
              {errors.vchNo && <p className="text-xs text-red-500 mt-1">{errors.vchNo}</p>}
            </div>

            {/* Party Name */}
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">
                {lang === 'hi' ? 'पार्टी का नाम' : 'Party Name'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  ref={partyButtonRef}
                  onClick={openPartyDropdown}
                  className={`input-field w-full flex items-center justify-between text-left ${errors.partyName ? 'border-red-400' : ''}`}
                >
                  <span className={partyName ? 'text-foreground' : 'text-muted-foreground'}>
                    {partyName || (lang === 'hi' ? 'पार्टी चुनें' : 'Select party')}
                  </span>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${partyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {partyDropdownOpen && (
                  <div
                    ref={partyDropdownRef}
                    className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
                    style={dropdownStyle}
                  >
                    <div className="p-2 border-b border-border shrink-0">
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-lg">
                        <Search size={12} className="text-muted-foreground shrink-0" />
                        <input
                          type="text"
                          autoFocus
                          value={partySearch}
                          onChange={(e) => setPartySearch(e.target.value)}
                          placeholder={lang === 'hi' ? 'खोजें...' : 'Search party...'}
                          className="bg-transparent text-xs outline-none w-full text-foreground placeholder:text-muted-foreground"
                        />
                        {partySearch && (
                          <span className="text-xs text-muted-foreground shrink-0">{totalFiltered}</span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {totalFiltered === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          {lang === 'hi' ? 'कोई परिणाम नहीं' : 'No results'}
                        </p>
                      ) : (
                        <>
                          {filteredDebtors.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-700 text-primary bg-primary/5 border-b border-border sticky top-0">
                                Sundry Debtors ({filteredDebtors.length})
                              </div>
                              {filteredDebtors.map((name, di) => (
                                <button
                                  key={`debtor-${di}-${name}`}
                                  type="button"
                                  onClick={() => {
                                    setPartyName(name);
                                    setPartyDropdownOpen(false);
                                    setErrors((prev) => ({ ...prev, partyName: '' }));
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${partyName === name ? 'bg-primary/10 text-primary font-600' : 'text-foreground'}`}
                                >
                                  {name}
                                </button>
                              ))}
                            </>
                          )}
                          {filteredCreditors.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 text-xs font-700 text-orange-600 bg-orange-50 border-b border-border sticky top-0">
                                Sundry Creditors ({filteredCreditors.length})
                              </div>
                              {filteredCreditors.map((name, ci) => (
                                <button
                                  key={`creditor-${ci}-${name}`}
                                  type="button"
                                  onClick={() => {
                                    setPartyName(name);
                                    setPartyDropdownOpen(false);
                                    setErrors((prev) => ({ ...prev, partyName: '' }));
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${partyName === name ? 'bg-primary/10 text-primary font-600' : 'text-foreground'}`}
                                >
                                  {name}
                                </button>
                              ))}
                            </>
                          )}
                        </>
                      )}
                      {/* Create New Party option */}
                      <div className="border-t border-border">
                        <button
                          type="button"
                          onClick={() => { setPartyDropdownOpen(false); router.push('/account-master'); }}
                          className="w-full text-left px-3 py-2.5 text-xs font-600 text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                        >
                          <Plus size={12} />
                          {lang === 'hi' ? 'नई पार्टी बनाएं' : 'Create New Party'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {errors.partyName && <p className="text-xs text-red-500 mt-1">{errors.partyName}</p>}
            </div>

            {/* Party Type */}
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">
                {lang === 'hi' ? 'पार्टी प्रकार' : 'Party Type'}
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'external', en: 'External', hi: 'बाहरी' },
                  { value: 'self', en: 'Self (Rangraahi)', hi: 'स्वयं (रंगराही)' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPartyType(opt.value as 'external' | 'self')}
                    className={`flex-1 py-2 rounded-lg text-xs font-600 transition-all border ${
                      partyType === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:bg-secondary'
                    }`}
                  >
                    {lang === 'hi' ? opt.hi : opt.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-muted-foreground" />
                <p className="text-sm font-600 text-foreground">
                  {lang === 'hi' ? 'आइटम' : 'Items'}
                </p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-600 text-primary hover:text-primary/80 transition-colors"
              >
                <Plus size={13} />
                {lang === 'hi' ? 'आइटम जोड़ें' : 'Add Item'}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-muted/40 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-600 text-muted-foreground">
                      {lang === 'hi' ? `आइटम ${idx + 1}` : `Item ${idx + 1}`}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Item Name */}
                  <div>
                    <select
                      value={item.itemName}
                      onChange={(e) => { if (e.target.value === '__create_new__') { router.push('/item-master'); } else { updateItem(idx, 'itemName', e.target.value); } }}
                      className={`input-field text-xs w-full ${errors[`item_name_${idx}`] ? 'border-red-400' : ''}`}
                    >
                      <option value="">{lang === 'hi' ? '-- आइटम चुनें --' : '-- Select Item --'}</option>
                      <option value="__create_new__" className="text-primary font-600">+ {lang === 'hi' ? 'नया आइटम बनाएं' : 'Create New Item'}</option>
                      {itemNamesLoading ? (
                        <option value="" disabled>Loading items…</option>
                      ) : itemNames.length === 0 ? (
                        <option value="" disabled>No items found in master</option>
                      ) : (
                        itemNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))
                      )}
                    </select>
                    {errors[`item_name_${idx}`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_name_${idx}`]}</p>
                    )}
                  </div>

                  {/* Size */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-muted-foreground">
                        {lang === 'hi' ? 'साइज़ ब्रेकअप' : 'Size Breakup'} <span className="text-muted-foreground/60 text-[10px]">({lang === 'hi' ? 'वैकल्पिक' : 'optional'})</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => addSizeRow(idx)}
                        className="flex items-center gap-1 text-[11px] font-600 text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus size={11} />
                        {lang === 'hi' ? 'साइज़ जोड़ें' : 'Add Size'}
                      </button>
                    </div>
                    {item.sizeRows.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.sizeRows.map((sr, si) => (
                          <div key={si} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={sr.size}
                              onChange={(e) => updateSizeRow(idx, si, 'size', e.target.value)}
                              placeholder={lang === 'hi' ? 'साइज़ (जैसे S, M, L)' : 'Size (e.g. S, M, L)'}
                              className="input-field text-xs flex-1"
                            />
                            <input
                              type="number"
                              min="0"
                              value={sr.qty}
                              onChange={(e) => updateSizeRow(idx, si, 'qty', e.target.value)}
                              placeholder={lang === 'hi' ? 'नग' : 'Qty'}
                              className="input-field text-xs w-20"
                            />
                            <button
                              type="button"
                              onClick={() => removeSizeRow(idx, si)}
                              className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        {item.sizeRows.some((sr) => sr.size.trim() && sr.qty) && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {item.sizeRows.filter((sr) => sr.size.trim()).map((sr) => `${sr.size}/${sr.qty || 0}`).join(', ')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={item.paramSize}
                        onChange={(e) => updateItem(idx, 'paramSize', e.target.value)}
                        placeholder={lang === 'hi' ? 'साइज़ ब्रेकअप (जैसे S/50, M/100)' : 'Size breakup (optional) e.g. S/50, M/100'}
                        className="input-field text-xs"
                      />
                    )}
                  </div>

                  {/* Colour */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {lang === 'hi' ? 'रंग' : 'Colour'} <span className="text-muted-foreground/60 text-[10px]">({lang === 'hi' ? 'वैकल्पिक' : 'optional'})</span>
                    </label>
                    <input
                      type="text"
                      value={item.paramColour}
                      onChange={(e) => updateItem(idx, 'paramColour', e.target.value)}
                      placeholder={lang === 'hi' ? 'जैसे Red, Blue, Navy' : 'e.g. Red, Blue, Navy'}
                      className="input-field text-xs"
                    />
                  </div>

                  {/* Qty, Unit, Price */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {lang === 'hi' ? 'मात्रा' : 'Qty'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                        placeholder="0"
                        className={`input-field text-xs ${errors[`item_qty_${idx}`] ? 'border-red-400' : ''}`}
                      />
                      {errors[`item_qty_${idx}`] && (
                        <p className="text-xs text-red-500 mt-0.5">{errors[`item_qty_${idx}`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {lang === 'hi' ? 'इकाई' : 'Unit'}
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="input-field text-xs"
                      >
                        <option value="Pcs.">Pcs.</option>
                        <option value="Set">Set</option>
                        <option value="Mtr">Mtr</option>
                        <option value="Kg">Kg</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {lang === 'hi' ? 'दर (₹)' : 'Rate (₹)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => updateItem(idx, 'price', e.target.value)}
                        placeholder="0"
                        className="input-field text-xs"
                      />
                    </div>
                  </div>

                  {/* Amount preview */}
                  {item.qty && item.price && Number(item.qty) > 0 && Number(item.price) > 0 && (
                    <div className="flex justify-end">
                      <span className="text-xs font-600 text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                        = ₹{(Number(item.qty) * Number(item.price)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total Preview */}
          {items.some((it) => it.qty && it.price) && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-muted-foreground">{lang === 'hi' ? 'कुल नग' : 'Total Qty'}</span>
                <span className="text-sm font-700 text-foreground">
                  {items.reduce((s, it) => s + (Number(it.qty) || 0), 0).toLocaleString('en-IN')} {lang === 'hi' ? 'नग' : 'Pcs'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{lang === 'hi' ? 'कुल राशि' : 'Total Amount'}</span>
                <span className="text-base font-700 text-primary">
                  ₹{items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {lang === 'hi' ? 'सेव हो रहा है...' : 'Saving...'}
              </>
            ) : (
              <>
                <FileText size={14} />
                {isEdit
                  ? (lang === 'hi' ? 'अपडेट करें' : 'Update Sales Order')
                  : (lang === 'hi' ? 'सेल्स ऑर्डर सेव करें' : 'Save Sales Order')}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary text-sm px-5 disabled:opacity-60"
          >
            {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
