import { Message, ChannelType } from './message';

/**
 * Conversation statuses:
 * - active: AI is handling the conversation
 * - waiting: waiting for customer reply
 * - handoff: customer requested human, waiting in queue
 * - human_active: a human agent has taken over (AI stopped)
 * - paused: AI paused by human agent (reviewing before intervening)
 * - closed: conversation ended
 */
export type ConversationStatus =
  | 'active'
  | 'waiting'
  | 'handoff'
  | 'human_active'
  | 'paused'
  | 'closed';

export type AgentType = 'router' | 'sales' | 'support' | 'trial_meeting' | 'handoff';

export interface ConversationContext {
  intent: string | null;
  sentiment: string | null;
  language: string | null;
  leadScore: number | null;
  tags: string[];
  customFields: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  contactId: string;
  channel: ChannelType;
  status: ConversationStatus;
  currentAgent: AgentType | null;
  messages: Message[];
  context: ConversationContext;
  customAgentId?: string;
  humanAgentId?: string;
  assignedHumanId?: string;
  takenOverAt?: Date;
  serviceWindowStart?: Date;
  serviceWindowExpires?: Date;
  entryPoint?: string;
  startedAt: Date;
  updatedAt: Date;
}
