import { cn } from '../lib/utils';
import type { AgentType } from '../lib/types';

const agentConfig: Record<string, { label: string; className: string }> = {
  router: { label: 'Router', className: 'bg-gray-100 text-gray-700' },
  sales: { label: 'Sales', className: 'bg-blue-100 text-blue-700' },
  support: { label: 'Support', className: 'bg-orange-100 text-orange-700' },
  trial_meeting: { label: 'Trial', className: 'bg-indigo-100 text-indigo-700' },
  handoff: { label: 'Handoff', className: 'bg-red-100 text-red-700' },
};

export function AgentBadge({ agent }: { agent: AgentType | string | null }) {
  if (!agent) return null;
  const config = agentConfig[agent] || { label: agent, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
