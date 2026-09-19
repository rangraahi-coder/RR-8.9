'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import GreyFabricContent from './components/GreyFabricContent';

export default function GreyFabricPage() {
  return (
    <AppLayout pageTitle="Grey Fabric Purchase" pageTitleHi="ग्रे फैब्रिक खरीद" render={(lang) => <GreyFabricContent lang={lang} />} />
  );
}
