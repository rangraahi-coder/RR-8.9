'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Filter, Edit2, Eye, CheckCircle, XCircle, ChevronDown, X, Upload, Phone, MapPin, FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Account, AccountType, ALL_ACCOUNT_TYPES, ACCOUNT_TYPE_META, DealerType, validateGSTIN, validateMobile, getFullAddress } from '../data/accountsData';
import { accountService } from '@/lib/services/accountService';
import { useRealtimeData } from '@/contexts/RealtimeDataContext';
import AuditBadge from '@/components/ui/AuditBadge';

// ─── Avatar color helper ─────────────────────────────────────────────────────
function getAvatarClass(type: AccountType): string {
  const map: Record<AccountType, string> = {
    'Sundry Creditors': 'bg-orange-500',
    'Sundry Debtors': 'bg-blue-500',
    'Contractor': 'bg-violet-500',
    'Job Worker': 'bg-pink-500',
    'Bank Account': 'bg-teal-500',
    'Cash Account': 'bg-green-500',
    'Sales Account': 'bg-indigo-500',
    'Purchase Account': 'bg-amber-500',
    'Expense Account': 'bg-red-500',
    'Other': 'bg-gray-500',
  };
  return map[type] ?? 'bg-gray-500';
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
interface EditModalProps {
  account: Account;
  onClose: () => void;
  onSave: (updated: Account) => void;
}

function EditModal({ account, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState<Account>({ ...account });

  const handleChange = (field: keyof Account, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const gstinValid = validateGSTIN(form.gstin);
  const mobValid = validateMobile(form.mob);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-700 text-foreground">Edit Account</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{account.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Account Name *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Account Type</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.parentGroup}
                onChange={e => handleChange('parentGroup', e.target.value as AccountType)}
              >
                {ALL_ACCOUNT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Address Line 1</label>
            <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.add1} onChange={e => handleChange('add1', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Address Line 2</label>
              <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.add2} onChange={e => handleChange('add2', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Address Line 3</label>
              <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.add3} onChange={e => handleChange('add3', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Address Line 4</label>
            <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" value={form.add4} onChange={e => handleChange('add4', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">GSTIN</label>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${!gstinValid ? 'border-red-400' : 'border-border'}`}
                value={form.gstin}
                onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
              />
              {!gstinValid && <p className="text-xs text-red-500 mt-1">Invalid GSTIN format</p>}
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Mobile</label>
              <input
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${!mobValid ? 'border-red-400' : 'border-border'}`}
                value={form.mob}
                onChange={e => handleChange('mob', e.target.value)}
                placeholder="10-digit mobile"
              />
              {!mobValid && <p className="text-xs text-red-500 mt-1">Invalid mobile number</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Type of Dealer</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.typeOfDealer}
                onChange={e => handleChange('typeOfDealer', e.target.value as DealerType)}
              >
                <option value="">— Select —</option>
                <option value="Registered">Registered</option>
                <option value="Un-Registered">Un-Registered</option>
                <option value="Composition">Composition</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Filing Frequency</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.filingFrequency}
                onChange={e => handleChange('filingFrequency', e.target.value as Account['filingFrequency'])}
              >
                <option value="">— Select —</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Not Known">Not Known</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Opening Balance (Dr) ₹</label>
              <input
                type="number"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.opBalDr}
                onChange={e => handleChange('opBalDr', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Opening Balance (Cr) ₹</label>
              <input
                type="number"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.opBalCr}
                onChange={e => handleChange('opBalCr', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-600 text-muted-foreground">Bill by Bill:</label>
            <select
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none"
              value={form.billByBill}
              onChange={e => handleChange('billByBill', e.target.value as 'Y' | 'N')}
            >
              <option value="Y">Yes</option>
              <option value="N">No</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-600 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { if (gstinValid && mobValid) onSave(form); }}
            disabled={!gstinValid || !mobValid || !form.name.trim()}
            className="px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────
interface ViewModalProps {
  account: Account;
  onClose: () => void;
}

function ViewModal({ account, onClose }: ViewModalProps) {
  const address = getFullAddress(account);
  const gstinValid = validateGSTIN(account.gstin);
  const mobValid = validateMobile(account.mob);
  const meta = ACCOUNT_TYPE_META[account.parentGroup] ?? ACCOUNT_TYPE_META['Other'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-700 text-sm ${getAvatarClass(account.parentGroup)}`}>
              {account.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-sm font-700 text-foreground">{account.name}</h2>
              <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                {account.parentGroup}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {address && (
            <div className="flex gap-2">
              <MapPin size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground">{address}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">GSTIN</p>
              <div className="flex items-center gap-1.5">
                <p className="font-600 text-foreground font-mono text-xs">{account.gstin || '—'}</p>
                {account.gstin && (gstinValid ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />)}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Mobile</p>
              <div className="flex items-center gap-1.5">
                <p className="font-600 text-foreground text-xs">{account.mob || '—'}</p>
                {account.mob && (mobValid ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />)}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Dealer Type</p>
              <p className="font-600 text-foreground text-xs">{account.typeOfDealer || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Filing Frequency</p>
              <p className="font-600 text-foreground text-xs">{account.filingFrequency || '—'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Op. Balance (Dr)</p>
              <p className="font-600 text-green-600 text-xs">₹{account.opBalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Op. Balance (Cr)</p>
              <p className="font-600 text-red-600 text-xs">₹{account.opBalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText size={12} />
            <span>Bill by Bill: <strong className="text-foreground">{account.billByBill === 'Y' ? 'Yes' : 'No'}</strong></span>
          </div>
          {(account.createdBy || account.updatedBy) && (
            <div className="bg-muted/40 rounded-lg p-3 border border-border">
              <p className="text-xs font-600 text-muted-foreground mb-2">Audit Trail</p>
              <AuditBadge
                createdBy={account.createdBy}
                createdAt={account.createdAt}
                updatedBy={account.updatedBy}
                updatedAt={account.updatedAt}
                variant="block"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────
interface AddMasterModalProps {
  onClose: () => void;
  onSave: (account: Account) => void;
}

function AddMasterModal({ onClose, onSave }: AddMasterModalProps) {
  const [form, setForm] = useState<Account>({
    id: '',
    name: '',
    parentGroup: 'Sundry Creditors',
    add1: '',
    add2: '',
    add3: '',
    add4: '',
    typeOfDealer: 'Registered',
    mob: '',
    billByBill: 'Y',
    alias: '',
    opBalDr: 0,
    opBalCr: 0,
    gstin: '',
    filingFrequency: '',
    createdAt: new Date().toISOString().split('T')[0],
  });

  const handleChange = (field: keyof Account, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    // Pass form data without a fake ID — parent will get real ID from Supabase
    const newAccount: Account = { ...form, id: '' };
    onSave(newAccount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-700 text-foreground">Add New Account</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create any type of account — party, bank, cash, sales, contractors & more</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-muted-foreground mb-1">Account Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                required
                placeholder="Enter account name"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Account Type <span className="text-red-500">*</span></label>
              <select
                value={form.parentGroup}
                onChange={e => handleChange('parentGroup', e.target.value as AccountType)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ALL_ACCOUNT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Alias</label>
              <input
                type="text"
                value={form.alias}
                onChange={e => handleChange('alias', e.target.value)}
                placeholder="Short name / alias"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Type of Dealer</label>
              <select
                value={form.typeOfDealer}
                onChange={e => handleChange('typeOfDealer', e.target.value as DealerType)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Select —</option>
                <option value="Registered">Registered</option>
                <option value="Un-Registered">Un-Registered</option>
                <option value="Composition">Composition</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Mobile</label>
              <input
                type="text"
                value={form.mob}
                onChange={e => handleChange('mob', e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">GSTIN</label>
              <input
                type="text"
                value={form.gstin}
                onChange={e => handleChange('gstin', e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
                maxLength={15}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Filing Frequency</label>
              <select
                value={form.filingFrequency}
                onChange={e => handleChange('filingFrequency', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Not Known">Not Known</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Bill by Bill</label>
              <select
                value={form.billByBill}
                onChange={e => handleChange('billByBill', e.target.value as 'Y' | 'N')}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-muted-foreground mb-1">Address Line 1</label>
              <input
                type="text"
                value={form.add1}
                onChange={e => handleChange('add1', e.target.value)}
                placeholder="Address line 1"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-muted-foreground mb-1">Address Line 2</label>
              <input
                type="text"
                value={form.add2}
                onChange={e => handleChange('add2', e.target.value)}
                placeholder="Address line 2"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Opening Balance (Dr) ₹</label>
              <input
                type="number"
                value={form.opBalDr}
                onChange={e => handleChange('opBalDr', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground mb-1">Opening Balance (Cr) ₹</label>
              <input
                type="number"
                value={form.opBalCr}
                onChange={e => handleChange('opBalCr', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-600 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface AccountMasterContentProps {
  lang?: 'en' | 'hi';
}

export default function AccountMasterContent({ lang = 'en' }: AccountMasterContentProps) {
  const { refreshAccounts } = useRealtimeData();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterType, setFilterType] = useState<AccountType | 'all'>('all');
  const [filterDealer, setFilterDealer] = useState<'all' | DealerType>('all');
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [viewAccount, setViewAccount] = useState<Account | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [addNewAccount, setAddNewAccount] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountService.getAll();
      setAccounts(data);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Realtime: re-fetch via global context subscription (no separate channel needed)
  useEffect(() => {
    loadAccounts();
  }, [refreshAccounts]);

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        a.name.toLowerCase().includes(q) ||
        a.gstin.toLowerCase().includes(q) ||
        a.mob.includes(q) ||
        a.parentGroup.toLowerCase().includes(q) ||
        getFullAddress(a).toLowerCase().includes(q);
      const matchType = filterType === 'all' || a.parentGroup === filterType;
      const matchDealer = filterDealer === 'all' || a.typeOfDealer === filterDealer;
      return matchSearch && matchType && matchDealer;
    });
  }, [accounts, search, filterType, filterDealer]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    ALL_ACCOUNT_TYPES.forEach(t => { byType[t] = accounts.filter(a => a.parentGroup === t).length; });
    return {
      total: accounts.length,
      creditors: byType['Sundry Creditors'] || 0,
      debtors: byType['Sundry Debtors'] || 0,
      contractors: byType['Contractor'] || 0,
      jobWorkers: byType['Job Worker'] || 0,
      banks: byType['Bank Account'] || 0,
      cash: byType['Cash Account'] || 0,
      sales: byType['Sales Account'] || 0,
      registered: accounts.filter(a => a.typeOfDealer === 'Registered').length,
      withGST: accounts.filter(a => a.gstin).length,
      invalidGST: accounts.filter(a => a.gstin && !validateGSTIN(a.gstin)).length,
    };
  }, [accounts]);

  const handleSave = async (updated: Account) => {
    const result = await accountService.update(updated.id, updated);
    if (result.data) {
      setAccounts(prev => prev.map(a => a.id === updated.id ? result.data! : a));
    } else {
      const errMsg = result.error ? `Update failed: ${result.error}` : 'Update failed. Please try again.';
      console.error('[handleSave]', errMsg);
      setToastMsg({ text: errMsg, type: 'error' });
      setTimeout(() => setToastMsg(null), 7000);
      // Re-fetch from DB to ensure consistent state
      try {
        const data = await accountService.getAll();
        setAccounts(data);
      } catch {}
    }
    setEditAccount(null);
    refreshAccounts();
  };

  const handleAddNew = async (newAccount: Account) => {
    const result = await accountService.create(newAccount);
    if (result.data) {
      // Re-fetch from DB to get the real record with server-assigned ID
      try {
        const data = await accountService.getAll();
        setAccounts(data);
      } catch {
        setAccounts(prev => [result.data!, ...prev]);
      }
      setToastMsg({ text: `Account "${result.data.name}" created successfully!`, type: 'success' });
      setTimeout(() => setToastMsg(null), 4000);
    } else {
      const errMsg = result.error ? `Failed to save: ${result.error}` : 'Failed to save account. Please try again.';
      console.error('[handleAddNew]', errMsg);
      setToastMsg({ text: errMsg, type: 'error' });
      setTimeout(() => setToastMsg(null), 8000);
    }
    setAddNewAccount(false);
    refreshAccounts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-600 animate-fade-in ${toastMsg.type === 'success' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
          {toastMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toastMsg.text}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-foreground">Account Master</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Single master for all account types — parties, banks, cash, sales, contractors & more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddNewAccount(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} />
            Add New Account
          </button>
          <Link
            href="/account-master/import"
            className="flex items-center gap-2 px-4 py-2 border border-border text-foreground text-sm font-600 rounded-lg hover:bg-muted transition-colors"
          >
            <Upload size={15} />
            Import
          </Link>
        </div>
      </div>

      {/* Stats — top row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Accounts', value: stats.total, color: 'text-foreground', bg: 'bg-muted/60' },
          { label: 'Sundry Creditors', value: stats.creditors, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Sundry Debtors', value: stats.debtors, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Contractors', value: stats.contractors, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Job Workers', value: stats.jobWorkers, color: 'text-pink-600', bg: 'bg-pink-50' },
          { label: 'Bank / Cash', value: stats.banks + stats.cash, color: 'text-teal-600', bg: 'bg-teal-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
            <p className={`text-2xl font-800 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search by name, type, GSTIN, mobile, address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-600 transition-colors ${showFilters ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:bg-muted'}`}
        >
          <Filter size={14} />
          Filters
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-col gap-4 p-4 bg-muted/40 rounded-xl border border-border">
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-2">Account Type</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-colors ${filterType === 'all' ? 'bg-primary text-white' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
              >
                All Types
              </button>
              {ALL_ACCOUNT_TYPES.map(t => {
                const meta = ACCOUNT_TYPE_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-colors ${filterType === t ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-2">Dealer Type</label>
            <div className="flex gap-2">
              {(['all', 'Registered', 'Un-Registered', 'Composition'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterDealer(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-600 transition-colors ${filterDealer === t ? 'bg-primary text-white' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {t === 'all' ? 'All Dealers' : t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        Showing <strong className="text-foreground">{filtered.length}</strong> of {accounts.length} accounts
        {search && <> matching &quot;<strong className="text-foreground">{search}</strong>&quot;</>}
      </p>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Account Name</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">GSTIN</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Mobile</th>
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Address</th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Op. Bal (Dr)</th>
                <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Op. Bal (Cr)</th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No accounts found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map(account => {
                  const gstinValid = validateGSTIN(account.gstin);
                  const mobValid = validateMobile(account.mob);
                  const address = getFullAddress(account);
                  const meta = ACCOUNT_TYPE_META[account.parentGroup] ?? ACCOUNT_TYPE_META['Other'];
                  return (
                    <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-700 text-xs flex-shrink-0 ${getAvatarClass(account.parentGroup)}`}>
                            {account.name.charAt(0)}
                          </div>
                          <span className="font-600 text-foreground text-xs">{account.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                          {meta.short}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {account.gstin ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-foreground">{account.gstin}</span>
                            {gstinValid ? <CheckCircle size={11} className="text-green-500 flex-shrink-0" /> : <XCircle size={11} className="text-red-500 flex-shrink-0" />}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {account.mob ? (
                          <div className="flex items-center gap-1">
                            <Phone size={11} className="text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-foreground">{account.mob}</span>
                            {mobValid ? <CheckCircle size={11} className="text-green-500 flex-shrink-0" /> : <XCircle size={11} className="text-red-500 flex-shrink-0" />}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {address ? (
                          <p className="text-xs text-muted-foreground truncate" title={address}>{address}</p>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {account.opBalDr > 0 ? (
                          <span className="text-xs font-600 text-green-600">₹{account.opBalDr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {account.opBalCr > 0 ? (
                          <span className="text-xs font-600 text-red-600">₹{account.opBalCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewAccount(account)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="View"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => setEditAccount(account)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} />
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
      </div>

      {editAccount && <EditModal account={editAccount} onClose={() => setEditAccount(null)} onSave={handleSave} />}
      {viewAccount && <ViewModal account={viewAccount} onClose={() => setViewAccount(null)} />}
      {addNewAccount && <AddMasterModal onClose={() => setAddNewAccount(false)} onSave={handleAddNew} />}
    </div>
  );
}
