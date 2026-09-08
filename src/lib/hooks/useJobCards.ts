'use client';

import { useRealtimeData, type JobCardSummary } from '@/contexts/RealtimeDataContext';

// Re-export the JobCard type shape from the context
export interface UseJobCardsResult {
  jobCards: JobCardSummary[];
  loading: boolean;
  refresh: () => void;
}

// Module-level cache bust counter — kept for backward compatibility
let _cacheVersion = 0;
export function invalidateJobCardsCache() {
  _cacheVersion += 1;
}

export function useJobCards(): UseJobCardsResult {
  const { jobCards, jobCardsLoading, refreshJobCards } = useRealtimeData();
  return { jobCards, loading: jobCardsLoading, refresh: refreshJobCards };
}
