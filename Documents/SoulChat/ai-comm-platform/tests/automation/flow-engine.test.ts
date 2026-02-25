import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEngine } from '../../src/automation/flow-engine';
import type { Flow, FlowStep } from '../../src/types/automation';

vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }) },
}));

function createMockDeps() {
  return {
    channelManager: {
      sendResponse: vi.fn().mockResolvedValue(undefined),
      getAdapter: vi.fn(),
      hasAdapter: vi.fn().mockReturnValue(true),
      registerAdapter: vi.fn(),
      getRegisteredChannels: vi.fn().mockReturnValue(['whatsapp']),
      sendImage: vi.fn().mockResolvedValue(undefined),
      sendButtons: vi.fn().mockResolvedValue(undefined),
      sendTemplate: vi.fn().mockResolvedValue(undefined),
    } as any,
    conversationManager: {
      updateAgent: vi.fn(),
      closeConversation: vi.fn(),
      getConversation: vi.fn().mockReturnValue({ id: 'conv1', status: 'active' }),
    } as any,
    contactManager: {
      getContact: vi.fn().mockReturnValue({ id: 'c1', tags: ['vip'], name: 'John' }),
      updateContact: vi.fn(),
      getAllContacts: vi.fn().mockReturnValue([]),
    } as any,
  };
}

function createTestFlow(overrides?: Partial<Flow>): Flow {
  return {
    id: 'flow-1',
    name: 'Test Flow',
    trigger: 'message_received',
    triggerConfig: {},
    steps: [
      {
        id: 'step-1',
        action: { type: 'send_message', config: { content: 'Hello!' } },
      },
      {
        id: 'step-2',
        action: { type: 'add_tag', config: { tag: 'greeted' } },
      },
    ],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('FlowEngine', () => {
  let engine: FlowEngine;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
    engine = new FlowEngine(deps);
  });

  describe('registerFlow', () => {
    it('registers and retrieves a flow', () => {
      const flow = createTestFlow();
      engine.registerFlow(flow);
      expect(engine.getFlow('flow-1')).toEqual(flow);
    });

    it('lists all flows', () => {
      engine.registerFlow(createTestFlow({ id: 'f1', name: 'Flow 1' }));
      engine.registerFlow(createTestFlow({ id: 'f2', name: 'Flow 2' }));
      expect(engine.getAllFlows()).toHaveLength(2);
    });
  });

  describe('activateFlow / deactivateFlow', () => {
    it('toggles active state', () => {
      engine.registerFlow(createTestFlow({ active: false }));
      engine.activateFlow('flow-1');
      expect(engine.getFlow('flow-1')?.active).toBe(true);

      engine.deactivateFlow('flow-1');
      expect(engine.getFlow('flow-1')?.active).toBe(false);
    });
  });

  describe('getActiveFlows', () => {
    it('returns only active flows', () => {
      engine.registerFlow(createTestFlow({ id: 'f1', active: true }));
      engine.registerFlow(createTestFlow({ id: 'f2', active: false }));
      expect(engine.getActiveFlows()).toHaveLength(1);
      expect(engine.getActiveFlows()[0].id).toBe('f1');
    });
  });

  describe('deleteFlow', () => {
    it('deletes a flow', () => {
      engine.registerFlow(createTestFlow());
      expect(engine.deleteFlow('flow-1')).toBe(true);
      expect(engine.getFlow('flow-1')).toBeUndefined();
    });
  });

  describe('executeFlow', () => {
    it('executes all steps in sequence', async () => {
      const flow = createTestFlow();
      engine.registerFlow(flow);

      const context = { conversationId: 'conv1', contactId: 'c1', channel: 'whatsapp', channelUserId: '+123' };
      const execution = await engine.executeFlow('flow-1', context);

      expect(execution.status).toBe('completed');
      expect(deps.channelManager.sendResponse).toHaveBeenCalled();
      expect(deps.contactManager.updateContact).toHaveBeenCalled();
    });

    it('throws for non-existent flow', async () => {
      await expect(engine.executeFlow('nonexistent', {})).rejects.toThrow('Flow not found');
    });

    it('throws for inactive flow', async () => {
      engine.registerFlow(createTestFlow({ active: false }));
      await expect(engine.executeFlow('flow-1', {})).rejects.toThrow('not active');
    });

    it('marks execution as failed on error', async () => {
      deps.channelManager.sendResponse.mockRejectedValueOnce(new Error('API down'));
      engine.registerFlow(createTestFlow());

      const execution = await engine.executeFlow('flow-1', { channel: 'whatsapp', channelUserId: '+1' });
      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('API down');
    });

    it('records execution history', async () => {
      engine.registerFlow(createTestFlow());
      await engine.executeFlow('flow-1', { contactId: 'c1' });

      const executions = engine.getExecutionsByFlow('flow-1');
      expect(executions).toHaveLength(1);
      expect(executions[0].flowId).toBe('flow-1');
    });
  });

  describe('executeFlow with wait action', () => {
    it('pauses execution on wait and calls delay handler', async () => {
      const delayHandler = vi.fn();
      engine.setDelayHandler(delayHandler);

      const flow = createTestFlow({
        steps: [
          { id: 's1', action: { type: 'wait', config: { amount: 5, unit: 'minutes' } } },
          { id: 's2', action: { type: 'send_message', config: { content: 'Delayed hello' } } },
        ],
      });
      engine.registerFlow(flow);

      const execution = await engine.executeFlow('flow-1', { contactId: 'c1' });
      expect(execution.status).toBe('running'); // Paused, waiting for delay
      expect(delayHandler).toHaveBeenCalledWith(execution.id, 's2', 300000);
    });
  });

  describe('evaluateConditions', () => {
    it('evaluates equals condition', () => {
      expect(engine.evaluateConditions(
        [{ field: 'channel', operator: 'equals', value: 'whatsapp' }],
        { channel: 'whatsapp' },
      )).toBe(true);

      expect(engine.evaluateConditions(
        [{ field: 'channel', operator: 'equals', value: 'telegram' }],
        { channel: 'whatsapp' },
      )).toBe(false);
    });

    it('evaluates contains condition', () => {
      expect(engine.evaluateConditions(
        [{ field: 'content', operator: 'contains', value: 'hello' }],
        { content: 'Hello World' },
      )).toBe(true);
    });

    it('evaluates gt/lt conditions', () => {
      expect(engine.evaluateConditions(
        [{ field: 'score', operator: 'gt', value: 5 }],
        { score: 10 },
      )).toBe(true);

      expect(engine.evaluateConditions(
        [{ field: 'score', operator: 'lt', value: 5 }],
        { score: 10 },
      )).toBe(false);
    });

    it('evaluates exists condition', () => {
      expect(engine.evaluateConditions(
        [{ field: 'name', operator: 'exists', value: true }],
        { name: 'John' },
      )).toBe(true);

      expect(engine.evaluateConditions(
        [{ field: 'email', operator: 'exists', value: true }],
        { name: 'John' },
      )).toBe(false);
    });

    it('evaluates nested field paths', () => {
      expect(engine.evaluateConditions(
        [{ field: 'contact.tags', operator: 'exists', value: true }],
        { contact: { tags: ['vip'] } },
      )).toBe(true);
    });

    it('requires all conditions to be true', () => {
      expect(engine.evaluateConditions(
        [
          { field: 'channel', operator: 'equals', value: 'whatsapp' },
          { field: 'score', operator: 'gt', value: 5 },
        ],
        { channel: 'whatsapp', score: 3 },
      )).toBe(false);
    });
  });

  describe('conditional step skipping', () => {
    it('skips steps when conditions are not met', async () => {
      const flow = createTestFlow({
        steps: [
          {
            id: 'step-1',
            action: { type: 'add_tag', config: { tag: 'always' } },
          },
          {
            id: 'step-2',
            action: { type: 'add_tag', config: { tag: 'conditional' } },
            conditions: [{ field: 'channel', operator: 'equals', value: 'telegram' }],
          },
          {
            id: 'step-3',
            action: { type: 'add_tag', config: { tag: 'final' } },
          },
        ],
      });
      engine.registerFlow(flow);

      await engine.executeFlow('flow-1', { contactId: 'c1', channel: 'whatsapp' });

      // step-2 should be skipped (channel is whatsapp, not telegram)
      const calls = deps.contactManager.updateContact.mock.calls;
      const tags = calls.map((c: any) => c[1].tags);
      expect(tags.flat()).not.toContain('conditional');
    });
  });

  describe('resumeExecution', () => {
    it('resumes from a specific step', async () => {
      const delayHandler = vi.fn();
      engine.setDelayHandler(delayHandler);

      const flow = createTestFlow({
        steps: [
          { id: 's1', action: { type: 'wait', config: { amount: 1, unit: 'minutes' } } },
          { id: 's2', action: { type: 'add_tag', config: { tag: 'resumed' } } },
        ],
      });
      engine.registerFlow(flow);

      const execution = await engine.executeFlow('flow-1', { contactId: 'c1' });
      expect(execution.status).toBe('running');

      // Resume from step s2
      await engine.resumeExecution(execution.id, 's2');
      const updated = engine.getExecution(execution.id);
      expect(updated?.status).toBe('completed');
    });
  });
});
