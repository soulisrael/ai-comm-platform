import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { AgentOrchestrator } from '../../src/agents/agent-orchestrator';
import { ClaudeAPI } from '../../src/services/claude-api';
import { BrainLoader } from '../../src/brain/brain-loader';
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

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
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

    const loader = new BrainLoader(brainPath);
    loader.loadAll();
    orchestrator = new AgentOrchestrator(mockClaude, loader);
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
    const conv = createTestConversation();
    conv.currentAgent = 'sales';

    const msg = createTestMessage('Tell me more about your products');
    const result = await orchestrator.handleMessage(msg, conv);

    expect(result.conversation.id).toBe('conv-1');
    // Should not re-route since agent is already assigned
    expect(result.routingDecision).toBeUndefined();
  });

  it('should handle handoff correctly', async () => {
    // First route to support
    vi.mocked(mockClaude.chatJSON).mockResolvedValue({
      data: { intent: 'support', confidence: 0.9, language: 'English', sentiment: 'negative', summary: 'Wants human' },
      inputTokens: 100, outputTokens: 50, model: 'test',
    });

    // Then the support agent should trigger handoff
    vi.mocked(mockClaude.chat).mockResolvedValue({
      content: "I understand you'd like to speak with a team member.",
      inputTokens: 200, outputTokens: 100, model: 'test',
    });

    const msg = createTestMessage('I want to speak to a human agent now');
    const result = await orchestrator.handleMessage(msg);

    // The support agent's escalation rules detect "human agent" and trigger handoff
    expect(result.conversation.status).toBe('handoff');
  });

  it('should switch agents manually', () => {
    const conv = createTestConversation();
    conv.currentAgent = 'sales';

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
    // First message
    vi.mocked(mockClaude.chatJSON).mockResolvedValue({
      data: { intent: 'sales', confidence: 0.9, language: 'English', sentiment: 'positive', summary: 'Sales inquiry' },
      inputTokens: 100, outputTokens: 50, model: 'test',
    });

    const msg1 = createTestMessage('I want to buy something');
    const result1 = await orchestrator.handleMessage(msg1);

    // Second message in same conversation
    const msg2 = createTestMessage('What products do you have?');
    const result2 = await orchestrator.handleMessage(msg2, result1.conversation);

    // Should have both messages + responses
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
});
