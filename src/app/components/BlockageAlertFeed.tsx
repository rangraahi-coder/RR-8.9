'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function BlockageAlertFeed({ lang }: { lang: 'en' | 'hi' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 bg-success-bg rounded-xl mb-3">
        <AlertTriangle size={20} className="text-success" />
      </div>
      <p className="text-sm font-600 text-foreground">
        {lang === 'hi' ? 'कोई रुकावट नहीं!' : 'No blockages!'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {lang === 'hi' ? 'सब कुछ ठीक चल रहा है' : 'Everything is running smoothly'}
      </p>
    </div>
  );
}