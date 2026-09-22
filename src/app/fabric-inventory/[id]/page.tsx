'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import FabricDetailContent from './components/FabricDetailContent';

interface FabricDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function FabricDetailPage({ params }: FabricDetailPageProps) {
  const { id } = React.use(params);
  return (
    <AppLayout pageTitle="Fabric Detail" pageTitleHi="फैब्रिक विवरण" render={() => <FabricDetailContent id={id} />} />
  );
}
