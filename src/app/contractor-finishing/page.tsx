'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ContractorFinishingContent from './components/ContractorFinishingContent';

export default function ContractorFinishingPage() {
  return (
    <AppLayout
      pageTitle="Contractor Finishing"
      pageTitleHi="कॉन्ट्रैक्टर फिनिशिंग"
      render={() => (
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground font-body">Loading...</div>}>
          <ContractorFinishingContent />
        </Suspense>
      )}
    />
  );
}
