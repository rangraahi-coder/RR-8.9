'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProductionBatchContent from './components/ProductionBatchContent';

interface PageProps {
  params: Promise<{ jobCardId: string }>;
}

export default function ProductionBatchPage({ params }: PageProps) {
  const { jobCardId } = React.use(params);
  return (
    <AppLayout pageTitle="Production Batch" pageTitleHi="प्रोडक्शन बैच" render={(lang) => <ProductionBatchContent jobCardId={jobCardId} lang={lang} />} />
  );
}
