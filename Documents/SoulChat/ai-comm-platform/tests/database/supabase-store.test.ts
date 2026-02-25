import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseStore, RowMapper } from '../../src/database/supabase-store';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

interface TestRow {
  id: string;
  name: string;
  value: number;
}

const mapper: RowMapper<TestItem> = {
  toRow: (item) => ({ id: item.id, name: item.name, value: item.value }),
  fromRow: (row) => ({ id: row.id as string, name: row.name as string, value: row.value as number }),
};

function createMockClient() {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn().mockReturnValue({
    select: mockSelect.mockReturnValue({
      data: [],
      error: null,
    }),
    insert: mockInsert,
    upsert: mockUpsert,
    delete: mockDelete.mockReturnValue({
      eq: mockEq,
    }),
  });

  return { from, _mocks: { mockSelect, mockInsert, mockUpsert, mockDelete, mockEq } };
}

describe('SupabaseStore', () => {
  let store: SupabaseStore<TestItem>;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    store = new SupabaseStore<TestItem>(
      mockClient as any,
      'test_items',
      mapper
    );
  });

  describe('before hydration', () => {
    it('should report not hydrated initially', () => {
      expect(store.isHydrated()).toBe(false);
    });
  });

  describe('hydrate', () => {
    it('should load data from Supabase into cache', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [
            { id: '1', name: 'Alice', value: 10 },
            { id: '2', name: 'Bob', value: 20 },
          ],
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      });

      await store.hydrate();

      expect(store.isHydrated()).toBe(true);
      expect(store.getAll()).toHaveLength(2);
      expect(store.get('1')).toEqual({ id: '1', name: 'Alice', value: 10 });
    });

    it('should continue with empty cache on error', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: null,
          error: { message: 'DB error', code: '500' },
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      });

      await store.hydrate();

      expect(store.isHydrated()).toBe(true);
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe('synchronous operations', () => {
    beforeEach(async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({ data: [], error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      });
      await store.hydrate();
    });

    it('should create items in cache and persist', () => {
      const item = { id: 'test-1', name: 'Test', value: 42 };
      const result = store.create(item);

      expect(result).toEqual(item);
      expect(store.get('test-1')).toEqual(item);
    });

    it('should update items in cache', () => {
      store.create({ id: 'test-1', name: 'Test', value: 42 });
      const updated = store.update('test-1', { value: 100 });

      expect(updated.value).toBe(100);
      expect(store.get('test-1')?.value).toBe(100);
    });

    it('should delete items from cache', () => {
      store.create({ id: 'test-1', name: 'Test', value: 42 });
      const deleted = store.delete('test-1');

      expect(deleted).toBe(true);
      expect(store.get('test-1')).toBeUndefined();
    });

    it('should find items by predicate', () => {
      store.create({ id: '1', name: 'Alice', value: 10 });
      store.create({ id: '2', name: 'Bob', value: 20 });
      store.create({ id: '3', name: 'Alice', value: 30 });

      const results = store.find(item => item.name === 'Alice');
      expect(results).toHaveLength(2);
    });

    it('should return all items', () => {
      store.create({ id: '1', name: 'A', value: 1 });
      store.create({ id: '2', name: 'B', value: 2 });

      expect(store.getAll()).toHaveLength(2);
    });
  });
});
