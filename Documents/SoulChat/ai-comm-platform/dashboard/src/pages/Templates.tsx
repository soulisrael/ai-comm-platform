import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { Plus, Edit2, Trash2, FileText, Check, X, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  channel?: string;
  approvalStatus: string;
  createdAt: string;
  updatedAt: string;
}

const APPROVAL_STYLES: Record<string, { bg: string; text: string; Icon: any }> = {
  approved: { bg: 'bg-green-100', text: 'text-green-700', Icon: Check },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', Icon: Clock },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', Icon: X },
};

export function Templates() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/api/automation/templates'),
  });

  const createTemplate = useMutation({
    mutationFn: (data: any) => api.post('/api/automation/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowCreate(false);
      toast.success('Template created');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/api/automation/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditing(null);
      toast.success('Template updated');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.delete(`/api/automation/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage reusable message templates with variables</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={16} /> New Template
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No templates yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(tpl => {
            const style = APPROVAL_STYLES[tpl.approvalStatus] || APPROVAL_STYLES.pending;
            return (
              <div key={tpl.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', style.bg, style.text)}>
                    <style.Icon size={10} />
                    {tpl.approvalStatus}
                  </span>
                </div>
                <div className="bg-gray-50 rounded p-3 mb-3 text-sm text-gray-700 font-mono whitespace-pre-wrap">
                  {tpl.content}
                </div>
                {tpl.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tpl.variables.map(v => (
                      <span key={v} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-mono">
                        {`{${v}}`}
                      </span>
                    ))}
                  </div>
                )}
                {tpl.channel && (
                  <div className="text-xs text-gray-500 mb-3">Channel: {tpl.channel}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(tpl)}
                    className="p-1.5 rounded text-gray-500 hover:bg-gray-100"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteTemplate.mutate(tpl.id)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showCreate || editing) && (
        <TemplateModal
          template={editing || undefined}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSubmit={(data) => {
            if (editing) {
              updateTemplate.mutate({ id: editing.id, ...data });
            } else {
              createTemplate.mutate(data);
            }
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({ template, onClose, onSubmit }: {
  template?: MessageTemplate;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState(template?.name || '');
  const [content, setContent] = useState(template?.content || '');
  const [channel, setChannel] = useState(template?.channel || '');

  // Live-extract variables from content
  const vars = [...new Set((content.match(/\{(\w+)\}/g) || []).map(m => m.slice(1, -1)))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">{template ? 'Edit Template' : 'Create Template'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="welcome_message" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              rows={4}
              placeholder="Hello {name}, your order #{orderId} is ready for pickup!"
            />
            {vars.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {vars.map(v => (
                  <span key={v} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-mono">{`{${v}}`}</span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Channel (optional)</label>
            <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Any</option>
              <option value="whatsapp">WhatsApp (requires approval)</option>
              <option value="telegram">Telegram</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({ name, content, channel: channel || undefined })}
            disabled={!name || !content}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {template ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
