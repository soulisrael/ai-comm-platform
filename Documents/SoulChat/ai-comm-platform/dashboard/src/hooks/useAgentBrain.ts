import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { BrainEntry } from '../lib/types';

interface BrainEntriesResponse {
  entries: BrainEntry[];
}

export function useAgentBrain(agentId: string | null) {
  return useQuery({
    queryKey: ['agent-brain', agentId],
    queryFn: async () => {
      try {
        // New nested route
        return await api.get<BrainEntriesResponse>(`/api/custom-agents/${agentId}/brain`);
      } catch {
        // Fallback to old route
        return api.get<BrainEntriesResponse>(`/api/brain/agent/${agentId}`);
      }
    },
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
    mutationFn: async (data: {
      title: string;
      content: string;
      category?: string;
      metadata?: Record<string, any>;
      sortOrder?: number;
    }) => {
      try {
        // New nested route
        return await api.post<BrainEntry>(`/api/custom-agents/${agentId}/brain`, data);
      } catch {
        // Fallback to old route
        return api.post<BrainEntry>('/api/brain', { agentId, ...data });
      }
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      title: string;
      content: string;
      category: string;
      metadata: Record<string, any>;
      sortOrder: number;
      active: boolean;
    }>) => {
      try {
        // New nested route
        return await api.put<BrainEntry>(`/api/custom-agents/${agentId}/brain/${id}`, data);
      } catch {
        // Fallback to old route
        return api.put<BrainEntry>(`/api/brain/${id}`, data);
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        // New nested route
        return await api.delete(`/api/custom-agents/${agentId}/brain/${id}`);
      } catch {
        // Fallback to old route
        return api.delete(`/api/brain/${id}`);
      }
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      try {
        // New nested route
        return await api.put(`/api/custom-agents/${agentId}/brain/reorder`, { orderedIds });
      } catch {
        // Fallback to old route
        return api.put(`/api/brain/reorder/${agentId}`, { orderedIds });
      }
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, reorder };
}
