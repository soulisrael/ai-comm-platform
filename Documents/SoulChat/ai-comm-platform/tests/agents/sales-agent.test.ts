import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { SalesAgent } from '../../src/agents/sales-agent';
import { ClaudeAPI } from '../../src/services/claude-api';
import { PromptBuilder } from '../../src/agents/prompt-builder';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainSearch } from '../../src/brain/brain-search';
import { Message } from '../../src/types/message';
import { Conversation, ConversationContext } from '../../src/types/conversation';

const brainPath = path.resolve(__dirname, '../../brain');

function createTestMessage(content: string): Message {
  return {
    id: 'msg-1', conversationId: 'conv-1', contactId: 'contact-1',
    direction: 'inbound', type: 'text', content, channel: 'whatsapp',
    metadata: {}, timestamp: new Date(),
  };
}

function createTestConversation(messages: Message[] = []): Conversation {
  const context: ConversationContext = {
    intent: 'sales', sentiment: null, language: null, leadScore: null, tags: [], customFields: {},
  };
  return {
    id: 'conv-1', contactId: 'contact-1', channel: 'whatsapp',
    status: 'active', currentAgent: 'sales', messages, context,
    startedAt: new Date(), updatedAt: new Date(),
  };
}

describe('SalesAgent', () => {
  let agent: SalesAgent;
  let mockClaude: ClaudeAPI;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockResolvedValue({
        content: 'Great choice! Let me tell you about our products.',
        inputTokens: 200, outputTokens: 100, model: 'test',
      }),
      chatJSON: vi.fn(),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    const loader = new BrainLoader(brainPath);
    loader.loadAll();
    const search = new BrainSearch(loader);
    const promptBuilder = new PromptBuilder(search);
    agent = new SalesAgent(mockClaude, promptBuilder);
  });

  it('should process a sales message', async () => {
    const msg = createTestMessage('What products do you have?');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.message).toBe('Great choice! Let me tell you about our products.');
    expect(result.action).toBe('send_message');
    expect(result.shouldHandoff).toBe(false);
  });

  it('should detect handoff when customer asks for human', async () => {
    const msg = createTestMessage('I want to talk to a real person');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.shouldHandoff).toBe(true);
    expect(result.suggestedAgent).toBe('handoff');
  });

  it('should detect qualifying stage for new conversation', () => {
    const conv = createTestConversation([createTestMessage('Hi')]);
    const stage = agent.detectSalesStage(conv);
    expect(stage).toBe('qualifying');
  });

  it('should detect objection handling stage', () => {
    const messages = [
      createTestMessage('Hi'),
      createTestMessage('Tell me about your product'),
      createTestMessage("That's too expensive for me"),
    ];
    const conv = createTestConversation(messages);
    const stage = agent.detectSalesStage(conv);
    expect(stage).toBe('objection_handling');
  });

  it('should calculate lead score', () => {
    const messages = [
      createTestMessage('How much does it cost?'),
      createTestMessage('Is it available?'),
    ];
    const conv = createTestConversation(messages);
    const score = agent.calculateLeadScore(conv);

    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle Claude API errors gracefully', async () => {
    vi.mocked(mockClaude.chat).mockRejectedValue(new Error('API error'));

    const msg = createTestMessage('Tell me about your products');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.shouldHandoff).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
