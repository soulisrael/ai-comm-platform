import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowTriggerManager } from '../../src/engines/flow-trigger';
import type { Flow, FlowRun } from '../../src/types/flow';

// Mock logger to suppress output in tests
vi.mock('../../src/services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockFlowRepo() {
  return {
    getAll: vi.fn(),
    getById: vi.fn(),
    getActive: vi.fn(),
    getByTrigger: vi.fn(),
    createFlow: vi.fn(),
    createRun: vi.fn(),
    updateRun: vi.fn(),
    updateStats: vi.fn(),
    updateFlow: vi.fn(),
    duplicate: vi.fn(),
    getRunsByFlow: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  } as any;
}

function createMockFlowEngine() {
  return {
    startFlow: vi.fn(),
    pauseFlow: vi.fn(),
    resumeFlow: vi.fn(),
    cancelFlow: vi.fn(),
  } as any;
}

function createTestFlow(overrides?: Partial<Flow>): Flow {
  return {
    id: 'flow-1',
    name: 'אוטומציה לבדיקה',
    description: null,
    triggerType: 'message_received',
    triggerConfig: {},
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [],
    active: true,
    stats: { runs: 0, success: 0, failed: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRun(overrides?: Partial<FlowRun>): FlowRun {
  return {
    id: 'run-1',
    flowId: 'flow-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    status: 'running',
    currentNodeId: null,
    context: {},
    startedAt: new Date(),
    completedAt: null,
    error: null,
    ...overrides,
  };
}

describe('FlowTriggerManager', () => {
  let triggerManager: FlowTriggerManager;
  let mockRepo: ReturnType<typeof createMockFlowRepo>;
  let mockEngine: ReturnType<typeof createMockFlowEngine>;

  beforeEach(() => {
    mockRepo = createMockFlowRepo();
    mockEngine = createMockFlowEngine();
    triggerManager = new FlowTriggerManager(mockRepo, mockEngine);
  });

  describe('checkTriggers', () => {
    it('finds matching flows and starts them', async () => {
      const flow = createTestFlow();
      mockRepo.getByTrigger.mockResolvedValue([flow]);
      mockEngine.startFlow.mockResolvedValue(createMockRun());

      const runIds = await triggerManager.checkTriggers('message_received', {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        message: 'שלום',
      });

      expect(runIds).toEqual(['run-1']);
      expect(mockEngine.startFlow).toHaveBeenCalledWith(
        'flow-1',
        'conv-1',
        'contact-1',
        expect.objectContaining({ message: 'שלום' }),
      );
    });

    it('starts multiple matching flows', async () => {
      const flow1 = createTestFlow({ id: 'flow-1', name: 'Flow A' });
      const flow2 = createTestFlow({ id: 'flow-2', name: 'Flow B' });
      mockRepo.getByTrigger.mockResolvedValue([flow1, flow2]);
      mockEngine.startFlow
        .mockResolvedValueOnce(createMockRun({ id: 'run-1' }))
        .mockResolvedValueOnce(createMockRun({ id: 'run-2' }));

      const runIds = await triggerManager.checkTriggers('message_received', {
        conversationId: 'conv-1',
      });

      expect(runIds).toEqual(['run-1', 'run-2']);
      expect(mockEngine.startFlow).toHaveBeenCalledTimes(2);
    });

    it('handles startFlow errors gracefully', async () => {
      const flow = createTestFlow();
      mockRepo.getByTrigger.mockResolvedValue([flow]);
      mockEngine.startFlow.mockRejectedValue(new Error('שגיאה'));

      const runIds = await triggerManager.checkTriggers('message_received', {
        conversationId: 'conv-1',
      });

      // Should return empty array, not throw
      expect(runIds).toEqual([]);
    });

    it('returns empty array when no flows match', async () => {
      mockRepo.getByTrigger.mockResolvedValue([]);

      const runIds = await triggerManager.checkTriggers('message_received', {
        conversationId: 'conv-1',
      });

      expect(runIds).toEqual([]);
    });
  });

  describe('keyword trigger matching', () => {
    it('matches keyword in message', async () => {
      const flow = createTestFlow({
        triggerType: 'keyword',
        triggerConfig: { keywords: ['מחיר', 'עלות'] },
      });
      mockRepo.getByTrigger.mockResolvedValue([flow]);
      mockEngine.startFlow.mockResolvedValue(createMockRun());

      const runIds = await triggerManager.checkTriggers('keyword', {
        message: 'מה המחיר שלכם?',
        conversationId: 'conv-1',
      });

      expect(runIds).toEqual(['run-1']);
    });

    it('keyword matching is case-insensitive', async () => {
      const flow = createTestFlow({
        triggerType: 'keyword',
        triggerConfig: { keywords: ['Hello'] },
      });
      mockRepo.getByTrigger.mockResolvedValue([flow]);
      mockEngine.startFlow.mockResolvedValue(createMockRun());

      const runIds = await triggerManager.checkTriggers('keyword', {
        message: 'hello world',
        conversationId: 'conv-1',
      });

      expect(runIds).toEqual(['run-1']);
    });

    it('does not match when keyword is absent', async () => {
      const flow = createTestFlow({
        triggerType: 'keyword',
        triggerConfig: { keywords: ['מחיר'] },
      });
      mockRepo.getByTrigger.mockResolvedValue([flow]);

      const runIds = await triggerManager.checkTriggers('keyword', {
        message: 'שלום, מה שלומכם?',
        conversationId: 'conv-1',
      });

      expect(runIds).toEqual([]);
      expect(mockEngine.startFlow).not.toHaveBeenCalled();
    });
  });

  describe('webhook trigger matching', () => {
    it('matches by webhookId', async () => {
      const flow = createTestFlow({
        triggerType: 'webhook',
        triggerConfig: { webhookId: 'wh-abc' },
      });
      mockRepo.getByTrigger.mockResolvedValue([flow]);
      mockEngine.startFlow.mockResolvedValue(createMockRun());

      const runIds = await triggerManager.checkTriggers('webhook', {
        webhookId: 'wh-abc',
        payload: { event: 'purchase' },
      });

      expect(runIds).toEqual(['run-1']);
    });

    it('does not match different webhookId', async () => {
      const flow = createTestFlow({
        triggerType: 'webhook',
        triggerConfig: { webhookId: 'wh-abc' },
      });
      mockRepo.getByTrigger.mockResolvedValue([flow]);

      const runIds = await triggerManager.checkTriggers('webhook', {
        webhookId: 'wh-xyz',
        payload: {},
      });

      expect(runIds).toEqual([]);
    });
  });

  describe('schedule trigger', () => {
    it('never matches in event-based check (handled by cron)', async () => {
      const flow = createTestFlow({ triggerType: 'schedule' });
      mockRepo.getByTrigger.mockResolvedValue([flow]);

      const runIds = await triggerManager.checkTriggers('schedule', {});

      expect(runIds).toEqual([]);
      expect(mockEngine.startFlow).not.toHaveBeenCalled();
    });
  });

  describe('manualTrigger', () => {
    it('starts a specific flow manually', async () => {
      mockEngine.startFlow.mockResolvedValue(createMockRun());

      const runId = await triggerManager.manualTrigger('flow-1', {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        payload: { source: 'dashboard' },
      });

      expect(runId).toBe('run-1');
      expect(mockEngine.startFlow).toHaveBeenCalledWith(
        'flow-1',
        'conv-1',
        'contact-1',
        { source: 'dashboard' },
      );
    });
  });

  describe('handleWebhookTrigger', () => {
    it('delegates to checkTriggers with webhook event', async () => {
      const flow = createTestFlow({
        triggerType: 'webhook',
        triggerConfig: { webhookId: 'wh-123' },
      });
      mockRepo.getByTrigger.mockResolvedValue([flow]);
      mockEngine.startFlow.mockResolvedValue(createMockRun());

      const runIds = await triggerManager.handleWebhookTrigger('wh-123', { data: 'test' });

      expect(runIds).toEqual(['run-1']);
      expect(mockRepo.getByTrigger).toHaveBeenCalledWith('webhook');
    });
  });
});
