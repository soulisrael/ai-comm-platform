import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEngine } from '../../src/engines/flow-engine';
import type { Flow, FlowNode, FlowEdge, FlowRun } from '../../src/types/flow';

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

function createTestFlow(overrides?: Partial<Flow>): Flow {
  return {
    id: 'flow-1',
    name: 'Test Flow',
    description: null,
    triggerType: 'manual',
    triggerConfig: {},
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
      { id: 'msg-1', type: 'send_message', position: { x: 0, y: 100 }, data: { message: 'שלום! ברוכים הבאים' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'msg-1' },
    ],
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

describe('FlowEngine', () => {
  let engine: FlowEngine;
  let mockRepo: ReturnType<typeof createMockFlowRepo>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let runAgent: ReturnType<typeof vi.fn>;
  let updateContact: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRepo = createMockFlowRepo();
    sendMessage = vi.fn().mockResolvedValue(undefined);
    runAgent = vi.fn().mockResolvedValue('תגובת AI');
    updateContact = vi.fn().mockResolvedValue(undefined);

    mockRepo.createRun.mockResolvedValue(createMockRun());
    mockRepo.updateRun.mockResolvedValue(createMockRun());
    mockRepo.updateStats.mockResolvedValue(undefined);

    engine = new FlowEngine(mockRepo, { sendMessage, runAgent, updateContact });
  });

  describe('startFlow', () => {
    it('finds trigger node and executes the flow', async () => {
      const flow = createTestFlow();
      mockRepo.getById.mockResolvedValue(flow);

      const run = await engine.startFlow('flow-1', 'conv-1', 'contact-1');

      expect(run).toBeDefined();
      expect(run.id).toBe('run-1');
      expect(mockRepo.createRun).toHaveBeenCalledWith('flow-1', 'conv-1', 'contact-1');
      expect(mockRepo.updateRun).toHaveBeenCalled();
    });

    it('throws when flow is not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      await expect(engine.startFlow('nonexistent')).rejects.toThrow('Flow nonexistent not found');
    });

    it('throws when flow is not active', async () => {
      const flow = createTestFlow({ active: false });
      mockRepo.getById.mockResolvedValue(flow);

      await expect(engine.startFlow('flow-1')).rejects.toThrow('Flow flow-1 is not active');
    });

    it('throws when flow has no trigger node', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'msg-1', type: 'send_message', position: { x: 0, y: 0 }, data: { message: 'שלום' } },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await expect(engine.startFlow('flow-1')).rejects.toThrow('has no trigger node');
    });

    it('passes triggerData as initial context', async () => {
      const flow = createTestFlow();
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', 'contact-1', { message: 'הי' });

      // updateRun is called with context that includes triggerData
      const firstUpdateCall = mockRepo.updateRun.mock.calls[0];
      expect(firstUpdateCall[1].context).toMatchObject({ message: 'הי', conversationId: 'conv-1' });
    });
  });

  describe('send_message node', () => {
    it('calls sendMessage callback with correct arguments', async () => {
      const flow = createTestFlow();
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', 'contact-1');

      expect(sendMessage).toHaveBeenCalledWith('conv-1', 'שלום! ברוכים הבאים');
    });

    it('does not fail if sendMessage callback is not provided', async () => {
      engine = new FlowEngine(mockRepo); // No options
      const flow = createTestFlow();
      mockRepo.getById.mockResolvedValue(flow);

      // Should not throw
      await engine.startFlow('flow-1', 'conv-1');
    });
  });

  describe('condition node', () => {
    it('follows "yes" branch when condition is true', async () => {
      const sendYes = vi.fn().mockResolvedValue(undefined);
      engine = new FlowEngine(mockRepo, { sendMessage: sendYes });

      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'cond-1', type: 'condition', position: { x: 0, y: 100 }, data: { expression: 'channel equals whatsapp' } },
          { id: 'msg-yes', type: 'send_message', position: { x: -100, y: 200 }, data: { message: 'כן!' } },
          { id: 'msg-no', type: 'send_message', position: { x: 100, y: 200 }, data: { message: 'לא!' } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'cond-1' },
          { id: 'e2', source: 'cond-1', target: 'msg-yes', sourceHandle: 'yes' },
          { id: 'e3', source: 'cond-1', target: 'msg-no', sourceHandle: 'no' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', undefined, { channel: 'whatsapp' });

      expect(sendYes).toHaveBeenCalledWith('conv-1', 'כן!');
      expect(sendYes).not.toHaveBeenCalledWith('conv-1', 'לא!');
    });

    it('follows "no" branch when condition is false', async () => {
      const sendNo = vi.fn().mockResolvedValue(undefined);
      engine = new FlowEngine(mockRepo, { sendMessage: sendNo });

      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'cond-1', type: 'condition', position: { x: 0, y: 100 }, data: { expression: 'channel equals telegram' } },
          { id: 'msg-yes', type: 'send_message', position: { x: -100, y: 200 }, data: { message: 'כן!' } },
          { id: 'msg-no', type: 'send_message', position: { x: 100, y: 200 }, data: { message: 'לא!' } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'cond-1' },
          { id: 'e2', source: 'cond-1', target: 'msg-yes', sourceHandle: 'yes' },
          { id: 'e3', source: 'cond-1', target: 'msg-no', sourceHandle: 'no' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', undefined, { channel: 'whatsapp' });

      expect(sendNo).toHaveBeenCalledWith('conv-1', 'לא!');
      expect(sendNo).not.toHaveBeenCalledWith('conv-1', 'כן!');
    });
  });

  describe('flow completion and stats', () => {
    it('marks run as completed and updates stats on success', async () => {
      const flow = createTestFlow();
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1');

      // Check that updateRun was called with completed status
      const completionCall = mockRepo.updateRun.mock.calls.find(
        (call: any[]) => call[1].status === 'completed',
      );
      expect(completionCall).toBeDefined();
      expect(completionCall![1].completed_at).toBeDefined();

      // Check that stats were updated with success
      expect(mockRepo.updateStats).toHaveBeenCalledWith('flow-1', 'success');
    });

    it('marks run as failed and updates stats on error', async () => {
      sendMessage.mockRejectedValue(new Error('שגיאת רשת'));

      const flow = createTestFlow();
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1');

      // Check that updateRun was called with failed status
      const failCall = mockRepo.updateRun.mock.calls.find(
        (call: any[]) => call[1].status === 'failed',
      );
      expect(failCall).toBeDefined();
      expect(failCall![1].error).toBe('שגיאת רשת');

      // Check that stats were updated with failed
      expect(mockRepo.updateStats).toHaveBeenCalledWith('flow-1', 'failed');
    });
  });

  describe('ai_agent node', () => {
    it('calls runAgent with correct arguments', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'ai-1', type: 'ai_agent', position: { x: 0, y: 100 }, data: { agentId: 'agent-sales' } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'ai-1' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', undefined, { lastMessage: 'מה המחיר?' });

      expect(runAgent).toHaveBeenCalledWith('agent-sales', 'מה המחיר?', 'conv-1');
    });
  });

  describe('tag node', () => {
    it('calls updateContact with tags', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'tag-1', type: 'tag', position: { x: 0, y: 100 }, data: { tags: ['vip', 'premium'] } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'tag-1' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', 'contact-1');

      expect(updateContact).toHaveBeenCalledWith('contact-1', ['vip', 'premium']);
    });

    it('supports single tag via data.tag', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'tag-1', type: 'tag', position: { x: 0, y: 100 }, data: { tag: 'greeted' } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'tag-1' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', 'contact-1');

      expect(updateContact).toHaveBeenCalledWith('contact-1', ['greeted']);
    });
  });

  describe('cancelFlow', () => {
    it('marks run as failed with Cancelled error', async () => {
      await engine.cancelFlow('run-1');

      expect(mockRepo.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'failed',
        error: 'Cancelled',
        completed_at: expect.any(String),
      });
    });
  });

  describe('pauseFlow', () => {
    it('marks run as paused', async () => {
      await engine.pauseFlow('run-1');

      expect(mockRepo.updateRun).toHaveBeenCalledWith('run-1', { status: 'paused' });
    });
  });

  describe('wait_reply node', () => {
    it('pauses the flow at wait_reply node', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'wait-1', type: 'wait_reply', position: { x: 0, y: 100 }, data: {} },
          { id: 'msg-1', type: 'send_message', position: { x: 0, y: 200 }, data: { message: 'תודה על התשובה!' } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'wait-1' },
          { id: 'e2', source: 'wait-1', target: 'msg-1' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1');

      // Flow should be paused, not completed
      const pauseCall = mockRepo.updateRun.mock.calls.find(
        (call: any[]) => call[1].status === 'paused',
      );
      expect(pauseCall).toBeDefined();

      // send_message after wait_reply should NOT have been called
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('check_window node', () => {
    it('follows "open" branch when window is open', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      engine = new FlowEngine(mockRepo, { sendMessage: sendFn });

      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'check-1', type: 'check_window', position: { x: 0, y: 100 }, data: {} },
          { id: 'msg-open', type: 'send_message', position: { x: -100, y: 200 }, data: { message: 'חלון פתוח' } },
          { id: 'msg-closed', type: 'send_message', position: { x: 100, y: 200 }, data: { message: 'חלון סגור' } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'check-1' },
          { id: 'e2', source: 'check-1', target: 'msg-open', sourceHandle: 'open' },
          { id: 'e3', source: 'check-1', target: 'msg-closed', sourceHandle: 'closed' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', undefined, { windowOpen: true });

      expect(sendFn).toHaveBeenCalledWith('conv-1', 'חלון פתוח');
      expect(sendFn).not.toHaveBeenCalledWith('conv-1', 'חלון סגור');
    });
  });

  describe('multi-step flow execution', () => {
    it('executes trigger -> send_message -> tag in sequence', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'trigger-1', type: 'trigger', position: { x: 0, y: 0 }, data: {} },
          { id: 'msg-1', type: 'send_message', position: { x: 0, y: 100 }, data: { message: 'שלום!' } },
          { id: 'tag-1', type: 'tag', position: { x: 0, y: 200 }, data: { tags: ['welcomed'] } },
        ],
        edges: [
          { id: 'e1', source: 'trigger-1', target: 'msg-1' },
          { id: 'e2', source: 'msg-1', target: 'tag-1' },
        ],
      });
      mockRepo.getById.mockResolvedValue(flow);

      await engine.startFlow('flow-1', 'conv-1', 'contact-1');

      expect(sendMessage).toHaveBeenCalledWith('conv-1', 'שלום!');
      expect(updateContact).toHaveBeenCalledWith('contact-1', ['welcomed']);
      expect(mockRepo.updateStats).toHaveBeenCalledWith('flow-1', 'success');
    });
  });
});
