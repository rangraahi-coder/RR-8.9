'use client';
import AppLayout from '@/components/AppLayout';
import FinalStockReceiveContent from './components/FinalStockReceiveContent';

export default function FinishingEntryPage() {
  return (
    <AppLayout
      pageTitle="Final Stock Receive"
      pageTitleHi="फाइनल स्टॉक प्राप्ति"
      render={() => <FinalStockReceiveContent />}
    />
  );
}
