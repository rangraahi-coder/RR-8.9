'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import EmbroidaryCuttingContent from './components/EmbroidaryCuttingContent';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <svg className="animate-spin w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}

export default function EmbroidaryCuttingPage() {
  return (
    <AppLayout pageTitle="Embroidery Cutting" pageTitleHi="कढ़ाई कटाई" render={(lang) => (
      <Suspense fallback={<PageLoader />}>
        <EmbroidaryCuttingContent lang={lang} />
      </Suspense>
    )} />
  );
}
