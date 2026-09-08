'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import OperatorMasterContent from './components/OperatorMasterContent';

export default function OperatorMasterPage() {
  return (
    <AppLayout
      pageTitle="Operator Master"
      pageTitleHi="ऑपरेटर मास्टर"
      render={() => <OperatorMasterContent />}
    />
  );
}
