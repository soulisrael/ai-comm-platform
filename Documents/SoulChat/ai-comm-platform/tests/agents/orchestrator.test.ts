import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestrator } from '../../src/agents/agent-orchestrator';
import { ClaudeAPI } from '../../src/services/claude-api';
import { CustomAgentRepository } from '../../src/database/repositories/custom-agent-repository';
import { CustomAgentWithBrain } from '../../src/types/custom-agent';
import { Message } from '../../src/types/message';
import { Conversation, ConversationContext } from '../../src/types/conversation';

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

function createTestAgents(): CustomAgentWithBrain[] {
  return [
    {
      id: 'agent-1', name: 'סניף קריית אונו', description: 'test',
      systemPrompt: 'אתה סוכן קריית אונו', routingKeywords: ['קריית אונו', 'מוזיקה'],
      routingDescription: null, handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: false, active: true, createdAt: new Date(), updatedAt: new Date(),
      mainDocumentText: null, mainDocumentFilename: null,
      brain: [{
        id: 'brain-1', agentId: 'agent-1', title: 'חוג מוזיקה',
        content: 'חוג מוזיקה לילדים',
        category: 'product', metadata: {}, sortOrder: 0, active: true,
        createdAt: new Date(), updatedAt: new Date(),
      }],
    },
    {
      id: 'agent-default', name: 'סוכן כללי', description: 'default agent',
      systemPrompt: null, routingKeywords: [], routingDescription: null,
      handoffRules: {}, transferRules: {},
      settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
      isDefault: true, active: true, createdAt: new Date(), updatedAt: new Date(),
      mainDocumentText: null, mainDocumentFilename: null,
      brain: [],
    },
  ];
}

describe('AgentOrchestrator', () => {
  let mockClaude: ClaudeAPI;
  let orchestrator: AgentOrchestrator;
  let mockAgentRepo: CustomAgentRepository;
  const testAgents = createTestAgents();

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockResolvedValue({
        content: 'Hello! How can I help you today?',
        inputTokens: 200, outputTokens: 100, model: 'test',
      }),
      chatJSON: vi.fn().mockResolvedValue({
        data: { agentId: 'agent-1', confidence: 0.9, reasoning: 'test routing' },
        inputTokens: 100, outputTokens: 50, model: 'test',
      }),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    mockAgentRepo = {
      getAllWithBrain: vi.fn().mockResolvedValue(testAgents),
      getWithBrain: vi.fn().mockImplementation(async (id: string) =>
        testAgents.find(a => a.id === id) || null
      ),
      findById: vi.fn().mockImplementation(async (id: string) =>
        testAgents.find(a => a.id === id) || null
      ),
      findAll: vi.fn().mockResolvedValue(testAgents),
    } as unknown as CustomAgentRepository;

    orchestrator = new AgentOrchestrator(mockClaude, mockAgentRepo);
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

  it('should skip AI for human_active conversations', async () => {
    const conv = createTestConversation({ status: 'human_active' });
    const msg = createTestMessage('hello');
    const result = await orchestrator.handleMessage(msg, conv);

    expect(result.response.message).toBe('');
    expect(mockClaude.chat).not.toHaveBeenCalled();
    expect(mockClaude.chatJSON).not.toHaveBeenCalled();
  });
});
