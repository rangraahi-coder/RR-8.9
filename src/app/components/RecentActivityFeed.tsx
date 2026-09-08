import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function RecentActivityFeed({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 bg-muted rounded-xl mb-3">
        <ClipboardList size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-600 text-foreground">
        {lang === 'hi' ? 'कोई गतिविधि नहीं' : 'No activity yet'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {lang === 'hi' ?'जॉब कार्ड अपडेट होने पर यहाँ दिखेगा' :'Activity will appear here as job cards are updated'}
      </p>
    </div>
  );
}