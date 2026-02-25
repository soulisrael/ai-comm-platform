import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { Contact } from '../lib/types';

interface ContactsResponse {
  contacts: Contact[];
  pagination: { page: number; limit: number; total: number };
}

export function useContacts(filters?: { search?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));

  return useQuery({
    queryKey: ['contacts', filters],
    queryFn: () => api.get<ContactsResponse>(`/api/contacts?${params}`),
  });
}

export function useContact(id: string | null) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<Contact & { conversations?: unknown[] }>(`/api/contacts/${id}`),
    enabled: !!id,
  });
}

export function useContactActions() {
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Contact> }) =>
      api.put<Contact>(`/api/contacts/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const addTag = useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      api.post<Contact>(`/api/contacts/${id}/tags`, { tag }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const removeTag = useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) =>
      api.delete<Contact>(`/api/contacts/${id}/tags/${tag}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  return { update, addTag, removeTag };
}
