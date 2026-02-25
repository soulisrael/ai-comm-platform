import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomAgentRepository } from '../../src/database/repositories/custom-agent-repository';
import { CustomAgentRow } from '../../src/database/db-types';

function createMockAgent(overrides: Partial<CustomAgentRow> = {}): CustomAgentRow {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    description: 'Test description',
    system_prompt: 'You are a test agent',
    routing_keywords: ['test', 'demo'],
    routing_description: 'Test agent for testing',
    handoff_rules: {},
    transfer_rules: {},
    settings: { temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' },
    is_default: false,
    active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockClient() {
  const mockSingle = vi.fn();
  const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
  const mockIn = vi.fn();
  const mockContains = vi.fn();
  const mockEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
    single: mockSingle,
    limit: mockLimit,
    in: mockIn,
  });
  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
    in: mockIn,
    contains: mockContains,
    data: [],
    error: null,
  });
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: mockSingle,
    }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    }),
  });
  const mockDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  const from = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  });

  return {
    from,
    _mocks: { mockSelect, mockInsert, mockUpdate, mockDelete, mockSingle, mockEq, mockLimit, mockIn, mockContains },
  };
}

describe('CustomAgentRepository', () => {
  let repo: CustomAgentRepository;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    repo = new CustomAgentRepository(mockClient as any);
  });

  describe('findAll', () => {
    it('should return all agents', async () => {
      const agents = [createMockAgent(), createMockAgent({ id: 'agent-2', name: 'Agent 2' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ data: agents, error: null }),
      });

      const result = await repo.findAll();
      expect(result).toHaveLength(2);
      expect(mockClient.from).toHaveBeenCalledWith('custom_agents');
    });
  });

  describe('findById', () => {
    it('should return agent by id', async () => {
      const agent = createMockAgent();
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: agent, error: null }),
          }),
        }),
      });

      const result = await repo.findById('agent-1');
      expect(result).toEqual(agent);
    });

    it('should return null when not found', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getActive', () => {
    it('should return only active agents', async () => {
      const activeAgents = [createMockAgent({ active: true })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: activeAgents, error: null }),
        }),
      });

      const result = await repo.getActive();
      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(true);
    });
  });

  describe('getDefault', () => {
    it('should return the default agent', async () => {
      const defaultAgent = createMockAgent({ is_default: true });
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: defaultAgent, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.getDefault();
      expect(result).not.toBeNull();
      expect(result!.is_default).toBe(true);
    });

    it('should return null when no default exists', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      });

      const result = await repo.getDefault();
      expect(result).toBeNull();
    });
  });

  describe('getWithTopics', () => {
    it('should return agent with joined topics', async () => {
      const agent = createMockAgent();
      const topicRow = {
        id: 'topic-1',
        name: 'Test Topic',
        description: 'Test',
        content: { description: 'Test topic', faq: [], customFields: {} },
        is_shared: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // findById call
      const mockFindById = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: agent, error: null }),
        }),
      });
      // agent_topics call
      const mockJunction = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ topic_id: 'topic-1' }], error: null }),
      });
      // topics call
      const mockTopics = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [topicRow], error: null }),
      });

      let callCount = 0;
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'custom_agents') {
          return { select: mockFindById };
        } else if (table === 'agent_topics') {
          return { select: mockJunction };
        } else if (table === 'topics') {
          return { select: mockTopics };
        }
        return {};
      });

      const result = await repo.getWithTopics('agent-1');
      expect(result).not.toBeNull();
      expect(result!.topics).toHaveLength(1);
      expect(result!.topics[0].name).toBe('Test Topic');
    });

    it('should return null when agent not found', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      const result = await repo.getWithTopics('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createAgent', () => {
    it('should create agent with validated input', async () => {
      const newAgent = createMockAgent();
      mockClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newAgent, error: null }),
          }),
        }),
      });

      const result = await repo.createAgent({ name: 'Test Agent' });
      expect(result).toEqual(newAgent);
      expect(mockClient.from).toHaveBeenCalledWith('custom_agents');
    });

    it('should throw on invalid input', async () => {
      await expect(repo.createAgent({ name: '' })).rejects.toThrow();
    });
  });

  describe('updateAgent', () => {
    it('should update agent with validated input', async () => {
      const updatedAgent = createMockAgent({ name: 'Updated Name' });
      mockClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedAgent, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.updateAgent('agent-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteById', () => {
    it('should delete agent by id', async () => {
      mockClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await repo.deleteById('agent-1');
      expect(result).toBe(true);
    });
  });

  describe('assignTopic', () => {
    it('should insert into agent_topics', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockClient.from.mockReturnValue({
        insert: mockInsert,
      });

      await repo.assignTopic('agent-1', 'topic-1');
      expect(mockClient.from).toHaveBeenCalledWith('agent_topics');
      expect(mockInsert).toHaveBeenCalledWith({ agent_id: 'agent-1', topic_id: 'topic-1' });
    });
  });

  describe('removeTopic', () => {
    it('should delete from agent_topics', async () => {
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      mockClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: mockDeleteEq,
          }),
        }),
      });

      await repo.removeTopic('agent-1', 'topic-1');
      expect(mockClient.from).toHaveBeenCalledWith('agent_topics');
    });
  });

  describe('getByKeyword', () => {
    it('should find agents by routing keyword', async () => {
      const agents = [createMockAgent({ routing_keywords: ['test', 'demo'] })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockResolvedValue({ data: agents, error: null }),
        }),
      });

      const result = await repo.getByKeyword('test');
      expect(result).toHaveLength(1);
      expect(result[0].routing_keywords).toContain('test');
    });

    it('should return empty array when no match', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          contains: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repo.getByKeyword('nonexistent');
      expect(result).toHaveLength(0);
    });
  });
});
