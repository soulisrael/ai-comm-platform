import { EventEmitter } from 'events';
import { AgentOrchestrator, OrchestratorResult } from '../agents/agent-orchestrator';
import { ConversationManager } from './conversation-manager';
import { ContactManager } from './contact-manager';
import { ContextWindowManager } from './context-window';
import { MessageQueue } from './message-queue';
import { Message, createMessage, ChannelType } from '../types/message';
import { Conversation, AgentType } from '../types/conversation';
import { Contact } from '../types/contact';
import logger from '../services/logger';

export interface RawIncomingMessage {
  content: string;
  channelUserId: string;
  channel: ChannelType;
  senderName?: string;
  metadata?: Record<string, unknown>;
}

export interface EngineResult {
  outgoingMessage: Message;
  conversation: Conversation;
  contact: Contact;
  routingDecision?: OrchestratorResult['routingDecision'];
  agentType: AgentType | null;
}

export class ConversationEngine extends EventEmitter {
  private orchestrator: AgentOrchestrator;
  private conversationManager: ConversationManager;
  private contactManager: ContactManager;
  private contextWindow: ContextWindowManager;
  private messageQueue: MessageQueue;

  constructor(
    orchestrator: AgentOrchestrator,
    conversationManager: ConversationManager,
    contactManager: ContactManager
  ) {
    super();
    this.orchestrator = orchestrator;
    this.conversationManager = conversationManager;
    this.contactManager = contactManager;
    this.contextWindow = new ContextWindowManager();
    this.messageQueue = new MessageQueue();

    this.messageQueue.setHandler(async (message: Message) => {
      await this.processMessage(message);
    });
  }

  async handleIncomingMessage(raw: RawIncomingMessage): Promise<EngineResult> {
    // 1. Get or create contact
    const contact = this.contactManager.getOrCreateContact(
      raw.channelUserId,
      raw.channel,
      raw.senderName
    );

    // 2. Get or create active conversation
    let conversation = this.conversationManager.getActiveConversation(contact.id);
    let isNewConversation = false;

    if (!conversation) {
      conversation = this.conversationManager.startConversation(contact.id, raw.channel);
      this.contactManager.incrementConversationCount(contact.id);
      isNewConversation = true;
      this.emit('conversation:started', { conversation, contact });
      logger.info(`New conversation started: ${conversation.id} for contact ${contact.id}`);
    }

    // 3. Create incoming message
    const incomingMessage = createMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      direction: 'inbound',
      type: 'text',
      content: raw.content,
      channel: raw.channel,
      metadata: raw.metadata || {},
    });

    this.emit('message:incoming', { message: incomingMessage, conversation, contact });

    // 4. Add incoming message to conversation store
    this.conversationManager.addMessage(conversation.id, incomingMessage);

    // 5. Build context window
    const freshConversation = this.conversationManager.getConversation(conversation.id)!;
    const contextResult = this.contextWindow.buildContext(freshConversation);

    // Build a context conversation with potentially truncated messages
    const contextConversation: Conversation = {
      ...freshConversation,
      messages: contextResult.messages,
    };

    // 6. Route through AgentOrchestrator
    const result = await this.orchestrator.handleMessage(
      incomingMessage,
      isNewConversation ? undefined : contextConversation,
      contact
    );

    // 7. Sync orchestrator state back to conversation manager
    const updatedConversation = this.conversationManager.getConversation(conversation.id)!;

    // Update agent and status from orchestrator result
    if (result.conversation.currentAgent) {
      this.conversationManager.updateAgent(conversation.id, result.conversation.currentAgent);
    }
    if (result.conversation.status !== updatedConversation.status) {
      this.conversationManager.updateStatus(conversation.id, result.conversation.status);
    }
    if (result.conversation.context) {
      this.conversationManager.updateContext(conversation.id, result.conversation.context);
    }

    // 8. Create and store outgoing message
    const outgoingMessage = createMessage({
      conversationId: conversation.id,
      contactId: contact.id,
      direction: 'outbound',
      type: 'text',
      content: result.response.message,
      channel: raw.channel,
      metadata: {
        agent: result.conversation.currentAgent,
        confidence: result.response.confidence,
        action: result.response.action,
      },
    });

    this.conversationManager.addMessage(conversation.id, outgoingMessage);
    this.emit('message:outgoing', { message: outgoingMessage, conversation, contact });

    // 9. Handle special states
    if (result.response.shouldHandoff) {
      this.conversationManager.updateStatus(conversation.id, 'handoff');
      this.emit('conversation:handoff', {
        conversation: this.conversationManager.getConversation(conversation.id),
        contact,
        reason: result.response.handoffReason,
      });
    }

    if (result.response.action === 'close_conversation') {
      this.conversationManager.closeConversation(conversation.id, 'Agent closed');
      this.emit('conversation:closed', {
        conversation: this.conversationManager.getConversation(conversation.id),
        contact,
      });
    }

    const finalConversation = this.conversationManager.getConversation(conversation.id)!;

    return {
      outgoingMessage,
      conversation: finalConversation,
      contact,
      routingDecision: result.routingDecision,
      agentType: finalConversation.currentAgent,
    };
  }

  handleHumanReply(conversationId: string, agentId: string, content: string): Message {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const message = createMessage({
      conversationId,
      contactId: conversation.contactId,
      direction: 'outbound',
      type: 'text',
      content,
      channel: conversation.channel,
      metadata: { humanAgent: agentId },
    });

    this.conversationManager.addMessage(conversationId, message);
    this.conversationManager.updateStatus(conversationId, 'human_active');

    this.emit('message:outgoing', { message, conversation, agentId });
    logger.info(`Human reply in conversation ${conversationId} by agent ${agentId}`);

    return message;
  }

  handleHandoff(conversationId: string): void {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    this.conversationManager.updateStatus(conversationId, 'handoff');
    const contact = this.contactManager.getContact(conversation.contactId);

    this.emit('conversation:handoff', { conversation, contact, reason: 'Manual handoff' });
    logger.info(`Manual handoff for conversation ${conversationId}`);
  }

  resumeAI(conversationId: string): void {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    this.conversationManager.updateStatus(conversationId, 'active');
    logger.info(`AI resumed for conversation ${conversationId}`);
  }

  // Accessors for CLI and API use
  getConversationManager(): ConversationManager {
    return this.conversationManager;
  }

  getContactManager(): ContactManager {
    return this.contactManager;
  }

  getOrchestrator(): AgentOrchestrator {
    return this.orchestrator;
  }

  private async processMessage(message: Message): Promise<void> {
    // Used by the message queue for internal processing
    logger.debug(`Queue processing message ${message.id} for conversation ${message.conversationId}`);
  }
}
