'use client';
import AppLayout from '@/components/AppLayout';
import PrinterLedgerContent from './components/PrinterLedgerContent';

export default function PrinterLedgerPage() {
  return (
    <AppLayout
      pageTitle="Printer Fabric Ledger"
      pageTitleHi="प्रिंटर फैब्रिक लेजर"
      render={(lang, searchQuery) => (
        <PrinterLedgerContent lang={lang} searchQuery={searchQuery} />
      )}
    />
  );
}
