'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FabricStockTrackerPage() {
  const router = useRouter();
  useEffect(() => {
    router?.replace('/');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-sm text-muted-foreground">Redirecting...</span>
      </div>
    </div>
  );
}
