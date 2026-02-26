import { cn } from '../lib/utils';
import type { AgentType } from '../lib/types';

const agentConfig: Record<string, { label: string; className: string }> = {
  router: { label: 'ניתוב', className: 'bg-gray-100 text-gray-700' },
  sales: { label: 'מכירות', className: 'bg-blue-100 text-blue-700' },
  support: { label: 'תמיכה', className: 'bg-orange-100 text-orange-700' },
  trial_meeting: { label: 'שיעור ניסיון', className: 'bg-indigo-100 text-indigo-700' },
  handoff: { label: 'העברה', className: 'bg-red-100 text-red-700' },
};

export function AgentBadge({ agent, customAgentName }: { agent: AgentType | string | null; customAgentName?: string }) {
  if (customAgentName) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700')}>
        <span aria-hidden="true">🤖</span>
        {customAgentName}
      </span>
    );
  }

  if (!agent) return null;
  const config = agentConfig[agent] || { label: agent, className: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', config.className)}>
      <span aria-hidden="true">🤖</span>
      {config.label}
    </span>
  );
}
