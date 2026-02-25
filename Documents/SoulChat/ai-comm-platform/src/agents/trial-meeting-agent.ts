// DEPRECATED: Replaced by AgentRunner + custom agents (see agent-runner.ts)
// This file is kept for reference only and will be removed in a future version.

import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';

interface TrialDetails {
  name: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  interestArea: string | null;
}

export class TrialMeetingAgent extends BaseAgent {
  private claude: ClaudeAPI;
  private promptBuilder: PromptBuilder;

  constructor(claude: ClaudeAPI, promptBuilder: PromptBuilder) {
    super('Trial Meeting', 'trial_meeting');
    this.claude = claude;
    this.promptBuilder = promptBuilder;
  }

  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>,
    contact?: Contact | null
  ): Promise<AgentResponse> {
    this.log('info', `Processing trial meeting message: "${message.content.slice(0, 50)}..."`);

    const details = this.extractTrialDetails(message.content, conversation, contact);
    const validation = this.validateTrialRequest(details);

    const { systemPrompt, messages } = this.promptBuilder.buildAgentPrompt(
      'trial_meeting',
      conversation,
      message,
      contact
    );

    const enhancedPrompt = systemPrompt +
      '\n\n## Trial Meeting Booking' +
      '\nYou ONLY handle free trial meetings / demo sessions.' +
      '\nDo NOT handle paid sessions, general calendar, or non-trial scheduling.' +
      '\n\nRequired information for booking:' +
      '\n- Full name' +
      '\n- Phone number' +
      '\n- Preferred date and time' +
      '\n- Area of interest' +
      `\n\nCollected so far: ${JSON.stringify(details)}` +
      `\nMissing fields: ${validation.missingFields.join(', ') || 'none'}` +
      '\n\nIMPORTANT: Respond with ONLY your message to the customer.' +
      (validation.isValid
        ? '\nAll information collected! Confirm the booking details with the customer.'
        : `\nAsk for the missing information naturally: ${validation.missingFields.join(', ')}`);

    try {
      const response = await this.claude.chat({
        systemPrompt: enhancedPrompt,
        messages,
        temperature: 0.3,
        maxTokens: 300,
      });

      return {
        message: response.content,
        action: validation.isValid ? 'book_trial_meeting' : 'send_message',
        shouldHandoff: false,
        confidence: 0.85,
      };
    } catch (err) {
      this.log('error', `Trial meeting agent error: ${err}`);
      return {
        message: "I'd love to help you book a trial! Could you share your name, preferred date and time, and what area you're interested in?",
        action: 'send_message',
        shouldHandoff: false,
        confidence: 0.5,
      };
    }
  }

  extractTrialDetails(content: string, conversation: Conversation, contact?: Contact | null): TrialDetails {
    const allContent = conversation.messages.map(m => m.content).join(' ') + ' ' + content;
    const lower = allContent.toLowerCase();

    // Extract name from contact or conversation
    let name: string | null = contact?.name || null;
    if (!name) {
      const nameMatch = allContent.match(/(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (nameMatch) name = nameMatch[1];
    }

    // Extract phone
    let phone: string | null = contact?.phone || null;
    if (!phone) {
      const phoneMatch = allContent.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) phone = phoneMatch[0];
    }

    // Extract date
    let date: string | null = null;
    const datePatterns = [
      /(?:on\s+)?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(?:on\s+)?(tomorrow|today|next week)/i,
    ];
    for (const pattern of datePatterns) {
      const match = allContent.match(pattern);
      if (match) { date = match[1]; break; }
    }

    // Extract time
    let time: string | null = null;
    const timeMatch = allContent.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/);
    if (timeMatch) time = timeMatch[1];

    // Extract interest area
    let interestArea: string | null = null;
    const interestPatterns = [
      /interested in\s+(.+?)(?:\.|,|$)/i,
      /want to (?:try|learn|know about)\s+(.+?)(?:\.|,|$)/i,
      /looking for\s+(.+?)(?:\.|,|$)/i,
    ];
    for (const pattern of interestPatterns) {
      const match = allContent.match(pattern);
      if (match) { interestArea = match[1].trim(); break; }
    }

    return { name, phone, date, time, interestArea };
  }

  validateTrialRequest(details: TrialDetails): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    if (!details.name) missingFields.push('name');
    if (!details.phone) missingFields.push('phone number');
    if (!details.date) missingFields.push('preferred date');
    if (!details.time) missingFields.push('preferred time');
    if (!details.interestArea) missingFields.push('area of interest');

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  }
}
