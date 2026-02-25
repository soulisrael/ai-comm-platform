import { AgentType, Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { BrainSearch } from '../brain/brain-search';
import logger from '../services/logger';

const MAX_HISTORY_MESSAGES = 20;

export class PromptBuilder {
  private brainSearch: BrainSearch;

  constructor(brainSearch: BrainSearch) {
    this.brainSearch = brainSearch;
  }

  buildRouterPrompt(message: Message, conversationHistory: Message[]): {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const brainData = this.brainSearch.findRelevantBrainData(message.content, 'router');
    const agentInstructions = brainData.agentInstructions as { systemPrompt: string } | undefined;

    const systemPrompt = agentInstructions?.systemPrompt ||
      'You are a message router. Classify the intent and respond with JSON: {"intent": "sales|support|trial_meeting|general", "confidence": 0.0-1.0, "language": "detected language", "sentiment": "positive|neutral|negative", "summary": "brief summary"}';

    const recentHistory = conversationHistory.slice(-5);
    const historyContext = recentHistory.length > 0
      ? `\n\nRecent conversation context:\n${recentHistory.map(m => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`).join('\n')}`
      : '';

    return {
      systemPrompt: systemPrompt + historyContext,
      messages: [{ role: 'user', content: message.content }],
    };
  }

  buildAgentPrompt(
    agentType: AgentType,
    conversation: Conversation,
    currentMessage: Message,
    contact?: Contact | null
  ): {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    const brainData = this.brainSearch.findRelevantBrainData(currentMessage.content, agentType);

    // Get agent instructions
    const agentInstructions = brainData.agentInstructions as {
      systemPrompt: string;
      temperature?: number;
      maxTokens?: number;
    } | undefined;

    let systemPrompt = agentInstructions?.systemPrompt || `You are a ${agentType} agent.`;

    // Inject variables
    const companyInfo = brainData.companyInfo as { companyName?: string } | undefined;
    systemPrompt = this.injectVariables(systemPrompt, {
      companyName: companyInfo?.companyName || 'our company',
      channel: conversation.channel,
      contactName: contact?.name || 'there',
    });

    // Add tone of voice
    const toneOfVoice = brainData.toneOfVoice as {
      personality?: string;
      doList?: string[];
      dontList?: string[];
    } | undefined;
    if (toneOfVoice) {
      systemPrompt += '\n\n## Tone of Voice';
      if (toneOfVoice.personality) systemPrompt += `\nPersonality: ${toneOfVoice.personality}`;
      if (toneOfVoice.doList) systemPrompt += `\nDo: ${toneOfVoice.doList.join(', ')}`;
      if (toneOfVoice.dontList) systemPrompt += `\nDon't: ${toneOfVoice.dontList.join(', ')}`;
    }

    // Add brain data sections (excluding already-used fields)
    const { companyInfo: _ci, toneOfVoice: _tov, agentInstructions: _ai, relevantFAQ, ...remainingBrain } = brainData;

    if (Object.keys(remainingBrain).length > 0) {
      systemPrompt += '\n\n## Knowledge Base';
      for (const [key, value] of Object.entries(remainingBrain)) {
        const section = JSON.stringify(value, null, 2);
        // Keep total prompt manageable
        if (systemPrompt.length + section.length < 80000) {
          systemPrompt += `\n\n### ${this.formatSectionName(key)}\n${section}`;
        }
      }
    }

    // Add relevant FAQ if found
    if (relevantFAQ && Array.isArray(relevantFAQ) && relevantFAQ.length > 0) {
      systemPrompt += '\n\n### Relevant FAQ Matches';
      for (const faq of relevantFAQ) {
        const f = faq as { question?: string; answer?: string };
        systemPrompt += `\nQ: ${f.question}\nA: ${f.answer}\n`;
      }
    }

    // Add contact info
    if (contact) {
      systemPrompt += `\n\n## Customer Info`;
      systemPrompt += `\nName: ${contact.name || 'Unknown'}`;
      if (contact.email) systemPrompt += `\nEmail: ${contact.email}`;
      if (contact.tags.length > 0) systemPrompt += `\nTags: ${contact.tags.join(', ')}`;
      systemPrompt += `\nConversation count: ${contact.conversationCount}`;
    }

    // Add conversation context
    if (conversation.context.intent) {
      systemPrompt += `\n\n## Conversation Context`;
      systemPrompt += `\nDetected intent: ${conversation.context.intent}`;
      if (conversation.context.sentiment) systemPrompt += `\nSentiment: ${conversation.context.sentiment}`;
      if (conversation.context.language) systemPrompt += `\nLanguage: ${conversation.context.language}`;
      if (conversation.context.leadScore !== null) systemPrompt += `\nLead score: ${conversation.context.leadScore}`;
    }

    // Build message history
    const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of recentMessages) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add current message if not already in history
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.content !== currentMessage.content) {
      messages.push({ role: 'user', content: currentMessage.content });
    }

    logger.debug('Built agent prompt', {
      agentType,
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length,
    });

    return { systemPrompt, messages };
  }

  private injectVariables(template: string, vars: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  private formatSectionName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, s => s.toUpperCase())
      .trim();
  }
}
