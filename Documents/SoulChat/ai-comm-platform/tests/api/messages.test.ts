import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import { createApp } from '../../src/api/server';
import { ClaudeAPI } from '../../src/services/claude-api';

function createMockClaude(): ClaudeAPI {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Hello! How can I help you today?',
      inputTokens: 200, outputTokens: 100, model: 'test',
    }),
    chatJSON: vi.fn().mockResolvedValue({
      data: { intent: 'sales', confidence: 0.9, language: 'English', sentiment: 'positive', summary: 'Sales inquiry' },
      inputTokens: 100, outputTokens: 50, model: 'test',
    }),
    getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
    resetUsage: vi.fn(),
  } as unknown as ClaudeAPI;
}

describe('Messages API', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];

  beforeEach(async () => {
    const brainPath = path.resolve(__dirname, '../../brain');
    const result = await createApp({ claude: createMockClaude(), brainPath, skipAuth: true });
    app = result.app;
  });

  describe('POST /api/messages/incoming', () => {
    it('should process an incoming message', async () => {
      const res = await request(app)
        .post('/api/messages/incoming')
        .send({
          channelUserId: 'test-user-001',
          channel: 'web',
          content: 'I want to buy something',
          senderName: 'Test User',
        });

      expect(res.status).toBe(200);
      expect(res.body.conversationId).toBeDefined();
      expect(res.body.response).toBeDefined();
      expect(res.body.agent).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/messages/incoming')
        .send({ channelUserId: 'test-user' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid channel', async () => {
      const res = await request(app)
        .post('/api/messages/incoming')
        .send({
          channelUserId: 'test-user',
          channel: 'invalid',
          content: 'Hello',
        });

      expect(res.status).toBe(400);
    });

    it('should reuse conversation for same user', async () => {
      const res1 = await request(app)
        .post('/api/messages/incoming')
        .send({ channelUserId: 'user-reuse', channel: 'web', content: 'Hello' });

      const res2 = await request(app)
        .post('/api/messages/incoming')
        .send({ channelUserId: 'user-reuse', channel: 'web', content: 'Tell me more' });

      expect(res1.body.conversationId).toBe(res2.body.conversationId);
    });
  });
});
