import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { TeamMember, TeamRole, TeamStatus } from '../lib/types';

interface TeamMembersResponse {
  members: TeamMember[];
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.get<TeamMembersResponse>('/api/team/members'),
  });
}

export function useTeamMember(id: string | null) {
  return useQuery({
    queryKey: ['team-member', id],
    queryFn: () => api.get<TeamMember>(`/api/team/members/${id}`),
    enabled: !!id,
  });
}

export function useAvailableMembers() {
  return useQuery({
    queryKey: ['team-members', 'available'],
    queryFn: () => api.get<TeamMembersResponse>('/api/team/members/available'),
  });
}

export function useTeamActions() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: { email: string; name: string; password: string; role?: TeamRole }) =>
      api.post<TeamMember>('/api/team/members', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; role?: TeamRole; maxConcurrentChats?: number; assignedAgents?: string[]; skills?: string[] }) =>
      api.put<TeamMember>(`/api/team/members/${id}`, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['team-members'] });
      qc.invalidateQueries({ queryKey: ['team-member', vars.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/team/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TeamStatus }) =>
      api.put(`/api/team/members/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
  });

  return { create, update, remove, updateStatus };
}
