import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { SupportAgent } from '../../src/agents/support-agent';
import { ClaudeAPI } from '../../src/services/claude-api';
import { PromptBuilder } from '../../src/agents/prompt-builder';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainSearch } from '../../src/brain/brain-search';
import { Message } from '../../src/types/message';
import { Conversation, ConversationContext } from '../../src/types/conversation';

const brainPath = path.resolve(__dirname, '../../brain');

function createTestMessage(content: string, direction: 'inbound' | 'outbound' = 'inbound'): Message {
  return {
    id: `msg-${Date.now()}`, conversationId: 'conv-1', contactId: 'contact-1',
    direction, type: 'text', content, channel: 'whatsapp',
    metadata: {}, timestamp: new Date(),
  };
}

function createTestConversation(messages: Message[] = []): Conversation {
  const context: ConversationContext = {
    intent: 'support', sentiment: null, language: null, leadScore: null, tags: [], customFields: {},
  };
  return {
    id: 'conv-1', contactId: 'contact-1', channel: 'whatsapp',
    status: 'active', currentAgent: 'support', messages, context,
    startedAt: new Date(), updatedAt: new Date(),
  };
}

describe('SupportAgent', () => {
  let agent: SupportAgent;
  let mockClaude: ClaudeAPI;
  let brainSearch: BrainSearch;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockResolvedValue({
        content: "I'd be happy to help with that issue.",
        inputTokens: 200, outputTokens: 100, model: 'test',
      }),
      chatJSON: vi.fn(),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    const loader = new BrainLoader(brainPath);
    loader.loadAll();
    brainSearch = new BrainSearch(loader);
    const promptBuilder = new PromptBuilder(brainSearch);
    agent = new SupportAgent(mockClaude, promptBuilder, brainSearch);
  });

  it('should process a support message', async () => {
    const msg = createTestMessage('My order is missing');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.message).toBeDefined();
    expect(result.action).toBe('send_message');
  });

  it('should escalate when customer asks for human', async () => {
    const msg = createTestMessage('I want to speak with a manager');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.shouldHandoff).toBe(true);
    expect(result.action).toBe('escalate');
    expect(result.suggestedAgent).toBe('handoff');
  });

  it('should escalate refund requests', async () => {
    const msg = createTestMessage('I want a refund for my order');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.shouldHandoff).toBe(true);
    expect(result.handoffReason).toContain('Refund');
  });

  it('should detect frustration', () => {
    const messages = [
      createTestMessage('This is terrible service!'),
      createTestMessage('UNACCEPTABLE! I am furious!'),
      createTestMessage('This is the worst experience ever'),
    ];

    const { frustrated, score } = agent.detectFrustration(messages);
    expect(frustrated).toBe(true);
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('should not detect frustration for normal messages', () => {
    const messages = [
      createTestMessage('Hi, I need some help'),
      createTestMessage('Can you check my order?'),
    ];

    const { frustrated } = agent.detectFrustration(messages);
    expect(frustrated).toBe(false);
  });

  it('should check escalation rules correctly', () => {
    const msg = createTestMessage('Let me talk to a real person');
    const conv = createTestConversation();
    const result = agent.checkEscalationRules(conv, msg);

    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toContain('human');
  });

  it('should handle Claude API errors gracefully', async () => {
    vi.mocked(mockClaude.chat).mockRejectedValue(new Error('API error'));

    const msg = createTestMessage('Help me with something complex');
    const conv = createTestConversation();
    const result = await agent.processMessage(msg, conv, {});

    expect(result.shouldHandoff).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
