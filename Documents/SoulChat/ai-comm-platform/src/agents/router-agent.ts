import { BaseAgent } from './base-agent';
import { AgentResponse } from '../types/agent';
import { AgentType, Conversation } from '../types/conversation';
import { Message } from '../types/message';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';
import { BrainSearch } from '../brain/brain-search';

interface RouterResult {
  intent: string;
  confidence: number;
  language: string;
  sentiment: string;
  summary: string;
}

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
  private confidenceThreshold: number;

  constructor(claude: ClaudeAPI, promptBuilder: PromptBuilder, brainSearch: BrainSearch) {
    super('Router', 'router');
    this.claude = claude;
    this.promptBuilder = promptBuilder;
    this.brainSearch = brainSearch;

    // Load confidence threshold from config
    const routingRules = this.brainSearch.findRelevantBrainData('', 'router');
    const rules = routingRules.routingRules as { confidenceThreshold?: number } | undefined;
    this.confidenceThreshold = rules?.confidenceThreshold ?? 0.6;
  }

  async processMessage(
    message: Message,
    conversation: Conversation,
    _brain: Record<string, unknown>
  ): Promise<AgentResponse> {
    this.log('info', `Routing message: "${message.content.slice(0, 50)}..."`);

    let routerResult: RouterResult;

    try {
      const { systemPrompt, messages } = this.promptBuilder.buildRouterPrompt(
        message,
        conversation.messages
      );

      const response = await this.claude.chatJSON<RouterResult>({
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

    // If confidence is below threshold, use keyword fallback
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

  getRoutingMetadata(result: RouterResult): Record<string, unknown> {
    return {
      intent: result.intent,
      confidence: result.confidence,
      language: result.language,
      sentiment: result.sentiment,
    };
  }

  private keywordFallback(content: string): RouterResult {
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
        language: 'English',
        sentiment: 'neutral',
        summary: `Keyword match: ${bestMatch.intent}`,
      };
    }

    return {
      intent: 'support',
      confidence: 0.3,
      language: 'English',
      sentiment: 'neutral',
      summary: 'Default routing to support',
    };
  }
}
