import { useHandoffs } from '../hooks/useHandoffs';
import { useConversationActions } from '../hooks/useConversations';
import { useAuth } from '../contexts/AuthContext';
import { PageLoading } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { ChannelIcon } from '../components/ChannelIcon';
import { formatRelativeTime, truncate } from '../lib/utils';
import { ArrowRightLeft, UserCheck, Eye, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export function HandoffQueue() {
  const { data, isLoading } = useHandoffs();
  const actions = useConversationActions();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handoffs = data?.conversations || [];

  const handleAssign = async (convId: string) => {
    try {
      await actions.takeover.mutateAsync({ id: convId, humanAgentId: user?.id || 'agent-1' });
      toast.success('Assigned to you');
    } catch {
      toast.error('Failed to assign');
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Handoff Queue</h1>
          {handoffs.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {handoffs.length}
            </span>
          )}
        </div>
      </div>

      {handoffs.length === 0 ? (
        <EmptyState
          title="No pending handoffs"
          description="All conversations are being handled by AI agents"
          icon={<ArrowRightLeft size={24} className="text-gray-400" />}
        />
      ) : (
        <div className="space-y-3">
          {handoffs.map(conv => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            return (
              <div key={conv.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <ArrowRightLeft size={18} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ChannelIcon channel={conv.channel} size={14} />
                      <span className="text-sm font-medium text-gray-900">{conv.contactId}</span>
                      <StatusBadge status={conv.status} />
                    </div>
                    {lastMsg && (
                      <p className="text-sm text-gray-600 mb-2">{truncate(lastMsg.content, 120)}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {formatRelativeTime(conv.updatedAt)} in queue
                      </span>
                      <span>{conv.messages.length} messages</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/conversations?id=${conv.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Eye size={14} /> View
                    </button>
                    <button
                      onClick={() => handleAssign(conv.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
                    >
                      <UserCheck size={14} /> Assign to Me
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
