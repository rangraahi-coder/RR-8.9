import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  action?: React.ReactNode;
  lang?: 'en' | 'hi';
}

export default function EmptyState({ icon, titleEn, titleHi, descEn, descHi, action, lang = 'hi' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="p-4 bg-muted rounded-2xl text-muted-foreground mb-4">{icon}</div>
      <h3 className="text-base font-700 text-foreground mb-1">{lang === 'hi' ? titleHi : titleEn}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">{lang === 'hi' ? descHi : descEn}</p>
      {action}
    </div>
  );
}