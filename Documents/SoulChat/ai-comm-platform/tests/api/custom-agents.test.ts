import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createCustomAgentsRouter } from '../../src/api/routes/custom-agents';
import { errorHandler } from '../../src/api/middleware/error-handler';
import { CustomAgentRow, AgentBrainRow } from '../../src/database/db-types';
import { BrainEntry } from '../../src/types/custom-agent';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

const agentRow: CustomAgentRow = {
  id: 'agent-1',
  name: 'Sales Agent',
  description: 'Handles sales',
  system_prompt: 'You are a sales agent.',
  main_document_text: null,
  main_document_filename: null,
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

const brainEntry: BrainEntry = {
  id: 'brain-1',
  agentId: 'agent-1',
  title: 'Pricing',
  content: 'Our prices start at $10/month.',
  category: 'product',
  metadata: {},
  sortOrder: 0,
  active: true,
  createdAt: new Date(now),
  updatedAt: new Date(now),
};

// ─── Mock factories ──────────────────────────────────────────────────────────

function createMockAgentRepo() {
  return {
    findById: vi.fn().mockResolvedValue(agentRow),
    findAll: vi.fn().mockResolvedValue([agentRow]),
    deleteById: vi.fn().mockResolvedValue(true),
    getActive: vi.fn().mockResolvedValue([agentRow]),
    getWithBrain: vi.fn().mockResolvedValue({ ...agentRow, name: 'Sales Agent', brain: [brainEntry] }),
    getAllWithBrain: vi.fn().mockResolvedValue([{ ...agentRow, name: 'Sales Agent', brain: [brainEntry] }]),
    createAgent: vi.fn().mockResolvedValue(agentRow),
    updateAgent: vi.fn().mockResolvedValue(agentRow),
  };
}

function createMockBrainRepo() {
  return {
    getByAgent: vi.fn().mockResolvedValue([brainEntry]),
    duplicateForAgent: vi.fn().mockResolvedValue([brainEntry]),
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
  brainRepo = createMockBrainRepo(),
  runner = createMockRunner(),
  claude = createMockClaude()
) {
  const app = express();
  app.use(express.json());
  app.use('/api/custom-agents', createCustomAgentsRouter(agentRepo as any, brainRepo as any, runner as any, claude));
  app.use(errorHandler);
  return { app, agentRepo, brainRepo, runner };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Custom Agents API', () => {
  let app: express.Express;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;
  let brainRepo: ReturnType<typeof createMockBrainRepo>;
  let runner: ReturnType<typeof createMockRunner>;

  beforeEach(() => {
    const built = buildApp();
    app = built.app;
    agentRepo = built.agentRepo;
    brainRepo = built.brainRepo;
    runner = built.runner;
  });

  describe('GET /api/custom-agents', () => {
    it('should list all agents with brain entry counts', async () => {
      const res = await request(app).get('/api/custom-agents');
      expect(res.status).toBe(200);
      expect(res.body.agents).toHaveLength(1);
      expect(res.body.agents[0].name).toBe('Sales Agent');
      expect(res.body.agents[0].brainEntryCount).toBe(1);
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
    it('should return agent with brain entries', async () => {
      const res = await request(app).get('/api/custom-agents/agent-1');
      expect(res.status).toBe(200);
      expect(res.body.brain).toHaveLength(1);
      expect(agentRepo.getWithBrain).toHaveBeenCalledWith('agent-1');
    });

    it('should return 404 for non-existent agent', async () => {
      agentRepo.getWithBrain.mockResolvedValue(null);
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
    it('should duplicate an agent with brain entries', async () => {
      const newRow = { ...agentRow, id: 'agent-new' };
      agentRepo.createAgent.mockResolvedValue(newRow);
      agentRepo.getWithBrain
        .mockResolvedValueOnce({ ...agentRow, name: 'Sales Agent', brain: [brainEntry] })
        .mockResolvedValueOnce({ ...newRow, name: 'Sales Agent', brain: [brainEntry] });

      const res = await request(app)
        .post('/api/custom-agents/agent-1/duplicate')
        .send({ name: 'Copied Agent' });

      expect(res.status).toBe(201);
      expect(agentRepo.createAgent).toHaveBeenCalled();
      expect(brainRepo.duplicateForAgent).toHaveBeenCalledWith('agent-1', 'agent-new');
    });

    it('should use default name if none provided', async () => {
      agentRepo.getWithBrain.mockResolvedValue({ ...agentRow, name: 'Sales Agent', brain: [] });
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
});
