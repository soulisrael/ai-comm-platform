import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Hand, Pause, Play, RefreshCw, X as XIcon, Send as SendIcon,
  StickyNote, ChevronDown,
} from 'lucide-react';
import { useConversations, useConversation, useConversationActions } from '../hooks/useConversations';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatRelativeTime, truncate } from '../lib/utils';
import { ChatBubble } from '../components/ChatBubble';
import { StatusBadge } from '../components/StatusBadge';
import { ChannelIcon } from '../components/ChannelIcon';
import { AgentBadge } from '../components/AgentBadge';
import { SearchInput } from '../components/SearchInput';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ConversationStatus, Conversation } from '../lib/types';
import toast from 'react-hot-toast';

const STATUS_TABS: { label: string; value: ConversationStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Waiting', value: 'waiting' },
  { label: 'Handoff', value: 'handoff' },
  { label: 'Closed', value: 'closed' },
];

export function Conversations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const { data: listData, isLoading: listLoading } = useConversations(
    statusFilter === 'all' ? { limit: 50 } : { status: statusFilter as ConversationStatus, limit: 50 }
  );
  const { data: activeConv, isLoading: convLoading } = useConversation(selectedId);
  const actions = useConversationActions();

  const conversations = listData?.conversations || [];
  const filtered = search
    ? conversations.filter(c =>
        c.contactId.toLowerCase().includes(search.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(search.toLowerCase()))
      )
    : conversations;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length]);

  const selectConversation = (id: string) => {
    setSearchParams({ id });
  };

  const handleTakeOver = async () => {
    if (!selectedId) return;
    try {
      await actions.takeover.mutateAsync({ id: selectedId, humanAgentId: user?.id || 'agent-1' });
      toast.success('Conversation taken over');
    } catch { toast.error('Failed to take over'); }
  };

  const handlePause = async () => {
    if (!selectedId) return;
    try {
      await actions.pause.mutateAsync(selectedId);
      toast.success('AI paused');
    } catch { toast.error('Failed to pause'); }
  };

  const handleResume = async () => {
    if (!selectedId) return;
    try {
      await actions.resume.mutateAsync(selectedId);
      toast.success('AI resumed');
    } catch { toast.error('Failed to resume'); }
  };

  const handleClose = async () => {
    if (!selectedId) return;
    try {
      await actions.close.mutateAsync({ id: selectedId, reason: 'resolved' });
      toast.success('Conversation closed');
    } catch { toast.error('Failed to close'); }
  };

  const handleSwitchAgent = async (agentType: string) => {
    if (!selectedId) return;
    try {
      await actions.switchAgent.mutateAsync({ id: selectedId, agentType });
      toast.success(`Switched to ${agentType}`);
    } catch { toast.error('Failed to switch agent'); }
  };

  const handleSendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    try {
      await actions.reply.mutateAsync({ id: selectedId, agentId: user?.id || 'agent-1', message: replyText });
      setReplyText('');
    } catch { toast.error('Failed to send reply'); }
  };

  const isHumanMode = activeConv?.status === 'human_active' || activeConv?.status === 'handoff';

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left Panel — Conversation List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search conversations..." />
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                  statusFilter === tab.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {listLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No conversations" description="No conversations match your filters" />
          ) : (
            filtered.map(conv => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                active={conv.id === selectedId}
                onClick={() => selectConversation(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Center Panel — Chat View */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState title="Select a conversation" description="Choose a conversation from the list to view messages" />
          </div>
        ) : convLoading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} /></div>
        ) : activeConv ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
              <StatusBadge status={activeConv.status} />
              <AgentBadge agent={activeConv.currentAgent} />
              <div className="flex-1" />

              {activeConv.status !== 'human_active' && activeConv.status !== 'closed' && (
                <button onClick={handleTakeOver} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100">
                  <Hand size={14} /> Take Over
                </button>
              )}
              {activeConv.status === 'active' && (
                <button onClick={handlePause} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100">
                  <Pause size={14} /> Pause AI
                </button>
              )}
              {(activeConv.status === 'paused' || activeConv.status === 'human_active') && (
                <button onClick={handleResume} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">
                  <Play size={14} /> Resume AI
                </button>
              )}

              {/* Switch Agent dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <RefreshCw size={14} /> Switch Agent <ChevronDown size={12} />
                </button>
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-10">
                  {['sales', 'support', 'trial_meeting'].map(a => (
                    <button key={a} onClick={() => handleSwitchAgent(a)} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 capitalize">
                      {a.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {activeConv.status !== 'closed' && (
                <button onClick={handleClose} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <XIcon size={14} /> Close
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeConv.messages.map(msg => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Reply input (when human mode) */}
            {isHumanMode && (
              <div className="p-3 bg-white border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                    placeholder="Type a reply..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    <SendIcon size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Right Panel — Context */}
      {activeConv && (
        <div className="w-72 border-l border-gray-200 bg-white flex-shrink-0 overflow-y-auto hidden xl:block">
          <div className="p-4 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact</h3>
              <p className="text-sm font-medium text-gray-900">{activeConv.contactId}</p>
              <p className="text-xs text-gray-500">{activeConv.channel}</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Conversation</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <StatusBadge status={activeConv.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Agent</span>
                  <AgentBadge agent={activeConv.currentAgent} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Messages</span>
                  <span className="text-gray-900">{activeConv.messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Started</span>
                  <span className="text-gray-900 text-xs">{formatRelativeTime(activeConv.startedAt)}</span>
                </div>
              </div>
            </div>

            {activeConv.context && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Context</h3>
                <div className="space-y-1.5 text-sm">
                  {activeConv.context.intent && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Intent</span>
                      <span className="text-gray-900">{activeConv.context.intent}</span>
                    </div>
                  )}
                  {activeConv.context.sentiment && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sentiment</span>
                      <span className="text-gray-900">{activeConv.context.sentiment}</span>
                    </div>
                  )}
                  {activeConv.context.leadScore !== null && activeConv.context.leadScore !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lead Score</span>
                      <span className="text-gray-900 font-medium">{activeConv.context.leadScore}</span>
                    </div>
                  )}
                  {activeConv.context.language && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Language</span>
                      <span className="text-gray-900">{activeConv.context.language}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationCard({ conversation: c, active, onClick }: { conversation: Conversation; active: boolean; onClick: () => void }) {
  const lastMsg = c.messages[c.messages.length - 1];
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors',
        active && 'bg-primary-50 hover:bg-primary-50',
        c.status === 'handoff' && !active && 'bg-red-50/50'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <ChannelIcon channel={c.channel} size={14} />
        <span className="text-sm font-medium text-gray-900 truncate flex-1">{c.contactId}</span>
        <span className="text-xs text-gray-400">{formatRelativeTime(c.updatedAt)}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-500 truncate flex-1">
          {lastMsg ? truncate(lastMsg.content, 50) : 'No messages'}
        </p>
        <StatusBadge status={c.status} />
      </div>
      {c.currentAgent && (
        <div className="mt-1">
          <AgentBadge agent={c.currentAgent} />
        </div>
      )}
    </button>
  );
}
