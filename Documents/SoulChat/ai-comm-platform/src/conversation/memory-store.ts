export interface Store<T extends { id: string }> {
  get(id: string): T | undefined;
  getAll(): T[];
  find(predicate: (item: T) => boolean): T[];
  create(item: T): T;
  update(id: string, partial: Partial<T>): T;
  delete(id: string): boolean;
}

export class MemoryStore<T extends { id: string }> implements Store<T> {
  private items: Map<string, T> = new Map();
  private locks: Set<string> = new Set();

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  find(predicate: (item: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }

  create(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  update(id: string, partial: Partial<T>): T {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Item not found: ${id}`);
    }
    const updated = { ...existing, ...partial };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  get size(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  // Simple locking for per-conversation concurrency control
  async withLock<R>(key: string, fn: () => Promise<R>): Promise<R> {
    while (this.locks.has(key)) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.locks.add(key);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
    }
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }
}
