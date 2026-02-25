import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { AgentOrchestrator } from '../../src/agents/agent-orchestrator';
import { ClaudeAPI } from '../../src/services/claude-api';
import { BrainLoader } from '../../src/brain/brain-loader';
import { CustomAgentRepository } from '../../src/database/repositories/custom-agent-repository';
import { TopicRepository } from '../../src/database/repositories/topic-repository';
import { CustomAgentWithTopics } from '../../src/types/custom-agent';
import { Message } from '../../src/types/message';
import { Conversation, ConversationContext } from '../../src/types/conversation';

const brainPath = path.resolve(__dirname, '../../brain');

function createTestMessage(content: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`, conversationId: 'conv-1', contactId: 'contact-1',
    direction: 'inbound', type: 'text', content, channel: 'whatsapp',
    metadata: {}, timestamp: new Date(),
  };
}

function createTestConversation(overrides?: Partial<Conversation>): Conversation {
  const context: ConversationContext = {
    intent: null, sentiment: null, language: null, leadScore: null, tags: [], customFields: {},
  };
  return {
    id: 'conv-1', contactId: 'contact-1', channel: 'whatsapp',
    status: 'active', currentAgent: null, messages: [], context,
    startedAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function createTestAgents(): CustomAgentWithTopics[] {
  return [
    {
      id: 'agent-1', name: 'סניף קריית אונו', description: 'test',
      systemPrompt: 'אתה סוכן קריית אונו', routingKeywords: ['קריית אונו', 'מוזיקה'],
      routingDescription: null, handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date(),
      topics: [{
        id: 'topic-1', name: 'חוג מוזיקה', description: null,
        content: { description: 'חוג מוזיקה', faq: [], customFields: {} },
        isShared: false, createdAt: new Date(), updatedAt: new Date(),
      }],
    },
    {
      id: 'agent-default', name: 'סוכן כללי', description: 'default agent',
      systemPrompt: null, routingKeywords: [], routingDescription: null,
      handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: true, active: true, createdAt: new Date(), updatedAt: new Date(),
      topics: [],
    },
  ];
}

describe('AgentOrchestrator', () => {
  let mockClaude: ClaudeAPI;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockResolvedValue({
        content: 'Hello! How can I help you today?',
        inputTokens: 200, outputTokens: 100, model: 'test',
      }),
      chatJSON: vi.fn().mockResolvedValue({
        data: { intent: 'sales', confidence: 0.9, language: 'English', sentiment: 'positive', summary: 'Wants to buy' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      }),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;
  });

  // ─── Legacy mode tests ──────────────────────────────────────────────

  describe('Legacy mode (no repos)', () => {
    let orchestrator: AgentOrchestrator;

    beforeEach(() => {
      const loader = new BrainLoader(brainPath);
      loader.loadAll();
      orchestrator = new AgentOrchestrator(mockClaude, loader);
    });

    it('should not be in custom agent mode', () => {
      expect(orchestrator.isCustomAgentMode()).toBe(false);
      expect(orchestrator.getAgentRunner()).toBeNull();
    });

    it('should route a new message and get a response', async () => {
      const msg = createTestMessage('I want to buy something');
      const result = await orchestrator.handleMessage(msg);

      expect(result.response).toBeDefined();
      expect(result.response.message).toBeDefined();
      expect(result.conversation).toBeDefined();
      expect(result.conversation.messages.length).toBeGreaterThan(0);
      expect(result.routingDecision).toBeDefined();
      expect(result.routingDecision!.selectedAgent).toBe('sales');
    });

    it('should create a conversation for new messages', async () => {
      const msg = createTestMessage('Hello');
      const result = await orchestrator.handleMessage(msg);

      expect(result.conversation.id).toBeDefined();
      expect(result.conversation.contactId).toBe('contact-1');
      expect(result.conversation.channel).toBe('whatsapp');
    });

    it('should use existing conversation when provided', async () => {
      const conv = createTestConversation({ currentAgent: 'sales' });
      const msg = createTestMessage('Tell me more about your products');
      const result = await orchestrator.handleMessage(msg, conv);

      expect(result.conversation.id).toBe('conv-1');
      expect(result.routingDecision).toBeUndefined();
    });

    it('should handle handoff correctly', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'support', confidence: 0.9, language: 'English', sentiment: 'negative', summary: 'Wants human' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });
      vi.mocked(mockClaude.chat).mockResolvedValue({
        content: "I understand you'd like to speak with a team member.",
        inputTokens: 200, outputTokens: 100, model: 'test',
      });

      const msg = createTestMessage('I want to speak to a human agent now');
      const result = await orchestrator.handleMessage(msg);

      expect(result.conversation.status).toBe('handoff');
    });

    it('should switch agents manually', () => {
      const conv = createTestConversation({ currentAgent: 'sales' });
      orchestrator.switchAgent(conv, 'support');
      expect(conv.currentAgent).toBe('support');
    });

    it('should return all agents', () => {
      const agents = orchestrator.getAllAgents();
      expect(agents.router).toBeDefined();
      expect(agents.sales).toBeDefined();
      expect(agents.support).toBeDefined();
      expect(agents.trial_meeting).toBeDefined();
      expect(agents.handoff).toBeDefined();
    });

    it('should maintain conversation history across messages', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'sales', confidence: 0.9, language: 'English', sentiment: 'positive', summary: 'Sales inquiry' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg1 = createTestMessage('I want to buy something');
      const result1 = await orchestrator.handleMessage(msg1);

      const msg2 = createTestMessage('What products do you have?');
      const result2 = await orchestrator.handleMessage(msg2, result1.conversation);

      expect(result2.conversation.messages.length).toBeGreaterThanOrEqual(4);
    });

    it('should route to trial_meeting for booking requests', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'trial_meeting', confidence: 0.85, language: 'English', sentiment: 'positive', summary: 'Wants to book trial' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg = createTestMessage('I want to book a free trial session');
      const result = await orchestrator.handleMessage(msg);

      expect(result.routingDecision!.selectedAgent).toBe('trial_meeting');
      expect(result.conversation.currentAgent).toBe('trial_meeting');
    });

    it('should skip AI for human-managed conversations', async () => {
      const conv = createTestConversation({ status: 'human_active' });
      const msg = createTestMessage('hello');
      const result = await orchestrator.handleMessage(msg, conv);

      expect(result.response.message).toBe('');
      expect(mockClaude.chat).not.toHaveBeenCalled();
      expect(mockClaude.chatJSON).not.toHaveBeenCalled();
    });
  });

  // ─── Custom agent mode tests ────────────────────────────────────────

  describe('Custom agent mode (with repos)', () => {
    let orchestrator: AgentOrchestrator;
    let mockAgentRepo: CustomAgentRepository;
    let mockTopicRepo: TopicRepository;
    const testAgents = createTestAgents();

    beforeEach(() => {
      mockAgentRepo = {
        getAllWithTopics: vi.fn().mockResolvedValue(testAgents),
        getWithTopics: vi.fn().mockImplementation(async (id: string) =>
          testAgents.find(a => a.id === id) || null
        ),
        findById: vi.fn().mockImplementation(async (id: string) =>
          testAgents.find(a => a.id === id) || null
        ),
        findAll: vi.fn().mockResolvedValue(testAgents),
      } as unknown as CustomAgentRepository;

      mockTopicRepo = {} as unknown as TopicRepository;

      const loader = new BrainLoader(brainPath);
      loader.loadAll();
      orchestrator = new AgentOrchestrator(mockClaude, loader, mockAgentRepo, mockTopicRepo);
    });

    it('should be in custom agent mode', () => {
      expect(orchestrator.isCustomAgentMode()).toBe(true);
      expect(orchestrator.getAgentRunner()).not.toBeNull();
    });

    it('should route to custom agent for new conversation', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'agent-1', confidence: 0.9, reasoning: 'מוזיקה בקריית אונו' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      vi.mocked(mockClaude.chat).mockResolvedValue({
        content: 'שלום! חוג המוזיקה שלנו מתקיים בימי שלישי.',
        inputTokens: 200, outputTokens: 100, model: 'test',
      });

      const msg = createTestMessage('אני מחפש חוג מוזיקה');
      const result = await orchestrator.handleMessage(msg);

      expect(result.conversation.customAgentId).toBe('agent-1');
      expect(result.routingDecision).toBeDefined();
      expect(result.routingDecision!.customAgentId).toBe('agent-1');
      expect(result.routingDecision!.customAgentName).toBe('סניף קריית אונו');
      expect(result.response.message).toBe('שלום! חוג המוזיקה שלנו מתקיים בימי שלישי.');
    });

    it('should reuse assigned agent for existing conversation', async () => {
      vi.mocked(mockClaude.chat).mockResolvedValue({
        content: 'המחיר הוא 250 ש"ח לחודש.',
        inputTokens: 200, outputTokens: 100, model: 'test',
      });

      const conv = createTestConversation({ customAgentId: 'agent-1' });
      const msg = createTestMessage('כמה עולה?');
      const result = await orchestrator.handleMessage(msg, conv);

      // Should NOT re-route since agent is already assigned
      expect(mockClaude.chatJSON).not.toHaveBeenCalled();
      expect(result.response.message).toBe('המחיר הוא 250 ש"ח לחודש.');
    });

    it('should handle handoff in custom agent mode', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'agent-1', confidence: 0.9, reasoning: 'test' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg = createTestMessage('אני רוצה לדבר עם נציג אנושי');
      const result = await orchestrator.handleMessage(msg);

      expect(result.conversation.status).toBe('handoff');
      expect(result.response.shouldHandoff).toBe(true);
    });

    it('should switch custom agent', () => {
      const conv = createTestConversation();
      orchestrator.switchCustomAgent(conv, 'agent-1');

      expect(conv.customAgentId).toBe('agent-1');
    });

    it('should skip AI for paused conversations', async () => {
      const conv = createTestConversation({ status: 'paused' });
      const msg = createTestMessage('hello');
      const result = await orchestrator.handleMessage(msg, conv);

      expect(result.response.message).toBe('');
      expect(mockClaude.chat).not.toHaveBeenCalled();
    });
  });
});
