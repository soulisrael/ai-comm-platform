import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { RouterAgent } from '../../src/agents/router-agent';
import { ClaudeAPI } from '../../src/services/claude-api';
import { PromptBuilder } from '../../src/agents/prompt-builder';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainSearch } from '../../src/brain/brain-search';
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

describe('RouterAgent', () => {
  let router: RouterAgent;
  let mockClaude: ClaudeAPI;

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn(),
      chatJSON: vi.fn(),
      getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
      resetUsage: vi.fn(),
    } as unknown as ClaudeAPI;

    const loader = new BrainLoader(brainPath);
    loader.loadAll();
    const search = new BrainSearch(loader);
    const promptBuilder = new PromptBuilder(search);
    router = new RouterAgent(mockClaude, promptBuilder, search);
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

    // Should fall back to keyword matching which detects 'refund' → support
    expect(result.suggestedAgent).toBe('support');
  });
});
