import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAgentBrainRouter } from '../../src/api/routes/brain';
import { errorHandler } from '../../src/api/middleware/error-handler';
import { BrainRepository } from '../../src/database/repositories/brain-repository';

function createMockBrainRepo() {
  const entries = [
    { id: 'brain-1', agentId: 'agent-1', title: 'FAQ', content: 'How to start', category: 'faq', metadata: {}, sortOrder: 0, active: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 'brain-2', agentId: 'agent-1', title: 'Script', content: 'Hello script', category: 'script', metadata: {}, sortOrder: 1, active: true, createdAt: new Date(), updatedAt: new Date() },
  ];

  return {
    getByAgent: vi.fn().mockResolvedValue(entries),
    getByAgentAndCategory: vi.fn().mockResolvedValue([entries[0]]),
    findById: vi.fn().mockImplementation(async (id: string) => {
      return entries.find(e => e.id === id) || null;
    }),
    createEntry: vi.fn().mockResolvedValue({
      id: 'brain-new', agentId: 'agent-1', title: 'New', content: 'New entry', category: 'general', metadata: {}, sortOrder: 2, active: true, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateEntry: vi.fn().mockResolvedValue({
      id: 'brain-1', agentId: 'agent-1', title: 'Updated FAQ', content: 'Updated', category: 'faq', metadata: {}, sortOrder: 0, active: true, createdAt: new Date(), updatedAt: new Date(),
    }),
    deleteById: vi.fn().mockResolvedValue(true),
    reorder: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrainRepository;
}

describe('Agent Brain API (nested routes)', () => {
  let app: express.Express;
  let brainRepo: ReturnType<typeof createMockBrainRepo>;

  beforeEach(() => {
    brainRepo = createMockBrainRepo();
    app = express();
    app.use(express.json());
    // Mount like server.ts would
    const agentRouter = express.Router();
    agentRouter.use('/:agentId/brain', createAgentBrainRouter(brainRepo as any));
    app.use('/api/custom-agents', agentRouter);
    app.use(errorHandler);
  });

  describe('GET /api/custom-agents/:agentId/brain', () => {
    it('should list brain entries for agent', async () => {
      const res = await request(app).get('/api/custom-agents/agent-1/brain');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(2);
      expect(brainRepo.getByAgent).toHaveBeenCalledWith('agent-1');
    });

    it('should filter by category', async () => {
      const res = await request(app).get('/api/custom-agents/agent-1/brain?category=faq');

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(brainRepo.getByAgentAndCategory).toHaveBeenCalledWith('agent-1', 'faq');
    });
  });

  describe('POST /api/custom-agents/:agentId/brain', () => {
    it('should create a brain entry', async () => {
      const res = await request(app)
        .post('/api/custom-agents/agent-1/brain')
        .send({ title: 'New', content: 'New entry', category: 'general' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New');
      expect(brainRepo.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1' })
      );
    });
  });

  describe('PUT /api/custom-agents/:agentId/brain/:entryId', () => {
    it('should update a brain entry', async () => {
      const res = await request(app)
        .put('/api/custom-agents/agent-1/brain/brain-1')
        .send({ title: 'Updated FAQ' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated FAQ');
    });

    it('should return 404 for unknown entry', async () => {
      const res = await request(app)
        .put('/api/custom-agents/agent-1/brain/unknown')
        .send({ title: 'X' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/custom-agents/:agentId/brain/:entryId', () => {
    it('should delete a brain entry', async () => {
      const res = await request(app).delete('/api/custom-agents/agent-1/brain/brain-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/custom-agents/:agentId/brain/reorder', () => {
    it('should reorder brain entries', async () => {
      const res = await request(app)
        .put('/api/custom-agents/agent-1/brain/reorder')
        .send({ orderedIds: ['brain-2', 'brain-1'] });

      expect(res.status).toBe(200);
      expect(brainRepo.reorder).toHaveBeenCalledWith('agent-1', ['brain-2', 'brain-1']);
    });

    it('should reject invalid orderedIds', async () => {
      const res = await request(app)
        .put('/api/custom-agents/agent-1/brain/reorder')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
