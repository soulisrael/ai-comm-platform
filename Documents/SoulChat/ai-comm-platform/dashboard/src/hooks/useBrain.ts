import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';

interface BrainModuleInfo {
  name: string;
  category: string;
  subcategory: string;
  entryCount: number;
}

export function useBrainModules() {
  return useQuery({
    queryKey: ['brain', 'modules'],
    queryFn: () => api.get<{ modules: BrainModuleInfo[] }>('/api/brain/modules'),
  });
}

export function useBrainModule(category: string, subcategory: string) {
  return useQuery({
    queryKey: ['brain', 'module', category, subcategory],
    queryFn: () => api.get<Record<string, unknown>>(`/api/brain/modules/${category}/${subcategory}`),
    enabled: !!category && !!subcategory,
  });
}

export function useBrainAgents() {
  return useQuery({
    queryKey: ['brain', 'agents'],
    queryFn: () => api.get<Record<string, unknown>>('/api/brain/agents'),
  });
}

export function useBrainCompany() {
  return useQuery({
    queryKey: ['brain', 'company'],
    queryFn: () => api.get<Record<string, unknown>>('/api/brain/company'),
  });
}

interface UploadPreviewResult {
  preview: true;
  moduleName: string;
  category: string;
  convertedData: Record<string, unknown>;
  extractedText: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

interface UploadConfirmResult {
  success: true;
  moduleName: string;
  category: string;
  module: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export function useDocxUpload() {
  const qc = useQueryClient();

  const preview = useMutation({
    mutationFn: ({ file, category, moduleName }: { file: File; category: string; moduleName?: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      fd.append('preview', 'true');
      if (moduleName) fd.append('moduleName', moduleName);
      return api.postFormData<UploadPreviewResult>('/api/brain/upload', fd);
    },
  });

  const confirm = useMutation({
    mutationFn: ({ file, category, moduleName }: { file: File; category: string; moduleName?: string }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      fd.append('preview', 'false');
      if (moduleName) fd.append('moduleName', moduleName);
      return api.postFormData<UploadConfirmResult>('/api/brain/upload', fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }),
  });

  return { preview, confirm };
}

export function useBrainActions() {
  const qc = useQueryClient();

  const reload = useMutation({
    mutationFn: () => api.post<{ success: boolean }>('/api/brain/reload'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }),
  });

  const updateModule = useMutation({
    mutationFn: ({ category, subcategory, data }: { category: string; subcategory: string; data: unknown }) =>
      api.put(`/api/brain/modules/${category}/${subcategory}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }),
  });

  const addEntry = useMutation({
    mutationFn: ({ category, subcategory, entry }: { category: string; subcategory: string; entry: unknown }) =>
      api.post(`/api/brain/modules/${category}/${subcategory}/entries`, entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }),
  });

  const updateEntry = useMutation({
    mutationFn: ({ category, subcategory, entryId, entry }: { category: string; subcategory: string; entryId: string; entry: unknown }) =>
      api.put(`/api/brain/modules/${category}/${subcategory}/entries/${entryId}`, entry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }),
  });

  const deleteEntry = useMutation({
    mutationFn: ({ category, subcategory, entryId }: { category: string; subcategory: string; entryId: string }) =>
      api.delete(`/api/brain/modules/${category}/${subcategory}/entries/${entryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brain'] }),
  });

  return { reload, updateModule, addEntry, updateEntry, deleteEntry };
}
