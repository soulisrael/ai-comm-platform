import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { AgentType, Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';
import { BrainSearch } from '../brain/brain-search';
import { CustomAgentRepository } from '../database/repositories/custom-agent-repository';
import { CustomAgentWithTopics } from '../types/custom-agent';

interface CustomRouterResult {
  agentId: string;
  confidence: number;
  reasoning: string;
}

// Legacy intent-to-agent mapping (fallback when no custom agents)
const INTENT_TO_AGENT: Record<string, AgentType> = {
  sales: 'sales',
  support: 'support',
  trial_meeting: 'trial_meeting',
  appointment: 'trial_meeting',
  general: 'support',
};

export class RouterAgent extends BaseAgent {
  private claude: ClaudeAPI;
  private promptBuilder: PromptBuilder;
  private brainSearch: BrainSearch;
  private customAgentRepo: CustomAgentRepository | null;
  private confidenceThreshold: number;

  constructor(
    claude: ClaudeAPI,
    promptBuilder: PromptBuilder,
    brainSearch: BrainSearch,
    customAgentRepo?: CustomAgentRepository
  ) {
    super('Router', 'router');
    this.claude = claude;
    this.promptBuilder = promptBuilder;
    this.brainSearch = brainSearch;
    this.customAgentRepo = customAgentRepo || null;

    const routingRules = this.brainSearch.findRelevantBrainData('', 'router');
    const rules = routingRules.routingRules as { confidenceThreshold?: number } | undefined;
    this.confidenceThreshold = rules?.confidenceThreshold ?? 0.6;
  }

  /**
   * Route a message to the best matching custom agent.
   */
  async routeToCustomAgent(
    message: string,
    conversationHistory?: Message[],
    currentAgentId?: string
  ): Promise<{ agentId: string; confidence: number; reasoning: string }> {
    if (!this.customAgentRepo) {
      throw new Error('CustomAgentRepository not configured');
    }

    // Load all active agents with topics
    const agents = await this.customAgentRepo.getAllWithTopics();
    const activeAgents = agents.filter(a => a.active);

    if (activeAgents.length === 0) {
      throw new Error('No active custom agents found');
    }

    // Try AI routing first
    let result: CustomRouterResult | null = null;

    try {
      const { systemPrompt, messages } = this.promptBuilder.buildCustomRouterPrompt(
        activeAgents,
        message,
        conversationHistory
      );

      const response = await this.claude.chatJSON<CustomRouterResult>({
        systemPrompt,
        messages,
        temperature: 0.1,
        maxTokens: 200,
      });

      result = response.data;
      this.log('info', `AI routing: agent=${result.agentId}, confidence=${result.confidence}`);
    } catch (err) {
      this.log('warn', `AI routing failed, falling back to keyword matching: ${err}`);
    }

    // If confidence is low or AI failed, try keyword fallback
    if (!result || result.confidence < this.confidenceThreshold) {
      const keywordResult = this.keywordFallbackCustom(message, activeAgents);
      if (!result || keywordResult.confidence > result.confidence) {
        result = keywordResult;
      }
    }

    // Validate the agent ID exists
    const validAgent = activeAgents.find(a => a.id === result!.agentId);
    if (!validAgent) {
      // Fall back to default agent
      const defaultAgent = activeAgents.find(a => a.isDefault) || activeAgents[0];
      result = {
        agentId: defaultAgent.id,
        confidence: 0.5,
        reasoning: 'סוכן ברירת מחדל - לא נמצאה התאמה',
      };
    }

    return result;
  }

  /**
   * Check if a message should be transferred to a different agent during a conversation.
   */
  async shouldTransfer(
    message: string,
    currentAgentId: string
  ): Promise<{ shouldTransfer: boolean; suggestedAgentId?: string; reasoning?: string }> {
    if (!this.customAgentRepo) {
      return { shouldTransfer: false };
    }

    const currentAgent = await this.customAgentRepo.getWithTopics(currentAgentId);
    if (!currentAgent) {
      return { shouldTransfer: false };
    }

    // Check if the message matches any topic of the current agent
    const topicNames = currentAgent.topics.map(t => t.name.toLowerCase());
    const lowerMessage = message.toLowerCase();
    const matchesCurrentAgent = topicNames.some(name => lowerMessage.includes(name)) ||
      currentAgent.routingKeywords.some(kw => lowerMessage.includes(kw.toLowerCase()));

    if (matchesCurrentAgent) {
      return { shouldTransfer: false };
    }

    // Check if it matches another agent's keywords
    const allAgents = await this.customAgentRepo.getAllWithTopics();
    for (const agent of allAgents) {
      if (agent.id === currentAgentId || !agent.active) continue;

      const matches = agent.routingKeywords.some(kw => lowerMessage.includes(kw.toLowerCase())) ||
        agent.topics.some(t => lowerMessage.includes(t.name.toLowerCase()));

      if (matches) {
        return {
          shouldTransfer: true,
          suggestedAgentId: agent.id,
          reasoning: `ההודעה מתאימה לסוכן "${agent.name}"`,
        };
      }
    }

    return { shouldTransfer: false };
  }

  /**
   * Keyword-based fallback routing for custom agents.
   */
  private keywordFallbackCustom(
    message: string,
    agents: CustomAgentWithTopics[]
  ): CustomRouterResult {
    const lowerMessage = message.toLowerCase();
    let bestMatch: { agent: CustomAgentWithTopics; score: number } | null = null;

    for (const agent of agents) {
      let score = 0;

      // Check routing keywords
      for (const keyword of agent.routingKeywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      // Check topic names
      for (const topic of agent.topics) {
        if (lowerMessage.includes(topic.name.toLowerCase())) {
          score += 1;
        }
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { agent, score };
      }
    }

    // If no keyword match, use default agent
    if (!bestMatch || bestMatch.score === 0) {
      const defaultAgent = agents.find(a => a.isDefault) || agents[0];
      return {
        agentId: defaultAgent.id,
        confidence: 0.3,
        reasoning: 'ברירת מחדל - אין התאמה למילות מפתח',
      };
    }

    return {
      agentId: bestMatch.agent.id,
      confidence: Math.min(0.5 + bestMatch.score * 0.1, 0.85),
      reasoning: `התאמה למילות מפתח של "${bestMatch.agent.name}"`,
    };
  }

  // ─── Legacy processMessage (backward compatibility) ───────────────────

  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>
  ): Promise<AgentResponse> {
    this.log('info', `Routing message: "${message.content.slice(0, 50)}..."`);

    // If custom agents repo is available, use custom routing
    if (this.customAgentRepo) {
      try {
        const result = await this.routeToCustomAgent(
          message.content,
          conversation.messages
        );
        return {
          message: result.reasoning,
          shouldHandoff: false,
          confidence: result.confidence,
          suggestedAgent: 'support', // legacy field
          action: 'send_message',
          metadata: { customAgentId: result.agentId },
        } as AgentResponse & { metadata?: Record<string, unknown> };
      } catch (err) {
        this.log('warn', `Custom routing failed, using legacy: ${err}`);
      }
    }

    // Legacy routing
    let routerResult: { intent: string; confidence: number; language: string; sentiment: string; summary: string };

    try {
      const { systemPrompt, messages } = this.promptBuilder.buildRouterPrompt(
        message,
        conversation.messages
      );

      const response = await this.claude.chatJSON<typeof routerResult>({
        systemPrompt,
        messages,
        temperature: 0.1,
        maxTokens: 200,
      });

      routerResult = response.data;
      this.log('info', `AI routing: intent=${routerResult.intent}, confidence=${routerResult.confidence}`);
    } catch (err) {
      this.log('warn', `AI routing failed, falling back to keyword matching: ${err}`);
      routerResult = this.keywordFallback(message.content);
    }

    if (routerResult.confidence < this.confidenceThreshold) {
      this.log('info', `Low confidence (${routerResult.confidence}), using keyword fallback`);
      const keywordResult = this.keywordFallback(message.content);
      if (keywordResult.confidence > routerResult.confidence) {
        routerResult = keywordResult;
      }
    }

    const suggestedAgent = INTENT_TO_AGENT[routerResult.intent] || 'support';

    return {
      message: routerResult.summary || 'Message routed',
      shouldHandoff: false,
      confidence: routerResult.confidence,
      suggestedAgent,
      action: 'send_message',
    };
  }

  private keywordFallback(content: string): { intent: string; confidence: number; language: string; sentiment: string; summary: string } {
    const lowerContent = content.toLowerCase();
    const routingData = this.brainSearch.findRelevantBrainData('', 'router');
    const routingRules = routingData.routingRules as {
      rules?: Array<{ keywords: string[]; intent: string; priority: number }>;
      defaultIntent?: string;
    } | undefined;

    if (routingRules?.rules) {
      let bestMatch = { intent: routingRules.defaultIntent || 'support', score: 0 };

      for (const rule of routingRules.rules) {
        let score = 0;
        for (const keyword of rule.keywords) {
          if (lowerContent.includes(keyword.toLowerCase())) {
            score += 1;
          }
        }
        if (score > bestMatch.score) {
          bestMatch = { intent: rule.intent, score };
        }
      }

      return {
        intent: bestMatch.intent,
        confidence: bestMatch.score > 0 ? Math.min(0.5 + bestMatch.score * 0.1, 0.85) : 0.3,
        language: 'Hebrew',
        sentiment: 'neutral',
        summary: `Keyword match: ${bestMatch.intent}`,
      };
    }

    return {
      intent: 'support',
      confidence: 0.3,
      language: 'Hebrew',
      sentiment: 'neutral',
      summary: 'Default routing to support',
    };
  }
}
