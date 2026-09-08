'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProductionWorkflowContent from './components/ProductionWorkflowContent';

export default function ProductionWorkflowPage() {
  return (
    <AppLayout pageTitle="Production Workflow" pageTitleHi="उत्पादन वर्कफ्लो" render={(lang) => <ProductionWorkflowContent lang={lang} />} />
  );
}
