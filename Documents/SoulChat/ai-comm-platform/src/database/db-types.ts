/**
 * Database row types (snake_case) and mapping functions to/from TypeScript types (camelCase).
 */

import { Contact } from '../types/contact';
import { Conversation, ConversationStatus, ConversationContext, AgentType } from '../types/conversation';
import { Message, MessageDirection, MessageType, ChannelType } from '../types/message';

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
