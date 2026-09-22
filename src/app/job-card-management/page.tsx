'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import JobCardContent from '@/app/job-card-management/components/JobCardContent';

export default function JobCardManagementPage() {
  return (
    <AppLayout pageTitle="Job Cards" pageTitleHi="जॉब कार्ड" render={(lang, searchQuery) => <JobCardContent lang={lang} searchQuery={searchQuery} />} />
  );
}