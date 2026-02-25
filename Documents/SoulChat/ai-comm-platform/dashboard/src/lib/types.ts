export type ChannelType = 'whatsapp' | 'instagram' | 'telegram' | 'web';
export type ConversationStatus = 'active' | 'waiting' | 'handoff' | 'human_active' | 'paused' | 'closed';
export type AgentType = 'router' | 'sales' | 'support' | 'trial_meeting' | 'handoff';
export type MessageDirection = 'inbound' | 'outbound';

export interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  channel: ChannelType;
  channelUserId: string;
  tags: string[];
  customFields: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  conversationCount: number;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  direction: MessageDirection;
  type: string;
  content: string;
  channel: ChannelType;
  metadata: Record<string, unknown>;
  timestamp: string;
}

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
  messageCount?: number;
  context: ConversationContext;
  startedAt: string;
  updatedAt: string;
}

export interface Handoff {
  id: string;
  conversationId: string;
  contactId: string;
  reason: string | null;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsOverview {
  conversations: { total: number; active: number; waiting: number; handoff: number; closed: number };
  contacts: { total: number };
  messages: { total: number; today: number };
}

export interface BrainModule {
  name: string;
  category: string;
  subcategory: string;
  entryCount: number;
  data: unknown;
}
