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

// Team types
export type TeamRole = 'admin' | 'manager' | 'agent';
export type TeamStatus = 'online' | 'away' | 'busy' | 'offline';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: TeamRole;
  status: TeamStatus;
  maxConcurrentChats: number;
  assignedAgents: string[];
  skills: string[];
  settings: Record<string, unknown>;
  lastSeenAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Flow types
export type FlowTriggerType = 'new_contact' | 'keyword' | 'webhook' | 'manual' | 'schedule' | 'message_received';
export type FlowRunStatus = 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  triggerType: FlowTriggerType;
  triggerConfig: Record<string, unknown>;
  nodes: unknown[];
  edges: unknown[];
  active: boolean;
  stats: { runs: number; success: number; failed: number };
  createdAt: string;
  updatedAt: string;
}

export interface FlowRun {
  id: string;
  flowId: string;
  conversationId: string | null;
  contactId: string | null;
  status: FlowRunStatus;
  currentNodeId: string | null;
  context: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

// WhatsApp types
export type WaConnectionStatus = 'connected' | 'disconnected' | 'error';

export interface WaConfig {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  verifyToken: string;
  webhookUrl: string | null;
  businessName: string | null;
  status: WaConnectionStatus;
  lastVerifiedAt: string | null;
  settings: Record<string, unknown>;
}

export interface WaTemplate {
  id: string;
  templateName: string;
  category: string;
  language: string;
  content: string;
  header: Record<string, unknown> | null;
  footer: string | null;
  buttons: Record<string, unknown>[];
  metaStatus: string;
  metaTemplateId: string | null;
}

// Cost types
export interface CostSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  cacheHitRate: number;
}

// Window status
export interface WindowStatus {
  isOpen: boolean;
  start: string | null;
  expires: string | null;
  remainingSeconds: number;
  entryPoint: string;
}
