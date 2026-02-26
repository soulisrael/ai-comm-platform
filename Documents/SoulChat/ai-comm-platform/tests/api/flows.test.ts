import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowRepository } from '../../src/database/repositories/flow-repository';
import { FlowEngine } from '../../src/engines/flow-engine';
import { createFlowsRouter } from '../../src/api/routes/flows';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/api/middleware/error-handler';

function createMockFlowRepo() {
  return {
    getAll: vi.fn().mockResolvedValue([
      { id: 'flow-1', name: 'Welcome', description: null, triggerType: 'new_contact', triggerConfig: {}, nodes: [], edges: [], active: true, stats: { runs: 0, success: 0, failed: 0 }, createdAt: new Date(), updatedAt: new Date() },
    ]),
    getById: vi.fn().mockImplementation(async (id: string) => {
      if (id === 'flow-1') {
        return { id: 'flow-1', name: 'Welcome', description: null, triggerType: 'new_contact', triggerConfig: {}, nodes: [{ id: '1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Start' } }], edges: [], active: true, stats: { runs: 0, success: 0, failed: 0 }, createdAt: new Date(), updatedAt: new Date() };
      }
      return null;
    }),
    createFlow: vi.fn().mockResolvedValue({
      id: 'flow-new', name: 'New Flow', description: null, triggerType: 'keyword', triggerConfig: {}, nodes: [], edges: [], active: false, stats: { runs: 0, success: 0, failed: 0 }, createdAt: new Date(), updatedAt: new Date(),
    }),
    updateFlow: vi.fn().mockResolvedValue({
      id: 'flow-1', name: 'Updated', description: null, triggerType: 'new_contact', triggerConfig: {}, nodes: [], edges: [], active: true, stats: { runs: 0, success: 0, failed: 0 }, createdAt: new Date(), updatedAt: new Date(),
    }),
    deleteById: vi.fn().mockResolvedValue(true),
    duplicate: vi.fn().mockResolvedValue({
      id: 'flow-copy', name: 'Welcome (עותק)', description: null, triggerType: 'new_contact', triggerConfig: {}, nodes: [], edges: [], active: false, stats: { runs: 0, success: 0, failed: 0 }, createdAt: new Date(), updatedAt: new Date(),
    }),
    getRunsByFlow: vi.fn().mockResolvedValue([]),
    createRun: vi.fn().mockResolvedValue({
      id: 'run-1', flowId: 'flow-1', conversationId: null, contactId: null, status: 'running', currentNodeId: '1', context: {}, startedAt: new Date(), completedAt: null, error: null,
    }),
    updateRun: vi.fn(),
    getByTrigger: vi.fn().mockResolvedValue([]),
  } as unknown as FlowRepository;
}

function createMockFlowEngine() {
  return {
    startFlow: vi.fn().mockResolvedValue({
      id: 'run-test', flowId: 'flow-1', conversationId: null, contactId: null, status: 'running', currentNodeId: '1', context: { test: true }, startedAt: new Date(), completedAt: null, error: null,
    }),
  } as unknown as FlowEngine;
}

describe('Flows API', () => {
  let app: express.Express;
  let flowRepo: ReturnType<typeof createMockFlowRepo>;
  let flowEngine: ReturnType<typeof createMockFlowEngine>;

  beforeEach(() => {
    flowRepo = createMockFlowRepo();
    flowEngine = createMockFlowEngine();
    app = express();
    app.use(express.json());
    app.use('/api/flows', createFlowsRouter(flowRepo as any, flowEngine as any));
    app.use(errorHandler);
  });

  describe('GET /api/flows', () => {
    it('should list all flows', async () => {
      const res = await request(app).get('/api/flows');

      expect(res.status).toBe(200);
      expect(res.body.flows).toHaveLength(1);
      expect(res.body.flows[0].name).toBe('Welcome');
    });
  });

  describe('POST /api/flows', () => {
    it('should create a flow', async () => {
      const res = await request(app)
        .post('/api/flows')
        .send({ name: 'New Flow', triggerType: 'keyword' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Flow');
    });
  });

  describe('GET /api/flows/:id', () => {
    it('should return flow by id', async () => {
      const res = await request(app).get('/api/flows/flow-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('flow-1');
    });

    it('should return 404 for unknown flow', async () => {
      const res = await request(app).get('/api/flows/unknown');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/flows/:id', () => {
    it('should update a flow', async () => {
      const res = await request(app)
        .put('/api/flows/flow-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated');
    });
  });

  describe('DELETE /api/flows/:id', () => {
    it('should delete a flow', async () => {
      const res = await request(app).delete('/api/flows/flow-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for unknown flow', async () => {
      const res = await request(app).delete('/api/flows/unknown');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/flows/:id/duplicate', () => {
    it('should duplicate a flow', async () => {
      const res = await request(app).post('/api/flows/flow-1/duplicate');

      expect(res.status).toBe(201);
      expect(res.body.name).toContain('עותק');
    });
  });

  describe('PUT /api/flows/:id/activate', () => {
    it('should activate a flow', async () => {
      const res = await request(app).put('/api/flows/flow-1/activate');

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/flows/:id/deactivate', () => {
    it('should deactivate a flow', async () => {
      const res = await request(app).put('/api/flows/flow-1/deactivate');

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/flows/:id/test', () => {
    it('should test a flow', async () => {
      const res = await request(app)
        .post('/api/flows/flow-1/test')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.run).toBeDefined();
      expect(res.body.run.status).toBe('running');
    });
  });

  describe('GET /api/flows/:id/runs', () => {
    it('should return flow runs', async () => {
      const res = await request(app).get('/api/flows/flow-1/runs');

      expect(res.status).toBe(200);
      expect(res.body.runs).toBeDefined();
    });
  });
});
