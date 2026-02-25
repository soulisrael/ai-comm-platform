import { describe, it, expect } from 'vitest';
import {
  messagesTotal,
  claudeApiCalls,
  conversationsActive,
  handoffTotal,
  register,
} from '../../src/services/monitoring';

describe('Monitoring', () => {
  it('increments messages_total counter', async () => {
    messagesTotal.inc({ channel: 'whatsapp', direction: 'inbound' });
    messagesTotal.inc({ channel: 'whatsapp', direction: 'outbound' });
    messagesTotal.inc({ channel: 'telegram', direction: 'inbound' });

    const metrics = await register.getMetricsAsJSON();
    const msgMetric = metrics.find(m => m.name === 'messages_total');
    expect(msgMetric).toBeDefined();
  });

  it('increments claude_api_calls counter', async () => {
    claudeApiCalls.inc({ agent_type: 'sales' });

    const metrics = await register.getMetricsAsJSON();
    const apiMetric = metrics.find(m => m.name === 'claude_api_calls_total');
    expect(apiMetric).toBeDefined();
  });

  it('tracks conversations_active gauge', async () => {
    conversationsActive.set(5);
    const metrics = await register.getMetricsAsJSON();
    const activeMetric = metrics.find(m => m.name === 'conversations_active');
    expect(activeMetric).toBeDefined();
  });

  it('increments handoff_total counter', async () => {
    handoffTotal.inc();
    const metrics = await register.getMetricsAsJSON();
    const handoffMetric = metrics.find(m => m.name === 'handoff_total');
    expect(handoffMetric).toBeDefined();
  });

  it('exposes metrics in prometheus text format', async () => {
    const text = await register.metrics();
    expect(text).toContain('messages_total');
    expect(text).toContain('conversations_active');
  });
});
