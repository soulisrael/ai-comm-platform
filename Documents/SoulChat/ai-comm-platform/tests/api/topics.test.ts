import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTopicsRouter } from '../../src/api/routes/topics';
import { errorHandler } from '../../src/api/middleware/error-handler';
import { TopicRow, CustomAgentRow } from '../../src/database/db-types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

const topicRow: TopicRow = {
  id: 'topic-1',
  name: 'Pricing',
  description: 'Pricing info',
  content: { description: 'Our prices', faq: [], customFields: {} },
  is_shared: false,
  created_at: now,
  updated_at: now,
};

const sharedTopicRow: TopicRow = {
  ...topicRow,
  id: 'topic-2',
  name: 'FAQ',
  is_shared: true,
};

const agentRow: CustomAgentRow = {
  id: 'agent-1',
  name: 'Sales Agent',
  description: 'Handles sales',
  system_prompt: 'You are a sales agent.',
  routing_keywords: ['buy'],
  routing_description: 'Sales',
  handoff_rules: {},
  transfer_rules: {},
  settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
  is_default: false,
  active: true,
  created_at: now,
  updated_at: now,
};

// ─── Mock factories ──────────────────────────────────────────────────────────

function createMockTopicRepo() {
  return {
    findById: vi.fn().mockResolvedValue(topicRow),
    findAll: vi.fn().mockResolvedValue([topicRow, sharedTopicRow]),
    deleteById: vi.fn().mockResolvedValue(true),
    getShared: vi.fn().mockResolvedValue([sharedTopicRow]),
    getByAgent: vi.fn().mockResolvedValue([topicRow]),
    createTopic: vi.fn().mockResolvedValue(topicRow),
    updateTopic: vi.fn().mockResolvedValue(topicRow),
    getAgentsUsingTopic: vi.fn().mockResolvedValue([agentRow]),
  };
}

function createMockAgentRepo() {
  return {} as any;
}

function buildApp(
  topicRepo = createMockTopicRepo(),
  agentRepo = createMockAgentRepo()
) {
  const app = express();
  app.use(express.json());
  app.use('/api/topics', createTopicsRouter(topicRepo as any, agentRepo));
  app.use(errorHandler);
  return { app, topicRepo };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Topics API', () => {
  let app: express.Express;
  let topicRepo: ReturnType<typeof createMockTopicRepo>;

  beforeEach(() => {
    const built = buildApp();
    app = built.app;
    topicRepo = built.topicRepo;
  });

  describe('GET /api/topics', () => {
    it('should list all topics', async () => {
      const res = await request(app).get('/api/topics');
      expect(res.status).toBe(200);
      expect(res.body.topics).toHaveLength(2);
    });

    it('should filter shared topics', async () => {
      const res = await request(app).get('/api/topics?shared=true');
      expect(res.status).toBe(200);
      expect(topicRepo.getShared).toHaveBeenCalled();
    });

    it('should filter by agentId', async () => {
      const res = await request(app).get('/api/topics?agentId=agent-1');
      expect(res.status).toBe(200);
      expect(topicRepo.getByAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('POST /api/topics', () => {
    it('should create a topic', async () => {
      const res = await request(app)
        .post('/api/topics')
        .send({ name: 'New Topic', content: { description: 'Test' } });

      expect(res.status).toBe(201);
      expect(topicRepo.createTopic).toHaveBeenCalledWith({
        name: 'New Topic',
        content: { description: 'Test' },
      });
    });
  });

  describe('GET /api/topics/:id', () => {
    it('should return topic with agents', async () => {
      const res = await request(app).get('/api/topics/topic-1');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Pricing');
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].name).toBe('Sales Agent');
    });

    it('should return 404 for non-existent topic', async () => {
      topicRepo.findById.mockResolvedValue(null);
      const res = await request(app).get('/api/topics/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/topics/:id', () => {
    it('should update a topic', async () => {
      const res = await request(app)
        .put('/api/topics/topic-1')
        .send({ name: 'Updated Topic' });

      expect(res.status).toBe(200);
      expect(topicRepo.updateTopic).toHaveBeenCalledWith('topic-1', { name: 'Updated Topic' });
    });

    it('should return 404 for non-existent topic', async () => {
      topicRepo.findById.mockResolvedValue(null);
      const res = await request(app)
        .put('/api/topics/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/topics/:id', () => {
    it('should delete a topic', async () => {
      const res = await request(app).delete('/api/topics/topic-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent topic', async () => {
      topicRepo.findById.mockResolvedValue(null);
      const res = await request(app).delete('/api/topics/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/topics/:id/duplicate', () => {
    it('should duplicate a topic', async () => {
      const res = await request(app)
        .post('/api/topics/topic-1/duplicate')
        .send({ name: 'Pricing Copy' });

      expect(res.status).toBe(201);
      expect(topicRepo.createTopic).toHaveBeenCalled();
      const createCall = topicRepo.createTopic.mock.calls[0][0];
      expect(createCall.name).toBe('Pricing Copy');
    });

    it('should use default name if none provided', async () => {
      await request(app)
        .post('/api/topics/topic-1/duplicate')
        .send({});

      const createCall = topicRepo.createTopic.mock.calls[0][0];
      expect(createCall.name).toBe('Pricing (copy)');
    });

    it('should return 404 for non-existent topic', async () => {
      topicRepo.findById.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/topics/nonexistent/duplicate')
        .send({ name: 'Copy' });
      expect(res.status).toBe(404);
    });
  });
});
