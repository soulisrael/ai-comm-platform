import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import { createApp } from '../../src/api/server';
import { ClaudeAPI } from '../../src/services/claude-api';
import { vi } from 'vitest';

function createMockClaude(): ClaudeAPI {
  return {
    chat: vi.fn().mockResolvedValue({ content: 'Ok', inputTokens: 10, outputTokens: 5, model: 'test' }),
    chatJSON: vi.fn().mockResolvedValue({
      content: { intent: 'support', confidence: 0.9, reasoning: 'test' },
      inputTokens: 10, outputTokens: 5, model: 'test',
    }),
  } as unknown as ClaudeAPI;
}

let app: Awaited<ReturnType<typeof createApp>>['app'];

beforeEach(async () => {
  const brainPath = path.resolve(__dirname, '../../brain');
  const result = await createApp({ claude: createMockClaude(), brainPath, skipAuth: true });
  app = result.app;
});

describe('Automation API', () => {
  // ── Flows ─────────────────────────────────────────

  describe('POST /api/automation/flows', () => {
    it('creates a new flow', async () => {
      const res = await request(app)
        .post('/api/automation/flows')
        .send({
          name: 'Test Flow',
          trigger: 'message_received',
          triggerConfig: {},
          steps: [{ id: 's1', action: { type: 'send_message', config: { content: 'Hi' } } }],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Flow');
      expect(res.body.active).toBe(false);
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/automation/flows')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/automation/flows', () => {
    it('lists all flows', async () => {
      await request(app)
        .post('/api/automation/flows')
        .send({ name: 'Flow 1', trigger: 'message_received' });

      const res = await request(app).get('/api/automation/flows');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/automation/flows/:id', () => {
    it('returns 404 for non-existent flow', async () => {
      const res = await request(app).get('/api/automation/flows/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/automation/flows/:id', () => {
    it('updates a flow', async () => {
      const create = await request(app)
        .post('/api/automation/flows')
        .send({ name: 'Original', trigger: 'message_received' });

      const res = await request(app)
        .put(`/api/automation/flows/${create.body.id}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });
  });

  describe('DELETE /api/automation/flows/:id', () => {
    it('deletes a flow', async () => {
      const create = await request(app)
        .post('/api/automation/flows')
        .send({ name: 'Delete Me', trigger: 'message_received' });

      const res = await request(app)
        .delete(`/api/automation/flows/${create.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });

  describe('POST /api/automation/flows/:id/activate', () => {
    it('activates a flow', async () => {
      const create = await request(app)
        .post('/api/automation/flows')
        .send({ name: 'Activate Me', trigger: 'message_received' });

      const res = await request(app)
        .post(`/api/automation/flows/${create.body.id}/activate`);

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(true);
    });
  });

  describe('POST /api/automation/flows/:id/deactivate', () => {
    it('deactivates a flow', async () => {
      const create = await request(app)
        .post('/api/automation/flows')
        .send({ name: 'Deactivate Me', trigger: 'message_received' });

      await request(app)
        .post(`/api/automation/flows/${create.body.id}/activate`);

      const res = await request(app)
        .post(`/api/automation/flows/${create.body.id}/deactivate`);

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
    });
  });

  // ── Broadcasts ────────────────────────────────────

  describe('POST /api/automation/broadcasts', () => {
    it('creates a broadcast', async () => {
      const res = await request(app)
        .post('/api/automation/broadcasts')
        .send({
          name: 'Test Broadcast',
          target: { channel: 'whatsapp' },
          message: { content: 'Hello everyone!' },
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Broadcast');
      expect(res.body.status).toBe('draft');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/automation/broadcasts')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/automation/broadcasts', () => {
    it('lists broadcasts', async () => {
      const res = await request(app).get('/api/automation/broadcasts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/automation/broadcasts/:id/cancel', () => {
    it('cancels a broadcast', async () => {
      const create = await request(app)
        .post('/api/automation/broadcasts')
        .send({
          name: 'Cancel Me',
          target: {},
          message: { content: 'Hi' },
        });

      const res = await request(app)
        .post(`/api/automation/broadcasts/${create.body.id}/cancel`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });
  });

  // ── Templates ─────────────────────────────────────

  describe('POST /api/automation/templates', () => {
    it('creates a template', async () => {
      const res = await request(app)
        .post('/api/automation/templates')
        .send({
          name: 'welcome',
          content: 'Hello {name}, welcome!',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('welcome');
      expect(res.body.variables).toEqual(['name']);
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/automation/templates')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/automation/templates', () => {
    it('lists templates', async () => {
      await request(app)
        .post('/api/automation/templates')
        .send({ name: 'test', content: 'Hi' });

      const res = await request(app).get('/api/automation/templates');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PUT /api/automation/templates/:id', () => {
    it('updates a template', async () => {
      const create = await request(app)
        .post('/api/automation/templates')
        .send({ name: 'editable', content: 'Old content' });

      const res = await request(app)
        .put(`/api/automation/templates/${create.body.id}`)
        .send({ content: 'New content with {var}' });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('New content with {var}');
      expect(res.body.variables).toEqual(['var']);
    });
  });

  describe('DELETE /api/automation/templates/:id', () => {
    it('deletes a template', async () => {
      const create = await request(app)
        .post('/api/automation/templates')
        .send({ name: 'deleteme', content: 'bye' });

      const res = await request(app)
        .delete(`/api/automation/templates/${create.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});
