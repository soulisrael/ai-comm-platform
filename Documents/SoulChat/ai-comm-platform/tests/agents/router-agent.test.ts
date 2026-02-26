import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RouterAgent } from '../../src/agents/router-agent';
import { ClaudeAPI } from '../../src/services/claude-api';
import { PromptBuilder } from '../../src/agents/prompt-builder';
import { CustomAgentRepository } from '../../src/database/repositories/custom-agent-repository';
import { CustomAgentWithBrain } from '../../src/types/custom-agent';
import { Message } from '../../src/types/message';
import { Conversation, ConversationContext } from '../../src/types/conversation';

function createTestMessage(content: string): Message {
  return {
    id: 'msg-1', conversationId: 'conv-1', contactId: 'contact-1',
    direction: 'inbound', type: 'text', content, channel: 'whatsapp',
    metadata: {}, timestamp: new Date(),
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

function createTestAgents(): CustomAgentWithBrain[] {
  return [
    {
      id: 'agent-kiryat-ono', name: 'סניף קריית אונו', description: 'סוכן לסניף קריית אונו',
      systemPrompt: null, routingKeywords: ['קריית אונו', 'מוזיקה', 'אנגלית'],
      routingDescription: null, handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date(),
      mainDocumentText: null, mainDocumentFilename: null,
      brain: [{
        id: 'brain-1', agentId: 'agent-kiryat-ono', title: 'חוג מוזיקה',
        content: 'חוג מוזיקה לילדים',
        category: 'product', metadata: {}, sortOrder: 0, active: true,
        createdAt: new Date(), updatedAt: new Date(),
      }],
    },
    {
      id: 'agent-ramat-hasharon', name: 'סניף רמת השרון', description: 'סוכן לסניף רמת השרון',
      systemPrompt: null, routingKeywords: ['רמת השרון', 'שחייה', 'ריקוד'],
      routingDescription: null, handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date(),
      mainDocumentText: null, mainDocumentFilename: null,
      brain: [{
        id: 'brain-2', agentId: 'agent-ramat-hasharon', title: 'שחייה',
        content: 'חוג שחייה לכל הגילאים',
        category: 'product', metadata: {}, sortOrder: 0, active: true,
        createdAt: new Date(), updatedAt: new Date(),
      }],
    },
    {
      id: 'agent-default', name: 'סוכן כללי', description: 'סוכן ברירת מחדל',
      systemPrompt: null, routingKeywords: [], routingDescription: null,
      handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: true, active: true, createdAt: new Date(), updatedAt: new Date(),
      mainDocumentText: null, mainDocumentFilename: null,
      brain: [],
    },
  ];
}

describe('RouterAgent', () => {
  let mockClaude: ClaudeAPI;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn(),
      chatJSON: vi.fn(),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    promptBuilder = new PromptBuilder();
  });

  describe('routeToCustomAgent()', () => {
    let router: RouterAgent;
    let mockAgentRepo: CustomAgentRepository;

    beforeEach(() => {
      mockAgentRepo = {
        getAllWithBrain: vi.fn().mockResolvedValue(createTestAgents()),
        getWithBrain: vi.fn(),
        findById: vi.fn(),
      } as unknown as CustomAgentRepository;

      router = new RouterAgent(mockClaude, promptBuilder, mockAgentRepo);
    });

    it('should route to correct agent via keyword match first (no AI call)', async () => {
      const result = await router.routeToCustomAgent('אני מחפש חוג מוזיקה בקריית אונו');

      // Keyword match finds it first, no AI call needed
      expect(result.agentId).toBe('agent-kiryat-ono');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(mockClaude.chatJSON).not.toHaveBeenCalled();
    });

    it('should route via AI when keyword match confidence is low', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'agent-kiryat-ono', confidence: 0.9, reasoning: 'הלקוח שואל על מוזיקה בקריית אונו' },
        inputTokens: 100, outputTokens: 50,
        cacheCreationInputTokens: 100, cacheReadInputTokens: 0,
        model: 'test',
      });

      const result = await router.routeToCustomAgent('שלום, מה שלומכם? רציתי לשאול משהו');

      // No keyword match -> AI routes it
      expect(result.agentId).toBe('agent-kiryat-ono');
      expect(result.confidence).toBe(0.9);
    });

    it('should use keyword fallback when AI fails', async () => {
      vi.mocked(mockClaude.chatJSON).mockRejectedValue(new Error('API error'));

      const result = await router.routeToCustomAgent('מה לגבי חוג מוזיקה?');

      expect(result.agentId).toBe('agent-kiryat-ono');
    });

    it('should fall back to default agent when no match', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'agent-default', confidence: 0.4, reasoning: 'לא ברור' },
        inputTokens: 100, outputTokens: 50,
        cacheCreationInputTokens: 0, cacheReadInputTokens: 0,
        model: 'test',
      });

      const result = await router.routeToCustomAgent('שלום, מה שלומכם?');

      expect(result.agentId).toBe('agent-default');
    });

    it('should validate agent ID exists', async () => {
      vi.mocked(mockClaude.chatJSON).mockResolvedValue({
        data: { agentId: 'nonexistent-agent', confidence: 0.9, reasoning: 'test' },
        inputTokens: 100, outputTokens: 50,
        cacheCreationInputTokens: 0, cacheReadInputTokens: 0,
        model: 'test',
      });

      // 'test' has no keyword match, so AI is called
      const result = await router.routeToCustomAgent('test');

      expect(result.agentId).toBe('agent-default');
      expect(result.confidence).toBe(0.5);
    });

    it('should stay with current agent when message matches', async () => {
      vi.mocked(mockAgentRepo.getWithBrain).mockResolvedValue(createTestAgents()[0]);

      const result = await router.routeToCustomAgent(
        'שאלה נוספת על מוזיקה',
        undefined,
        'agent-kiryat-ono'
      );

      expect(result.agentId).toBe('agent-kiryat-ono');
      expect(result.confidence).toBe(0.9);
      expect(result.reasoning).toBe('נשאר באותו סוכן');
      expect(mockClaude.chatJSON).not.toHaveBeenCalled();
    });

    it('should throw when no active agents', async () => {
      vi.mocked(mockAgentRepo.getAllWithBrain).mockResolvedValue([]);

      await expect(router.routeToCustomAgent('test'))
        .rejects.toThrow('No active custom agents found');
    });
  });

  describe('shouldTransfer()', () => {
    let router: RouterAgent;
    let mockAgentRepo: CustomAgentRepository;
    const testAgents = createTestAgents();

    beforeEach(() => {
      mockAgentRepo = {
        getAllWithBrain: vi.fn().mockResolvedValue(testAgents),
        getWithBrain: vi.fn().mockImplementation(async (id: string) => {
          return testAgents.find(a => a.id === id) || null;
        }),
        findById: vi.fn(),
      } as unknown as CustomAgentRepository;

      router = new RouterAgent(mockClaude, promptBuilder, mockAgentRepo);
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
      vi.mocked(mockAgentRepo.getWithBrain).mockResolvedValue(null);

      const result = await router.shouldTransfer('test', 'nonexistent');

      expect(result.shouldTransfer).toBe(false);
    });
  });
});
