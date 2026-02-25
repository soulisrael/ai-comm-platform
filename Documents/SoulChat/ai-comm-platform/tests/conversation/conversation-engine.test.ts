import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { ConversationEngine } from '../../src/conversation/conversation-engine';
import { ConversationManager } from '../../src/conversation/conversation-manager';
import { ContactManager } from '../../src/conversation/contact-manager';
import { AgentOrchestrator } from '../../src/agents/agent-orchestrator';
import { ClaudeAPI } from '../../src/services/claude-api';
import { BrainLoader } from '../../src/brain/brain-loader';

const brainPath = path.resolve(__dirname, '../../brain');

describe('ConversationEngine', () => {
  let engine: ConversationEngine;
  let conversationManager: ConversationManager;
  let contactManager: ContactManager;
  let mockClaude: ClaudeAPI;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockResolvedValue({
        content: 'Hello! How can I help you today?',
        inputTokens: 200, outputTokens: 100, model: 'test',
      }),
      chatJSON: vi.fn().mockResolvedValue({
        data: { intent: 'sales', confidence: 0.9, language: 'English', sentiment: 'positive', summary: 'Sales inquiry' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      }),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    const brainLoader = new BrainLoader(brainPath);
    brainLoader.loadAll();

    const orchestrator = new AgentOrchestrator(mockClaude, brainLoader);
    conversationManager = new ConversationManager();
    contactManager = new ContactManager();
    engine = new ConversationEngine(orchestrator, conversationManager, contactManager);
  });

  describe('handleIncomingMessage', () => {
    it('should create a contact and conversation for a new user', async () => {
      const result = await engine.handleIncomingMessage({
        content: 'Hello!',
        channelUserId: 'user-001',
        channel: 'whatsapp',
        senderName: 'Test User',
      });

      expect(result.contact).toBeDefined();
      expect(result.contact.name).toBe('Test User');
      expect(result.contact.channelUserId).toBe('user-001');

      expect(result.conversation).toBeDefined();
      expect(result.conversation.contactId).toBe(result.contact.id);

      expect(result.outgoingMessage).toBeDefined();
      expect(result.outgoingMessage.content).toBeDefined();
    });

    it('should reuse existing contact and conversation', async () => {
      const result1 = await engine.handleIncomingMessage({
        content: 'Hello!',
        channelUserId: 'user-001',
        channel: 'whatsapp',
        senderName: 'Test User',
      });

      const result2 = await engine.handleIncomingMessage({
        content: 'Tell me more',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      expect(result2.contact.id).toBe(result1.contact.id);
      expect(result2.conversation.id).toBe(result1.conversation.id);
    });

    it('should store messages in conversation', async () => {
      await engine.handleIncomingMessage({
        content: 'First message',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      await engine.handleIncomingMessage({
        content: 'Second message',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      const contacts = contactManager.getAllContacts();
      const conv = conversationManager.getActiveConversation(contacts[0].id);
      expect(conv).toBeDefined();
      // Each handleIncomingMessage stores: 1 inbound + 1 outbound
      expect(conv!.messages.length).toBeGreaterThanOrEqual(4);
    });

    it('should include routing decision for new conversations', async () => {
      const result = await engine.handleIncomingMessage({
        content: 'I want to buy something',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      expect(result.routingDecision).toBeDefined();
      expect(result.routingDecision!.selectedAgent).toBe('sales');
    });

    it('should emit conversation:started event', async () => {
      const handler = vi.fn();
      engine.on('conversation:started', handler);

      await engine.handleIncomingMessage({
        content: 'Hello',
        channelUserId: 'user-new',
        channel: 'whatsapp',
      });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should emit message:incoming and message:outgoing events', async () => {
      const incomingHandler = vi.fn();
      const outgoingHandler = vi.fn();
      engine.on('message:incoming', incomingHandler);
      engine.on('message:outgoing', outgoingHandler);

      await engine.handleIncomingMessage({
        content: 'Hello',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      expect(incomingHandler).toHaveBeenCalledOnce();
      expect(outgoingHandler).toHaveBeenCalledOnce();
    });

    it('should increment conversation count for new conversations', async () => {
      await engine.handleIncomingMessage({
        content: 'Hello',
        channelUserId: 'user-001',
        channel: 'whatsapp',
        senderName: 'Test User',
      });

      const contacts = contactManager.getAllContacts();
      expect(contacts[0].conversationCount).toBe(1);
    });
  });

  describe('handleHumanReply', () => {
    it('should add a human reply to the conversation', async () => {
      const result = await engine.handleIncomingMessage({
        content: 'I need help',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      const convId = result.conversation.id;
      const msg = engine.handleHumanReply(convId, 'agent-1', 'Hi, I can help you!');

      expect(msg.content).toBe('Hi, I can help you!');
      expect(msg.direction).toBe('outbound');
      expect(msg.metadata).toHaveProperty('humanAgent', 'agent-1');

      const conv = conversationManager.getConversation(convId);
      expect(conv!.status).toBe('human_active');
    });

    it('should throw for non-existent conversation', () => {
      expect(() => engine.handleHumanReply('nonexistent', 'agent-1', 'Hi')).toThrow('Conversation not found');
    });
  });

  describe('handleHandoff', () => {
    it('should set conversation to handoff status', async () => {
      const result = await engine.handleIncomingMessage({
        content: 'Hello',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      const handoffHandler = vi.fn();
      engine.on('conversation:handoff', handoffHandler);

      engine.handleHandoff(result.conversation.id);

      const conv = conversationManager.getConversation(result.conversation.id);
      expect(conv!.status).toBe('handoff');
      expect(handoffHandler).toHaveBeenCalledOnce();
    });
  });

  describe('resumeAI', () => {
    it('should resume AI for a conversation', async () => {
      const result = await engine.handleIncomingMessage({
        content: 'Hello',
        channelUserId: 'user-001',
        channel: 'whatsapp',
      });

      engine.handleHandoff(result.conversation.id);
      engine.resumeAI(result.conversation.id);

      const conv = conversationManager.getConversation(result.conversation.id);
      expect(conv!.status).toBe('active');
    });
  });

  describe('accessors', () => {
    it('should expose managers', () => {
      expect(engine.getConversationManager()).toBe(conversationManager);
      expect(engine.getContactManager()).toBe(contactManager);
      expect(engine.getOrchestrator()).toBeDefined();
    });
  });
});
