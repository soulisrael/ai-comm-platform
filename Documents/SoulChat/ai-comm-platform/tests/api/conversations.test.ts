import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import { createApp } from '../../src/api/server';
import { ClaudeAPI } from '../../src/services/claude-api';

function createMockClaude(): ClaudeAPI {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Hello! How can I help?',
      inputTokens: 200, outputTokens: 100, model: 'test',
    }),
    chatJSON: vi.fn().mockResolvedValue({
      data: { intent: 'support', confidence: 0.9, language: 'English', sentiment: 'neutral', summary: 'Support' },
      inputTokens: 100, outputTokens: 50, model: 'test',
    }),
    getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
    resetUsage: vi.fn(),
  } as unknown as ClaudeAPI;
}

describe('Conversations API', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let convId: string;

  beforeEach(async () => {
    const brainPath = path.resolve(__dirname, '../../brain');
    const result = await createApp({ claude: createMockClaude(), brainPath, skipAuth: true });
    app = result.app;

    // Create a conversation first
    const res = await request(app)
      .post('/api/messages/incoming')
      .send({ channelUserId: 'conv-test-user', channel: 'web', content: 'Hello' });
    convId = res.body.conversationId;
  });

  describe('GET /api/conversations', () => {
    it('should list conversations', async () => {
      const res = await request(app).get('/api/conversations');

      expect(res.status).toBe(200);
      expect(res.body.conversations).toBeDefined();
      expect(res.body.conversations.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const res = await request(app).get('/api/conversations?page=1&limit=1');

      expect(res.status).toBe(200);
      expect(res.body.conversations.length).toBeLessThanOrEqual(1);
      expect(res.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should return conversation details', async () => {
      const res = await request(app).get(`/api/conversations/${convId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(convId);
      expect(res.body.messages).toBeDefined();
    });

    it('should return 404 for non-existent conversation', async () => {
      const res = await request(app).get('/api/conversations/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/conversations/:id/handoff', () => {
    it('should trigger handoff', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/handoff`)
        .send({ reason: 'Customer request' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('handoff');
    });
  });

  describe('POST /api/conversations/:id/takeover', () => {
    it('should allow human takeover', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/takeover`)
        .send({ humanAgentId: 'agent-1' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('human_active');
    });

    it('should require humanAgentId', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/takeover`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/conversations/:id/pause', () => {
    it('should pause AI', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/pause`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('paused');
    });
  });

  describe('POST /api/conversations/:id/resume', () => {
    it('should resume AI', async () => {
      await request(app).post(`/api/conversations/${convId}/pause`);
      const res = await request(app)
        .post(`/api/conversations/${convId}/resume`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });

  describe('POST /api/conversations/:id/reply', () => {
    it('should allow human reply when in handoff', async () => {
      await request(app)
        .post(`/api/conversations/${convId}/handoff`)
        .send({});

      const res = await request(app)
        .post(`/api/conversations/${convId}/reply`)
        .send({ agentId: 'agent-1', message: 'Hi, I can help!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject reply when conversation is active (AI-controlled)', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/reply`)
        .send({ agentId: 'agent-1', message: 'Hi' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS');
    });
  });

  describe('POST /api/conversations/:id/close', () => {
    it('should close conversation', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/close`)
        .send({ reason: 'resolved' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('closed');
    });
  });

  describe('POST /api/conversations/:id/switch-agent', () => {
    it('should switch agent type', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/switch-agent`)
        .send({ agentType: 'sales' });

      expect(res.status).toBe(200);
      expect(res.body.agentType).toBe('sales');
    });

    it('should reject invalid agent type', async () => {
      const res = await request(app)
        .post(`/api/conversations/${convId}/switch-agent`)
        .send({ agentType: 'invalid' });

      expect(res.status).toBe(400);
    });
  });
});
