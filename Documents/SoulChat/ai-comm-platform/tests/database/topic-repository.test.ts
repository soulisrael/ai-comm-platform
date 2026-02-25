import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopicRepository } from '../../src/database/repositories/topic-repository';
import { TopicRow } from '../../src/database/db-types';

function createMockTopic(overrides: Partial<TopicRow> = {}): TopicRow {
  return {
    id: 'topic-1',
    name: 'Test Topic',
    description: 'A test topic',
    content: {
      description: 'Test topic content',
      faq: [{ question: 'Q1', answer: 'A1' }],
      customFields: {},
    },
    is_shared: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockClient() {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ data: [], error: null }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  return { from };
}

describe('TopicRepository', () => {
  let repo: TopicRepository;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    repo = new TopicRepository(mockClient as any);
  });

  describe('findAll', () => {
    it('should return all topics', async () => {
      const topics = [createMockTopic(), createMockTopic({ id: 'topic-2', name: 'Topic 2' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ data: topics, error: null }),
      });

      const result = await repo.findAll();
      expect(result).toHaveLength(2);
      expect(mockClient.from).toHaveBeenCalledWith('topics');
    });
  });

  describe('findById', () => {
    it('should return topic by id', async () => {
      const topic = createMockTopic();
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: topic, error: null }),
          }),
        }),
      });

      const result = await repo.findById('topic-1');
      expect(result).toEqual(topic);
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

  describe('getShared', () => {
    it('should return only shared topics', async () => {
      const sharedTopics = [createMockTopic({ is_shared: true, name: 'Shared' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: sharedTopics, error: null }),
        }),
      });

      const result = await repo.getShared();
      expect(result).toHaveLength(1);
      expect(result[0].is_shared).toBe(true);
    });
  });

  describe('getByAgent', () => {
    it('should return topics for a specific agent', async () => {
      const topic = createMockTopic();

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'agent_topics') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ topic_id: 'topic-1' }], error: null }),
            }),
          };
        }
        if (table === 'topics') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [topic], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repo.getByAgent('agent-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('topic-1');
    });

    it('should return empty array when agent has no topics', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repo.getByAgent('agent-no-topics');
      expect(result).toHaveLength(0);
    });
  });

  describe('createTopic', () => {
    it('should create topic with validated input', async () => {
      const newTopic = createMockTopic();
      mockClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newTopic, error: null }),
          }),
        }),
      });

      const result = await repo.createTopic({
        name: 'Test Topic',
        content: {
          description: 'Test content',
          faq: [],
          customFields: {},
        },
      });
      expect(result).toEqual(newTopic);
      expect(mockClient.from).toHaveBeenCalledWith('topics');
    });

    it('should throw on invalid input', async () => {
      await expect(repo.createTopic({ name: '' })).rejects.toThrow();
    });
  });

  describe('updateTopic', () => {
    it('should update topic with validated input', async () => {
      const updatedTopic = createMockTopic({ name: 'Updated Name' });
      mockClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedTopic, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.updateTopic('topic-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteById', () => {
    it('should delete topic by id', async () => {
      mockClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await repo.deleteById('topic-1');
      expect(result).toBe(true);
    });
  });

  describe('getAgentsUsingTopic', () => {
    it('should return agents that use a specific topic', async () => {
      const agentRow = {
        id: 'agent-1',
        name: 'Agent 1',
        description: null,
        system_prompt: null,
        routing_keywords: [],
        routing_description: null,
        handoff_rules: {},
        transfer_rules: {},
        settings: {},
        is_default: false,
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'agent_topics') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ agent_id: 'agent-1' }], error: null }),
            }),
          };
        }
        if (table === 'custom_agents') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [agentRow], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repo.getAgentsUsingTopic('topic-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('agent-1');
    });

    it('should return empty array when no agents use the topic', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repo.getAgentsUsingTopic('unused-topic');
      expect(result).toHaveLength(0);
    });
  });
});
