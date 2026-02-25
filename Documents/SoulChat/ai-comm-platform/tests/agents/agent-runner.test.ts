import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../../src/agents/agent-runner';
import { ClaudeAPI } from '../../src/services/claude-api';
import { PromptBuilder } from '../../src/agents/prompt-builder';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainSearch } from '../../src/brain/brain-search';
import { CustomAgentRepository } from '../../src/database/repositories/custom-agent-repository';
import { TopicRepository } from '../../src/database/repositories/topic-repository';
import { CustomAgentWithTopics } from '../../src/types/custom-agent';
import { Message } from '../../src/types/message';
import path from 'path';

const brainPath = path.resolve(__dirname, '../../brain');

function createTestMessage(content: string, direction: 'inbound' | 'outbound' = 'inbound'): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    conversationId: 'conv-1',
    contactId: 'contact-1',
    direction,
    type: 'text',
    content,
    channel: 'whatsapp',
    metadata: {},
    timestamp: new Date(),
  };
}

function createTestAgent(overrides?: Partial<CustomAgentWithTopics>): CustomAgentWithTopics {
  return {
    id: 'agent-1',
    name: 'סניף קריית אונו',
    description: 'סוכן לסניף קריית אונו',
    systemPrompt: 'אתה סוכן שירות לקוחות לסניף קריית אונו.',
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
        id: 'topic-1',
        name: 'חוג מוזיקה',
        description: 'חוג מוזיקה לילדים',
        content: {
          description: 'חוג מוזיקה לגילאי 4-8',
          schedule: 'ימי שלישי 16:00-17:00',
          price: '250 ש"ח לחודש',
          faq: [{ question: 'מה הגיל המינימלי?', answer: 'גיל 4' }],
          customFields: {},
        },
        isShared: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    ...overrides,
  };
}

describe('AgentRunner', () => {
  let runner: AgentRunner;
  let mockClaude: ClaudeAPI;
  let mockAgentRepo: CustomAgentRepository;
  let mockTopicRepo: TopicRepository;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockResolvedValue({
        content: 'שלום! חוג המוזיקה שלנו מתקיים בימי שלישי.',
        inputTokens: 200,
        outputTokens: 100,
        model: 'test',
      }),
      chatJSON: vi.fn(),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    mockAgentRepo = {
      getWithTopics: vi.fn().mockResolvedValue(createTestAgent()),
      getAllWithTopics: vi.fn().mockResolvedValue([createTestAgent()]),
      findById: vi.fn(),
      findAll: vi.fn(),
    } as unknown as CustomAgentRepository;

    mockTopicRepo = {} as unknown as TopicRepository;

    const loader = new BrainLoader(brainPath);
    loader.loadAll();
    const search = new BrainSearch(loader);
    const promptBuilder = new PromptBuilder(search);

    runner = new AgentRunner(mockClaude, mockAgentRepo, mockTopicRepo, promptBuilder);
  });

  describe('run()', () => {
    it('should load agent from repo and return response', async () => {
      const result = await runner.run('agent-1', 'מתי חוג המוזיקה?', []);

      expect(mockAgentRepo.getWithTopics).toHaveBeenCalledWith('agent-1');
      expect(result.message).toBe('שלום! חוג המוזיקה שלנו מתקיים בימי שלישי.');
      expect(result.shouldHandoff).toBe(false);
      expect(result.shouldTransfer).toBe(false);
      expect(result.confidence).toBe(0.85);
    });

    it('should return error message when agent not found', async () => {
      vi.mocked(mockAgentRepo.getWithTopics).mockResolvedValue(null);

      const result = await runner.run('nonexistent', 'hello', []);

      expect(result.message).toContain('שגיאה');
      expect(result.confidence).toBe(0);
    });

    it('should return error message when Claude API fails', async () => {
      vi.mocked(mockClaude.chat).mockRejectedValue(new Error('API timeout'));

      const result = await runner.run('agent-1', 'hello', []);

      expect(result.message).toContain('שגיאה');
      expect(result.confidence).toBe(0);
    });
  });

  describe('runWithAgent()', () => {
    it('should call Claude with agent system prompt and topics', async () => {
      const agent = createTestAgent();
      await runner.runWithAgent(agent, 'מתי חוג המוזיקה?', []);

      expect(mockClaude.chat).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(mockClaude.chat).mock.calls[0][0];
      expect(callArgs.systemPrompt).toContain('קריית אונו');
      expect(callArgs.temperature).toBe(0.7);
      expect(callArgs.maxTokens).toBe(1024);
    });

    it('should include conversation history in messages', async () => {
      const agent = createTestAgent();
      const history = [
        createTestMessage('שלום', 'inbound'),
        createTestMessage('שלום! איך אוכל לעזור?', 'outbound'),
      ];

      await runner.runWithAgent(agent, 'מתי חוג המוזיקה?', history);

      const callArgs = vi.mocked(mockClaude.chat).mock.calls[0][0];
      expect(callArgs.messages.length).toBeGreaterThanOrEqual(3); // 2 history + 1 current
    });
  });

  describe('detectHandoff()', () => {
    it('should detect explicit request for human agent', () => {
      const agent = createTestAgent();
      const result = runner.detectHandoff('אני רוצה לדבר עם נציג', [], agent);

      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toContain('נציג');
    });

    it('should detect "אדם" as handoff keyword', () => {
      const agent = createTestAgent();
      const result = runner.detectHandoff('תחבר אותי לאדם', [], agent);

      expect(result.shouldHandoff).toBe(true);
    });

    it('should not trigger handoff for normal messages', () => {
      const agent = createTestAgent();
      const result = runner.detectHandoff('מתי חוג המוזיקה?', [], agent);

      expect(result.shouldHandoff).toBe(false);
    });

    it('should trigger handoff when max turns exceeded', () => {
      const agent = createTestAgent({ handoffRules: { maxTurns: 3 } });
      const history = [
        createTestMessage('msg1', 'inbound'),
        createTestMessage('reply1', 'outbound'),
        createTestMessage('msg2', 'inbound'),
        createTestMessage('reply2', 'outbound'),
        createTestMessage('msg3', 'inbound'),
      ];

      const result = runner.detectHandoff('msg4', history, agent);

      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toContain('סיבובים');
    });

    it('should trigger handoff on 3 consecutive negative messages', () => {
      const agent = createTestAgent();
      const history = [
        createTestMessage('זה גרוע', 'inbound'),
        createTestMessage('reply', 'outbound'),
        createTestMessage('נמאס לי מזה', 'inbound'),
        createTestMessage('reply', 'outbound'),
        createTestMessage('מזעזע', 'inbound'),
      ];

      const result = runner.detectHandoff('עוד הודעה', history, agent);

      expect(result.shouldHandoff).toBe(true);
      expect(result.reason).toContain('מתוסכל');
    });
  });

  describe('detectTransfer()', () => {
    it('should detect when AI says it cannot answer', () => {
      const agent = createTestAgent();
      const result = runner.detectTransfer(
        'אין לי מידע על שחייה. אני מתמחה רק בקריית אונו.',
        'מה לגבי שחייה?',
        agent
      );

      expect(result.shouldTransfer).toBe(true);
      expect(result.transferMessage).toBeDefined();
    });

    it('should not trigger transfer for normal responses', () => {
      const agent = createTestAgent();
      const result = runner.detectTransfer(
        'חוג המוזיקה שלנו מתקיים בימי שלישי!',
        'מתי חוג המוזיקה?',
        agent
      );

      expect(result.shouldTransfer).toBe(false);
    });

    it('should detect "לא בתחום שלי" as transfer trigger', () => {
      const agent = createTestAgent();
      const result = runner.detectTransfer(
        'הנושא הזה לא בתחום שלי, אני יכול לעזור רק עם חוגים.',
        'מה לגבי החזרת כסף?',
        agent
      );

      expect(result.shouldTransfer).toBe(true);
    });
  });
});
