import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { Conversation, ConversationStatus, WindowStatus } from '../lib/types';

interface ConversationsResponse {
  conversations: Conversation[];
  pagination: { page: number; limit: number; total: number };
}

export function useConversations(filters?: { status?: ConversationStatus; channel?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.channel) params.set('channel', filters.channel);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));

  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => api.get<ConversationsResponse>(`/api/conversations?${params}`),
    refetchInterval: 5000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<Conversation>(`/api/conversations/${id}`),
    enabled: !!id,
    refetchInterval: 3000,
  });
}

export function useConversationActions() {
  const qc = useQueryClient();

  const handoff = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/api/conversations/${id}/handoff`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const takeover = useMutation({
    mutationFn: ({ id, humanAgentId }: { id: string; humanAgentId: string }) =>
      api.post(`/api/conversations/${id}/takeover`, { humanAgentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const pause = useMutation({
    mutationFn: (id: string) => api.post(`/api/conversations/${id}/pause`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const resume = useMutation({
    mutationFn: (id: string) => api.post(`/api/conversations/${id}/resume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const close = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/api/conversations/${id}/close`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const switchAgent = useMutation({
    mutationFn: ({ id, agentType, customAgentId }: { id: string; agentType?: string; customAgentId?: string }) =>
      api.post(`/api/conversations/${id}/switch-agent`, { agentType, customAgentId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const transferToAgent = useMutation({
    mutationFn: ({ id, targetAgentId, message }: { id: string; targetAgentId: string; message?: string }) =>
      api.post(`/api/conversations/${id}/transfer`, { targetAgentId, message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const reply = useMutation({
    mutationFn: ({ id, agentId, message }: { id: string; agentId: string; message: string }) =>
      api.post(`/api/conversations/${id}/reply`, { agentId, message }),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['conversation', id] }),
  });

  const reopen = useMutation({
    mutationFn: (id: string) => api.post(`/api/conversations/${id}/reopen`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const transferToHuman = useMutation({
    mutationFn: ({ id, toHumanId, note }: { id: string; toHumanId: string; note?: string }) =>
      api.post(`/api/conversations/${id}/transfer-to-human`, { toHumanId, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });

  return { handoff, takeover, pause, resume, close, switchAgent, transferToAgent, reply, reopen, transferToHuman };
}

export function useConversationWindow(id: string | null) {
  return useQuery({
    queryKey: ['conversation-window', id],
    queryFn: () => api.get<WindowStatus>(`/api/conversations/${id}/window`),
    enabled: !!id,
    refetchInterval: 30000,
  });
}
