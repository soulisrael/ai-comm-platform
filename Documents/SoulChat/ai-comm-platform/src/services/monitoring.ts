import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import { Request, Response } from 'express';
import logger from './logger';

// Global registry
const register = new Registry();
collectDefaultMetrics({ register });

// ── Counters ──────────────────────────────────────────

export const messagesTotal = new Counter({
  name: 'messages_total',
  help: 'Total messages processed',
  labelNames: ['channel', 'direction'] as const,
  registers: [register],
});

export const claudeApiCalls = new Counter({
  name: 'claude_api_calls_total',
  help: 'Total Claude API calls',
  labelNames: ['agent_type'] as const,
  registers: [register],
});

export const claudeApiTokens = new Counter({
  name: 'claude_api_tokens_used',
  help: 'Total tokens consumed by Claude API',
  labelNames: ['type'] as const,
  registers: [register],
});

export const handoffTotal = new Counter({
  name: 'handoff_total',
  help: 'Total handoff events',
  registers: [register],
});

// ── Gauges ────────────────────────────────────────────

export const conversationsActive = new Gauge({
  name: 'conversations_active',
  help: 'Currently active conversations',
  registers: [register],
});

// ── Histograms ────────────────────────────────────────

export const agentResponseTime = new Histogram({
  name: 'agent_response_time_seconds',
  help: 'Agent response time in seconds',
  labelNames: ['agent_type'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const webhookProcessingTime = new Histogram({
  name: 'webhook_processing_time_seconds',
  help: 'Webhook processing time in seconds',
  labelNames: ['channel'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// ── Metrics endpoint ──────────────────────────────────

export function metricsHandler(_req: Request, res: Response): void {
  register.metrics().then(metrics => {
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  }).catch(err => {
    logger.error('Metrics error:', err);
    res.status(500).end();
  });
}

export { register };
