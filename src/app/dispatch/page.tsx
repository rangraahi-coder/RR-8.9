'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import DispatchContent from './components/DispatchContent';

export default function DispatchPage() {
  return (
    <AppLayout pageTitle="Dispatch" pageTitleHi="डिस्पैच" render={(lang) => <DispatchContent lang={lang} />} />
  );
}
