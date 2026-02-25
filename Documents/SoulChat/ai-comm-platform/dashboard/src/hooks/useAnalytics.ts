import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { AnalyticsOverview } from '../lib/types';

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get<AnalyticsOverview>('/api/analytics/overview'),
    refetchInterval: 30000,
  });
}

export function useAnalyticsConversations(groupBy: 'hour' | 'day' | 'week' = 'day') {
  return useQuery({
    queryKey: ['analytics', 'conversations', groupBy],
    queryFn: () => api.get<{ data: { period: string; count: number }[] }>(`/api/analytics/conversations?groupBy=${groupBy}`),
  });
}
