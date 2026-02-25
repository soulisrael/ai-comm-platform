import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { Plus, Send, XCircle, Radio, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface Broadcast {
  id: string;
  name: string;
  messageContent: string;
  messageType: string;
  targetFilter: Record<string, any>;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  status: string;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; Icon: any }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', Icon: Clock },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', Icon: Clock },
  sending: { bg: 'bg-amber-100', text: 'text-amber-700', Icon: Radio },
  completed: { bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', Icon: XCircle },
};

export function Broadcasts() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ['broadcasts'],
    queryFn: () => api.get('/api/automation/broadcasts'),
  });

  const sendBroadcast = useMutation({
    mutationFn: (id: string) => api.post(`/api/automation/broadcasts/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast sent');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelBroadcast = useMutation({
    mutationFn: (id: string) => api.post(`/api/automation/broadcasts/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      toast.success('Broadcast cancelled');
    },
  });

  const createBroadcast = useMutation({
    mutationFn: (data: any) => api.post('/api/automation/broadcasts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      setShowCreate(false);
      toast.success('Broadcast created');
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-sm text-gray-500 mt-1">Send messages to groups of contacts</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={16} /> New Broadcast
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Radio size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No broadcasts yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Recipients</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Failed</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {broadcasts.map(b => {
                const style = STATUS_STYLES[b.status] || STATUS_STYLES.draft;
                return (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{b.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{b.messageContent}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', style.bg, style.text)}>
                        <style.Icon size={12} />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.totalRecipients}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.sentCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.failedCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {b.status === 'draft' && (
                          <button
                            onClick={() => sendBroadcast.mutate(b.id)}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                          >
                            <Send size={12} className="inline mr-1" /> Send
                          </button>
                        )}
                        {(b.status === 'draft' || b.status === 'scheduled') && (
                          <button
                            onClick={() => cancelBroadcast.mutate(b.id)}
                            className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateBroadcastModal
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createBroadcast.mutate(data)}
        />
      )}
    </div>
  );
}

function CreateBroadcastModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: any) => void }) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [channel, setChannel] = useState('');
  const [tags, setTags] = useState('');
  const [scheduled, setScheduled] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Create Broadcast</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="VIP Announcement" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} placeholder="Write your broadcast message..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel (optional)</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">All channels</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input value={tags} onChange={e => setTags(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="vip, premium" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
            <input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({
              name,
              target: {
                ...(channel ? { channel } : {}),
                ...(tags ? { tags: tags.split(',').map(t => t.trim()).filter(Boolean) } : {}),
              },
              message: { content },
              ...(scheduled ? { schedule: new Date(scheduled).toISOString() } : {}),
            })}
            disabled={!name || !content}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
