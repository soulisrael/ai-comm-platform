import { cn } from '../lib/utils';
import type { ConversationStatus } from '../lib/types';

const statusConfig: Record<ConversationStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  waiting: { label: 'Waiting', className: 'bg-yellow-100 text-yellow-800' },
  handoff: { label: 'Handoff', className: 'bg-red-100 text-red-800' },
  human_active: { label: 'Human', className: 'bg-purple-100 text-purple-800' },
  paused: { label: 'Paused', className: 'bg-gray-100 text-gray-800' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-500' },
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
