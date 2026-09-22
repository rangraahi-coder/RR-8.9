export type AccountType =
  | 'Sundry Creditors' |'Sundry Debtors' |'Contractor' |'Job Worker' |'Bank Account' |'Cash Account' |'Sales Account' |'Purchase Account' |'Expense Account' |'Other';

export const ALL_ACCOUNT_TYPES: AccountType[] = [
  'Sundry Creditors',
  'Sundry Debtors',
  'Contractor',
  'Job Worker',
  'Bank Account',
  'Cash Account',
  'Sales Account',
  'Purchase Account',
  'Expense Account',
  'Other',
];

export const ACCOUNT_TYPE_META: Record<AccountType, { color: string; bg: string; short: string }> = {
  'Sundry Creditors':  { color: 'text-orange-700',  bg: 'bg-orange-100',  short: 'Creditor' },
  'Sundry Debtors':    { color: 'text-blue-700',    bg: 'bg-blue-100',    short: 'Debtor' },
  'Contractor':        { color: 'text-violet-700',  bg: 'bg-violet-100',  short: 'Contractor' },
  'Job Worker':        { color: 'text-pink-700',    bg: 'bg-pink-100',    short: 'Job Worker' },
  'Bank Account':      { color: 'text-teal-700',    bg: 'bg-teal-100',    short: 'Bank' },
  'Cash Account':      { color: 'text-green-700',   bg: 'bg-green-100',   short: 'Cash' },
  'Sales Account':     { color: 'text-indigo-700',  bg: 'bg-indigo-100',  short: 'Sales A/c' },
  'Purchase Account':  { color: 'text-amber-700',   bg: 'bg-amber-100',   short: 'Purchase A/c' },
  'Expense Account':   { color: 'text-red-700',     bg: 'bg-red-100',     short: 'Expense A/c' },
  'Other':             { color: 'text-gray-700',    bg: 'bg-gray-100',    short: 'Other' },
};

export type DealerType = 'Registered' | 'Un-Registered' | 'Composition';
export type FilingFrequency = 'Monthly' | 'Quarterly' | 'Not Known' | '';

export interface Account {
  id: string;
  name: string;
  parentGroup: AccountType;
  add1: string;
  add2: string;
  add3: string;
  add4: string;
  typeOfDealer: DealerType | '';
  mob: string;
  billByBill: 'Y' | 'N';
  alias: string;
  opBalDr: number;
  opBalCr: number;
  gstin: string;
  filingFrequency: FilingFrequency;
  createdAt: string;
  // Audit trail
  createdBy?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

// All imported account data has been permanently removed.
// Only manually punched entries from Supabase are used.
export const ACCOUNTS_DATA: Account[] = [];

// Validation helpers
export function validateGSTIN(gstin: string): boolean {
  if (!gstin) return true; // blank is allowed
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
}

export function validateMobile(mob: string): boolean {
  if (!mob) return true; // blank is allowed
  // Handle multiple numbers separated by comma
  const numbers = mob.split(',').map(n => n.trim());
  return numbers.every(n => /^[6-9]\d{9}$/.test(n));
}

export function getFullAddress(account: Account): string {
  return [account.add1, account.add2, account.add3, account.add4]
    .filter(Boolean)
    .join(', ');
}
