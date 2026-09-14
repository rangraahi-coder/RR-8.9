'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, Plus, Save, Package, ChevronDown, Search, ShoppingCart } from 'lucide-react';
import { JobCard, JobCardStage } from './JobCardContent';
import { getItemVariantsForSelect, ItemVariantOption } from '@/lib/services/itemClientService';
import { jobCardService } from '@/lib/services/jobCardService';
import { invalidateJobCardsCache } from '@/lib/hooks/useJobCards';
import { useRealtimeData } from '@/contexts/RealtimeDataContext';
import { salesOrderService } from '@/lib/services/salesOrderService';
import { SalesOrder } from '@/app/sales-orders/data/salesOrdersData';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface CreateJobCardFormData {
  styleEn: string;
  styleHi: string;
  designCode: string;
  partyName: string;
  poNo: string;
  totalPieces: number;
  dueDate: string;
  colors: string;
  sizes: string;
  jobCardNo: string;
}

interface CreateJobCardModalProps {
  lang: 'en' | 'hi';
  onClose: () => void;
  onCreate: (card: JobCard) => void;
  editCard?: JobCard;
}

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL'];
const COLOR_OPTIONS = ['Red', 'Blue', 'Green', 'Navy', 'Maroon', 'White', 'Black', 'Pink', 'Yellow', 'Peach', 'Cream', 'Off White'];

// Convert DD/MM/YYYY to YYYY-MM-DD for date input
function toInputDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
}

// Convert YYYY-MM-DD to DD/MM/YYYY for storage
function fromInputDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export default function CreateJobCardModal({ lang, onClose, onCreate, editCard }: CreateJobCardModalProps) {
  const isEditMode = !!editCard;
  const [step, setStep] = useState(1);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(editCard?.sizes ?? []);
  const [selectedColors, setSelectedColors] = useState<string[]>(editCard?.colors ?? []);
  // sizeRatios: editable per-size quantities — initialized from editCard if present
  const [sizeRatios, setSizeRatios] = useState<Record<string, number>>(
    editCard?.sizeRatios ? { ...editCard.sizeRatios } : {}
  );
  const [isLoading, setIsLoading] = useState(false);

  // Live data from RealtimeDataContext
  const { accounts, itemVariantsLoading, refreshSalesOrders } = useRealtimeData();

  // Fetch sales orders directly from DB on modal open — bypasses stale context
  // Include both 'pending' and 'in_production' (partially fulfilled orders can still get new job cards)
  const [pendingSalesOrders, setPendingSalesOrders] = useState<{ id: string; vchNo: string; partyName: string; totalQty: number; status: string }[]>([]);
  const [soFetchLoading, setSoFetchLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadSalesOrders() {
      setSoFetchLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('sales_orders')
          .select('id, vch_no, party_name, status, total_qty')
          .in('status', ['pending', 'in_production'])
          .order('created_at', { ascending: false });
        if (!cancelled && !error && data) {
          setPendingSalesOrders(
            data.map((r: any) => ({
              id: r.id,
              vchNo: r.vch_no,
              partyName: r.party_name,
              status: r.status,
              totalQty: r.total_qty || 0,
            }))
          );
        } else if (!cancelled && (error || !data)) {
          // Fallback: treat null/pending status as available
          setPendingSalesOrders([]);
        }
      } catch {
        if (!cancelled) setPendingSalesOrders([]);
      } finally {
        if (!cancelled) setSoFetchLoading(false);
      }
    }
    loadSalesOrders();
    return () => { cancelled = true; };
  }, []);

  // Selected sales order state
  const [selectedSalesOrder, setSelectedSalesOrder] = useState<{ id: string; vchNo: string; partyName: string; totalQty: number } | null>(null);
  const [soDropdownOpen, setSoDropdownOpen] = useState(false);
  const [soSearch, setSoSearch] = useState('');
  const [soLoading, setSoLoading] = useState(false);
  const soDropdownRef = useRef<HTMLDivElement>(null);

  // Derive contractor suggestions and party names from live accounts
  const partySuggestions = accounts.length > 0
    ? accounts.map((a) => a.name)
    : [];

  // Item selector state
  const [itemVariants, setItemVariants] = useState<ItemVariantOption[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemVariantOption | null>(null);
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  // Initial fetch of item variants
  useEffect(() => {
    getItemVariantsForSelect().then(setItemVariants);
    // Refresh sales orders context when modal opens
    refreshSalesOrders();
  }, []);

  // Re-fetch item variants whenever RealtimeDataContext signals a change
  useEffect(() => {
    if (!itemVariantsLoading) {
      getItemVariantsForSelect().then(setItemVariants);
    }
  }, [itemVariantsLoading]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setItemDropdownOpen(false);
      }
      if (soDropdownRef.current && !soDropdownRef.current.contains(e.target as Node)) {
        setSoDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems = itemVariants.filter((v) => {
    const q = itemSearch.toLowerCase();
    return (
      v.job_card_no.toLowerCase().includes(q) ||
      v.colour.toLowerCase().includes(q) ||
      v.style_no.toLowerCase().includes(q) ||
      v.set_type.toLowerCase().includes(q) ||
      v.design_code.toLowerCase().includes(q)
    );
  });

  const filteredSalesOrders = pendingSalesOrders.filter((o) => {
    const q = soSearch.toLowerCase();
    return (
      o.vchNo.toLowerCase().includes(q) ||
      o.partyName.toLowerCase().includes(q)
    );
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateJobCardFormData>({
    defaultValues: isEditMode
      ? {
          styleEn: editCard.styleEn,
          styleHi: editCard.styleHi,
          designCode: editCard.designCode,
          partyName: editCard.partyName,
          poNo: editCard.poNo,
          totalPieces: editCard.totalPieces,
          dueDate: toInputDate(editCard.dueDate),
          jobCardNo: editCard.jobCardNo,
        }
      : {
          totalPieces: 240,
        },
  });

  // Handle sales order selection — fetch full details and auto-fill form
  async function handleSelectSalesOrder(so: { id: string; vchNo: string; partyName: string; totalQty: number }) {
    setSelectedSalesOrder(so);
    setSoDropdownOpen(false);
    setSoSearch('');
    setSoLoading(true);

    // Auto-fill basic fields from summary
    setValue('partyName', so.partyName);
    setValue('poNo', so.vchNo);
    setValue('totalPieces', so.totalQty);

    try {
      // Fetch full sales order to get items with sizes
      const allOrders = await salesOrderService.getAll();
      const fullOrder = allOrders.find((o: SalesOrder) => o.id === so.id);
      if (fullOrder) {
        // Auto-fill due date from sales order date (DD-MM-YYYY → YYYY-MM-DD)
        if (fullOrder.date) {
          const dateParts = fullOrder.date.split('-');
          if (dateParts.length === 3) {
            const inputDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            setValue('dueDate', inputDate);
          }
        }
        // Build size ratios from items
        const ratios: Record<string, number> = {};
        const detectedSizes: string[] = [];
        const detectedColours: string[] = [];
        fullOrder.items.forEach((item) => {
          if (item.paramSize) {
            const rawSize = item.paramSize.trim();
            // Check if it's a size/qty breakup like "S/50, M/100, L/80"
            const parts = rawSize.split(',').map((p) => p.trim()).filter(Boolean);
            const hasSizeQtyPairs = parts.length > 0 && parts.every((p) => p.includes('/'));

            if (hasSizeQtyPairs) {
              // Parse each "SIZE/QTY" pair
              parts.forEach((part) => {
                const [sizeRaw, qtyRaw] = part.split('/');
                const sizeKey = (sizeRaw || '').trim().toUpperCase();
                const qty = parseInt(qtyRaw || '0', 10) || 0;
                if (sizeKey) {
                  ratios[sizeKey] = (ratios[sizeKey] || 0) + qty;
                  if (!detectedSizes.includes(sizeKey)) detectedSizes.push(sizeKey);
                }
              });
            } else {
              // Plain size string like "M" or "XL"
              const sizeKey = rawSize.toUpperCase();
              ratios[sizeKey] = (ratios[sizeKey] || 0) + item.qty;
              if (!detectedSizes.includes(sizeKey)) detectedSizes.push(sizeKey);
            }
          }
          if (item.paramColour) {
            const colours = item.paramColour.split(',').map((c) => c.trim()).filter(Boolean);
            colours.forEach((c) => {
              const colourKey = c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
              if (!detectedColours.includes(colourKey)) detectedColours.push(colourKey);
            });
          }
        });
        if (detectedSizes.length > 0) {
          // Include all detected sizes — both standard (SIZE_OPTIONS) and custom
          const standardSizes = detectedSizes.filter((s) => SIZE_OPTIONS.includes(s));
          const customSizes = detectedSizes.filter((s) => !SIZE_OPTIONS.includes(s));
          const allDetectedSizes = [...standardSizes, ...customSizes];
          if (allDetectedSizes.length > 0) {
            setSelectedSizes(allDetectedSizes);
            setSizeRatios({});
          }
        }
        // Auto-fill colours from order items
        if (detectedColours.length > 0) {
          // Match against COLOR_OPTIONS (case-insensitive), keep custom ones too
          const matchedColors = detectedColours.filter((c) =>
            COLOR_OPTIONS.some((opt) => opt.toLowerCase() === c.toLowerCase())
          ).map((c) => {
            const match = COLOR_OPTIONS.find((opt) => opt.toLowerCase() === c.toLowerCase());
            return match || c;
          });
          const customColors = detectedColours.filter((c) =>
            !COLOR_OPTIONS.some((opt) => opt.toLowerCase() === c.toLowerCase())
          );
          const allColors = [...matchedColors, ...customColors];
          if (allColors.length > 0) {
            setSelectedColors(allColors);
          }
        }
        // Auto-fill style name from order if available
        if (fullOrder.items.length > 0 && fullOrder.items[0].itemName) {
          const orderItemName = fullOrder.items[0].itemName;
          setValue('styleEn', orderItemName);

          // Try to match item master variant by item name
          const nameNorm = orderItemName.trim().toLowerCase();
          const matchedItem = itemVariants.find((v) => {
            return (
              (v.style_no && v.style_no.trim().toLowerCase() === nameNorm) ||
              (v.set_type && v.set_type.trim().toLowerCase() === nameNorm) ||
              (v.job_card_no && v.job_card_no.trim().toLowerCase() === nameNorm) ||
              (v.style_no && nameNorm.includes(v.style_no.trim().toLowerCase())) ||
              (v.set_type && nameNorm.includes(v.set_type.trim().toLowerCase()))
            );
          });
          if (matchedItem) {
            setSelectedItem(matchedItem);
            setValue('designCode', matchedItem.design_code || matchedItem.style_no || matchedItem.job_card_no);
          }
        }
      }
    } catch {
      // silently fail — basic fields already filled
    } finally {
      setSoLoading(false);
    }
  }

  function handleSelectItem(item: ItemVariantOption) {
    setSelectedItem(item);
    setItemDropdownOpen(false);
    setItemSearch('');
    // Auto-fill style name and design code
    // Item master style_no is always the same as style name in one PO
    const styleName = item.style_no || (item.set_type
      ? `${item.set_type} — ${item.colour}`
      : `JC ${item.job_card_no} — ${item.colour}`);
    setValue('styleEn', styleName);
    setValue('designCode', item.design_code || item.style_no || item.job_card_no);
  }

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
    // When adding a new size in edit mode, initialize its ratio to 0 if not already set
    setSizeRatios((prev) => {
      if (!prev[size]) return { ...prev, [size]: 0 };
      return prev;
    });
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const updateSizeRatio = (size: string, value: number) => {
    setSizeRatios((prev) => ({ ...prev, [size]: value }));
  };

  const onSubmit = async (data: CreateJobCardFormData) => {
    setIsLoading(true);

    // Validate: if size ratios are set, their total must match totalPieces
    if (Object.keys(sizeRatios).length > 0 && selectedSizes.length > 0) {
      const sizeRatioTotal = selectedSizes.reduce((sum, size) => {
        return sum + (sizeRatios[size] ?? (isEditMode ? (editCard?.sizeRatios?.[size] ?? 0) : 0));
      }, 0);
      const totalPieces = Number(data.totalPieces);
      if (sizeRatioTotal !== totalPieces) {
        toast.error(
          lang === 'hi'
            ? `साइज़ की कुल मात्रा (${sizeRatioTotal}) सेल्स ऑर्डर की कुल मात्रा (${totalPieces}) से मेल नहीं खाती। कृपया साइज़ अनुपात सही करें।`
            : `Total size quantities (${sizeRatioTotal}) do not match the sales order total (${totalPieces}). Please correct the size ratios before saving.`,
        );
        setIsLoading(false);
        return;
      }
    }

    if (isEditMode) {
      // Build updated sizeRatios only for currently selected sizes
      const updatedSizeRatios: Record<string, number> = {};
      selectedSizes.forEach((size) => {
        updatedSizeRatios[size] = sizeRatios[size] ?? (editCard.sizeRatios?.[size] ?? 0);
      });

      const updatedCard: JobCard = {
        ...editCard,
        jobCardNo: data.jobCardNo || editCard.jobCardNo,
        styleEn: data.styleEn,
        styleHi: data.styleHi || data.styleEn,
        designCode: data.designCode,
        partyName: data.partyName,
        poNo: data.poNo,
        totalPieces: Number(data.totalPieces),
        dueDate: fromInputDate(data.dueDate),
        colors: selectedColors,
        sizes: selectedSizes,
        sizeRatios: Object.keys(updatedSizeRatios).length > 0 ? updatedSizeRatios : editCard.sizeRatios,
        // Preserve the sales order link — DB trigger will recalculate status automatically
        salesOrderId: editCard.salesOrderId,
      };

      const saved = await jobCardService.update(editCard.id, updatedCard);
      invalidateJobCardsCache();
      setIsLoading(false);
      if (saved == null) {
        toast.error(
          lang === 'hi' ? 'परिवर्तन सहेजने में विफल। कृपया पुनः प्रयास करें।' : 'Failed to save changes. Please try again.',
        );
        return;
      }
      onCreate(saved);
    } else {
      // Generate a sequential job card number
      const jobCardNo = `JC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const today = new Date();
      const createdDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      const newCardData: Omit<JobCard, 'id'> = {
        jobCardNo,
        styleEn: data.styleEn,
        styleHi: data.styleHi || data.styleEn,
        designCode: data.designCode,
        partyName: data.partyName,
        contractor: 'Unassigned',
        stage: 'cutting' as JobCardStage,
        totalPieces: Number(data.totalPieces),
        completedPieces: 0,
        isBlocked: false,
        dueDate: fromInputDate(data.dueDate),
        poNo: data.poNo,
        createdDate,
        colors: selectedColors,
        sizes: selectedSizes,
        sizeRatios: Object.keys(sizeRatios).length > 0 ? sizeRatios : undefined,
        // Store the FK so the DB trigger can recalculate status on any future change/delete
        salesOrderId: selectedSalesOrder?.id ?? null,
      };

      // Save directly to Supabase — DB trigger will set sales order to 'in_production'
      const saved = await jobCardService.create(newCardData);

      if (saved && selectedSalesOrder) {
        // Refresh so the sales orders list reflects the DB-trigger update immediately
        refreshSalesOrders();
      }

      setIsLoading(false);

      if (!saved) {
        toast.error(
          lang === 'hi' ?'जॉब कार्ड सहेजने में विफल। कृपया पुनः प्रयास करें।' :'Failed to save job card. Please try again.',
        );
        return;
      }

      invalidateJobCardsCache();
      onCreate(saved);
    }
  };

  const STEPS = [
    { num: 1, labelEn: 'Basic Info', labelHi: 'बुनियादी जानकारी' },
    { num: 2, labelEn: 'Size & Color', labelHi: 'साइज़ और रंग' },
    { num: 3, labelEn: 'Review', labelHi: 'समीक्षा' },
  ];

  const watchedData = watch();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-modal w-full max-w-xl fade-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-700 text-foreground">
            {isEditMode
              ? (lang === 'hi' ? `${editCard.jobCardNo} संपादित करें` : `Edit ${editCard.jobCardNo}`)
              : (lang === 'hi' ? 'नया जॉब कार्ड बनाएं' : 'Create New Job Card')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-all duration-150">
            <X size={16} />
          </button>
        </div>

        {/* Step Progress */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => (
              <React.Fragment key={`step-${s.num}`}>
                <div
                  className={`flex items-center gap-2 ${step === s.num ? 'text-primary' : step > s.num ? 'text-success' : 'text-muted-foreground'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-800 ${
                      step > s.num
                        ? 'bg-success text-white'
                        : step === s.num
                        ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step > s.num ? '✓' : s.num}
                  </div>
                  <span className="text-xs font-600 hidden sm:block">
                    {lang === 'hi' ? s.labelHi : s.labelEn}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-px ${step > s.num ? 'bg-success' : 'bg-border'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-4">

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                {/* Datalist suggestions for party — sourced from live accounts */}
                <datalist id="party-suggestions">
                  {partySuggestions.map((name, idx) => <option key={`party-${idx}`} value={name} />)}
                  {isEditMode && editCard.partyName && !partySuggestions.includes(editCard.partyName) && (
                    <option value={editCard.partyName} />
                  )}
                </datalist>

                {/* Pending Sales Order Selector — only in create mode */}
                {!isEditMode && (
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'पेंडिंग सेल्स ऑर्डर से बनाएं' : 'Create from Pending Sales Order'}
                      <span className="text-xs text-muted-foreground ml-2 font-400">
                        {lang === 'hi' ? '(वैकल्पिक — विवरण स्वतः भरेगा)' : '(optional — auto-fills details)'}
                      </span>
                    </label>
                    <div className="relative" ref={soDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setSoDropdownOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-xl bg-background text-sm hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <ShoppingCart size={14} className="text-muted-foreground shrink-0" />
                          {soLoading ? (
                            <span className="text-muted-foreground text-xs">{lang === 'hi' ? 'लोड हो रहा है…' : 'Loading details…'}</span>
                          ) : soFetchLoading ? (
                            <span className="text-muted-foreground text-xs">{lang === 'hi' ? 'ऑर्डर लोड हो रहे हैं…' : 'Loading orders…'}</span>
                          ) : selectedSalesOrder ? (
                            <span className="text-foreground font-500 truncate">
                              {selectedSalesOrder.vchNo}
                              <span className="text-muted-foreground ml-1.5">· {selectedSalesOrder.partyName}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {pendingSalesOrders.length === 0
                                ? (lang === 'hi' ? 'कोई पेंडिंग ऑर्डर नहीं' : 'No pending orders')
                                : (lang === 'hi' ? `${pendingSalesOrders.length} पेंडिंग ऑर्डर` : `${pendingSalesOrders.length} pending orders`)}
                            </span>
                          )}
                        </span>
                        <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${soDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {soDropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                          {/* Search */}
                          <div className="p-2 border-b border-border">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                              <input
                                type="text"
                                autoFocus
                                value={soSearch}
                                onChange={(e) => setSoSearch(e.target.value)}
                                placeholder={lang === 'hi' ? 'VCH नंबर, पार्टी खोजें…' : 'Search VCH no., party…'}
                                className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                          </div>

                          {/* Order list */}
                          <div className="max-h-48 overflow-y-auto">
                            {soFetchLoading ? (
                              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                {lang === 'hi' ? 'लोड हो रहा है…' : 'Loading…'}
                              </div>
                            ) : filteredSalesOrders.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                {pendingSalesOrders.length === 0
                                  ? (lang === 'hi' ? 'कोई पेंडिंग सेल्स ऑर्डर नहीं' : 'No pending sales orders found')
                                  : (lang === 'hi' ? 'कोई मिलान नहीं' : 'No match found')}
                              </div>
                            ) : (
                              filteredSalesOrders.map((so) => (
                                <button
                                  key={so.id}
                                  type="button"
                                  onClick={() => handleSelectSalesOrder(so)}
                                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 ${selectedSalesOrder?.id === so.id ? 'bg-primary/5' : ''}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <span className="text-xs font-600 text-foreground">{so.vchNo}</span>
                                      <span className="text-xs text-muted-foreground ml-1.5">· {so.partyName}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                        {lang === 'hi' ? 'पेंडिंग' : 'Pending'}
                                      </span>
                                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                        {so.totalQty} {lang === 'hi' ? 'नग' : 'pcs'}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>

                          {/* Clear selection */}
                          {selectedSalesOrder && (
                            <div className="border-t border-border">
                              <button
                                type="button"
                                onClick={() => { setSelectedSalesOrder(null); setSoDropdownOpen(false); }}
                                className="w-full text-xs text-muted-foreground hover:text-danger transition-colors py-2"
                              >
                                {lang === 'hi' ? '✕ चयन हटाएं' : '✕ Clear selection'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Size & Colour preview — shown on Step 1 after SO is selected */}
                    {selectedSalesOrder && (selectedSizes.length > 0 || selectedColors.length > 0) && (
                      <div className="mt-3 p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                        <p className="text-xs font-700 text-primary uppercase tracking-wide">
                          {lang === 'hi' ? 'साइज़ और रंग — सेल्स ऑर्डर से' : 'Sizes & Colours from Sales Order'}
                        </p>

                        {selectedSizes.length > 0 && (
                          <div>
                            <p className="text-xs font-600 text-muted-foreground mb-1.5">
                              {lang === 'hi' ? 'साइज़' : 'Sizes'}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedSizes.map((size) => (
                                <div
                                  key={`so-size-${size}`}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-700"
                                >
                                  <span>{size}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedColors.length > 0 && (
                          <div>
                            <p className="text-xs font-600 text-muted-foreground mb-1.5">
                              {lang === 'hi' ? 'रंग' : 'Colours'}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedColors.map((colour) => (
                                <span
                                  key={`so-colour-${colour}`}
                                  className="px-2 py-1 rounded-lg bg-card border border-border text-foreground text-xs font-600"
                                >
                                  {colour}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {lang === 'hi' ?'आप अगले चरण में इन्हें बदल सकते हैं।' :'You can adjust these in the next step.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Item Master Selector */}
                <div>
                  <label className="block text-sm font-600 text-foreground mb-1.5">
                    {lang === 'hi' ? 'आइटम मास्टर से चुनें' : 'Select from Item Master'}
                    <span className="text-xs text-muted-foreground ml-2 font-400">
                      {lang === 'hi' ? '(वैकल्पिक — स्वतः भरेगा)' : '(optional — auto-fills style & code)'}
                    </span>
                  </label>
                  <div className="relative" ref={itemDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setItemDropdownOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-xl bg-background text-sm hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Package size={14} className="text-muted-foreground shrink-0" />
                        {selectedItem ? (
                          <span className="text-foreground font-500 truncate">
                            JC {selectedItem.job_card_no} · {selectedItem.colour}
                            {selectedItem.set_type && <span className="text-muted-foreground ml-1">({selectedItem.set_type})</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {itemVariants.length === 0
                              ? (lang === 'hi' ? 'आइटम लोड हो रहे हैं…' : 'Loading items…')
                              : (lang === 'hi' ? `${itemVariants.length} आइटम उपलब्ध` : `${itemVariants.length} items available`)}
                          </span>
                        )}
                      </span>
                      <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${itemDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {itemDropdownOpen && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                        {/* Search inside dropdown */}
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="text"
                              autoFocus
                              value={itemSearch}
                              onChange={(e) => setItemSearch(e.target.value)}
                              placeholder={lang === 'hi' ? 'JC नंबर, रंग, स्टाइल खोजें…' : 'Search JC no., colour, style…'}
                              className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </div>
                        </div>

                        {/* Item list */}
                        <div className="max-h-48 overflow-y-auto">
                          {filteredItems.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                              {itemVariants.length === 0
                                ? (lang === 'hi' ? 'कोई आइटम नहीं — पहले इम्पोर्ट करें' : 'No items — run import first')
                                : (lang === 'hi' ? 'कोई मिलान नहीं' : 'No match found')}
                            </div>
                          ) : (
                            filteredItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectItem(item)}
                                className={`w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 ${selectedItem?.id === item.id ? 'bg-primary/5' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-xs font-600 text-foreground">JC {item.job_card_no}</span>
                                    <span className="text-xs text-muted-foreground ml-1.5">· {item.colour}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {item.set_type && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">{item.set_type}</span>
                                    )}
                                    {item.style_no && (
                                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{item.style_no}</span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        {/* Create New Item + Clear selection */}
                        <div className="border-t border-border">
                          <button
                            type="button"
                            onClick={() => { setItemDropdownOpen(false); window.location.href = '/item-master'; }}
                            className="w-full text-left px-3 py-2.5 text-xs font-600 text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5 border-b border-border/40"
                          >
                            <Plus size={12} />
                            {lang === 'hi' ? 'नया आइटम बनाएं' : 'Create New Item'}
                          </button>
                          {selectedItem && (
                            <button
                              type="button"
                              onClick={() => { setSelectedItem(null); setItemDropdownOpen(false); }}
                              className="w-full text-xs text-muted-foreground hover:text-danger transition-colors py-2"
                            >
                              {lang === 'hi' ? '✕ चयन हटाएं' : '✕ Clear selection'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Job Card Number — editable in edit mode only */}
                {isEditMode && (
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'जॉब कार्ड नंबर' : 'Job Card Number'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('jobCardNo', { required: 'Job card number required' })}
                      placeholder="e.g. JC-2026-001"
                      className="input-field"
                    />
                    {errors.jobCardNo && <p className="text-xs text-danger mt-1 font-500">{errors.jobCardNo.message}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'स्टाइल नाम (English)' : 'Style Name (English)'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('styleEn', { required: 'Style name required' })}
                      placeholder="e.g. Floral Anarkali — Navy"
                      className="input-field"
                    />
                    {errors.styleEn && <p className="text-xs text-danger mt-1 font-500">{errors.styleEn.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'स्टाइल नाम (हिंदी)' : 'Style Name (Hindi)'}
                    </label>
                    <input
                      type="text"
                      {...register('styleHi')}
                      placeholder="जैसे: फ्लोरल अनारकली — नेवी"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'डिज़ाइन कोड' : 'Design Code'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('designCode', { required: 'Design code required' })}
                      placeholder="e.g. ANK-048"
                      className="input-field"
                    />
                    {errors.designCode && <p className="text-xs text-danger mt-1 font-500">{errors.designCode.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'PO नंबर' : 'PO Number'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('poNo', { required: 'PO number required' })}
                      placeholder="e.g. PO-2026-115"
                      className="input-field"
                    />
                    {errors.poNo && <p className="text-xs text-danger mt-1 font-500">{errors.poNo.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'पार्टी का नाम' : 'Party Name'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      list="party-suggestions"
                      {...register('partyName', { required: 'Party required' })}
                      placeholder={lang === 'hi' ? 'पार्टी का नाम लिखें' : 'Type or select party name'}
                      className="input-field"
                    />
                    {errors.partyName && <p className="text-xs text-danger mt-1 font-500">{errors.partyName.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'कुल पीस' : 'Total Pieces'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="number"
                      {...register('totalPieces', {
                        required: 'Required',
                        min: { value: 1, message: 'Min 1 piece' },
                      })}
                      className="input-field"
                    />
                    {errors.totalPieces && <p className="text-xs text-danger mt-1 font-500">{errors.totalPieces.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-600 text-foreground mb-1.5">
                      {lang === 'hi' ? 'देय तारीख' : 'Due Date'}
                      <span className="text-danger ml-1">*</span>
                    </label>
                    <input
                      type="date"
                      {...register('dueDate', { required: 'Due date required' })}
                      className="input-field"
                    />
                    {errors.dueDate && <p className="text-xs text-danger mt-1 font-500">{errors.dueDate.message}</p>}
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Size & Color */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-700 text-foreground mb-2">
                    {lang === 'hi' ? 'साइज़ चुनें' : 'Select Sizes'}
                    <span className="text-xs text-muted-foreground ml-2 font-500">
                      ({selectedSizes.length} {lang === 'hi' ? 'चुने' : 'selected'})
                    </span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {SIZE_OPTIONS.map((size) => (
                      <button
                        key={`size-opt-${size}`}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={`w-12 h-12 rounded-xl text-sm font-700 border-2 transition-all duration-150 ${
                          selectedSizes.includes(size)
                            ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  {selectedSizes.length === 0 && (
                    <p className="text-xs text-danger mt-1.5 font-500">
                      {lang === 'hi' ? 'कम से कम एक साइज़ चुनें' : 'Select at least one size'}
                    </p>
                  )}
                </div>

                {/* Size Ratio Quantities — shown when ratios exist (from SO or edit mode) */}
                {selectedSizes.length > 0 && (
                  <div>
                    <label className="block text-sm font-700 text-foreground mb-2">
                      {lang === 'hi' ? 'साइज़ अनुपात (नग)' : 'Size Ratios (Qty per Size)'}
                      <span className="text-xs text-muted-foreground ml-2 font-400">
                        {selectedSalesOrder
                          ? (lang === 'hi' ? '(सेल्स ऑर्डर से — बदल सकते हैं)' : '(from sales order — editable)')
                          : (lang === 'hi' ? '(बदल सकते हैं)' : '(editable)')}
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedSizes.map((size) => (
                        <div key={`ratio-${size}`} className="flex flex-col gap-1">
                          <span className="text-xs font-600 text-muted-foreground text-center">{size}</span>
                          <input
                            type="number"
                            min={0}
                            value={sizeRatios[size] ?? (isEditMode ? (editCard?.sizeRatios?.[size] ?? 0) : 0)}
                            onChange={(e) => updateSizeRatio(size, Number(e.target.value))}
                            className="input-field text-center text-sm font-700 py-2"
                          />
                        </div>
                      ))}
                    </div>
                    {(isEditMode || selectedSalesOrder) && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {lang === 'hi' ?'⚠ ये नग सेल्स ऑर्डर से आए हैं। बदलाव केवल इस जॉब कार्ड पर लागू होगा।' :'⚠ These quantities come from the sales order. Changes apply only to this job card.'}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-700 text-foreground mb-2">
                    {lang === 'hi' ? 'रंग चुनें' : 'Select Colors'}
                    <span className="text-xs text-muted-foreground ml-2 font-500">
                      ({selectedColors.length} {lang === 'hi' ? 'चुने' : 'selected'})
                    </span>
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={`color-opt-${color}`}
                        type="button"
                        onClick={() => toggleColor(color)}
                        className={`px-3 py-2 rounded-lg text-xs font-600 border-2 transition-all duration-150 ${
                          selectedColors.includes(color)
                            ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                  {selectedColors.length === 0 && (
                    <p className="text-xs text-danger mt-1.5 font-500">
                      {lang === 'hi' ? 'कम से कम एक रंग चुनें' : 'Select at least one color'}
                    </p>
                  )}
                </div>

                {selectedSizes.length > 0 && selectedColors.length > 0 && (
                  <div className="p-3 bg-muted rounded-xl">
                    <p className="section-label mb-2">
                      {lang === 'hi' ? 'मैट्रिक्स प्रीव्यू' : 'Matrix Preview'}
                    </p>
                    <p className="text-sm font-700 text-foreground">
                      {selectedSizes.length} × {selectedColors.length} ={' '}
                      <span className="text-primary">{selectedSizes.length * selectedColors.length}</span>{' '}
                      {lang === 'hi' ? 'कॉम्बिनेशन' : 'combinations'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedSizes.join(', ')} · {selectedColors.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <p className="section-label">{lang === 'hi' ? 'जॉब कार्ड समीक्षा' : 'Job Card Review'}</p>
                  {[
                    ...(selectedSalesOrder ? [{ labelEn: 'Sales Order', labelHi: 'सेल्स ऑर्डर', value: selectedSalesOrder.vchNo }] : []),
                    { labelEn: 'Style', labelHi: 'स्टाइल', value: watchedData.styleEn || '—' },
                    { labelEn: 'Design Code', labelHi: 'डिज़ाइन कोड', value: watchedData.designCode || '—' },
                    { labelEn: 'Party', labelHi: 'पार्टी', value: watchedData.partyName || '—' },
                    { labelEn: 'PO Number', labelHi: 'PO नंबर', value: watchedData.poNo || '—' },
                    { labelEn: 'Total Pieces', labelHi: 'कुल पीस', value: watchedData.totalPieces?.toString() || '—' },
                    { labelEn: 'Due Date', labelHi: 'देय तारीख', value: watchedData.dueDate || '—' },
                    { labelEn: 'Sizes', labelHi: 'साइज़', value: selectedSizes.join(', ') || '—' },
                    { labelEn: 'Colors', labelHi: 'रंग', value: selectedColors.join(', ') || '—' },
                    ...(isEditMode ? [{ labelEn: 'Job Card No.', labelHi: 'जॉब कार्ड नंबर', value: watchedData.jobCardNo || '—' }] : []),
                  ].map((row, idx) => (
                    <div key={`review-${idx}`} className="flex items-start justify-between gap-4">
                      <span className="text-xs text-muted-foreground font-600 flex-shrink-0">
                        {lang === 'hi' ? row.labelHi : row.labelEn}
                      </span>
                      <span className="text-xs font-700 text-foreground text-right">{row.value}</span>
                    </div>
                  ))}
                  {/* Show size ratios in review if set */}
                  {Object.keys(sizeRatios).length > 0 && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs text-muted-foreground font-600 flex-shrink-0">
                        {lang === 'hi' ? 'साइज़ अनुपात' : 'Size Ratios'}
                      </span>
                      <span className="text-xs font-700 text-foreground text-right">
                        {selectedSizes.map((s) => `${s}:${sizeRatios[s] ?? (isEditMode ? (editCard?.sizeRatios?.[s] ?? 0) : 0)}`).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-xs font-600 text-primary">
                    {isEditMode
                      ? (lang === 'hi' ? '✓ जॉब कार्ड की जानकारी अपडेट होगी' : '✓ Job card details will be updated')
                      : (lang === 'hi' ? '✓ जॉब कार्ड "कटाई" स्टेज से शुरू होगा' : '✓ Job card will start at "Cutting" stage')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 bg-muted/30">
            <button
              type="button"
              onClick={step === 1 ? onClose : () => setStep(step - 1)}
              className="btn-secondary"
            >
              {step === 1
                ? (lang === 'hi' ? 'रद्द करें' : 'Cancel')
                : (lang === 'hi' ? 'पिछला' : 'Back')}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 2 && (selectedSizes.length === 0 || selectedColors.length === 0)) return;
                  setStep(step + 1);
                }}
                className="btn-primary flex items-center gap-1.5"
              >
                {lang === 'hi' ? 'अगला' : 'Next'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span>{isEditMode ? (lang === 'hi' ? 'अपडेट हो रहा है...' : 'Updating...') : (lang === 'hi' ? 'बन रहा है...' : 'Creating...')}</span>
                  </>
                ) : isEditMode ? (
                  <>
                    <Save size={14} />
                    <span>{lang === 'hi' ? 'बदलाव सेव करें' : 'Save Changes'}</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>{lang === 'hi' ? 'जॉब कार्ड बनाएं' : 'Create Job Card'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}