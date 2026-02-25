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
  customAgentName?: string;
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
        'אני מחבר אותך עם נציג שיוכל לעזור. הוא יקבל את כל ההיסטוריה של השיחה שלנו. רגע אחד!';
    } else {
      const queueMsg = handoffRules?.queueMessage ||
        'כל הנציגים שלנו תפוסים כרגע. אתה מספר #{position} בתור. זמן המתנה משוער: {waitTime} דקות.';
      customerMessage = queueMsg
        .replace('#{position}', String(availability.queuePosition))
        .replace('{position}', String(availability.queuePosition))
        .replace('{waitTime}', String(availability.estimatedWait));
    }

    this.log('info', `Handoff summary: issue=${summary.issueType}, sentiment=${summary.sentiment}, agent=${summary.customAgentName || 'legacy'}, messages=${summary.conversationLength}`);

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

    // Hebrew + English issue detection
    if (allContent.includes('החזר') || allContent.includes('refund') || allContent.includes('return')) issueType = 'refund_request';
    else if (allContent.includes('לא עובד') || allContent.includes('broken') || allContent.includes('not working') || allContent.includes('תקלה')) issueType = 'technical_issue';
    else if (allContent.includes('הזמנה') || allContent.includes('order') || allContent.includes('tracking') || allContent.includes('משלוח')) issueType = 'order_issue';
    else if (allContent.includes('תלונה') || allContent.includes('complaint')) issueType = 'complaint';

    // Determine sentiment (Hebrew + English)
    let sentiment = conversation.context.sentiment || 'neutral';
    const frustrationWords = ['כועס', 'עצבני', 'נמאס', 'גרוע', 'מזעזע', 'angry', 'furious', 'terrible', 'worst', 'horrible', 'unacceptable'];
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

    // Infer customer name from messages (Hebrew + English)
    let customerName: string | null = null;
    for (const msg of inboundMessages) {
      const nameMatch = msg.content.match(/(?:my name is|i'm|i am|שמי|קוראים לי)\s+([A-Za-z\u0590-\u05FF]+)/i);
      if (nameMatch) { customerName = nameMatch[1]; break; }
    }

    // Get custom agent name from metadata
    const lastOutbound = outboundMessages[outboundMessages.length - 1];
    const customAgentName = lastOutbound?.metadata?.customAgentName as string | undefined;

    return {
      customerName,
      issueType,
      sentiment,
      attemptedSolutions,
      keyMessages,
      conversationLength: conversation.messages.length,
      channel: conversation.channel,
      customAgentName,
    };
  }

  checkAgentAvailability(): { available: boolean; queuePosition: number; estimatedWait: number } {
    // TODO: Check real agent availability from database
    return {
      available: true,
      queuePosition: 0,
      estimatedWait: 0,
    };
  }
}
