import { ClaudeAPI } from '../services/claude-api';
import { CustomAgentRepository } from '../database/repositories/custom-agent-repository';
import { TopicRepository } from '../database/repositories/topic-repository';
import { CustomAgentWithTopics } from '../types/custom-agent';
import { Message } from '../types/message';
import { Contact } from '../types/contact';
import { PromptBuilder } from './prompt-builder';
import { BrainSearch } from '../brain/brain-search';
import logger from '../services/logger';

export interface AgentRunnerResult {
  message: string;
  shouldHandoff: boolean;
  handoffReason?: string;
  shouldTransfer: boolean;
  suggestedAgentId?: string;
  transferMessage?: string;
  confidence: number;
}

// Hebrew keywords for handoff detection
const HANDOFF_KEYWORDS = ['נציג', 'אדם', 'מנהל', 'אני רוצה לדבר עם מישהו', 'נציג אנושי', 'בן אדם'];
const NEGATIVE_KEYWORDS = ['כועס', 'עצבני', 'נמאס', 'גרוע', 'מזעזע', 'לא מקובל', 'בושה', 'חרא'];

export class AgentRunner {
  private claude: ClaudeAPI;
  private customAgentRepo: CustomAgentRepository;
  private topicRepo: TopicRepository;
  private promptBuilder: PromptBuilder;

  constructor(
    claude: ClaudeAPI,
    customAgentRepo: CustomAgentRepository,
    topicRepo: TopicRepository,
    promptBuilder: PromptBuilder
  ) {
    this.claude = claude;
    this.customAgentRepo = customAgentRepo;
    this.topicRepo = topicRepo;
    this.promptBuilder = promptBuilder;
  }

  async run(
    agentId: string,
    message: string,
    conversationHistory: Message[],
    contact?: Contact | null
  ): Promise<AgentRunnerResult> {
    // Load agent with topics from DB
    const agent = await this.customAgentRepo.getWithTopics(agentId);
    if (!agent) {
      logger.error(`Agent not found: ${agentId}`);
      return {
        message: 'מצטער, אירעה שגיאה. אנא נסה שוב מאוחר יותר.',
        shouldHandoff: false,
        shouldTransfer: false,
        confidence: 0,
      };
    }

    return this.runWithAgent(agent, message, conversationHistory, contact);
  }

  async runWithAgent(
    agent: CustomAgentWithTopics,
    message: string,
    conversationHistory: Message[],
    contact?: Contact | null
  ): Promise<AgentRunnerResult> {
    logger.info(`Running agent: ${agent.name} (${agent.id})`);

    // Check for handoff before running AI
    const handoffCheck = this.detectHandoff(message, conversationHistory, agent);
    if (handoffCheck.shouldHandoff) {
      return {
        message: 'אני מחבר אותך עם נציג שיוכל לעזור. הוא יקבל את כל ההיסטוריה של השיחה שלנו. רגע אחד!',
        shouldHandoff: true,
        handoffReason: handoffCheck.reason,
        shouldTransfer: false,
        confidence: 1.0,
      };
    }

    // Build prompt with topics
    const { systemPrompt, messages } = this.promptBuilder.buildCustomAgentPrompt(
      agent,
      conversationHistory,
      contact
    );

    // Add current message if not already in history
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.content !== message) {
      messages.push({ role: 'user', content: message });
    }

    // Call Claude with agent-specific settings
    const settings = agent.settings;
    try {
      const result = await this.claude.chat({
        systemPrompt,
        messages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const response = result.content;

      // Check for transfer
      const transferCheck = this.detectTransfer(response, message, agent);

      return {
        message: response,
        shouldHandoff: false,
        shouldTransfer: transferCheck.shouldTransfer,
        suggestedAgentId: transferCheck.suggestedAgentId,
        transferMessage: transferCheck.transferMessage,
        confidence: 0.85,
      };
    } catch (err) {
      logger.error(`Agent ${agent.name} failed:`, err);
      return {
        message: 'מצטער, אירעה שגיאה בעיבוד ההודעה. אנא נסה שוב.',
        shouldHandoff: false,
        shouldTransfer: false,
        confidence: 0,
      };
    }
  }

  detectHandoff(
    message: string,
    history: Message[],
    agent: CustomAgentWithTopics
  ): { shouldHandoff: boolean; reason?: string } {
    // Check for explicit human request keywords
    const lowerMessage = message.toLowerCase();
    for (const keyword of HANDOFF_KEYWORDS) {
      if (lowerMessage.includes(keyword)) {
        return { shouldHandoff: true, reason: `לקוח ביקש נציג אנושי: "${keyword}"` };
      }
    }

    // Check max turns from handoff rules
    const maxTurns = (agent.handoffRules as { maxTurns?: number })?.maxTurns;
    if (maxTurns) {
      const inboundCount = history.filter(m => m.direction === 'inbound').length;
      if (inboundCount >= maxTurns) {
        return { shouldHandoff: true, reason: `חריגה ממספר סיבובים מרבי (${maxTurns})` };
      }
    }

    // Check for frustration (3 consecutive negative messages)
    const recentInbound = history.filter(m => m.direction === 'inbound').slice(-3);
    if (recentInbound.length >= 3) {
      const allNegative = recentInbound.every(m => {
        const content = m.content.toLowerCase();
        return NEGATIVE_KEYWORDS.some(kw => content.includes(kw));
      });
      if (allNegative) {
        return { shouldHandoff: true, reason: 'לקוח מתוסכל (3 הודעות שליליות ברצף)' };
      }
    }

    return { shouldHandoff: false };
  }

  detectTransfer(
    response: string,
    message: string,
    agent: CustomAgentWithTopics
  ): { shouldTransfer: boolean; suggestedAgentId?: string; transferMessage?: string } {
    // Check if the AI response indicates it can't answer (topic not in knowledge base)
    const cantAnswerPhrases = [
      'אין לי מידע על',
      'לא בבסיס הידע',
      'לא יכול לעזור עם',
      'לא מתמחה ב',
      'לא בתחום שלי',
    ];

    for (const phrase of cantAnswerPhrases) {
      if (response.includes(phrase)) {
        return {
          shouldTransfer: true,
          transferMessage: 'הנושא הזה לא בתחום הידע של הסוכן הנוכחי. מנתב לסוכן המתאים...',
        };
      }
    }

    return { shouldTransfer: false };
  }
}
