import { describe, it, expect, beforeEach } from 'vitest';
import { costTracker } from '../../src/services/cost-tracker';

describe('CostTracker', () => {
  beforeEach(() => {
    costTracker.reset();
  });

  describe('trackApiCall()', () => {
    it('should track an API call and store it', () => {
      costTracker.trackApiCall('agent-1', 1200, 150, false, 'claude-sonnet-4-5');

      const summary = costTracker.getDailyCost();
      expect(summary.totalCalls).toBe(1);
      expect(summary.totalInputTokens).toBe(1200);
      expect(summary.totalOutputTokens).toBe(150);
    });

    it('should track multiple calls', () => {
      costTracker.trackApiCall('agent-1', 1000, 100, false, 'claude-sonnet-4-5');
      costTracker.trackApiCall('agent-2', 500, 50, true, 'claude-sonnet-4-5');

      const summary = costTracker.getDailyCost();
      expect(summary.totalCalls).toBe(2);
      expect(summary.totalInputTokens).toBe(1500);
      expect(summary.totalOutputTokens).toBe(150);
    });
  });

  describe('getDailyCost()', () => {
    it('should return zero summary when no calls tracked', () => {
      const summary = costTracker.getDailyCost();
      expect(summary.totalCalls).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.estimatedCost).toBe(0);
      expect(summary.cacheHitRate).toBe(0);
    });

    it('should calculate estimated cost correctly for non-cached call', () => {
      // 1M input tokens = $3, 1M output tokens = $15
      costTracker.trackApiCall('agent-1', 1_000_000, 1_000_000, false, 'claude-sonnet-4-5');

      const summary = costTracker.getDailyCost();
      expect(summary.estimatedCost).toBeCloseTo(18, 2); // $3 + $15
    });

    it('should calculate estimated cost correctly for cached call', () => {
      // 1M cached input tokens = $0.30, 1M output tokens = $15
      costTracker.trackApiCall('agent-1', 1_000_000, 1_000_000, true, 'claude-sonnet-4-5');

      const summary = costTracker.getDailyCost();
      expect(summary.estimatedCost).toBeCloseTo(15.30, 2); // $0.30 + $15
    });

    it('should calculate cache hit rate correctly', () => {
      costTracker.trackApiCall('agent-1', 1000, 100, true, 'claude-sonnet-4-5');
      costTracker.trackApiCall('agent-1', 1000, 100, true, 'claude-sonnet-4-5');
      costTracker.trackApiCall('agent-1', 1000, 100, false, 'claude-sonnet-4-5');

      const summary = costTracker.getDailyCost();
      expect(summary.cacheHitRate).toBeCloseTo(2 / 3, 4);
    });
  });

  describe('getAgentCost()', () => {
    it('should return cost summary for a specific agent', () => {
      costTracker.trackApiCall('agent-1', 1000, 100, false, 'claude-sonnet-4-5');
      costTracker.trackApiCall('agent-2', 500, 50, true, 'claude-sonnet-4-5');
      costTracker.trackApiCall('agent-1', 800, 200, true, 'claude-sonnet-4-5');

      const agent1Summary = costTracker.getAgentCost('agent-1');
      expect(agent1Summary.totalCalls).toBe(2);
      expect(agent1Summary.totalInputTokens).toBe(1800);
      expect(agent1Summary.totalOutputTokens).toBe(300);
      expect(agent1Summary.cacheHitRate).toBe(0.5);

      const agent2Summary = costTracker.getAgentCost('agent-2');
      expect(agent2Summary.totalCalls).toBe(1);
      expect(agent2Summary.totalInputTokens).toBe(500);
      expect(agent2Summary.totalOutputTokens).toBe(50);
      expect(agent2Summary.cacheHitRate).toBe(1);
    });

    it('should return zero summary for unknown agent', () => {
      costTracker.trackApiCall('agent-1', 1000, 100, false, 'claude-sonnet-4-5');

      const summary = costTracker.getAgentCost('nonexistent');
      expect(summary.totalCalls).toBe(0);
      expect(summary.estimatedCost).toBe(0);
    });
  });

  describe('reset()', () => {
    it('should clear all tracked calls', () => {
      costTracker.trackApiCall('agent-1', 1000, 100, false, 'claude-sonnet-4-5');
      costTracker.trackApiCall('agent-2', 500, 50, true, 'claude-sonnet-4-5');

      costTracker.reset();

      const summary = costTracker.getDailyCost();
      expect(summary.totalCalls).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
    });
  });
});
