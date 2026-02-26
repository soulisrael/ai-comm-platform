import logger from './logger';

// Sonnet pricing (per million tokens)
const SONNET_INPUT_PRICE = 3;      // $3/M input tokens
const SONNET_OUTPUT_PRICE = 15;    // $15/M output tokens
const SONNET_CACHED_INPUT_PRICE = 0.30; // $0.30/M cached input tokens

interface ApiCallRecord {
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  model: string;
  timestamp: Date;
}

export interface CostSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  cacheHitRate: number;
}

class CostTracker {
  private calls: ApiCallRecord[] = [];

  /**
   * Track an API call and log cost info.
   */
  trackApiCall(agentId: string, inputTokens: number, outputTokens: number, cacheHit: boolean, model: string): void {
    this.calls.push({
      agentId,
      inputTokens,
      outputTokens,
      cacheHit,
      model,
      timestamp: new Date(),
    });

    const inputCost = cacheHit
      ? (inputTokens / 1_000_000) * SONNET_CACHED_INPUT_PRICE
      : (inputTokens / 1_000_000) * SONNET_INPUT_PRICE;
    const outputCost = (outputTokens / 1_000_000) * SONNET_OUTPUT_PRICE;
    const totalCost = inputCost + outputCost;

    logger.info(
      `[COST] Agent:${agentId} | in:${inputTokens} out:${outputTokens} | cache:${cacheHit ? 'HIT' : 'MISS'} | ~$${totalCost.toFixed(4)}`
    );
  }

  /**
   * Get aggregated cost summary for the current day.
   */
  getDailyCost(): CostSummary {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCalls = this.calls.filter(c => c.timestamp >= today);
    return this.summarize(todayCalls);
  }

  /**
   * Get aggregated cost summary for a specific agent.
   */
  getAgentCost(agentId: string): CostSummary {
    const agentCalls = this.calls.filter(c => c.agentId === agentId);
    return this.summarize(agentCalls);
  }

  /**
   * Reset all tracked calls.
   */
  reset(): void {
    this.calls = [];
  }

  private summarize(calls: ApiCallRecord[]): CostSummary {
    if (calls.length === 0) {
      return {
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        estimatedCost: 0,
        cacheHitRate: 0,
      };
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let estimatedCost = 0;
    let cacheHits = 0;

    for (const call of calls) {
      totalInputTokens += call.inputTokens;
      totalOutputTokens += call.outputTokens;

      const inputCost = call.cacheHit
        ? (call.inputTokens / 1_000_000) * SONNET_CACHED_INPUT_PRICE
        : (call.inputTokens / 1_000_000) * SONNET_INPUT_PRICE;
      const outputCost = (call.outputTokens / 1_000_000) * SONNET_OUTPUT_PRICE;
      estimatedCost += inputCost + outputCost;

      if (call.cacheHit) cacheHits++;
    }

    return {
      totalCalls: calls.length,
      totalInputTokens,
      totalOutputTokens,
      estimatedCost,
      cacheHitRate: cacheHits / calls.length,
    };
  }
}

export const costTracker = new CostTracker();
