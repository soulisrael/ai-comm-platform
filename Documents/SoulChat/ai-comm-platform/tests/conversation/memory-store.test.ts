import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../../src/conversation/memory-store';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

describe('MemoryStore', () => {
  let store: MemoryStore<TestItem>;

  beforeEach(() => {
    store = new MemoryStore<TestItem>();
  });

  it('should create and get an item', () => {
    const item: TestItem = { id: '1', name: 'test', value: 42 };
    store.create(item);

    const result = store.get('1');
    expect(result).toBeDefined();
    expect(result!.name).toBe('test');
    expect(result!.value).toBe(42);
  });

  it('should return undefined for non-existent item', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('should get all items', () => {
    store.create({ id: '1', name: 'a', value: 1 });
    store.create({ id: '2', name: 'b', value: 2 });
    store.create({ id: '3', name: 'c', value: 3 });

    const all = store.getAll();
    expect(all).toHaveLength(3);
  });

  it('should find items by predicate', () => {
    store.create({ id: '1', name: 'a', value: 10 });
    store.create({ id: '2', name: 'b', value: 20 });
    store.create({ id: '3', name: 'c', value: 30 });

    const found = store.find(item => item.value > 15);
    expect(found).toHaveLength(2);
  });

  it('should update an item', () => {
    store.create({ id: '1', name: 'original', value: 1 });
    const updated = store.update('1', { name: 'updated', value: 99 });

    expect(updated.name).toBe('updated');
    expect(updated.value).toBe(99);
    expect(store.get('1')!.name).toBe('updated');
  });

  it('should throw when updating non-existent item', () => {
    expect(() => store.update('nonexistent', { name: 'x' })).toThrow('Item not found');
  });

  it('should delete an item', () => {
    store.create({ id: '1', name: 'test', value: 1 });
    expect(store.delete('1')).toBe(true);
    expect(store.get('1')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('should return false when deleting non-existent item', () => {
    expect(store.delete('nonexistent')).toBe(false);
  });

  it('should track size', () => {
    expect(store.size).toBe(0);
    store.create({ id: '1', name: 'a', value: 1 });
    expect(store.size).toBe(1);
    store.create({ id: '2', name: 'b', value: 2 });
    expect(store.size).toBe(2);
    store.delete('1');
    expect(store.size).toBe(1);
  });

  it('should clear all items', () => {
    store.create({ id: '1', name: 'a', value: 1 });
    store.create({ id: '2', name: 'b', value: 2 });
    store.clear();
    expect(store.size).toBe(0);
    expect(store.getAll()).toHaveLength(0);
  });

  it('should handle concurrent access with locks', async () => {
    let counter = 0;

    const task1 = store.withLock('key1', async () => {
      const val = counter;
      await new Promise(r => setTimeout(r, 50));
      counter = val + 1;
      return counter;
    });

    const task2 = store.withLock('key1', async () => {
      const val = counter;
      await new Promise(r => setTimeout(r, 50));
      counter = val + 1;
      return counter;
    });

    await Promise.all([task1, task2]);
    // Both should run sequentially, so counter should be 2
    expect(counter).toBe(2);
  });

  it('should report lock status', async () => {
    expect(store.isLocked('key1')).toBe(false);

    const promise = store.withLock('key1', async () => {
      expect(store.isLocked('key1')).toBe(true);
      await new Promise(r => setTimeout(r, 20));
    });

    // Give the lock a moment to acquire
    await new Promise(r => setTimeout(r, 5));
    expect(store.isLocked('key1')).toBe(true);

    await promise;
    expect(store.isLocked('key1')).toBe(false);
  });
});
