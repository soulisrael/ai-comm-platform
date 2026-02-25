import { useState } from 'react';
import { useContacts, useContact, useContactActions } from '../hooks/useContacts';
import { SearchInput } from '../components/SearchInput';
import { ChannelIcon } from '../components/ChannelIcon';
import { PageLoading } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatRelativeTime } from '../lib/utils';
import { X, Plus, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

export function Contacts() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const { data, isLoading } = useContacts({ search: search || undefined });
  const { data: detail } = useContact(selectedId);
  const { update, addTag, removeTag } = useContactActions();

  const contacts = data?.contacts || [];

  const handleAddTag = async () => {
    if (!selectedId || !tagInput.trim()) return;
    try {
      await addTag.mutateAsync({ id: selectedId, tag: tagInput.trim() });
      setTagInput('');
      toast.success('Tag added');
    } catch { toast.error('Failed to add tag'); }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedId) return;
    try {
      await removeTag.mutateAsync({ id: selectedId, tag });
      toast.success('Tag removed');
    } catch { toast.error('Failed to remove tag'); }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Contact List */}
      <div className="w-96 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Search contacts..." />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {isLoading ? <PageLoading /> : contacts.length === 0 ? (
            <EmptyState title="No contacts" description="Contacts will appear when customers send messages" />
          ) : (
            contacts.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selectedId === c.id ? 'bg-primary-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    {(c.name || c.channelUserId)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name || c.channelUserId}</p>
                    <div className="flex items-center gap-1">
                      <ChannelIcon channel={c.channel} size={12} />
                      <span className="text-xs text-gray-500">{c.channelUserId}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{formatRelativeTime(c.lastSeenAt)}</span>
                </div>
                {c.tags.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {c.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                    {c.tags.length > 3 && <span className="text-xs text-gray-400">+{c.tags.length - 3}</span>}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Contact Detail */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {!selectedId ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState title="Select a contact" description="Choose a contact from the list to view details" />
          </div>
        ) : detail ? (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Contact card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-lg font-medium text-primary-700">
                  {(detail.name || detail.channelUserId)[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{detail.name || 'Unknown'}</h2>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <ChannelIcon channel={detail.channel} size={14} />
                    <span>{detail.channelUserId}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs text-gray-500">Email</label>
                  <p className="text-gray-900">{detail.email || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Phone</label>
                  <p className="text-gray-900">{detail.phone || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">First Seen</label>
                  <p className="text-gray-900">{formatRelativeTime(detail.firstSeenAt)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Last Active</label>
                  <p className="text-gray-900">{formatRelativeTime(detail.lastSeenAt)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Conversations</label>
                  <p className="text-gray-900 font-medium">{detail.conversationCount}</p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                <Tag size={14} /> Tags
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {detail.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-sm">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="text-gray-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button onClick={handleAddTag} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <PageLoading />
        )}
      </div>
    </div>
  );
}
