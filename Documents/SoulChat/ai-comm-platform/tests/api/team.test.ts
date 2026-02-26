import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../../src/api/server';
import { ClaudeAPI } from '../../src/services/claude-api';

function createMockClaude(): ClaudeAPI {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Hello!', inputTokens: 200, outputTokens: 100, model: 'test',
    }),
    chatJSON: vi.fn().mockResolvedValue({
      data: { intent: 'support', confidence: 0.9, language: 'English', sentiment: 'neutral', summary: 'Support' },
      inputTokens: 100, outputTokens: 50, model: 'test',
    }),
    getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
    resetUsage: vi.fn(),
  } as unknown as ClaudeAPI;
}

describe('Team API', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let teamRepo: Awaited<ReturnType<typeof createApp>>['teamRepo'];

  beforeEach(async () => {
    const result = await createApp({ claude: createMockClaude(), skipAuth: true });
    app = result.app;
    teamRepo = result.teamRepo;
  });

  describe('POST /api/team/login', () => {
    it('should reject invalid credentials', async () => {
      if (!teamRepo) return; // Skip if no Supabase
      const res = await request(app)
        .post('/api/team/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/team/members', () => {
    it('should list team members', async () => {
      if (!teamRepo) return;
      const res = await request(app).get('/api/team/members');

      expect(res.status).toBe(200);
      expect(res.body.members).toBeDefined();
      expect(Array.isArray(res.body.members)).toBe(true);
    });
  });

  describe('GET /api/team/members/available', () => {
    it('should list available team members', async () => {
      if (!teamRepo) return;
      const res = await request(app).get('/api/team/members/available');

      expect(res.status).toBe(200);
      expect(res.body.members).toBeDefined();
    });
  });

  describe('POST /api/team/members', () => {
    it('should reject short password', async () => {
      if (!teamRepo) return;
      const res = await request(app)
        .post('/api/team/members')
        .send({ email: 'test@test.com', name: 'Test', password: '12' });

      expect(res.status).toBe(400);
    });
  });
});
