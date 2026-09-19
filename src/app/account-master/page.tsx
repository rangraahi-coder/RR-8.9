'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import AccountMasterContent from './components/AccountMasterContent';

function AccountMasterFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

export default function AccountMasterPage() {
  return (
    <AppLayout
      pageTitle="Account Master"
      pageTitleHi="खाता मास्टर"
      render={(lang) => (
        <Suspense fallback={<AccountMasterFallback />}>
          <AccountMasterContent lang={lang} />
        </Suspense>
      )}
    />
  );
}
