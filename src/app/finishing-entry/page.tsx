'use client';
import AppLayout from '@/components/AppLayout';
import FinishingEntryContent from './components/FinishingEntryContent';

export default function FinishingEntryPage() {
  return (
    <AppLayout
      pageTitle="Finishing Entry"
      pageTitleHi="फिनिशिंग प्रविष्टि"
      render={() => <FinishingEntryContent />}
    />
  );
}
