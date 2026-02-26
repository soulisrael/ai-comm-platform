import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';
import { CustomAgentRepository } from '../database/repositories/custom-agent-repository';
import { CustomAgentWithBrain } from '../types/custom-agent';

interface CustomRouterResult {
  agentId: string;
  confidence: number;
  reasoning: string;
}

export class RouterAgent extends BaseAgent {
  private claude: ClaudeAPI;
  private promptBuilder: PromptBuilder;
  private customAgentRepo: CustomAgentRepository;
  private confidenceThreshold: number;

  constructor(
    claude: ClaudeAPI,
    promptBuilder: PromptBuilder,
    customAgentRepo: CustomAgentRepository
  ) {
    super('Router', 'router');
    this.claude = claude;
    this.promptBuilder = promptBuilder;
    this.customAgentRepo = customAgentRepo;
    this.confidenceThreshold = 0.6;
  }

  /**
   * Route a message to the best matching custom agent.
   */
  async routeToCustomAgent(
    message: string,
    conversationHistory?: Message[],
    currentAgentId?: string
  ): Promise<{ agentId: string; confidence: number; reasoning: string }> {
    // Load all active agents with brain
    const agents = await this.customAgentRepo.getAllWithBrain();
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
    const currentAgent = await this.customAgentRepo.getWithBrain(currentAgentId);
    if (!currentAgent) {
      return { shouldTransfer: false };
    }

    // Check if the message matches any brain entry title of the current agent
    const brainTitles = currentAgent.brain.map(b => b.title.toLowerCase());
    const lowerMessage = message.toLowerCase();
    const matchesCurrentAgent = brainTitles.some(title => lowerMessage.includes(title)) ||
      currentAgent.routingKeywords.some(kw => lowerMessage.includes(kw.toLowerCase()));

    if (matchesCurrentAgent) {
      return { shouldTransfer: false };
    }

    // Check if it matches another agent's keywords or brain
    const allAgents = await this.customAgentRepo.getAllWithBrain();
    for (const agent of allAgents) {
      if (agent.id === currentAgentId || !agent.active) continue;

      const matches = agent.routingKeywords.some(kw => lowerMessage.includes(kw.toLowerCase())) ||
        agent.brain.some(b => lowerMessage.includes(b.title.toLowerCase()));

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
    agents: CustomAgentWithBrain[]
  ): CustomRouterResult {
    const lowerMessage = message.toLowerCase();
    let bestMatch: { agent: CustomAgentWithBrain; score: number } | null = null;

    for (const agent of agents) {
      let score = 0;

      // Check routing keywords
      for (const keyword of agent.routingKeywords) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      // Check brain entry titles
      for (const entry of agent.brain) {
        if (lowerMessage.includes(entry.title.toLowerCase())) {
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

  // Legacy processMessage kept for BaseAgent interface
  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>
  ): Promise<AgentResponse> {
    const result = await this.routeToCustomAgent(
      message.content,
      conversation.messages
    );
    return {
      message: result.reasoning,
      shouldHandoff: false,
      confidence: result.confidence,
      suggestedAgent: 'support',
      action: 'send_message',
    };
  }
}
