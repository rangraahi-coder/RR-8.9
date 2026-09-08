'use client';
import React, { useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  ArrowLeft,
  TrendingUp,
  Hash,
  Phone,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { ACCOUNTS_DATA, validateGSTIN, validateMobile } from '../../data/accountsData';

export default function AccountImportContent({ lang = 'en' }: { lang?: 'en' | 'hi' }) {
  const summary = useMemo(() => {
    const total = ACCOUNTS_DATA.length;
    const gstinErrors = ACCOUNTS_DATA.filter(a => a.gstin && !validateGSTIN(a.gstin));
    const mobErrors = ACCOUNTS_DATA.filter(a => a.mob && !validateMobile(a.mob));
    const missingName = ACCOUNTS_DATA.filter(a => !a.name.trim());
    const noAddress = ACCOUNTS_DATA.filter(a => !a.add1 && !a.add2 && !a.add3 && !a.add4);
    const noGST = ACCOUNTS_DATA.filter(a => !a.gstin);
    const noMobile = ACCOUNTS_DATA.filter(a => !a.mob);
    const creditors = ACCOUNTS_DATA.filter(a => a.parentGroup === 'Sundry Creditors');
    const debtors = ACCOUNTS_DATA.filter(a => a.parentGroup === 'Sundry Debtors');
    const registered = ACCOUNTS_DATA.filter(a => a.typeOfDealer === 'Registered');
    const unregistered = ACCOUNTS_DATA.filter(a => a.typeOfDealer === 'Un-Registered');
    const composition = ACCOUNTS_DATA.filter(a => a.typeOfDealer === 'Composition');
    const monthly = ACCOUNTS_DATA.filter(a => a.filingFrequency === 'Monthly');
    const quarterly = ACCOUNTS_DATA.filter(a => a.filingFrequency === 'Quarterly');
    const notKnown = ACCOUNTS_DATA.filter(a => a.filingFrequency === 'Not Known');
    const withDrBalance = ACCOUNTS_DATA.filter(a => a.opBalDr > 0);
    const withCrBalance = ACCOUNTS_DATA.filter(a => a.opBalCr > 0);
    const totalDr = ACCOUNTS_DATA.reduce((s, a) => s + a.opBalDr, 0);
    const totalCr = ACCOUNTS_DATA.reduce((s, a) => s + a.opBalCr, 0);
    const validationErrors = [...new Set([...gstinErrors.map(a => a.id), ...mobErrors.map(a => a.id)])].length;
    const successfullyImported = total - missingName.length;

    return {
      total, successfullyImported, validationErrors, missingName: missingName.length,
      gstinErrors, mobErrors, noAddress, noGST, noMobile,
      creditors, debtors, registered, unregistered, composition,
      monthly, quarterly, notKnown,
      withDrBalance, withCrBalance, totalDr, totalCr,
    };
  }, []);

  const allValidationIssues = useMemo(() => {
    const issues: { id: string; name: string; field: string; issue: string; severity: 'error' | 'warning' }[] = [];
    ACCOUNTS_DATA.forEach(a => {
      if (a.gstin && !validateGSTIN(a.gstin)) {
        issues.push({ id: a.id, name: a.name, field: 'GSTIN', issue: `Invalid GSTIN: ${a.gstin}`, severity: 'error' });
      }
      if (a.mob && !validateMobile(a.mob)) {
        issues.push({ id: a.id, name: a.name, field: 'Mobile', issue: `Invalid mobile: ${a.mob}`, severity: 'error' });
      }
      if (!a.add1 && !a.add2 && !a.add3 && !a.add4) {
        issues.push({ id: a.id, name: a.name, field: 'Address', issue: 'No address provided', severity: 'warning' });
      }
      if (!a.mob) {
        issues.push({ id: a.id, name: a.name, field: 'Mobile', issue: 'Mobile number missing', severity: 'warning' });
      }
    });
    return issues;
  }, []);

  const errorIssues = allValidationIssues.filter(i => i.severity === 'error');
  const warningIssues = allValidationIssues.filter(i => i.severity === 'warning');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/account-master" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-800 text-foreground">Import Summary</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comp0012_ListofAccounts — Account Master Import Report</p>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileSpreadsheet size={16} className="text-blue-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground">Total Processed</p>
          </div>
          <p className="text-3xl font-800 text-foreground">{summary.total}</p>
          <p className="text-xs text-muted-foreground mt-1">rows from Excel file</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground">Successfully Imported</p>
          </div>
          <p className="text-3xl font-800 text-green-600">{summary.successfullyImported}</p>
          <p className="text-xs text-muted-foreground mt-1">accounts created</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle size={16} className="text-red-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground">Validation Errors</p>
          </div>
          <p className="text-3xl font-800 text-red-600">{errorIssues.length}</p>
          <p className="text-xs text-muted-foreground mt-1">fields with errors</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center">
              <AlertTriangle size={16} className="text-yellow-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground">Warnings</p>
          </div>
          <p className="text-3xl font-800 text-yellow-600">{warningIssues.length}</p>
          <p className="text-xs text-muted-foreground mt-1">missing optional fields</p>
        </div>
      </div>

      {/* Column Mapping */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
          <Hash size={14} className="text-primary" />
          Column Mapping (Auto-detected)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { excel: 'Name', mapped: 'Account Name', status: 'ok' },
            { excel: 'Parent Group', mapped: 'Account Type', status: 'ok' },
            { excel: 'Add1', mapped: 'Address Line 1', status: 'ok' },
            { excel: 'ADD2', mapped: 'Address Line 2', status: 'ok' },
            { excel: 'ADD3', mapped: 'Address Line 3', status: 'ok' },
            { excel: 'ADD4', mapped: 'Address Line 4', status: 'ok' },
            { excel: 'TYPE OF DEALER', mapped: 'Dealer Type', status: 'ok' },
            { excel: 'MOB', mapped: 'Mobile Number', status: 'ok' },
            { excel: 'BILL BY BILL', mapped: 'Bill by Bill', status: 'ok' },
            { excel: 'Op. Bal.(Dr)', mapped: 'Opening Balance Dr', status: 'ok' },
            { excel: 'Op. Bal.(Cr)', mapped: 'Opening Balance Cr', status: 'ok' },
            { excel: 'GSTIN', mapped: 'GSTIN', status: 'ok' },
            { excel: 'Filing Frequency', mapped: 'Filing Frequency', status: 'ok' },
            { excel: 'Alias', mapped: '(Skipped — empty)', status: 'skip' },
            { excel: 'Type of Dealer (col 13)', mapped: '(Skipped — duplicate)', status: 'skip' },
          ].map(col => (
            <div key={col.excel} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${col.status === 'ok' ? 'bg-green-50' : 'bg-muted/50'}`}>
              {col.status === 'ok' ? <CheckCircle size={11} className="text-green-500 flex-shrink-0" /> : <AlertTriangle size={11} className="text-muted-foreground flex-shrink-0" />}
              <span className="font-600 text-foreground truncate">{col.excel}</span>
              <span className="text-muted-foreground">→</span>
              <span className={`truncate ${col.status === 'ok' ? 'text-green-700' : 'text-muted-foreground'}`}>{col.mapped}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account Type Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
            <Users size={14} className="text-primary" />
            Account Type Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm text-foreground">Sundry Creditors</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-orange-200 w-32 overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(summary.creditors.length / summary.total) * 100}%` }} />
                </div>
                <span className="text-sm font-700 text-foreground w-8 text-right">{summary.creditors.length}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-foreground">Sundry Debtors</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-blue-200 w-32 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(summary.debtors.length / summary.total) * 100}%` }} />
                </div>
                <span className="text-sm font-700 text-foreground w-8 text-right">{summary.debtors.length}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-xs font-600 text-muted-foreground mb-2">Dealer Type</p>
            {[
              { label: 'Registered', count: summary.registered.length, color: 'bg-green-500' },
              { label: 'Un-Registered', count: summary.unregistered.length, color: 'bg-gray-400' },
              { label: 'Composition', count: summary.composition.length, color: 'bg-purple-500' },
            ].map(d => (
              <div key={d.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${d.color}`} />
                  <span className="text-muted-foreground">{d.label}</span>
                </div>
                <span className="font-600 text-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GST & Filing */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            GST & Filing Frequency
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <span className="text-sm text-muted-foreground">Accounts with GSTIN</span>
              <span className="text-sm font-700 text-foreground">{ACCOUNTS_DATA.filter(a => a.gstin).length} / {summary.total}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <span className="text-sm text-muted-foreground">Valid GSTINs</span>
              <span className="text-sm font-700 text-green-600">{ACCOUNTS_DATA.filter(a => a.gstin && validateGSTIN(a.gstin)).length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-muted-foreground">Invalid GSTINs</span>
              <span className="text-sm font-700 text-red-600">{summary.gstinErrors.length}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-xs font-600 text-muted-foreground mb-2">Filing Frequency</p>
            {[
              { label: 'Monthly', count: summary.monthly.length },
              { label: 'Quarterly', count: summary.quarterly.length },
              { label: 'Not Known', count: summary.notKnown.length },
              { label: 'Not Set', count: ACCOUNTS_DATA.filter(a => !a.filingFrequency).length },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-600 text-foreground">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Opening Balance Summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          Opening Balance Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Total Dr Balance</p>
            <p className="text-lg font-800 text-green-600">₹{(summary.totalDr / 100000).toFixed(2)}L</p>
            <p className="text-xs text-muted-foreground">{summary.withDrBalance.length} accounts</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Total Cr Balance</p>
            <p className="text-lg font-800 text-red-600">₹{(summary.totalCr / 100000).toFixed(2)}L</p>
            <p className="text-xs text-muted-foreground">{summary.withCrBalance.length} accounts</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Zero Balance</p>
            <p className="text-lg font-800 text-foreground">{ACCOUNTS_DATA.filter(a => a.opBalDr === 0 && a.opBalCr === 0).length}</p>
            <p className="text-xs text-muted-foreground">accounts</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">With Mobile</p>
            <p className="text-lg font-800 text-foreground">{ACCOUNTS_DATA.filter(a => a.mob).length}</p>
            <p className="text-xs text-muted-foreground">of {summary.total} accounts</p>
          </div>
        </div>
      </div>

      {/* Validation Errors Table */}
      {errorIssues.length > 0 && (
        <div className="bg-card border border-red-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <XCircle size={15} className="text-red-600" />
            <h2 className="text-sm font-700 text-red-700">Validation Errors ({errorIssues.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-700 text-muted-foreground">Account Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-700 text-muted-foreground">Field</th>
                  <th className="text-left px-4 py-2.5 text-xs font-700 text-muted-foreground">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {errorIssues.map((issue, i) => (
                  <tr key={i} className="hover:bg-red-50/50">
                    <td className="px-4 py-2.5 text-xs font-600 text-foreground">{issue.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-red-100 text-red-700">{issue.field}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-red-600">{issue.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warnings */}
      <div className="bg-card border border-yellow-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-yellow-600" />
            <h2 className="text-sm font-700 text-yellow-700">Missing Optional Data ({warningIssues.length} fields)</h2>
          </div>
          <span className="text-xs text-yellow-600">Accounts imported successfully — data can be added later</span>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'No Address', count: summary.noAddress.length, icon: <AlertTriangle size={13} /> },
            { label: 'No Mobile', count: summary.noMobile.length, icon: <Phone size={13} /> },
            { label: 'No GSTIN', count: summary.noGST.length, icon: <Shield size={13} /> },
            { label: 'No Filing Freq.', count: ACCOUNTS_DATA.filter(a => !a.filingFrequency).length, icon: <FileSpreadsheet size={13} /> },
          ].map(w => (
            <div key={w.label} className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
              <span className="text-yellow-600">{w.icon}</span>
              <div>
                <p className="text-lg font-800 text-yellow-700">{w.count}</p>
                <p className="text-xs text-yellow-600">{w.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Success Banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={22} className="text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-700 text-green-800">Import Completed Successfully</p>
          <p className="text-xs text-green-700 mt-0.5">
            {summary.successfullyImported} accounts from Comp0012_ListofAccounts are now available in the Account Master. 
            All accounts are searchable, editable, and ready for use across purchases, sales, and accounting.
          </p>
        </div>
        <Link href="/account-master" className="flex-shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-600 rounded-lg hover:bg-green-700 transition-colors">
          View Accounts
        </Link>
      </div>
    </div>
  );
}
