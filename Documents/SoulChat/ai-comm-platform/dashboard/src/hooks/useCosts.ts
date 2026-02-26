import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { CostSummary } from '../lib/types';

export function useTodayCost() {
  return useQuery({
    queryKey: ['costs', 'today'],
    queryFn: () => api.get<CostSummary>('/api/costs/today'),
    refetchInterval: 30000,
  });
}

export function useCostSummary() {
  return useQuery({
    queryKey: ['costs', 'summary'],
    queryFn: () => api.get<CostSummary>('/api/costs/summary'),
  });
}
