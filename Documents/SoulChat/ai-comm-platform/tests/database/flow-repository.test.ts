import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowRepository } from '../../src/database/repositories/flow-repository';
import { FlowRow, FlowRunRow } from '../../src/database/db-types';

function createMockFlow(overrides: Partial<FlowRow> = {}): FlowRow {
  return {
    id: 'flow-1',
    name: 'Test Flow',
    description: 'A test flow',
    trigger_type: 'new_contact',
    trigger_config: {},
    nodes: [{ id: '1', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Start' } }],
    edges: [],
    active: true,
    stats: { runs: 0, success: 0, failed: 0 },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockFlowRun(overrides: Partial<FlowRunRow> = {}): FlowRunRow {
  return {
    id: 'run-1',
    flow_id: 'flow-1',
    conversation_id: 'conv-1',
    contact_id: 'contact-1',
    status: 'running',
    current_node_id: '1',
    context: {},
    started_at: '2024-01-01T00:00:00Z',
    completed_at: null,
    error: null,
    ...overrides,
  };
}

function createMockClient() {
  const mockSingle = vi.fn();
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: mockSingle,
    order: mockOrder,
    select: vi.fn().mockReturnValue({ single: mockSingle }),
  });
  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
    data: [],
    error: null,
  });
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: mockSingle }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    }),
  });
  const mockDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const mockUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: mockSingle }),
  });

  const from = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    upsert: mockUpsert,
  });

  return { from, _mocks: { mockSelect, mockInsert, mockUpdate, mockDelete, mockSingle, mockEq, mockOrder } };
}

describe('FlowRepository', () => {
  let repo: FlowRepository;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    repo = new FlowRepository(mockClient as any);
  });

  describe('getAll', () => {
    it('should return all flows mapped to Flow type', async () => {
      const flows = [createMockFlow(), createMockFlow({ id: 'flow-2', name: 'Flow 2' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ data: flows, error: null }),
      });

      const result = await repo.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test Flow');
      expect(result[0].triggerType).toBe('new_contact');
    });
  });

  describe('getById', () => {
    it('should return flow by id', async () => {
      const flow = createMockFlow();
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: flow, error: null }),
          }),
        }),
      });

      const result = await repo.getById('flow-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('flow-1');
      expect(result!.nodes).toHaveLength(1);
    });

    it('should return null when not found', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      const result = await repo.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getActive', () => {
    it('should return only active flows', async () => {
      const flows = [createMockFlow({ active: true })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: flows, error: null }),
        }),
      });

      const result = await repo.getActive();
      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(true);
    });
  });

  describe('getByTrigger', () => {
    it('should return active flows by trigger type', async () => {
      const flows = [createMockFlow({ trigger_type: 'new_contact' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: flows, error: null }),
          }),
        }),
      });

      const result = await repo.getByTrigger('new_contact');
      expect(result).toHaveLength(1);
    });
  });

  describe('createFlow', () => {
    it('should create flow with validated input', async () => {
      const flow = createMockFlow();
      mockClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: flow, error: null }),
          }),
        }),
      });

      const result = await repo.createFlow({
        name: 'Test Flow',
        triggerType: 'new_contact',
      });
      expect(result.name).toBe('Test Flow');
    });

    it('should throw on invalid input', async () => {
      await expect(repo.createFlow({ name: '' })).rejects.toThrow();
    });
  });

  describe('updateFlow', () => {
    it('should update flow with validated input', async () => {
      const updatedFlow = createMockFlow({ name: 'Updated Flow' });
      mockClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedFlow, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.updateFlow('flow-1', { name: 'Updated Flow' });
      expect(result.name).toBe('Updated Flow');
    });
  });

  describe('duplicate', () => {
    it('should create a copy with "(עותק)" suffix', async () => {
      const original = createMockFlow();
      const copy = createMockFlow({ id: 'flow-2', name: 'Test Flow (עותק)', active: false });

      // First call: getById (findById)
      const mockFindSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: original, error: null }),
        }),
      });
      // Second call: createFlow (insert)
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: copy, error: null }),
        }),
      });

      let callCount = 0;
      mockClient.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: mockFindSelect };
        return { insert: mockInsert };
      });

      const result = await repo.duplicate('flow-1');
      expect(result.name).toBe('Test Flow (עותק)');
      expect(result.active).toBe(false);
    });
  });

  describe('deleteById', () => {
    it('should delete flow by id', async () => {
      mockClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await repo.deleteById('flow-1');
      expect(result).toBe(true);
    });
  });

  describe('createRun', () => {
    it('should create a flow run', async () => {
      const run = createMockFlowRun();
      mockClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: run, error: null }),
          }),
        }),
      });

      const result = await repo.createRun('flow-1', 'conv-1', 'contact-1');
      expect(result.flowId).toBe('flow-1');
      expect(result.status).toBe('running');
      expect(mockClient.from).toHaveBeenCalledWith('flow_runs');
    });
  });

  describe('getRunsByFlow', () => {
    it('should return flow runs ordered by started_at desc', async () => {
      const runs = [createMockFlowRun(), createMockFlowRun({ id: 'run-2' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: runs, error: null }),
          }),
        }),
      });

      const result = await repo.getRunsByFlow('flow-1');
      expect(result).toHaveLength(2);
      expect(mockClient.from).toHaveBeenCalledWith('flow_runs');
    });
  });

  describe('updateRun', () => {
    it('should update a flow run', async () => {
      const updatedRun = createMockFlowRun({ status: 'completed', completed_at: '2024-01-01T01:00:00Z' });
      mockClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedRun, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.updateRun('run-1', { status: 'completed' });
      expect(result.status).toBe('completed');
    });
  });
});
