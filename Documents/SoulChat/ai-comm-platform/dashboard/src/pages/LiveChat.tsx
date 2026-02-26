import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Hand, Pause, Play, RefreshCw, X as XIcon, Send as SendIcon,
  StickyNote, ChevronDown, Plus, Bot, ArrowUpRight, Lock, Unlock,
  User, MessageSquare, Clock, Tag, Brain,
} from 'lucide-react';
import { useConversations, useConversation, useConversationActions } from '../hooks/useConversations';
import { useCustomAgents } from '../hooks/useCustomAgents';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatRelativeTime, truncate } from '../lib/utils';
import { api } from '../lib/api-client';
import { ChatBubble } from '../components/ChatBubble';
import { StatusBadge } from '../components/StatusBadge';
import { ChannelIcon } from '../components/ChannelIcon';
import { AgentBadge } from '../components/AgentBadge';
import { SearchInput } from '../components/SearchInput';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { ConversationStatus, ChannelType, Conversation, Message } from '../lib/types';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: { label: string; value: ConversationStatus | 'all' }[] = [
  { label: 'הכל', value: 'all' },
  { label: 'פעיל', value: 'active' },
  { label: 'נציג', value: 'human_active' },
  { label: 'המתנה', value: 'waiting' },
  { label: 'העברה', value: 'handoff' },
  { label: 'סגור', value: 'closed' },
];

const CHANNEL_OPTIONS: { label: string; value: ChannelType | 'all' }[] = [
  { label: 'כל הערוצים', value: 'all' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Web', value: 'web' },
];

interface IncomingResponse {
  conversationId: string;
  response: string;
  agent: string;
  routingDecision: string;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function LiveChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelType | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Demo chat state
  const [demoMode, setDemoMode] = useState(false);
  const [demoMessages, setDemoMessages] = useState<Message[]>([]);
  const [demoInput, setDemoInput] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoConvId, setDemoConvId] = useState<string | null>(null);
  const [demoUserId] = useState(() => `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const demoEndRef = useRef<HTMLDivElement>(null);

  // Agent switch dropdown
  const [showSwitchAgent, setShowSwitchAgent] = useState(false);
  const switchAgentRef = useRef<HTMLDivElement>(null);

  // Custom agents
  const { data: customAgentsData } = useCustomAgents({ active: true });
  const customAgents = customAgentsData?.agents || [];

  // Build filters for the list query
  const listFilters: { status?: ConversationStatus; channel?: string; limit: number } = { limit: 50 };
  if (statusFilter !== 'all') listFilters.status = statusFilter as ConversationStatus;
  if (channelFilter !== 'all') listFilters.channel = channelFilter;

  const { data: listData, isLoading: listLoading } = useConversations(listFilters);
  const { data: activeConv, isLoading: convLoading } = useConversation(demoMode ? null : selectedId);
  const actions = useConversationActions();

  const conversations = listData?.conversations || [];

  // Client-side filtering for search and agent
  const filtered = conversations.filter(c => {
    if (agentFilter !== 'all' && c.customAgentId !== agentFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesContact = c.contactId.toLowerCase().includes(q);
      const matchesMsg = (c.messages || []).some(m => m.content.toLowerCase().includes(q));
      if (!matchesContact && !matchesMsg) return false;
    }
    return true;
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length]);

  useEffect(() => {
    demoEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [demoMessages.length]);

  // Close switch-agent dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switchAgentRef.current && !switchAgentRef.current.contains(e.target as Node)) {
        setShowSwitchAgent(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const selectConversation = (id: string) => {
    setDemoMode(false);
    setSearchParams({ id });
  };

  const startDemo = () => {
    setDemoMode(true);
    setDemoMessages([]);
    setDemoConvId(null);
    setDemoInput('');
    setSearchParams({});
  };

  const sendDemoMessage = async () => {
    const text = demoInput.trim();
    if (!text || demoLoading) return;

    const userMsg: Message = {
      id: `demo-user-${Date.now()}`,
      conversationId: demoConvId || 'demo',
      contactId: 'demo-tester',
      direction: 'inbound',
      type: 'text',
      content: text,
      channel: 'web',
      metadata: {},
      timestamp: new Date().toISOString(),
    };

    setDemoMessages(prev => [...prev, userMsg]);
    setDemoInput('');
    setDemoLoading(true);

    try {
      const res = await api.post<IncomingResponse>('/api/messages/incoming', {
        channelUserId: demoUserId,
        channel: 'web',
        content: text,
        senderName: 'משתמש דמו',
      });

      if (res.conversationId) setDemoConvId(res.conversationId);

      const botMsg: Message = {
        id: `demo-bot-${Date.now()}`,
        conversationId: res.conversationId,
        contactId: 'demo-tester',
        direction: 'outbound',
        type: 'text',
        content: res.response,
        channel: 'web',
        metadata: { agent: res.agent },
        timestamp: new Date().toISOString(),
      };

      setDemoMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      toast.error(err?.message || 'שגיאה בשליחת ההודעה');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleTakeOver = async () => {
    if (!selectedId) return;
    try {
      await actions.takeover.mutateAsync({ id: selectedId, humanAgentId: user?.id || 'agent-1' });
      toast.success('השיחה נלקחה בהצלחה');
    } catch { toast.error('שגיאה בקבלת שליטה'); }
  };

  const handlePause = async () => {
    if (!selectedId) return;
    try {
      await actions.pause.mutateAsync(selectedId);
      toast.success('ה-AI הושהה');
    } catch { toast.error('שגיאה בהשהיה'); }
  };

  const handleResume = async () => {
    if (!selectedId) return;
    try {
      await actions.resume.mutateAsync(selectedId);
      toast.success('ה-AI חזר לפעולה');
    } catch { toast.error('שגיאה בהחזרת ה-AI'); }
  };

  const handleClose = async () => {
    if (!selectedId) return;
    try {
      await actions.close.mutateAsync({ id: selectedId, reason: 'resolved' });
      toast.success('השיחה נסגרה');
    } catch { toast.error('שגיאה בסגירת השיחה'); }
  };

  const handleReopen = async () => {
    if (!selectedId) return;
    try {
      await actions.reopen.mutateAsync(selectedId);
      toast.success('השיחה נפתחה מחדש');
    } catch { toast.error('שגיאה בפתיחת השיחה'); }
  };

  const handleHandoff = async () => {
    if (!selectedId) return;
    try {
      await actions.handoff.mutateAsync({ id: selectedId, reason: 'manual handoff' });
      toast.success('השיחה הועברה לנציג');
    } catch { toast.error('שגיאה בהעברה לנציג'); }
  };

  const handleSwitchAgent = async (customAgentId: string) => {
    if (!selectedId) return;
    setShowSwitchAgent(false);
    try {
      await actions.switchAgent.mutateAsync({ id: selectedId, customAgentId });
      const label = customAgents.find(a => a.id === customAgentId)?.name || customAgentId;
      toast.success(`הוחלף לסוכן: ${label}`);
    } catch { toast.error('שגיאה בהחלפת סוכן'); }
  };

  const handleSendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    try {
      if (isInternalNote) {
        await api.post(`/api/conversations/${selectedId}/reply`, {
          agentId: user?.id || 'agent-1',
          message: replyText,
          isInternalNote: true,
        });
      } else {
        await actions.reply.mutateAsync({ id: selectedId, agentId: user?.id || 'agent-1', message: replyText });
      }
      setReplyText('');
      setIsInternalNote(false);
    } catch { toast.error('שגיאה בשליחת תגובה'); }
  };

  // Resolve custom agent name for current conversation
  const activeCustomAgentName = activeConv?.customAgentId
    ? customAgents.find(a => a.id === activeConv.customAgentId)?.name
    : undefined;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ===== RIGHT PANEL — Conversation List ===== */}
      <div className="w-80 border-e border-gray-200 bg-white flex flex-col flex-shrink-0">
        {/* Header with search + new chat */}
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="חיפוש שיחות..." />
            </div>
            <button
              onClick={startDemo}
              title="שיחה חדשה (דמו)"
              className={cn(
                'flex-shrink-0 p-2 rounded-lg transition-colors',
                demoMode
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              )}
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Status tabs */}
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

          {/* Channel + Agent filters */}
          <div className="flex gap-2">
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value as ChannelType | 'all')}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CHANNEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">כל הסוכנים</option>
              {customAgents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {listLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="אין שיחות" description="אין שיחות התואמות את הסינון" />
          ) : (
            filtered.map(conv => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                active={conv.id === selectedId && !demoMode}
                onClick={() => selectConversation(conv.id)}
                customAgentName={
                  conv.customAgentId
                    ? customAgents.find(a => a.id === conv.customAgentId)?.name
                    : undefined
                }
              />
            ))
          )}
        </div>
      </div>

      {/* ===== CENTER PANEL — Chat View ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {demoMode ? (
          <DemoChat
            messages={demoMessages}
            input={demoInput}
            loading={demoLoading}
            convId={demoConvId}
            endRef={demoEndRef}
            onInputChange={setDemoInput}
            onSend={sendDemoMessage}
            onClose={() => { setDemoMode(false); if (demoConvId) setSearchParams({ id: demoConvId }); else setSearchParams({}); }}
          />
        ) : !selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState title="בחר שיחה" description="בחר שיחה מהרשימה, או לחץ + כדי להתחיל דמו" />
          </div>
        ) : convLoading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} /></div>
        ) : activeConv ? (
          <>
            {/* Toolbar */}
            <ChatToolbar
              conversation={activeConv}
              customAgentName={activeCustomAgentName}
              customAgents={customAgents}
              showSwitchAgent={showSwitchAgent}
              switchAgentRef={switchAgentRef}
              onToggleSwitchAgent={() => setShowSwitchAgent(v => !v)}
              onTakeOver={handleTakeOver}
              onPause={handlePause}
              onResume={handleResume}
              onClose={handleClose}
              onReopen={handleReopen}
              onHandoff={handleHandoff}
              onSwitchAgent={handleSwitchAgent}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeConv.messages.map(msg => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Reply input */}
            <ReplyInput
              value={replyText}
              onChange={setReplyText}
              onSend={handleSendReply}
              isInternalNote={isInternalNote}
              onToggleNote={() => setIsInternalNote(v => !v)}
            />
          </>
        ) : null}
      </div>

      {/* ===== LEFT PANEL — Context ===== */}
      {activeConv && !demoMode && (
        <ContextPanel
          conversation={activeConv}
          customAgentName={activeCustomAgentName}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation Card (list item)
// ---------------------------------------------------------------------------

function ConversationCard({
  conversation: c,
  active,
  onClick,
  customAgentName,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  customAgentName?: string;
}) {
  const messages = c.messages || [];
  const lastMsg = messages[messages.length - 1];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-start px-3 py-3 hover:bg-gray-50 transition-colors',
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
          {lastMsg ? truncate(lastMsg.content, 50) : 'אין הודעות'}
        </p>
        <StatusBadge status={c.status} />
      </div>
      <div className="flex items-center gap-1 mt-1">
        <AgentBadge agent={c.currentAgent} customAgentName={customAgentName} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Demo Chat Panel
// ---------------------------------------------------------------------------

function DemoChat({
  messages,
  input,
  loading,
  convId,
  endRef,
  onInputChange,
  onSend,
  onClose,
}: {
  messages: Message[];
  input: string;
  loading: boolean;
  convId: string | null;
  endRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <Bot size={16} className="text-primary-600" />
        <span className="text-sm font-medium text-gray-900">שיחת דמו</span>
        {convId && <span className="text-xs text-gray-400 ms-1">{convId.slice(0, 12)}...</span>}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <XIcon size={14} /> סגור דמו
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot size={40} className="mb-2 text-gray-300" />
            <p className="text-sm">שלח הודעה לבדיקת סוכני ה-AI</p>
          </div>
        )}
        {messages.map(msg => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot size={14} className="text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
            placeholder="הקלד הודעה לבדיקה..."
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            autoFocus
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Chat Toolbar
// ---------------------------------------------------------------------------

function ChatToolbar({
  conversation,
  customAgentName,
  customAgents,
  showSwitchAgent,
  switchAgentRef,
  onToggleSwitchAgent,
  onTakeOver,
  onPause,
  onResume,
  onClose,
  onReopen,
  onHandoff,
  onSwitchAgent,
}: {
  conversation: Conversation;
  customAgentName?: string;
  customAgents: { id: string; name: string }[];
  showSwitchAgent: boolean;
  switchAgentRef: React.RefObject<HTMLDivElement | null>;
  onToggleSwitchAgent: () => void;
  onTakeOver: () => void;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onReopen: () => void;
  onHandoff: () => void;
  onSwitchAgent: (id: string) => void;
}) {
  const status = conversation.status;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-wrap">
      <StatusBadge status={status} />
      <AgentBadge agent={conversation.currentAgent} customAgentName={customAgentName} />
      <div className="flex-1" />

      {/* Reopen (closed) */}
      {status === 'closed' && (
        <ToolbarButton onClick={onReopen} icon={<Unlock size={14} />} label="פתח מחדש" variant="green" />
      )}

      {/* Take over (not human_active, not closed) */}
      {status !== 'human_active' && status !== 'closed' && (
        <ToolbarButton onClick={onTakeOver} icon={<Hand size={14} />} label="קח שליטה" variant="red" />
      )}

      {/* Pause AI (active) */}
      {status === 'active' && (
        <ToolbarButton onClick={onPause} icon={<Pause size={14} />} label="השהה AI" variant="yellow" />
      )}

      {/* Resume AI (paused or human_active) */}
      {(status === 'paused' || status === 'human_active') && (
        <ToolbarButton onClick={onResume} icon={<Play size={14} />} label="החזר AI" variant="green" />
      )}

      {/* Switch agent dropdown */}
      <div className="relative" ref={switchAgentRef}>
        <button
          onClick={onToggleSwitchAgent}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw size={14} /> החלף סוכן <ChevronDown size={12} />
        </button>
        {showSwitchAgent && (
          <div className="absolute end-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            {customAgents.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">אין סוכנים פעילים</div>
            ) : (
              customAgents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => onSwitchAgent(agent.id)}
                  className="block w-full text-start px-3 py-2 text-sm hover:bg-purple-50 text-purple-700"
                >
                  {agent.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Handoff to human (not closed, not human_active) */}
      {status !== 'closed' && status !== 'human_active' && status !== 'handoff' && (
        <ToolbarButton onClick={onHandoff} icon={<ArrowUpRight size={14} />} label="העבר לנציג" variant="gray" />
      )}

      {/* Close (not closed) */}
      {status !== 'closed' && (
        <ToolbarButton onClick={onClose} icon={<XIcon size={14} />} label="סגור" variant="gray" />
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon,
  label,
  variant,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: 'red' | 'yellow' | 'green' | 'gray';
}) {
  const colors = {
    red: 'text-red-700 bg-red-50 hover:bg-red-100',
    yellow: 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100',
    green: 'text-green-700 bg-green-50 hover:bg-green-100',
    gray: 'text-gray-700 bg-gray-100 hover:bg-gray-200',
  };

  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg', colors[variant])}
    >
      {icon} {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Reply Input
// ---------------------------------------------------------------------------

function ReplyInput({
  value,
  onChange,
  onSend,
  isInternalNote,
  onToggleNote,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isInternalNote: boolean;
  onToggleNote: () => void;
}) {
  return (
    <div className={cn(
      'p-3 border-t border-gray-200',
      isInternalNote ? 'bg-yellow-50' : 'bg-white',
    )}>
      {isInternalNote && (
        <div className="text-xs text-yellow-700 font-medium mb-2 flex items-center gap-1">
          <StickyNote size={12} /> הערה פנימית — לא תישלח ללקוח
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleNote}
          title={isInternalNote ? 'חזור להודעה רגילה' : 'הערה פנימית'}
          className={cn(
            'p-2 rounded-lg transition-colors',
            isInternalNote
              ? 'bg-yellow-200 text-yellow-800'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          )}
        >
          <StickyNote size={16} />
        </button>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder={isInternalNote ? 'כתוב הערה פנימית...' : 'הקלד תגובה...'}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          onClick={onSend}
          disabled={!value.trim()}
          className={cn(
            'p-2 rounded-lg disabled:opacity-50',
            isInternalNote
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          <SendIcon size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context Panel (Left)
// ---------------------------------------------------------------------------

function ContextPanel({
  conversation,
  customAgentName,
}: {
  conversation: Conversation;
  customAgentName?: string;
}) {
  return (
    <div className="w-72 border-s border-gray-200 bg-white flex-shrink-0 overflow-y-auto hidden xl:block">
      <div className="p-4 space-y-5">
        {/* Contact Info */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <User size={12} /> איש קשר
          </h3>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-900">{conversation.contactId}</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ChannelIcon channel={conversation.channel} size={12} />
              <span>{conversation.channel}</span>
            </div>
            {conversation.context?.tags && conversation.context.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {conversation.context.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-0.5 text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                    <Tag size={10} /> {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Current Agent */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Bot size={12} /> סוכן נוכחי
          </h3>
          <AgentBadge agent={conversation.currentAgent} customAgentName={customAgentName} />
          {customAgentName && (
            <p className="text-xs text-purple-600 mt-1">{customAgentName}</p>
          )}
        </section>

        {/* Conversation Metadata */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <MessageSquare size={12} /> פרטי שיחה
          </h3>
          <div className="space-y-1.5 text-sm">
            <MetadataRow label="סטטוס">
              <StatusBadge status={conversation.status} />
            </MetadataRow>
            <MetadataRow label="הודעות">
              <span className="text-gray-900">{conversation.messages.length}</span>
            </MetadataRow>
            <MetadataRow label="התחלה">
              <span className="text-gray-900 text-xs flex items-center gap-1">
                <Clock size={10} /> {formatRelativeTime(conversation.startedAt)}
              </span>
            </MetadataRow>
            <MetadataRow label="עדכון אחרון">
              <span className="text-gray-900 text-xs">{formatRelativeTime(conversation.updatedAt)}</span>
            </MetadataRow>
          </div>
        </section>

        {/* Context: intent, sentiment, language, lead score */}
        {conversation.context && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">הקשר</h3>
            <div className="space-y-1.5 text-sm">
              {conversation.context.intent && (
                <MetadataRow label="כוונה">
                  <span className="text-gray-900">{conversation.context.intent}</span>
                </MetadataRow>
              )}
              {conversation.context.sentiment && (
                <MetadataRow label="סנטימנט">
                  <SentimentIndicator sentiment={conversation.context.sentiment} />
                </MetadataRow>
              )}
              {conversation.context.language && (
                <MetadataRow label="שפה">
                  <span className="text-gray-900">{conversation.context.language}</span>
                </MetadataRow>
              )}
              {conversation.context.leadScore != null && (
                <MetadataRow label="ציון ליד">
                  <LeadScoreBadge score={conversation.context.leadScore} />
                </MetadataRow>
              )}
            </div>
          </section>
        )}

        {/* AI Summary placeholder */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Brain size={12} /> סיכום AI
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-400 italic">
            סיכום אוטומטי של השיחה יופיע כאן בקרוב...
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      {children}
    </div>
  );
}

function SentimentIndicator({ sentiment }: { sentiment: string }) {
  const config: Record<string, { emoji: string; color: string }> = {
    positive: { emoji: '+', color: 'text-green-600' },
    negative: { emoji: '-', color: 'text-red-600' },
    neutral: { emoji: '~', color: 'text-gray-600' },
  };
  const c = config[sentiment] || config.neutral;
  return (
    <span className={cn('text-sm font-medium', c.color)}>
      {c.emoji} {sentiment}
    </span>
  );
}

function LeadScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', color)}>
      {score}
    </span>
  );
}
