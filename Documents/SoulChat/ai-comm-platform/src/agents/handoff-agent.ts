import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { BrainSearch } from '../brain/brain-search';

interface HandoffSummary {
  customerName: string | null;
  issueType: string;
  sentiment: string;
  attemptedSolutions: string[];
  keyMessages: string[];
  conversationLength: number;
  channel: string;
}

export class HandoffAgent extends BaseAgent {
  private brainSearch: BrainSearch;

  constructor(brainSearch: BrainSearch) {
    super('Handoff', 'handoff');
    this.brainSearch = brainSearch;
  }

  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>
  ): Promise<AgentResponse> {
    this.log('info', 'Processing handoff request');

    const summary = this.generateHandoffSummary(conversation);
    const availability = this.checkAgentAvailability();

    // Get handoff rules from brain
    const brainData = this.brainSearch.findRelevantBrainData('', 'handoff');
    const handoffRules = brainData.handoffRules as {
      handoffMessage?: string;
      queueMessage?: string;
    } | undefined;

    let customerMessage: string;

    if (availability.available) {
      customerMessage = handoffRules?.handoffMessage ||
        "I'm connecting you with a team member who can help further. They'll have our full conversation history. Please hold on!";
    } else {
      const queueMsg = handoffRules?.queueMessage ||
        "All our team members are currently busy. You're #{position} in queue. Estimated wait: {waitTime} minutes.";
      customerMessage = queueMsg
        .replace('#{position}', String(availability.queuePosition))
        .replace('{position}', String(availability.queuePosition))
        .replace('{waitTime}', String(availability.estimatedWait));
    }

    this.log('info', `Handoff summary generated: issue=${summary.issueType}, sentiment=${summary.sentiment}, messages=${summary.conversationLength}`);

    return {
      message: customerMessage,
      action: 'transfer_to_human',
      shouldHandoff: true,
      handoffReason: summary.issueType,
      confidence: 1.0,
    };
  }

  generateHandoffSummary(conversation: Conversation): HandoffSummary {
    const inboundMessages = conversation.messages.filter(m => m.direction === 'inbound');
    const outboundMessages = conversation.messages.filter(m => m.direction === 'outbound');

    // Determine issue type from context or messages
    let issueType = conversation.context.intent || 'unknown';
    const allContent = inboundMessages.map(m => m.content.toLowerCase()).join(' ');

    if (allContent.includes('refund') || allContent.includes('return')) issueType = 'refund_request';
    else if (allContent.includes('broken') || allContent.includes('not working')) issueType = 'technical_issue';
    else if (allContent.includes('order') || allContent.includes('tracking')) issueType = 'order_issue';
    else if (allContent.includes('complaint')) issueType = 'complaint';

    // Determine sentiment
    let sentiment = conversation.context.sentiment || 'neutral';
    const frustrationWords = ['angry', 'furious', 'terrible', 'worst', 'horrible', 'unacceptable'];
    if (frustrationWords.some(w => allContent.includes(w))) sentiment = 'very_negative';

    // Extract attempted solutions from bot responses
    const attemptedSolutions = outboundMessages
      .filter(m => m.content.length > 20)
      .slice(-3)
      .map(m => m.content.slice(0, 100));

    // Key customer messages
    const keyMessages = inboundMessages
      .slice(-5)
      .map(m => m.content.slice(0, 150));

    // Infer customer name from first message or context
    let customerName: string | null = null;
    for (const msg of inboundMessages) {
      const nameMatch = msg.content.match(/(?:my name is|i'm|i am)\s+([A-Z][a-z]+)/i);
      if (nameMatch) { customerName = nameMatch[1]; break; }
    }

    return {
      customerName,
      issueType,
      sentiment,
      attemptedSolutions,
      keyMessages,
      conversationLength: conversation.messages.length,
      channel: conversation.channel,
    };
  }

  checkAgentAvailability(): { available: boolean; queuePosition: number; estimatedWait: number } {
    // TODO: In Phase 5+, check real agent availability from database
    // For now, simulate availability
    return {
      available: true,
      queuePosition: 0,
      estimatedWait: 0,
    };
  }
}
