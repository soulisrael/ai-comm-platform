import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { BrainEntry } from '../lib/types';

interface BrainEntriesResponse {
  entries: BrainEntry[];
}

export function useAgentBrain(agentId: string | null) {
  return useQuery({
    queryKey: ['agent-brain', agentId],
    queryFn: () => api.get<BrainEntriesResponse>(`/api/custom-agents/${agentId}/brain`),
    enabled: !!agentId,
  });
}

export function useBrainActions(agentId: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agent-brain', agentId] });
    qc.invalidateQueries({ queryKey: ['custom-agent', agentId] });
  };

  const create = useMutation({
    mutationFn: (data: {
      title: string;
      content: string;
      category?: string;
      metadata?: Record<string, any>;
      sortOrder?: number;
    }) => api.post<BrainEntry>(`/api/custom-agents/${agentId}/brain`, data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<{
      title: string;
      content: string;
      category: string;
      metadata: Record<string, any>;
      sortOrder: number;
      active: boolean;
    }>) => api.put<BrainEntry>(`/api/custom-agents/${agentId}/brain/${id}`, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/custom-agents/${agentId}/brain/${id}`),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.put(`/api/custom-agents/${agentId}/brain/reorder`, { orderedIds }),
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder };
}
