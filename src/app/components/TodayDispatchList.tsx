import React from 'react';
import { Truck } from 'lucide-react';

export default function TodayDispatchList({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 bg-muted rounded-xl mb-3">
        <Truck size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-600 text-foreground">
        {lang === 'hi' ? 'आज कोई डिस्पैच नहीं' : 'No dispatches today'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {lang === 'hi' ?'जब ऑर्डर तैयार होंगे तो यहाँ दिखेंगे' :'Dispatch-ready orders will appear here'}
      </p>
    </div>
  );
}