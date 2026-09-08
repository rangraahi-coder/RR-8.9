'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardContent from '@/app/components/DashboardContent';

export default function HomePage() {
  return (
    <AppLayout pageTitle="Dashboard" pageTitleHi="डैशबोर्ड" render={(lang) => <DashboardContent lang={lang} />} />
  );
}