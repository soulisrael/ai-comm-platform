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
  customAgentId?: string;
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

// Custom Agent types
export interface CustomAgentSettings {
  temperature: number;
  maxTokens: number;
  language: string;
  model: string;
}

export interface CustomAgent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  mainDocumentText: string | null;
  mainDocumentFilename: string | null;
  routingKeywords: string[];
  routingDescription: string | null;
  handoffRules: Record<string, unknown>;
  transferRules: Record<string, unknown>;
  settings: CustomAgentSettings;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Brain Entry types (per-agent knowledge)
export interface BrainEntry {
  id: string;
  agentId: string;
  title: string;
  content: string;
  category: string;
  metadata: Record<string, any>;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomAgentWithBrain extends CustomAgent {
  brain: BrainEntry[];
}

// Legacy alias
export type CustomAgentWithTopics = CustomAgentWithBrain;

// Topic types (kept for backward compatibility)
export interface TopicFAQ {
  question: string;
  answer: string;
}

export interface TopicContent {
  description: string;
  details?: string;
  schedule?: string;
  price?: string;
  faq: TopicFAQ[];
  customFields: Record<string, unknown>;
  images?: string[];
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  content: TopicContent;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TopicWithAgents extends Topic {
  agents?: { id: string; name: string }[];
}
