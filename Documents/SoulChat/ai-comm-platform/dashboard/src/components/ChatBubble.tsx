import { Bot, User } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Message } from '../lib/types';
import { format } from 'date-fns';

export function ChatBubble({ message }: { message: Message }) {
  const isInbound = message.direction === 'inbound';
  const isHuman = !isInbound && (message.metadata?.humanAgent as string | undefined);
  const agentType = message.metadata?.agent as string | undefined;

  return (
    <div className={cn('flex gap-2 mb-3', isInbound ? 'justify-start' : 'justify-end')}>
      {isInbound && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
          <User size={14} className="text-gray-600" />
        </div>
      )}
      <div className={cn('max-w-[70%]')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            isInbound && 'bg-gray-100 text-gray-900',
            !isInbound && !isHuman && 'bg-blue-500 text-white',
            isHuman && 'bg-green-500 text-white'
          )}
        >
          {message.content}
        </div>
        <div className={cn('flex items-center gap-1 mt-0.5 text-xs text-gray-400', !isInbound && 'justify-end')}>
          {!isInbound && agentType && (
            <span className="font-medium">{isHuman ? `Agent ${message.metadata.humanAgent}` : agentType}</span>
          )}
          <span>{format(new Date(message.timestamp), 'HH:mm')}</span>
        </div>
      </div>
      {!isInbound && (
        <div className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
          isHuman ? 'bg-green-100' : 'bg-blue-100'
        )}>
          {isHuman ? <User size={14} className="text-green-600" /> : <Bot size={14} className="text-blue-600" />}
        </div>
      )}
    </div>
  );
}
