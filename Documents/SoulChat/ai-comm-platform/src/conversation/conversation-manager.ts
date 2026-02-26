import { Conversation, ConversationStatus, ConversationContext, AgentType } from '../types/conversation';
import { Message, ChannelType } from '../types/message';
import { Store, MemoryStore } from './memory-store';
import logger from '../services/logger';

export interface ConversationFilters {
  status?: ConversationStatus;
  channel?: ChannelType;
  currentAgent?: AgentType;
  contactId?: string;
  startedAfter?: Date;
  startedBefore?: Date;
}

export class ConversationManager {
  private store: Store<Conversation>;

  constructor(store?: Store<Conversation>) {
    this.store = store || new MemoryStore<Conversation>();
  }

  startConversation(contactId: string, channel: ChannelType): Conversation {
    const context: ConversationContext = {
      intent: null,
      sentiment: null,
      language: null,
      leadScore: null,
      tags: [],
      customFields: {},
    };

    const conversation: Conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      contactId,
      channel,
      status: 'active',
      currentAgent: null,
      messages: [],
      context,
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.create(conversation);
    logger.info(`Conversation started: ${conversation.id}`, { contactId, channel });
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.store.get(id);
  }

  getActiveConversation(contactId: string): Conversation | undefined {
    const active = this.store.find(
      c => c.contactId === contactId && (c.status === 'active' || c.status === 'waiting')
    );
    // Return most recent active conversation
    return active.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }

  addMessage(conversationId: string, message: Message): Conversation {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    this.store.update(conversationId, conversation);
    return conversation;
  }

  updateStatus(conversationId: string, status: ConversationStatus): Conversation {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const oldStatus = conversation.status;
    conversation.status = status;
    conversation.updatedAt = new Date();
    this.store.update(conversationId, conversation);

    logger.info(`Conversation ${conversationId} status: ${oldStatus} → ${status}`);
    return conversation;
  }

  updateAgent(conversationId: string, agentType: AgentType): Conversation {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.currentAgent = agentType;
    conversation.updatedAt = new Date();
    this.store.update(conversationId, conversation);
    return conversation;
  }

  updateContext(conversationId: string, context: Partial<ConversationContext>): Conversation {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.context = { ...conversation.context, ...context };
    conversation.updatedAt = new Date();
    this.store.update(conversationId, conversation);
    return conversation;
  }

  closeConversation(conversationId: string, reason?: string): Conversation {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.status = 'closed';
    conversation.updatedAt = new Date();
    if (reason) {
      conversation.context.customFields.closeReason = reason;
    }
    this.store.update(conversationId, conversation);

    logger.info(`Conversation closed: ${conversationId}`, { reason });
    return conversation;
  }

  reopenConversation(conversationId: string): Conversation {
    const conversation = this.store.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.status = 'active';
    conversation.updatedAt = new Date();
    delete conversation.context.customFields.closeReason;
    this.store.update(conversationId, conversation);

    logger.info(`Conversation reopened: ${conversationId}`);
    return conversation;
  }

  getConversationHistory(conversationId: string, limit?: number): Message[] {
    const conversation = this.store.get(conversationId);
    if (!conversation) return [];

    if (limit) {
      return conversation.messages.slice(-limit);
    }
    return [...conversation.messages];
  }

  findConversations(filters: ConversationFilters): Conversation[] {
    return this.store.find(c => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.channel && c.channel !== filters.channel) return false;
      if (filters.currentAgent && c.currentAgent !== filters.currentAgent) return false;
      if (filters.contactId && c.contactId !== filters.contactId) return false;
      if (filters.startedAfter && c.startedAt < filters.startedAfter) return false;
      if (filters.startedBefore && c.startedAt > filters.startedBefore) return false;
      return true;
    });
  }

  getAllConversations(): Conversation[] {
    return this.store.getAll();
  }

  getStats(): { total: number; active: number; waiting: number; handoff: number; closed: number } {
    const all = this.store.getAll();
    return {
      total: all.length,
      active: all.filter(c => c.status === 'active').length,
      waiting: all.filter(c => c.status === 'waiting').length,
      handoff: all.filter(c => c.status === 'handoff').length,
      closed: all.filter(c => c.status === 'closed').length,
    };
  }
}
