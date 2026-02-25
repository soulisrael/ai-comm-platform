import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { Conversation } from '../lib/types';

export function useHandoffs() {
  return useQuery({
    queryKey: ['handoffs'],
    queryFn: () => api.get<{ conversations: Conversation[] }>('/api/conversations?status=handoff'),
    refetchInterval: 5000,
  });
}
