import { createClient } from '@/lib/supabase/client';
import { Account, AccountType, DealerType, FilingFrequency } from '@/app/account-master/data/accountsData';
import { getCreateAudit, getUpdateAudit } from '@/lib/auditTrail';

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const errorClass = error.code.substring(0, 2);
    if (errorClass === '42') return true;
    if (errorClass === '23') return false;
    if (errorClass === '08') return true;
  }
  if (error.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return schemaErrorPatterns.some((p) => p.test(error.message));
  }
  return false;
}

function rowToAccount(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    parentGroup: row.parent_group as AccountType,
    add1: row.add1 || '',
    add2: row.add2 || '',
    add3: row.add3 || '',
    add4: row.add4 || '',
    typeOfDealer: (row.type_of_dealer || '') as DealerType | '',
    mob: row.mob || '',
    billByBill: (row.bill_by_bill || 'Y') as 'Y' | 'N',
    alias: row.alias || '',
    opBalDr: Number(row.op_bal_dr) || 0,
    opBalCr: Number(row.op_bal_cr) || 0,
    gstin: row.gstin || '',
    filingFrequency: (row.filing_frequency || '') as FilingFrequency,
    createdAt: row.created_at ? row.created_at.split('T')[0] : '',
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at || null,
  };
}

function accountToRow(account: Partial<Account>) {
  return {
    name: account.name,
    parent_group: account.parentGroup,
    add1: account.add1 || '',
    add2: account.add2 || '',
    add3: account.add3 || '',
    add4: account.add4 || '',
    type_of_dealer: account.typeOfDealer ? account.typeOfDealer : 'Un-Registered',
    mob: account.mob || '',
    bill_by_bill: account.billByBill || 'Y',
    alias: account.alias || '',
    op_bal_dr: account.opBalDr || 0,
    op_bal_cr: account.opBalCr || 0,
    gstin: account.gstin || '',
    filing_frequency: account.filingFrequency || '',
  };
}

export const accountService = {
  async getAll(): Promise<Account[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data || []).map(rowToAccount);
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return [];
    }
  },

  async create(account: Omit<Account, 'id' | 'createdAt'>, username?: string | null): Promise<{ data: Account | null; error: string | null }> {
    const supabase = createClient();
    try {
      const row = { ...accountToRow(account), ...getCreateAudit(username ?? null) };
      console.log('[accountService.create] Inserting row:', JSON.stringify(row, null, 2));
      const { data, error } = await supabase
        .from('accounts')
        .insert(row)
        .select()
        .single();
      if (error) {
        const msg = `[Supabase Error] code=${error.code} message=${error.message} details=${error.details} hint=${error.hint}`;
        console.error('[accountService.create] Supabase error:', msg, '\nRow attempted:', row);
        return { data: null, error: `${error.message}${error.hint ? ' — ' + error.hint : ''}` };
      }
      console.log('[accountService.create] Success, inserted id:', data?.id);
      return { data: rowToAccount(data), error: null };
    } catch (err: any) {
      console.error('[accountService.create] Exception:', err.message);
      return { data: null, error: err.message };
    }
  },

  async update(id: string, account: Partial<Account>, username?: string | null): Promise<{ data: Account | null; error: string | null }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('accounts')
        .update({ ...accountToRow(account), ...getUpdateAudit(username ?? null) })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('[accountService.update] Supabase error:', error.message, error.details, error.hint);
        return { data: null, error: `${error.message}${error.hint ? ' — ' + error.hint : ''}` };
      }
      return { data: rowToAccount(data), error: null };
    } catch (err: any) {
      console.error('[accountService.update] Exception:', err.message);
      return { data: null, error: err.message };
    }
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) {
        if (isSchemaError(error)) throw error;
        return false;
      }
      return true;
    } catch (error: any) {
      if (isSchemaError(error)) throw error;
      return false;
    }
  },

  async seedFromLocal(accounts: Account[]): Promise<void> {
    const supabase = createClient();
    try {
      const { count } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true });
      if ((count || 0) > 0) return; // already seeded
      const rows = accounts.map((a) => ({
        legacy_id: a.id,
        ...accountToRow(a),
      }));
      // Insert in batches of 50
      for (let i = 0; i < rows.length; i += 50) {
        await supabase.from('accounts').insert(rows.slice(i, i + 50));
      }
    } catch (error: any) {
      console.log('Account seed error:', error.message);
    }
  },
};
