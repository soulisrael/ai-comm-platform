import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { CustomAgentWithBrain, BrainEntry } from '../types/custom-agent';
import logger from '../services/logger';

const MAX_HISTORY_MESSAGES = 20;

export class PromptBuilder {
  /**
   * Build a router prompt that lists all active custom agents for classification.
   */
  buildCustomRouterPrompt(
    agents: CustomAgentWithBrain[],
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
      if (agent.brain.length > 0) {
        systemPrompt += `\nנושאי ידע: ${agent.brain.map(b => b.title).join(', ')}`;
      }
      if (agent.isDefault) {
        systemPrompt += `\n(סוכן ברירת מחדל)`;
      }
      systemPrompt += '\n';
    }

    systemPrompt += `
הוראות:
1. נתח את הודעת הלקוח וזהה לאיזה סוכן היא מתאימה.
2. התחשב במילות המפתח ובנושאי הידע של כל סוכן.
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
   * Build a prompt for a specific custom agent with its brain as knowledge base.
   */
  buildCustomAgentPrompt(
    agent: CustomAgentWithBrain,
    history: Message[],
    contact?: Contact | null
  ): {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    // Start with the agent's system prompt
    let systemPrompt = agent.systemPrompt || `אתה סוכן שירות לקוחות בשם "${agent.name}".`;

    // Enforce language and conversational style
    const lang = agent.settings?.language || 'Hebrew';
    if (lang === 'Hebrew' || lang === 'he') {
      systemPrompt += `\n\nחשוב:
- ענה תמיד בשפה העברית בלבד.
- דבר בצורה טבעית ושוטפת, כמו בשיחה רגילה בין אנשים.
- אל תשתמש בסימני markdown כמו כוכביות (*), מקפים (-), סולמיות (#), או מספור.
- השתמש ברווחים ושורות חדשות כדי להפריד בין רעיונות.
- תשובות קצרות וברורות, 2-4 משפטים אלא אם הלקוח ביקש פירוט.`;
    } else if (lang === 'Arabic' || lang === 'ar') {
      systemPrompt += '\n\nمهم: أجب دائمًا باللغة العربية فقط. تحدث بشكل طبيعي بدون علامات markdown.';
    } else if (lang === 'English' || lang === 'en') {
      systemPrompt += '\n\nImportant: Always respond in English only. Speak naturally without markdown formatting, asterisks, or bullet points.';
    }

    // Add main document content if available
    if (agent.mainDocumentText) {
      systemPrompt += '\n\n=== מסמך מרכזי ===\n';
      systemPrompt += agent.mainDocumentText;
      systemPrompt += '\n=== סוף מסמך מרכזי ===';
    }

    // Build knowledge base from brain entries
    if (agent.brain.length > 0) {
      systemPrompt += '\n\n=== בסיס הידע שלך ===\n';

      for (const entry of agent.brain) {
        systemPrompt += this.formatBrainEntry(entry);
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

    // Final formatting instruction — placed last for maximum influence
    systemPrompt += `\n\nסגנון כתיבה (חובה לציית):
ענה כאילו אתה מדבר בשיחה רגילה. אסור בהחלט להשתמש בכוכביות, מקפים, מספור, סולמיות, או כל סימן עיצוב אחר.
כתוב טקסט רגיל בלבד. השתמש בשורות חדשות כדי להפריד בין נושאים.`;

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
      brainEntryCount: agent.brain.length,
      hasMainDocument: !!agent.mainDocumentText,
    });

    return { systemPrompt, messages };
  }

  /**
   * Format a single brain entry into a readable Hebrew section for the prompt.
   */
  private formatBrainEntry(entry: BrainEntry): string {
    let section = `\n### ${entry.title}`;
    if (entry.category !== 'general') {
      section += ` [${entry.category}]`;
    }
    section += `\n${entry.content}\n`;

    // Add metadata fields if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      for (const [key, value] of Object.entries(entry.metadata)) {
        section += `${key}: ${value}\n`;
      }
    }

    return section;
  }
}
