import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createCustomAgentsRouter } from '../../src/api/routes/custom-agents';
import { errorHandler } from '../../src/api/middleware/error-handler';
import { CustomAgentRow, TopicRow } from '../../src/database/db-types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

const agentRow: CustomAgentRow = {
  id: 'agent-1',
  name: 'Sales Agent',
  description: 'Handles sales',
  system_prompt: 'You are a sales agent.',
  routing_keywords: ['buy', 'price'],
  routing_description: 'Handles sales inquiries',
  handoff_rules: {},
  transfer_rules: {},
  settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
  is_default: false,
  active: true,
  created_at: now,
  updated_at: now,
};

const topicRow: TopicRow = {
  id: 'topic-1',
  name: 'Pricing',
  description: 'Pricing info',
  content: { description: 'Our prices', faq: [], customFields: {} },
  is_shared: false,
  created_at: now,
  updated_at: now,
};

// ─── Mock factories ──────────────────────────────────────────────────────────

function createMockAgentRepo() {
  return {
    findById: vi.fn().mockResolvedValue(agentRow),
    findAll: vi.fn().mockResolvedValue([agentRow]),
    deleteById: vi.fn().mockResolvedValue(true),
    getActive: vi.fn().mockResolvedValue([agentRow]),
    getWithTopics: vi.fn().mockResolvedValue({ ...agentRow, topics: [topicRow] }),
    getAllWithTopics: vi.fn().mockResolvedValue([{ ...agentRow, topics: [topicRow] }]),
    createAgent: vi.fn().mockResolvedValue(agentRow),
    updateAgent: vi.fn().mockResolvedValue(agentRow),
    assignTopic: vi.fn().mockResolvedValue(undefined),
    removeTopic: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockTopicRepo() {
  return {
    findById: vi.fn().mockResolvedValue(topicRow),
    findAll: vi.fn().mockResolvedValue([topicRow]),
    getByAgent: vi.fn().mockResolvedValue([topicRow]),
    getShared: vi.fn().mockResolvedValue([topicRow]),
  };
}

function createMockRunner() {
  return {
    run: vi.fn().mockResolvedValue({
      message: 'Test response',
      shouldHandoff: false,
      shouldTransfer: false,
      confidence: 0.85,
    }),
  };
}

function createMockClaude() {
  return {} as any;
}

function buildApp(
  agentRepo = createMockAgentRepo(),
  topicRepo = createMockTopicRepo(),
  runner = createMockRunner(),
  claude = createMockClaude()
) {
  const app = express();
  app.use(express.json());
  app.use('/api/custom-agents', createCustomAgentsRouter(agentRepo as any, topicRepo as any, runner as any, claude));
  app.use(errorHandler);
  return { app, agentRepo, topicRepo, runner };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Custom Agents API', () => {
  let app: express.Express;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;
  let topicRepo: ReturnType<typeof createMockTopicRepo>;
  let runner: ReturnType<typeof createMockRunner>;

  beforeEach(() => {
    const built = buildApp();
    app = built.app;
    agentRepo = built.agentRepo;
    topicRepo = built.topicRepo;
    runner = built.runner;
  });

  describe('GET /api/custom-agents', () => {
    it('should list all agents with topic counts', async () => {
      const res = await request(app).get('/api/custom-agents');
      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].name).toBe('Sales Agent');
      expect(res.body.agents[0].topicCount).toBe(1);
    });

    it('should filter active agents', async () => {
      const res = await request(app).get('/api/custom-agents?active=true');
      expect(res.status).toBe(200);
      expect(agentRepo.getActive).toHaveBeenCalled();
    });

    it('should filter inactive agents', async () => {
      agentRepo.findAll.mockResolvedValue([
        { ...agentRow, active: false },
        { ...agentRow, id: 'agent-2', active: true },
      ]);
      const res = await request(app).get('/api/custom-agents?active=false');
      expect(res.status).toBe(200);
      expect(res.body.agents.every((a: any) => !a.active)).toBe(true);
    });
  });

  describe('POST /api/custom-agents', () => {
    it('should create an agent', async () => {
      const res = await request(app)
        .post('/api/custom-agents')
        .send({ name: 'New Agent' });
      expect(res.status).toBe(201);
      expect(agentRepo.createAgent).toHaveBeenCalledWith({ name: 'New Agent' });
    });
  });

  describe('GET /api/custom-agents/:id', () => {
    it('should return agent with topics', async () => {
      const res = await request(app).get('/api/custom-agents/agent-1');
      expect(res.status).toBe(200);
      expect(res.body.topics).toHaveLength(1);
      expect(agentRepo.getWithTopics).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.getWithTopics.mockResolvedValue(null);
      const res = await request(app).get('/api/custom-agents/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/custom-agents/:id', () => {
    it('should update an agent', async () => {
      const res = await request(app)
        .put('/api/custom-agents/agent-1')
        .send({ name: 'Updated Agent' });
      expect(res.status).toBe(200);
      expect(agentRepo.updateAgent).toHaveBeenCalledWith('agent-1', { name: 'Updated Agent' });
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      const res = await request(app)
        .put('/api/custom-agents/nonexistent')
        .send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/custom-agents/:id', () => {
    it('should delete an agent', async () => {
      const res = await request(app).delete('/api/custom-agents/agent-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(agentRepo.deleteById).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      const res = await request(app).delete('/api/custom-agents/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/custom-agents/:id/duplicate', () => {
    it('should duplicate an agent with topics', async () => {
      const newRow = { ...agentRow, id: 'agent-new' };
      agentRepo.createAgent.mockResolvedValue(newRow);
      agentRepo.getWithTopics.mockResolvedValueOnce({ ...agentRow, topics: [topicRow] })
        .mockResolvedValueOnce({ ...newRow, topics: [topicRow] });

      const res = await request(app)
        .post('/api/custom-agents/agent-1/duplicate')
        .send({ name: 'Copied Agent' });

      expect(res.status).toBe(201);
      expect(agentRepo.createAgent).toHaveBeenCalled();
      expect(agentRepo.assignTopic).toHaveBeenCalledWith('agent-new', 'topic-1');
    });

    it('should use default name if none provided', async () => {
      agentRepo.getWithTopics.mockResolvedValue({ ...agentRow, topics: [] });
      agentRepo.createAgent.mockResolvedValue({ ...agentRow, id: 'agent-dup' });

      await request(app).post('/api/custom-agents/agent-1/duplicate').send({});

      const createCall = agentRepo.createAgent.mock.calls[0][0];
      expect(createCall.name).toBe('Sales Agent (copy)');
    });
  });

  describe('POST /api/custom-agents/:id/test', () => {
    it('should test agent with a message', async () => {
      const res = await request(app)
        .post('/api/custom-agents/agent-1/test')
        .send({ message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.response).toBe('Test response');
      expect(res.body.confidence).toBe(0.85);
      expect(runner.run).toHaveBeenCalledWith('agent-1', 'Hello', []);
    });

    it('should require message', async () => {
      const res = await request(app)
        .post('/api/custom-agents/agent-1/test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/custom-agents/nonexistent/test')
        .send({ message: 'Hello' });

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/custom-agents/:id/activate', () => {
    it('should activate an agent', async () => {
      const res = await request(app).put('/api/custom-agents/agent-1/activate');
      expect(res.status).toBe(200);
      expect(agentRepo.updateAgent).toHaveBeenCalledWith('agent-1', { active: true });
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      const res = await request(app).put('/api/custom-agents/nonexistent/activate');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/custom-agents/:id/deactivate', () => {
    it('should deactivate an agent', async () => {
      const res = await request(app).put('/api/custom-agents/agent-1/deactivate');
      expect(res.status).toBe(200);
      expect(agentRepo.updateAgent).toHaveBeenCalledWith('agent-1', { active: false });
    });
  });

  describe('GET /api/custom-agents/:id/topics', () => {
    it('should list topics linked to agent', async () => {
      const res = await request(app).get('/api/custom-agents/agent-1/topics');
      expect(res.status).toBe(200);
      expect(res.body.topics).toHaveLength(1);
      expect(topicRepo.getByAgent).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      const res = await request(app).get('/api/custom-agents/nonexistent/topics');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/custom-agents/:id/topics', () => {
    it('should link a topic to an agent', async () => {
      const res = await request(app)
        .post('/api/custom-agents/agent-1/topics')
        .send({ topicId: 'topic-1' });

      expect(res.status).toBe(201);
      expect(agentRepo.assignTopic).toHaveBeenCalledWith('agent-1', 'topic-1');
    });

    it('should require topicId', async () => {
      const res = await request(app)
        .post('/api/custom-agents/agent-1/topics')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 if topic does not exist', async () => {
      topicRepo.findById.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/custom-agents/agent-1/topics')
        .send({ topicId: 'nonexistent' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/custom-agents/:id/topics/:topicId', () => {
    it('should unlink a topic from an agent', async () => {
      const res = await request(app)
        .delete('/api/custom-agents/agent-1/topics/topic-1');

      expect(res.status).toBe(200);
      expect(agentRepo.removeTopic).toHaveBeenCalledWith('agent-1', 'topic-1');
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.findById.mockResolvedValue(null);
      const res = await request(app)
        .delete('/api/custom-agents/nonexistent/topics/topic-1');

      expect(res.status).toBe(404);
    });
  });
});
