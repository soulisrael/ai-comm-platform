import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import type { WaConfig, WaTemplate } from '../lib/types';

interface WaTemplatesResponse {
  templates: WaTemplate[];
}

export function useWaConfig() {
  return useQuery({
    queryKey: ['wa-config'],
    queryFn: () => api.get<WaConfig>('/api/whatsapp/config'),
  });
}

export function useWaTemplates() {
  return useQuery({
    queryKey: ['wa-templates'],
    queryFn: () => api.get<WaTemplatesResponse>('/api/whatsapp/templates'),
  });
}

export function useMetaConfig() {
  return useQuery({
    queryKey: ['wa-meta-config'],
    queryFn: () => api.get<{ appId: string; configId: string }>('/api/whatsapp/auth/meta-config'),
  });
}

export function useWhatsAppActions() {
  const qc = useQueryClient();

  const updateConfig = useMutation({
    mutationFn: (data: Partial<WaConfig>) =>
      api.put<WaConfig>('/api/whatsapp/config', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-config'] }),
  });

  const testConnection = useMutation({
    mutationFn: () => api.post<{ success: boolean; message: string }>('/api/whatsapp/test'),
  });

  const sendTest = useMutation({
    mutationFn: (data: { to: string; message: string }) =>
      api.post('/api/whatsapp/send-test', data),
  });

  const createTemplate = useMutation({
    mutationFn: (data: Partial<WaTemplate>) =>
      api.post<WaTemplate>('/api/whatsapp/templates', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-templates'] }),
  });

  const exchangeToken = useMutation({
    mutationFn: (data: { code: string }) =>
      api.post<{ success: boolean }>('/api/whatsapp/auth/exchange-token', data),
  });

  const completeSignup = useMutation({
    mutationFn: (data: { wabaId: string; phoneNumberId: string }) =>
      api.post<{ success: boolean; status: string }>('/api/whatsapp/auth/complete-signup', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-config'] }),
  });

  return { updateConfig, testConnection, sendTest, createTemplate, exchangeToken, completeSignup };
}
