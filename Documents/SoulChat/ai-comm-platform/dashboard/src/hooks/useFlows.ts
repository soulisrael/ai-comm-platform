import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { Flow, FlowRun } from '../lib/types';

interface FlowsResponse {
  flows: Flow[];
}

interface FlowRunsResponse {
  runs: FlowRun[];
}

export function useFlows() {
  return useQuery({
    queryKey: ['flows'],
    queryFn: () => api.get<FlowsResponse>('/api/flows'),
  });
}

export function useFlow(id: string | null) {
  return useQuery({
    queryKey: ['flow', id],
    queryFn: () => api.get<Flow>(`/api/flows/${id}`),
    enabled: !!id,
  });
}

export function useFlowRuns(flowId: string | null) {
  return useQuery({
    queryKey: ['flow-runs', flowId],
    queryFn: () => api.get<FlowRunsResponse>(`/api/flows/${flowId}/runs`),
    enabled: !!flowId,
  });
}

export function useFlowActions() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: Partial<Flow>) =>
      api.post<Flow>('/api/flows', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: Partial<Flow> & { id: string }) =>
      api.put<Flow>(`/api/flows/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      qc.invalidateQueries({ queryKey: ['flow', vars.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/flows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) =>
      api.post<Flow>(`/api/flows/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const activate = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/flows/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/flows/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const test = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/flows/${id}/test`),
  });

  return { create, update, remove, duplicate, activate, deactivate, test };
}
