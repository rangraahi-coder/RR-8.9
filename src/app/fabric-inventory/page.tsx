'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import FabricInventoryContent from './components/FabricInventoryContent';

export default function FabricInventoryPage() {
  return (
    <AppLayout pageTitle="Fabric Inventory" pageTitleHi="फैब्रिक इन्वेंटरी" render={(lang: 'en' | 'hi') => <FabricInventoryContent lang={lang} />} />
  );
}
