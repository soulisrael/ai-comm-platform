import { cn } from '../lib/utils';
import type { ConversationStatus } from '../lib/types';

const statusConfig: Record<ConversationStatus, { label: string; className: string }> = {
  active: { label: 'פעיל', className: 'bg-green-100 text-green-800' },
  waiting: { label: 'ממתין', className: 'bg-yellow-100 text-yellow-800' },
  handoff: { label: 'העברה', className: 'bg-orange-100 text-orange-800' },
  human_active: { label: 'נציג פעיל', className: 'bg-purple-100 text-purple-800' },
  paused: { label: 'מושהה', className: 'bg-gray-100 text-gray-800' },
  closed: { label: 'סגור', className: 'bg-red-100 text-red-800' },
};

export function StatusBadge({ status }: { status: ConversationStatus }) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
