import { Bot, User } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Message } from '../lib/types';
import { format } from 'date-fns';

export function ChatBubble({ message }: { message: Message }) {
  const isInbound = message.direction === 'inbound';
  const isHuman = !isInbound && (message.metadata?.humanAgent as string | undefined);
  const agentType = message.metadata?.agent as string | undefined;
  const customAgentName = message.metadata?.customAgentName as string | undefined;
  const isInternalNote = message.metadata?.isInternalNote as boolean | undefined;
  const isSystem = message.type === 'system';

  // System messages: centered, no bubble, gray italic
  if (isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <span className="text-xs text-gray-400 italic">{message.content}</span>
      </div>
    );
  }

  // Internal note: yellow background with lock icon prefix
  if (isInternalNote) {
    return (
      <div className="flex justify-center mb-3">
        <div className="max-w-[80%]">
          <div className="rounded-lg px-3 py-2 text-sm bg-yellow-100 text-yellow-900 border border-yellow-200">
            <div className="text-xs font-medium text-yellow-700 mb-1">&#x1F512; הערה פנימית</div>
            {message.content}
          </div>
          <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-gray-400">
            <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
          </div>
        </div>
      </div>
    );
  }

  // RTL: inbound (customer) on the RIGHT (justify-end), outbound (agent) on the LEFT (justify-start)
  return (
    <div className={cn('flex gap-2 mb-3', isInbound ? 'justify-end' : 'justify-start')}>
      {/* Outbound avatar on the left */}
      {!isInbound && (
        <div className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
          isHuman ? 'bg-green-100' : 'bg-blue-100'
        )}>
          {isHuman ? <User size={14} className="text-green-600" /> : <Bot size={14} className="text-blue-600" />}
        </div>
      )}
      <div className={cn('max-w-[70%]')}>
        {/* Custom agent name label */}
        {!isInbound && customAgentName && (
          <div className="text-xs text-purple-600 font-medium mb-0.5">
            &#x1F916; {customAgentName}
          </div>
        )}
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
            isInbound && 'bg-gray-100 text-gray-900',
            !isInbound && !isHuman && 'bg-blue-500 text-white',
            isHuman && 'bg-green-500 text-white'
          )}
        >
          {message.content}
        </div>
        <div className={cn('flex items-center gap-1 mt-0.5 text-xs text-gray-400', isInbound ? 'justify-end' : 'justify-start')}>
          {!isInbound && agentType && !customAgentName && (
            <span className="font-medium">{isHuman ? `נציג ${message.metadata.humanAgent}` : agentType}</span>
          )}
          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
        </div>
      </div>
      {/* Inbound avatar on the right */}
      {isInbound && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
          <User size={14} className="text-gray-600" />
        </div>
      )}
    </div>
  );
}
