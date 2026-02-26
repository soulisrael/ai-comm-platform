import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/server';
import { ClaudeAPI } from '../../src/services/claude-api';

function createMockClaude(): ClaudeAPI {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Hello!',
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

describe('Contacts API', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];
  let contactId: string;
  const uniqueUserId = `contact-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeEach(async () => {
    const result = await createApp({ claude: createMockClaude(), skipAuth: true });
    app = result.app;

    // Create a contact by sending a message
    await request(app)
      .post('/api/messages/incoming')
      .send({ channelUserId: uniqueUserId, channel: 'web', content: 'Hello', senderName: 'Test Person' });

    // Get contacts and find the one we just created
    const contactsRes = await request(app).get(`/api/contacts?search=Test Person`);
    const match = contactsRes.body.contacts.find((c: any) => c.channelUserId === uniqueUserId);
    contactId = match?.id || contactsRes.body.contacts[0].id;
  });

  describe('GET /api/contacts', () => {
    it('should list contacts', async () => {
      const res = await request(app).get('/api/contacts');

      expect(res.status).toBe(200);
      expect(res.body.contacts).toBeDefined();
      expect(res.body.contacts.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('should search contacts by name', async () => {
      const res = await request(app).get('/api/contacts?search=Test');

      expect(res.status).toBe(200);
      expect(res.body.contacts.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/contacts/:id', () => {
    it('should return contact with conversations', async () => {
      const res = await request(app).get(`/api/contacts/${contactId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(contactId);
      expect(res.body.name).toBe('Test Person');
      expect(res.body.conversations).toBeDefined();
    });

    it('should return 404 for non-existent contact', async () => {
      const res = await request(app).get('/api/contacts/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/contacts/:id', () => {
    it('should update contact info', async () => {
      const res = await request(app)
        .put(`/api/contacts/${contactId}`)
        .send({ email: 'test@example.com', phone: '+1234567890' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
      expect(res.body.phone).toBe('+1234567890');
    });
  });

  describe('POST /api/contacts/:id/tags', () => {
    it('should add a tag', async () => {
      const res = await request(app)
        .post(`/api/contacts/${contactId}/tags`)
        .send({ tag: 'vip' });

      expect(res.status).toBe(200);
      expect(res.body.tags).toContain('vip');
    });

    it('should require tag field', async () => {
      const res = await request(app)
        .post(`/api/contacts/${contactId}/tags`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/contacts/:id/tags/:tag', () => {
    it('should remove a tag', async () => {
      // Add then remove
      await request(app)
        .post(`/api/contacts/${contactId}/tags`)
        .send({ tag: 'to-remove' });

      const res = await request(app)
        .delete(`/api/contacts/${contactId}/tags/to-remove`);

      expect(res.status).toBe(200);
      expect(res.body.tags).not.toContain('to-remove');
    });
  });
});
