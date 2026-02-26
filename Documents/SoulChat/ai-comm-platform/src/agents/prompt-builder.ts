import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { CustomAgentWithBrain, BrainEntry } from '../types/custom-agent';
import logger from '../services/logger';

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_TOKENS = 2000;
const MAX_BRAIN_ENTRIES = 5;
const ALWAYS_INCLUDE_CATEGORIES = ['script', 'policy'];

export class PromptBuilder {
  /**
   * Trim conversation history to stay within limits.
   */
  trimHistory(messages: Message[], maxMessages = MAX_HISTORY_MESSAGES, maxTokens = MAX_HISTORY_TOKENS): Message[] {
    if (messages.length <= maxMessages) {
      // Check token count even if under message limit
      const totalTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      if (totalTokens <= maxTokens) {
        return messages;
      }
    }

    // Take last maxMessages
    let trimmed = messages.slice(-maxMessages);

    // Rough token count: content.length / 4
    let totalTokens = trimmed.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);

    // Keep removing oldest until under maxTokens
    while (totalTokens > maxTokens && trimmed.length > 1) {
      const removed = trimmed.shift()!;
      totalTokens -= Math.ceil(removed.content.length / 4);
    }

    return trimmed;
  }

  /**
   * Filter brain entries to only relevant ones.
   */
  getRelevantBrain(brain: BrainEntry[], message: string, maxEntries = MAX_BRAIN_ENTRIES): BrainEntry[] {
    if (brain.length <= maxEntries) {
      return brain;
    }

    // Always include script and policy entries
    const alwaysInclude = brain.filter(e => ALWAYS_INCLUDE_CATEGORIES.includes(e.category));
    const remaining = brain.filter(e => !ALWAYS_INCLUDE_CATEGORIES.includes(e.category));

    // If always-include already fills the quota, return them
    if (alwaysInclude.length >= maxEntries) {
      return alwaysInclude.slice(0, maxEntries);
    }

    // Score remaining by keyword overlap with message
    const scored = remaining.map(entry => ({
      entry,
      score: this.calculateRelevance(entry, message),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top entries to fill remaining slots
    const slotsLeft = maxEntries - alwaysInclude.length;
    const topEntries = scored.slice(0, slotsLeft).map(s => s.entry);

    // Deduplicate (entries already in alwaysInclude won't be in remaining)
    return [...alwaysInclude, ...topEntries];
  }

  /**
   * Calculate relevance score between a brain entry and a message.
   */
  calculateRelevance(entry: BrainEntry, message: string): number {
    const messageWords = message.toLowerCase().split(/\s+/);
    const titleWords = entry.title.toLowerCase().split(/\s+/);
    const contentWords = entry.content.toLowerCase().split(/\s+/).slice(0, 50);

    let score = 0;

    // Title matches are worth 3x
    score += this.countOverlap(messageWords, titleWords) * 3;

    // Content matches are worth 1x
    score += this.countOverlap(messageWords, contentWords);

    // Metadata key matches
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      const metaWords = Object.keys(entry.metadata).map(k => k.toLowerCase());
      const metaValues = Object.values(entry.metadata)
        .filter(v => typeof v === 'string')
        .flatMap(v => (v as string).toLowerCase().split(/\s+/));
      score += this.countOverlap(messageWords, [...metaWords, ...metaValues]);
    }

    return score;
  }

  private countOverlap(wordsA: string[], wordsB: string[]): number {
    let count = 0;
    for (const word of wordsA) {
      if (word.length < 2) continue; // Skip single-char words
      if (wordsB.includes(word)) count++;
    }
    return count;
  }

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

    // Add trimmed conversation history context
    if (history && history.length > 0) {
      const trimmedHistory = this.trimHistory(history, 5, 1000);
      systemPrompt += `\n\nהקשר שיחה אחרון:\n`;
      for (const msg of trimmedHistory) {
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
    contact?: Contact | null,
    currentMessage?: string
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
- השתמש בירידת שורה רגילה בין משפטים, בלי שורות ריקות ובלי רווח כפול.
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

    // Build knowledge base from relevant brain entries only
    if (agent.brain.length > 0) {
      const relevantBrain = currentMessage
        ? this.getRelevantBrain(agent.brain, currentMessage)
        : agent.brain;

      systemPrompt += '\n\n=== בסיס הידע שלך ===\n';

      for (const entry of relevantBrain) {
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
אתה כותב בצ'אט. כל משפט שמסתיים בנקודה ירד לשורה חדשה, בלי שורה ריקה ביניהם.
אם יש כמה פריטים (כמו חוגים, שירותים, מוצרים) — כל פריט בשורה נפרדת, בלי שורות ריקות.
אסור בהחלט להשתמש בכוכביות, מקפים, מספור, סולמיות, או כל סימן עיצוב.
אסור להוסיף שורות ריקות בין משפטים. רק ירידת שורה רגילה, בלי רווח כפול.
כתוב טקסט רגיל וטבעי בלבד, כמו הודעת וואטסאפ.`;

    // Trim message history
    const trimmedHistory = this.trimHistory(history);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of trimmedHistory) {
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
      relevantBrainCount: currentMessage ? this.getRelevantBrain(agent.brain, currentMessage).length : agent.brain.length,
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
