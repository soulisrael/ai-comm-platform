import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { RouterAgent } from '../../src/agents/router-agent';
import { ClaudeAPI } from '../../src/services/claude-api';
import { PromptBuilder } from '../../src/agents/prompt-builder';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainSearch } from '../../src/brain/brain-search';
import { CustomAgentRepository } from '../../src/database/repositories/custom-agent-repository';
import { CustomAgentWithTopics } from '../../src/types/custom-agent';
import { Message } from '../../src/types/message';
import { Conversation, ConversationContext } from '../../src/types/conversation';

const brainPath = path.resolve(__dirname, '../../brain');

function createTestMessage(content: string): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    direction: 'inbound',
    type: 'text',
    content,
    channel: 'whatsapp',
    metadata: {},
    timestamp: new Date(),
  };
}

function createTestConversation(): Conversation {
  const context: ConversationContext = {
    intent: null, sentiment: null, language: null, leadScore: null, tags: [], customFields: {},
  };
  return {
    id: 'conv-1', contactId: 'contact-1', channel: 'whatsapp',
    status: 'active', currentAgent: null, messages: [], context,
    startedAt: new Date(), updatedAt: new Date(),
  };
}

function createTestAgents(): CustomAgentWithTopics[] {
  return [
    {
      id: 'agent-kiryat-ono',
      name: 'סניף קריית אונו',
      description: 'סוכן לסניף קריית אונו',
      systemPrompt: null,
      routingKeywords: ['קריית אונו', 'מוזיקה', 'אנגלית'],
      routingDescription: null,
      handoffRules: {},
      transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      topics: [
        {
          id: 'topic-1', name: 'חוג מוזיקה', description: null,
          content: { description: 'חוג מוזיקה', faq: [], customFields: {} },
          isShared: false, createdAt: new Date(), updatedAt: new Date(),
        },
      ],
    },
    {
      id: 'agent-ramat-hasharon',
      name: 'סניף רמת השרון',
      description: 'סוכן לסניף רמת השרון',
      systemPrompt: null,
      routingKeywords: ['רמת השרון', 'שחייה', 'ריקוד'],
      routingDescription: null,
      handoffRules: {},
      transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      topics: [
        {
          id: 'topic-2', name: 'שחייה', description: null,
          content: { description: 'שחייה', faq: [], customFields: {} },
          isShared: false, createdAt: new Date(), updatedAt: new Date(),
        },
      ],
    },
    {
      id: 'agent-default',
      name: 'סוכן כללי',
      description: 'סוכן ברירת מחדל',
      systemPrompt: null,
      routingKeywords: [],
      routingDescription: null,
      handoffRules: {},
      transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: true,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      topics: [],
    },
  ];
}

describe('RouterAgent', () => {
  let mockClaude: ClaudeAPI;
  let brainSearch: BrainSearch;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn(),
      chatJSON: vi.fn(),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    const loader = new BrainLoader(brainPath);
    loader.loadAll();
    brainSearch = new BrainSearch(loader);
    promptBuilder = new PromptBuilder(brainSearch);
  });

  // ─── Legacy routing tests ────────────────────────────────────────────

  describe('Legacy processMessage()', () => {
    let router: RouterAgent;

    beforeEach(() => {
      router = new RouterAgent(mockClaude, promptBuilder, brainSearch);
    });

    it('should route to sales agent for buying intent', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'sales', confidence: 0.9, language: 'English', sentiment: 'positive', summary: 'Wants to buy' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg = createTestMessage('I want to buy a product');
      const conv = createTestConversation();
      const result = await router.processMessage(msg, conv, {});

      expect(result.suggestedAgent).toBe('sales');
      expect(result.confidence).toBe(0.9);
    });

    it('should route to support agent for help request', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'support', confidence: 0.85, language: 'English', sentiment: 'negative', summary: 'Has a problem' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg = createTestMessage('I have a problem with my order');
      const conv = createTestConversation();
      const result = await router.processMessage(msg, conv, {});

      expect(result.suggestedAgent).toBe('support');
    });

    it('should route to trial_meeting for appointment request', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'trial_meeting', confidence: 0.88, language: 'English', sentiment: 'positive', summary: 'Wants to book trial' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg = createTestMessage('I want to book a trial session');
      const conv = createTestConversation();
      const result = await router.processMessage(msg, conv, {});

      expect(result.suggestedAgent).toBe('trial_meeting');
    });

    it('should fall back to keyword matching when AI fails', async () => {
      vi.mocked(mockClaude.chatJSON).mockRejectedValue(new Error('API error'));

      const msg = createTestMessage('What is the price of your product?');
      const conv = createTestConversation();
      const result = await router.processMessage(msg, conv, {});

      expect(result.suggestedAgent).toBe('sales');
    });

    it('should use keyword fallback for low confidence', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { intent: 'general', confidence: 0.3, language: 'English', sentiment: 'neutral', summary: 'Unclear intent' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const msg = createTestMessage('I need help with a refund');
      const conv = createTestConversation();
      const result = await router.processMessage(msg, conv, {});

      expect(result.suggestedAgent).toBe('support');
    });
  });

  // ─── Custom agent routing tests ──────────────────────────────────────

  describe('routeToCustomAgent()', () => {
    let router: RouterAgent;
    let mockAgentRepo: CustomAgentRepository;

    beforeEach(() => {
      mockAgentRepo = {
        getAllWithTopics: vi.fn().mockResolvedValue(createTestAgents()),
        getWithTopics: vi.fn(),
        findById: vi.fn(),
      } as unknown as CustomAgentRepository;

      router = new RouterAgent(mockClaude, promptBuilder, brainSearch, mockAgentRepo);
    });

    it('should route to correct agent via AI', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'agent-kiryat-ono', confidence: 0.9, reasoning: 'הלקוח שואל על מוזיקה בקריית אונו' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const result = await router.routeToCustomAgent('אני מחפש חוג מוזיקה בקריית אונו');

      expect(result.agentId).toBe('agent-kiryat-ono');
      expect(result.confidence).toBe(0.9);
    });

    it('should use keyword fallback when AI confidence is low', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'agent-default', confidence: 0.3, reasoning: 'לא ברור' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const result = await router.routeToCustomAgent('אני רוצה שחייה');

      // Keyword fallback should match 'שחייה' to רמת השרון
      expect(result.agentId).toBe('agent-ramat-hasharon');
    });

    it('should use keyword fallback when AI fails', async () => {
      vi.mocked(mockClaude.chatJSON).mockRejectedValue(new Error('API error'));

      const result = await router.routeToCustomAgent('מה לגבי חוג מוזיקה?');

      expect(result.agentId).toBe('agent-kiryat-ono');
    });

    it('should fall back to default agent when no match', async () => {
      vi.mocked(mockClaude.chatJSON).mockRejectedValue(new Error('API error'));

      const result = await router.routeToCustomAgent('שלום, מה שלומכם?');

      expect(result.agentId).toBe('agent-default');
      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });

    it('should validate agent ID exists', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'nonexistent-agent', confidence: 0.9, reasoning: 'test' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      });

      const result = await router.routeToCustomAgent('test');

      // Should fall back to default agent
      expect(result.agentId).toBe('agent-default');
      expect(result.confidence).toBe(0.5);
    });

    it('should throw when no active agents', async () => {
      vi.mocked(mockAgentRepo.getAllWithTopics).mockResolvedValue([]);

      await expect(router.routeToCustomAgent('test'))
        .rejects.toThrow('No active custom agents found');
    });
  });

  // ─── Transfer detection tests ────────────────────────────────────────

  describe('shouldTransfer()', () => {
    let router: RouterAgent;
    let mockAgentRepo: CustomAgentRepository;
    const testAgents = createTestAgents();

    beforeEach(() => {
      mockAgentRepo = {
        getAllWithTopics: vi.fn().mockResolvedValue(testAgents),
        getWithTopics: vi.fn().mockImplementation(async (id: string) => {
          return testAgents.find(a => a.id === id) || null;
        }),
        findById: vi.fn(),
      } as unknown as CustomAgentRepository;

      router = new RouterAgent(mockClaude, promptBuilder, brainSearch, mockAgentRepo);
    });

    it('should not transfer when message matches current agent', async () => {
      const result = await router.shouldTransfer('ספר לי על חוג מוזיקה', 'agent-kiryat-ono');

      expect(result.shouldTransfer).toBe(false);
    });

    it('should suggest transfer when message matches different agent', async () => {
      const result = await router.shouldTransfer('אני רוצה שחייה', 'agent-kiryat-ono');

      expect(result.shouldTransfer).toBe(true);
      expect(result.suggestedAgentId).toBe('agent-ramat-hasharon');
    });

    it('should not transfer when no match found', async () => {
      const result = await router.shouldTransfer('מה המזג אוויר?', 'agent-kiryat-ono');

      expect(result.shouldTransfer).toBe(false);
    });

    it('should return false when agent not found', async () => {
      vi.mocked(mockAgentRepo.getWithTopics).mockResolvedValue(null);

      const result = await router.shouldTransfer('test', 'nonexistent');

      expect(result.shouldTransfer).toBe(false);
    });

    it('should return false when no repo configured', async () => {
      const routerNoRepo = new RouterAgent(mockClaude, promptBuilder, brainSearch);
      const result = await routerNoRepo.shouldTransfer('test', 'agent-1');

      expect(result.shouldTransfer).toBe(false);
    });
  });
});
