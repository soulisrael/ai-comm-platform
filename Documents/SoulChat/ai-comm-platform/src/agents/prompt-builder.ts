import { AgentType, Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { CustomAgentWithTopics } from '../types/custom-agent';
import { Topic, TopicContent } from '../types/topic';
import { BrainSearch } from '../brain/brain-search';
import logger from '../services/logger';

const MAX_HISTORY_MESSAGES = 20;

export class PromptBuilder {
  private brainSearch: BrainSearch;

  constructor(brainSearch: BrainSearch) {
    this.brainSearch = brainSearch;
  }

  /**
   * Build a router prompt that lists all active custom agents for classification.
   */
  buildCustomRouterPrompt(
    agents: CustomAgentWithTopics[],
    message: string,
    history?: Message[]
  ): {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    let systemPrompt = `אתה מערכת ניתוב חכמה. תפקידך לנתח את הודעת הלקוח ולהחליט לאיזה סוכן להעביר אותה.

הסוכנים הזמינים:
`;

    for (const agent of agents) {
      systemPrompt += `\nסוכן: ${agent.name} (ID: ${agent.id})`;
      if (agent.description) {
        systemPrompt += `\nתיאור: ${agent.description}`;
      }
      if (agent.routingKeywords.length > 0) {
        systemPrompt += `\nמילות מפתח: ${agent.routingKeywords.join(', ')}`;
      }
      if (agent.topics.length > 0) {
        systemPrompt += `\nנושאים: ${agent.topics.map(t => t.name).join(', ')}`;
      }
      if (agent.isDefault) {
        systemPrompt += `\n(סוכן ברירת מחדל)`;
      }
      systemPrompt += '\n';
    }

    systemPrompt += `
הוראות:
1. נתח את הודעת הלקוח וזהה לאיזה סוכן היא מתאימה.
2. התחשב במילות המפתח ובנושאים של כל סוכן.
3. אם אתה לא בטוח, בחר בסוכן ברירת המחדל.

ענה אך ורק ב-JSON בפורמט הבא:
{"agentId": "...", "confidence": 0.0-1.0, "reasoning": "..."}`;

    // Add conversation history context
    if (history && history.length > 0) {
      const recentHistory = history.slice(-5);
      systemPrompt += `\n\nהקשר שיחה אחרון:\n`;
      for (const msg of recentHistory) {
        const sender = msg.direction === 'inbound' ? 'לקוח' : 'סוכן';
        systemPrompt += `${sender}: ${msg.content}\n`;
      }
    }

    return {
      systemPrompt,
      messages: [{ role: 'user', content: message }],
    };
  }

  /**
   * Build a prompt for a specific custom agent with its topics as knowledge base.
   */
  buildCustomAgentPrompt(
    agent: CustomAgentWithTopics,
    history: Message[],
    contact?: Contact | null
  ): {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    // Start with the agent's system prompt
    let systemPrompt = agent.systemPrompt || `אתה סוכן שירות לקוחות בשם "${agent.name}".`;

    // Add company tone of voice from brain
    const brainData = this.brainSearch.findRelevantBrainData('', 'support');
    const companyInfo = brainData.companyInfo as { companyName?: string } | undefined;
    const toneOfVoice = brainData.toneOfVoice as {
      personality?: string;
      doList?: string[];
      dontList?: string[];
    } | undefined;

    if (toneOfVoice) {
      systemPrompt += '\n\n## סגנון דיבור';
      if (toneOfVoice.personality) systemPrompt += `\nאישיות: ${toneOfVoice.personality}`;
      if (toneOfVoice.doList) systemPrompt += `\nכן: ${toneOfVoice.doList.join(', ')}`;
      if (toneOfVoice.dontList) systemPrompt += `\nלא: ${toneOfVoice.dontList.join(', ')}`;
    }

    // Add business hours from brain
    const companyData = brainData.companyInfo as { businessHours?: string } | undefined;
    if (companyData?.businessHours) {
      systemPrompt += `\n\nשעות פעילות: ${companyData.businessHours}`;
    }

    // Build knowledge base from topics
    if (agent.topics.length > 0) {
      systemPrompt += '\n\n=== בסיס הידע שלך ===\n';

      for (const topic of agent.topics) {
        systemPrompt += this.formatTopicSection(topic);
      }

      systemPrompt += '\n=== סוף בסיס הידע ===';

      systemPrompt += `\n\nאתה יכול לענות רק על נושאים שמופיעים למעלה.
אם שואלים אותך על משהו שלא בבסיס הידע שלך, אמור בנימוס שאין לך מידע על זה והצע לחבר את הלקוח למישהו שיכול לעזור.`;
    }

    // Add contact info
    if (contact) {
      systemPrompt += `\n\n## פרטי לקוח`;
      systemPrompt += `\nשם: ${contact.name || 'לא ידוע'}`;
      if (contact.email) systemPrompt += `\nאימייל: ${contact.email}`;
      if (contact.phone) systemPrompt += `\nטלפון: ${contact.phone}`;
      if (contact.tags.length > 0) systemPrompt += `\nתגיות: ${contact.tags.join(', ')}`;
      systemPrompt += `\nמספר שיחות: ${contact.conversationCount}`;
    }

    // Add transfer rules
    if (agent.transferRules && Object.keys(agent.transferRules).length > 0) {
      systemPrompt += `\n\n## כללי העברה`;
      systemPrompt += `\n${JSON.stringify(agent.transferRules, null, 2)}`;
    }

    // Build message history
    const recentMessages = history.slice(-MAX_HISTORY_MESSAGES);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of recentMessages) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    logger.debug('Built custom agent prompt', {
      agentName: agent.name,
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length,
      topicCount: agent.topics.length,
    });

    return { systemPrompt, messages };
  }

  /**
   * Format a single topic into a readable Hebrew section for the prompt.
   */
  private formatTopicSection(topic: Topic): string {
    const content = topic.content;
    let section = `\nנושא: ${topic.name}\n`;

    if (content.description) {
      section += `תיאור: ${content.description}\n`;
    }
    if (content.schedule) {
      section += `לוח זמנים: ${content.schedule}\n`;
    }
    if (content.price) {
      section += `מחיר: ${content.price}\n`;
    }
    if (content.faq && content.faq.length > 0) {
      section += `שאלות נפוצות:\n`;
      for (const faq of content.faq) {
        section += `ש: ${faq.question} ת: ${faq.answer}\n`;
      }
    }
    if (content.details) {
      section += `פרטים נוספים:\n${content.details}\n`;
    }
    // Custom fields
    if (content.customFields && Object.keys(content.customFields).length > 0) {
      for (const [key, value] of Object.entries(content.customFields)) {
        section += `${key}: ${value}\n`;
      }
    }

    return section;
  }

  // ─── Legacy methods (kept for backward compatibility) ────────────────────

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

    const agentInstructions = brainData.agentInstructions as {
      systemPrompt: string;
      temperature?: number;
      maxTokens?: number;
    } | undefined;

    let systemPrompt = agentInstructions?.systemPrompt || `You are a ${agentType} agent.`;

    const companyInfo = brainData.companyInfo as { companyName?: string } | undefined;
    systemPrompt = this.injectVariables(systemPrompt, {
      companyName: companyInfo?.companyName || 'our company',
      channel: conversation.channel,
      contactName: contact?.name || 'there',
    });

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

    const { companyInfo: _ci, toneOfVoice: _tov, agentInstructions: _ai, relevantFAQ, ...remainingBrain } = brainData;

    if (Object.keys(remainingBrain).length > 0) {
      systemPrompt += '\n\n## Knowledge Base';
      for (const [key, value] of Object.entries(remainingBrain)) {
        const section = JSON.stringify(value, null, 2);
        if (systemPrompt.length + section.length < 80000) {
          systemPrompt += `\n\n### ${this.formatSectionName(key)}\n${section}`;
        }
      }
    }

    if (relevantFAQ && Array.isArray(relevantFAQ) && relevantFAQ.length > 0) {
      systemPrompt += '\n\n### Relevant FAQ Matches';
      for (const faq of relevantFAQ) {
        const f = faq as { question?: string; answer?: string };
        systemPrompt += `\nQ: ${f.question}\nA: ${f.answer}\n`;
      }
    }

    if (contact) {
      systemPrompt += `\n\n## Customer Info`;
      systemPrompt += `\nName: ${contact.name || 'Unknown'}`;
      if (contact.email) systemPrompt += `\nEmail: ${contact.email}`;
      if (contact.tags.length > 0) systemPrompt += `\nTags: ${contact.tags.join(', ')}`;
      systemPrompt += `\nConversation count: ${contact.conversationCount}`;
    }

    if (conversation.context.intent) {
      systemPrompt += `\n\n## Conversation Context`;
      systemPrompt += `\nDetected intent: ${conversation.context.intent}`;
      if (conversation.context.sentiment) systemPrompt += `\nSentiment: ${conversation.context.sentiment}`;
      if (conversation.context.language) systemPrompt += `\nLanguage: ${conversation.context.language}`;
      if (conversation.context.leadScore !== null) systemPrompt += `\nLead score: ${conversation.context.leadScore}`;
    }

    const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of recentMessages) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

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
