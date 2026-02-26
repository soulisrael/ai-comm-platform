import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { CustomAgent, CustomAgentWithBrain } from '../lib/types';

interface CustomAgentsResponse {
  agents: (CustomAgent & { brainEntryCount?: number })[];
}

export function useCustomAgents(filters?: { active?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.active !== undefined) params.set('active', String(filters.active));

  return useQuery({
    queryKey: ['custom-agents', filters],
    queryFn: () => api.get<CustomAgentsResponse>(`/api/custom-agents?${params}`),
  });
}

export function useCustomAgent(id: string | null) {
  return useQuery({
    queryKey: ['custom-agent', id],
    queryFn: () => api.get<CustomAgentWithBrain>(`/api/custom-agents/${id}`),
    enabled: !!id,
  });
}

export function useCustomAgentActions() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: Partial<CustomAgent>) =>
      api.post<CustomAgent>('/api/custom-agents', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-agents'] }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<CustomAgent> & { id: string }) =>
      api.put<CustomAgent>(`/api/custom-agents/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['custom-agents'] });
      qc.invalidateQueries({ queryKey: ['custom-agent', vars.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/custom-agents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-agents'] }),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) =>
      api.post<CustomAgent>(`/api/custom-agents/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-agents'] }),
  });

  const activate = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/custom-agents/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-agents'] }),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/custom-agents/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-agents'] }),
  });

  const uploadDocument = useMutation({
    mutationFn: ({ agentId, formData }: { agentId: string; formData: FormData }) =>
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/custom-agents/${agentId}/upload-document`, {
        method: 'POST',
        headers: {
          'x-api-key': localStorage.getItem('api_key') || '',
        },
        body: formData,
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: r.statusText }));
          throw new Error(err.error || 'Upload failed');
        }
        return r.json();
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['custom-agent', vars.agentId] });
      qc.invalidateQueries({ queryKey: ['custom-agents'] });
    },
  });

  const removeDocument = useMutation({
    mutationFn: (agentId: string) =>
      api.delete(`/api/custom-agents/${agentId}/document`),
    onSuccess: (_, agentId) => {
      qc.invalidateQueries({ queryKey: ['custom-agent', agentId] });
      qc.invalidateQueries({ queryKey: ['custom-agents'] });
    },
  });

  return { create, update, remove, duplicate, activate, deactivate, uploadDocument, removeDocument };
}

interface TestResponse {
  response: string;
  agent: string;
  tokensUsed?: number;
}

export function useAgentTest(agentId: string | null) {
  return useMutation({
    mutationFn: (message: string) =>
      api.post<TestResponse>(`/api/custom-agents/${agentId}/test`, { message }),
  });
}
