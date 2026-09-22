'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import FinishedGoodsContent from './components/FinishedGoodsContent';

export default function FinishedGoodsPage() {
  return (
    <AppLayout pageTitle="Finished Goods" pageTitleHi="तैयार माल" render={(lang) => <FinishedGoodsContent lang={lang} />} />
  );
}
