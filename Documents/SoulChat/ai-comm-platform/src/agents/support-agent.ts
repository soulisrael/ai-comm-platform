import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';
import { BrainSearch } from '../brain/brain-search';

export class SupportAgent extends BaseAgent {
  private claude: ClaudeAPI;
  private promptBuilder: PromptBuilder;
  private brainSearch: BrainSearch;

  constructor(claude: ClaudeAPI, promptBuilder: PromptBuilder, brainSearch: BrainSearch) {
    super('Support', 'support');
    this.claude = claude;
    this.promptBuilder = promptBuilder;
    this.brainSearch = brainSearch;
  }

  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>,
    contact?: Contact | null
  ): Promise<AgentResponse> {
    this.log('info', `Processing support message: "${message.content.slice(0, 50)}..."`);

    // Check escalation rules first (highest priority)
    const escalation = this.checkEscalationRules(conversation, message);
    if (escalation.shouldEscalate) {
      this.log('info', `Escalation triggered: ${escalation.reason}`);
      return {
        message: escalation.message || "Let me connect you with a team member who can help with this.",
        action: 'escalate',
        shouldHandoff: true,
        handoffReason: escalation.reason,
        confidence: 0.9,
        suggestedAgent: 'handoff',
      };
    }

    // Check FAQ for quick answers
    const faqResults = this.brainSearch.searchFAQ(message.content);
    if (faqResults.length > 0 && faqResults[0].relevanceScore >= 4) {
      const faq = faqResults[0].entry.data as { answer: string };
      this.log('info', `High-confidence FAQ match found (score: ${faqResults[0].relevanceScore})`);

      return {
        message: faq.answer,
        action: 'send_message',
        shouldHandoff: false,
        confidence: 0.95,
      };
    }

    // Use Claude for complex support queries
    const { systemPrompt, messages } = this.promptBuilder.buildAgentPrompt(
      'support',
      conversation,
      message,
      contact
    );

    const enhancedPrompt = systemPrompt +
      '\n\nIMPORTANT: Respond with ONLY your message to the customer. Be empathetic and solution-oriented.' +
      '\nIf you cannot resolve the issue with the information available, let the customer know you\'ll connect them with a team member.';

    try {
      const response = await this.claude.chat({
        systemPrompt: enhancedPrompt,
        messages,
        temperature: 0.5,
        maxTokens: 500,
      });

      const frustration = this.detectFrustration(conversation.messages);

      return {
        message: response.content,
        action: 'send_message',
        shouldHandoff: frustration.frustrated,
        handoffReason: frustration.frustrated ? 'Customer frustration detected' : undefined,
        confidence: 0.8,
        suggestedAgent: frustration.frustrated ? 'handoff' : undefined,
      };
    } catch (err) {
      this.log('error', `Support agent error: ${err}`);
      return {
        message: "I apologize for the inconvenience. Let me connect you with a team member who can help right away.",
        action: 'escalate',
        shouldHandoff: true,
        handoffReason: 'AI error — transferring to human',
        confidence: 0.3,
        suggestedAgent: 'handoff',
      };
    }
  }

  checkEscalationRules(
    conversation: Conversation,
    message: Message
  ): { shouldEscalate: boolean; reason?: string; message?: string } {
    const lower = message.content.toLowerCase();

    // Explicit human request
    const humanKeywords = ['human', 'person', 'agent', 'manager', 'representative', 'real person'];
    if (humanKeywords.some(k => lower.includes(k))) {
      return {
        shouldEscalate: true,
        reason: 'Customer explicitly requested a human',
        message: "I'm connecting you with a team member right away. They'll have our full conversation history. Please hold on!",
      };
    }

    // Refund-related
    if (lower.includes('refund') || lower.includes('money back')) {
      return {
        shouldEscalate: true,
        reason: 'Refund request — requires human authorization',
        message: "I understand you'd like a refund. Let me connect you with a team member who can process this for you.",
      };
    }

    // Frustration check
    const frustration = this.detectFrustration(conversation.messages);
    if (frustration.frustrated) {
      return {
        shouldEscalate: true,
        reason: `Customer frustration detected (score: ${frustration.score})`,
      };
    }

    return { shouldEscalate: false };
  }

  detectFrustration(messages: Message[]): { frustrated: boolean; score: number } {
    const recentInbound = messages
      .filter(m => m.direction === 'inbound')
      .slice(-5);

    let score = 0;

    const frustrationWords = [
      'angry', 'furious', 'terrible', 'horrible', 'worst', 'hate',
      'useless', 'incompetent', 'stupid', 'ridiculous', 'unacceptable',
      'disgusted', 'outraged', 'scam', 'fraud', 'sue', 'lawyer',
    ];

    const mildFrustration = [
      'frustrated', 'annoying', 'disappointed', 'unhappy', 'upset',
      'not working', 'still broken', 'again', 'already told you',
    ];

    for (const msg of recentInbound) {
      const lower = msg.content.toLowerCase();

      for (const word of frustrationWords) {
        if (lower.includes(word)) score += 3;
      }
      for (const word of mildFrustration) {
        if (lower.includes(word)) score += 1;
      }

      // ALL CAPS detection
      if (msg.content === msg.content.toUpperCase() && msg.content.length > 10) {
        score += 2;
      }

      // Excessive punctuation
      if ((msg.content.match(/[!?]{2,}/g) || []).length > 0) {
        score += 1;
      }
    }

    return {
      frustrated: score >= 5,
      score,
    };
  }
}
