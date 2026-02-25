import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';

type SalesStage = 'qualifying' | 'presenting' | 'objection_handling' | 'closing' | 'followup';

export class SalesAgent extends BaseAgent {
  private claude: ClaudeAPI;
  private promptBuilder: PromptBuilder;

  constructor(claude: ClaudeAPI, promptBuilder: PromptBuilder) {
    super('Sales', 'sales');
    this.claude = claude;
    this.promptBuilder = promptBuilder;
  }

  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>,
    contact?: Contact | null
  ): Promise<AgentResponse> {
    this.log('info', `Processing sales message: "${message.content.slice(0, 50)}..."`);

    const stage = this.detectSalesStage(conversation);
    this.log('debug', `Sales stage: ${stage}`);

    const { systemPrompt, messages } = this.promptBuilder.buildAgentPrompt(
      'sales',
      conversation,
      message,
      contact
    );

    const enhancedPrompt = systemPrompt +
      `\n\n## Current Sales Stage: ${stage}` +
      `\nGuide the conversation towards the next stage naturally.` +
      `\n\nIMPORTANT: Respond with ONLY your message to the customer. Be conversational and natural.`;

    try {
      const response = await this.claude.chat({
        systemPrompt: enhancedPrompt,
        messages,
        temperature: 0.7,
        maxTokens: 500,
      });

      const shouldHandoff = this.shouldHandoff(message.content, conversation);
      const leadScore = this.calculateLeadScore(conversation);

      return {
        message: response.content,
        action: 'send_message',
        shouldHandoff: shouldHandoff.handoff,
        handoffReason: shouldHandoff.reason,
        confidence: 0.85,
        suggestedAgent: shouldHandoff.handoff ? 'handoff' : undefined,
      };
    } catch (err) {
      this.log('error', `Sales agent error: ${err}`);
      return {
        message: "I'd be happy to help you with that! Let me connect you with our team for more details.",
        action: 'send_message',
        shouldHandoff: true,
        handoffReason: 'AI error — transferring to human',
        confidence: 0.3,
        suggestedAgent: 'handoff',
      };
    }
  }

  detectSalesStage(conversation: Conversation): SalesStage {
    const messageCount = conversation.messages.filter(m => m.direction === 'inbound').length;
    const content = conversation.messages.map(m => m.content.toLowerCase()).join(' ');

    if (messageCount <= 1) return 'qualifying';

    const closingKeywords = ['buy', 'purchase', 'order', 'checkout', 'pay', 'card', 'deal'];
    if (closingKeywords.some(k => content.includes(k)) && messageCount > 3) return 'closing';

    const objectionKeywords = ['expensive', 'cheap', 'think about', 'not sure', 'compare', 'competitor'];
    if (objectionKeywords.some(k => content.includes(k))) return 'objection_handling';

    if (messageCount > 2) return 'presenting';

    return 'qualifying';
  }

  calculateLeadScore(conversation: Conversation): number {
    let score = 20; // base score
    const messages = conversation.messages.filter(m => m.direction === 'inbound');

    // Engagement: more messages = more engaged
    score += Math.min(messages.length * 5, 25);

    const content = messages.map(m => m.content.toLowerCase()).join(' ');

    // Buying intent signals
    const buyingSignals = ['price', 'buy', 'order', 'how much', 'available', 'purchase', 'discount'];
    for (const signal of buyingSignals) {
      if (content.includes(signal)) score += 8;
    }

    // Negative signals
    const negativeSignals = ['too expensive', 'not interested', 'no thanks', 'just looking'];
    for (const signal of negativeSignals) {
      if (content.includes(signal)) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private shouldHandoff(content: string, conversation: Conversation): { handoff: boolean; reason?: string } {
    const lower = content.toLowerCase();

    // Explicit human request
    const humanKeywords = ['human', 'person', 'agent', 'manager', 'representative', 'real person'];
    if (humanKeywords.some(k => lower.includes(k))) {
      return { handoff: true, reason: 'Customer requested human agent' };
    }

    // High frustration detection
    const frustrationKeywords = ['terrible', 'worst', 'scam', 'fraud', 'sue', 'lawyer', 'report'];
    if (frustrationKeywords.some(k => lower.includes(k))) {
      return { handoff: true, reason: 'Customer frustration detected' };
    }

    // Too many messages without progress
    const inboundCount = conversation.messages.filter(m => m.direction === 'inbound').length;
    if (inboundCount > 15) {
      return { handoff: true, reason: 'Extended conversation without resolution' };
    }

    return { handoff: false };
  }
}
