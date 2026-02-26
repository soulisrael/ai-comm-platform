import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TeamRepository } from '../../src/database/repositories/team-repository';
import { TeamMemberRow } from '../../src/database/db-types';

function createMockMember(overrides: Partial<TeamMemberRow> = {}): TeamMemberRow {
  return {
    id: 'member-1',
    email: 'test@funkids.co.il',
    name: 'Test User',
    avatar_url: null,
    role: 'agent',
    password_hash: '$2a$10$hashedpassword',
    status: 'offline',
    max_concurrent_chats: 5,
    assigned_agents: [],
    skills: ['sales'],
    settings: {},
    last_seen_at: null,
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
  const mockEq = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ data: [], error: null }),
    single: mockSingle,
    limit: mockLimit,
    in: mockIn,
  });
  const mockSelect = vi.fn().mockReturnValue({
    eq: mockEq,
    in: mockIn,
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

  const from = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  });

  return { from, _mocks: { mockSelect, mockInsert, mockUpdate, mockDelete, mockSingle, mockEq, mockLimit, mockIn } };
}

describe('TeamRepository', () => {
  let repo: TeamRepository;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    repo = new TeamRepository(mockClient as any);
  });

  describe('getAll', () => {
    it('should return all team members mapped to TeamMember', async () => {
      const members = [createMockMember(), createMockMember({ id: 'member-2', name: 'Agent 2' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ data: members, error: null }),
      });

      const result = await repo.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('test@funkids.co.il');
      expect(result[0].name).toBe('Test User');
      expect(mockClient.from).toHaveBeenCalledWith('team_members');
    });
  });

  describe('getById', () => {
    it('should return team member by id', async () => {
      const member = createMockMember();
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: member, error: null }),
          }),
        }),
      });

      const result = await repo.getById('member-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('member-1');
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

  describe('getByEmail', () => {
    it('should return member by email', async () => {
      const member = createMockMember();
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: member, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.getByEmail('test@funkids.co.il');
      expect(result).not.toBeNull();
      expect(result!.email).toBe('test@funkids.co.il');
    });

    it('should return null when email not found', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      });

      const result = await repo.getByEmail('nonexistent@test.com');
      expect(result).toBeNull();
    });
  });

  describe('getOnline', () => {
    it('should return online and away members', async () => {
      const members = [
        createMockMember({ status: 'online' }),
        createMockMember({ id: 'member-2', status: 'away' }),
      ];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: members, error: null }),
          }),
        }),
      });

      const result = await repo.getOnline();
      expect(result).toHaveLength(2);
    });
  });

  describe('getAvailableForChat', () => {
    it('should return only online members', async () => {
      const members = [createMockMember({ status: 'online' })];
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: members, error: null }),
          }),
        }),
      });

      const result = await repo.getAvailableForChat();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('online');
    });
  });

  describe('create', () => {
    it('should create a team member with validated input', async () => {
      const newMember = createMockMember();
      mockClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newMember, error: null }),
          }),
        }),
      });

      const result = await repo.create({
        email: 'test@funkids.co.il',
        name: 'Test User',
        password: 'hashed_password_here',
      });
      expect(result.email).toBe('test@funkids.co.il');
    });

    it('should throw on invalid input', async () => {
      await expect(repo.create({ email: 'not-an-email', name: '', password: '12' })).rejects.toThrow();
    });
  });

  describe('updateMember', () => {
    it('should update member with validated input', async () => {
      const updatedMember = createMockMember({ name: 'Updated Name' });
      mockClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedMember, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.updateMember('member-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('updateStatus', () => {
    it('should update member status and last_seen_at', async () => {
      const updatedMember = createMockMember({ status: 'online', last_seen_at: '2024-06-01T00:00:00Z' });
      mockClient.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedMember, error: null }),
            }),
          }),
        }),
      });

      const result = await repo.updateStatus('member-1', 'online');
      expect(result.status).toBe('online');
    });
  });

  describe('deleteById', () => {
    it('should delete member by id', async () => {
      mockClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const result = await repo.deleteById('member-1');
      expect(result).toBe(true);
    });
  });
});
