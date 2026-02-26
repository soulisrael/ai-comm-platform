/**
 * Database row types (snake_case) and mapping functions to/from TypeScript types (camelCase).
 */

import { Contact } from '../types/contact';
import { Conversation, ConversationStatus, ConversationContext, AgentType } from '../types/conversation';
import { Message, MessageDirection, MessageType, ChannelType, SenderType } from '../types/message';
import { CustomAgent, CustomAgentSettings, BrainEntry } from '../types/custom-agent';
import { Topic, TopicContent } from '../types/topic'; // kept for legacy compat
import { TeamMember, TeamRole, TeamStatus } from '../types/team';
import { Flow, FlowRun, FlowTriggerType, FlowRunStatus, FlowNode, FlowEdge, FlowStats } from '../types/flow';
import { WaConfig, WaTemplate, WaConnectionStatus, WaTemplateCategory, WaTemplateStatus } from '../types/whatsapp';

// ─── Row interfaces (match Supabase/PostgreSQL column names) ────────────────

export interface ContactRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  channel: string;
  channel_user_id: string;
  tags: string[];
  custom_fields: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  conversation_count: number;
  metadata: Record<string, unknown>;
}

export interface ConversationRow {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  current_agent: string | null;
  context: Record<string, unknown>;
  custom_agent_id: string | null;
  human_agent_id: string | null;
  assigned_human_id: string | null;
  taken_over_at: string | null;
  service_window_start: string | null;
  service_window_expires: string | null;
  entry_point: string | null;
  started_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  contact_id: string;
  direction: string;
  type: string;
  content: string;
  channel: string;
  metadata: Record<string, unknown>;
  sender_type: string | null;
  custom_agent_id: string | null;
  is_internal_note: boolean;
  timestamp: string;
}

export interface HandoffRow {
  id: string;
  conversation_id: string;
  contact_id: string;
  reason: string | null;
  status: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrainEntryRow {
  id: string;
  category: string;
  subcategory: string;
  content: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsEventRow {
  id: string;
  event_type: string;
  conversation_id: string | null;
  contact_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface CustomAgentRow {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  main_document_text: string | null;
  main_document_filename: string | null;
  routing_keywords: string[];
  routing_description: string | null;
  handoff_rules: Record<string, unknown>;
  transfer_rules: Record<string, unknown>;
  settings: Record<string, unknown>;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TopicRow {
  id: string;
  name: string;
  description: string | null;
  content: Record<string, unknown>;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentTopicRow {
  agent_id: string;
  topic_id: string;
}

export interface AgentBrainRow {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  category: string;
  metadata: Record<string, any>;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
  password_hash: string;
  status: string;
  max_concurrent_chats: number;
  assigned_agents: string[];
  skills: string[];
  settings: Record<string, unknown>;
  last_seen_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  active: boolean;
  stats: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FlowRunRow {
  id: string;
  flow_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  status: string;
  current_node_id: string | null;
  context: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface WaConfigRow {
  id: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  verify_token: string;
  webhook_url: string | null;
  business_name: string | null;
  status: string;
  last_verified_at: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WaTemplateRow {
  id: string;
  template_name: string;
  category: string;
  language: string;
  content: string;
  header: Record<string, unknown> | null;
  footer: string | null;
  buttons: Record<string, unknown>[];
  meta_status: string;
  meta_template_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Mapping functions: Row → TypeScript ────────────────────────────────────

export function contactFromRow(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    channel: row.channel as ChannelType,
    channelUserId: row.channel_user_id,
    tags: row.tags || [],
    customFields: row.custom_fields || {},
    firstSeenAt: new Date(row.first_seen_at),
    lastSeenAt: new Date(row.last_seen_at),
    conversationCount: row.conversation_count,
    metadata: row.metadata || {},
  };
}

export function contactToRow(contact: Contact): ContactRow {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    channel: contact.channel,
    channel_user_id: contact.channelUserId,
    tags: contact.tags,
    custom_fields: contact.customFields,
    first_seen_at: contact.firstSeenAt.toISOString(),
    last_seen_at: contact.lastSeenAt.toISOString(),
    conversation_count: contact.conversationCount,
    metadata: contact.metadata,
  };
}

export function conversationFromRow(row: ConversationRow, messages: Message[] = []): Conversation {
  const context = row.context as unknown as ConversationContext;
  return {
    id: row.id,
    contactId: row.contact_id,
    channel: row.channel as ChannelType,
    status: row.status as ConversationStatus,
    currentAgent: row.current_agent as AgentType | null,
    messages,
    context: context || {
      intent: null,
      sentiment: null,
      language: null,
      leadScore: null,
      tags: [],
      customFields: {},
    },
    customAgentId: row.custom_agent_id || undefined,
    humanAgentId: row.human_agent_id || undefined,
    assignedHumanId: row.assigned_human_id || undefined,
    takenOverAt: row.taken_over_at ? new Date(row.taken_over_at) : undefined,
    serviceWindowStart: row.service_window_start ? new Date(row.service_window_start) : undefined,
    serviceWindowExpires: row.service_window_expires ? new Date(row.service_window_expires) : undefined,
    entryPoint: row.entry_point || undefined,
    startedAt: new Date(row.started_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function conversationToRow(conversation: Conversation): ConversationRow {
  return {
    id: conversation.id,
    contact_id: conversation.contactId,
    channel: conversation.channel,
    status: conversation.status,
    current_agent: conversation.currentAgent,
    context: conversation.context as unknown as Record<string, unknown>,
    custom_agent_id: conversation.customAgentId || null,
    human_agent_id: conversation.humanAgentId || null,
    assigned_human_id: conversation.assignedHumanId || null,
    taken_over_at: conversation.takenOverAt?.toISOString() || null,
    service_window_start: conversation.serviceWindowStart?.toISOString() || null,
    service_window_expires: conversation.serviceWindowExpires?.toISOString() || null,
    entry_point: conversation.entryPoint || null,
    started_at: conversation.startedAt.toISOString(),
    updated_at: conversation.updatedAt.toISOString(),
  };
}

export function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    contactId: row.contact_id,
    direction: row.direction as MessageDirection,
    type: row.type as MessageType,
    content: row.content,
    channel: row.channel as ChannelType,
    metadata: row.metadata || {},
    senderType: (row.sender_type as SenderType) || undefined,
    customAgentId: row.custom_agent_id || undefined,
    isInternalNote: row.is_internal_note || false,
    timestamp: new Date(row.timestamp),
  };
}

export function messageToRow(message: Message): MessageRow {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    contact_id: message.contactId,
    direction: message.direction,
    type: message.type,
    content: message.content,
    channel: message.channel,
    metadata: message.metadata,
    sender_type: message.senderType || null,
    custom_agent_id: message.customAgentId || null,
    is_internal_note: message.isInternalNote || false,
    timestamp: message.timestamp.toISOString(),
  };
}

export function handoffFromRow(row: HandoffRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    contactId: row.contact_id,
    reason: row.reason,
    status: row.status,
    assignedTo: row.assigned_to,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function analyticsEventFromRow(row: AnalyticsEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    conversationId: row.conversation_id,
    contactId: row.contact_id,
    data: row.data || {},
    createdAt: new Date(row.created_at),
  };
}

// ─── Custom Agent mapping functions ──────────────────────────────────────────

export function customAgentFromRow(row: CustomAgentRow): CustomAgent {
  const settings = row.settings as unknown as CustomAgentSettings;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    mainDocumentText: row.main_document_text || null,
    mainDocumentFilename: row.main_document_filename || null,
    routingKeywords: row.routing_keywords || [],
    routingDescription: row.routing_description,
    handoffRules: row.handoff_rules || {},
    transferRules: row.transfer_rules || {},
    settings: settings || { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
    isDefault: row.is_default,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function customAgentToRow(agent: CustomAgent): CustomAgentRow {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    system_prompt: agent.systemPrompt,
    main_document_text: agent.mainDocumentText,
    main_document_filename: agent.mainDocumentFilename,
    routing_keywords: agent.routingKeywords,
    routing_description: agent.routingDescription,
    handoff_rules: agent.handoffRules,
    transfer_rules: agent.transferRules,
    settings: agent.settings as unknown as Record<string, unknown>,
    is_default: agent.isDefault,
    active: agent.active,
    created_at: agent.createdAt.toISOString(),
    updated_at: agent.updatedAt.toISOString(),
  };
}

// ─── Topic mapping functions ─────────────────────────────────────────────────

export function topicFromRow(row: TopicRow): Topic {
  const content = row.content as unknown as TopicContent;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: content || { description: '', faq: [], customFields: {} },
    isShared: row.is_shared,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function topicToRow(topic: Topic): TopicRow {
  return {
    id: topic.id,
    name: topic.name,
    description: topic.description,
    content: topic.content as unknown as Record<string, unknown>,
    is_shared: topic.isShared,
    created_at: topic.createdAt.toISOString(),
    updated_at: topic.updatedAt.toISOString(),
  };
}

// ─── Agent Brain mapping functions ───────────────────────────────────────────

export function brainEntryFromRow(row: AgentBrainRow): BrainEntry {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    content: row.content,
    category: row.category || 'general',
    metadata: row.metadata || {},
    sortOrder: row.sort_order || 0,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function brainEntryToRow(entry: BrainEntry): AgentBrainRow {
  return {
    id: entry.id,
    agent_id: entry.agentId,
    title: entry.title,
    content: entry.content,
    category: entry.category,
    metadata: entry.metadata,
    sort_order: entry.sortOrder,
    active: entry.active,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
  };
}

// ─── Team Member mapping functions ──────────────────────────────────────────

export function teamMemberFromRow(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    role: row.role as TeamRole,
    status: row.status as TeamStatus,
    maxConcurrentChats: row.max_concurrent_chats,
    assignedAgents: row.assigned_agents || [],
    skills: row.skills || [],
    settings: row.settings || {},
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function teamMemberToRow(member: TeamMember & { passwordHash: string }): TeamMemberRow {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    avatar_url: member.avatarUrl,
    role: member.role,
    password_hash: member.passwordHash,
    status: member.status,
    max_concurrent_chats: member.maxConcurrentChats,
    assigned_agents: member.assignedAgents,
    skills: member.skills,
    settings: member.settings,
    last_seen_at: member.lastSeenAt?.toISOString() || null,
    active: member.active,
    created_at: member.createdAt.toISOString(),
    updated_at: member.updatedAt.toISOString(),
  };
}

// ─── Flow mapping functions ─────────────────────────────────────────────────

export function flowFromRow(row: FlowRow): Flow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type as FlowTriggerType,
    triggerConfig: row.trigger_config || {},
    nodes: (row.nodes || []) as unknown as FlowNode[],
    edges: (row.edges || []) as unknown as FlowEdge[],
    active: row.active,
    stats: (row.stats || { runs: 0, success: 0, failed: 0 }) as unknown as FlowStats,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function flowToRow(flow: Flow): FlowRow {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    trigger_type: flow.triggerType,
    trigger_config: flow.triggerConfig,
    nodes: flow.nodes as unknown as Record<string, unknown>[],
    edges: flow.edges as unknown as Record<string, unknown>[],
    active: flow.active,
    stats: flow.stats as unknown as Record<string, unknown>,
    created_at: flow.createdAt.toISOString(),
    updated_at: flow.updatedAt.toISOString(),
  };
}

export function flowRunFromRow(row: FlowRunRow): FlowRun {
  return {
    id: row.id,
    flowId: row.flow_id,
    conversationId: row.conversation_id,
    contactId: row.contact_id,
    status: row.status as FlowRunStatus,
    currentNodeId: row.current_node_id,
    context: row.context || {},
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    error: row.error,
  };
}

// ─── WhatsApp mapping functions ─────────────────────────────────────────────

export function waConfigFromRow(row: WaConfigRow): WaConfig {
  return {
    id: row.id,
    phoneNumberId: row.phone_number_id,
    wabaId: row.waba_id,
    accessToken: row.access_token,
    verifyToken: row.verify_token,
    webhookUrl: row.webhook_url,
    businessName: row.business_name,
    status: row.status as WaConnectionStatus,
    lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at) : null,
    settings: row.settings || {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function waTemplateFromRow(row: WaTemplateRow): WaTemplate {
  return {
    id: row.id,
    templateName: row.template_name,
    category: row.category as WaTemplateCategory,
    language: row.language,
    content: row.content,
    header: row.header,
    footer: row.footer,
    buttons: row.buttons || [],
    metaStatus: row.meta_status as WaTemplateStatus,
    metaTemplateId: row.meta_template_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
