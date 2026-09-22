'use client';
import AppLayout from '@/components/AppLayout';
import AccountImportContent from './components/AccountImportContent';

export default function AccountImportPage() {
  return (
    <AppLayout
      pageTitle="Import Summary"
      pageTitleHi="आयात सारांश"
      render={(lang) => <AccountImportContent lang={lang} />}
    />
  );
}
