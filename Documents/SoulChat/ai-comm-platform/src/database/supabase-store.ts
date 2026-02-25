/**
 * Write-through cache implementing Store<T> with async Supabase persistence.
 *
 * All reads are synchronous from the internal MemoryStore cache.
 * All writes update cache first (synchronous), then fire-and-forget persist to Supabase.
 * On startup, hydrate() loads all data from Supabase into the cache.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Store, MemoryStore } from '../conversation/memory-store';
import logger from '../services/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RowMapper<T> {
  toRow: (item: T) => any;
  fromRow: (row: any) => T;
}

export class SupabaseStore<T extends { id: string }> implements Store<T> {
  private cache: MemoryStore<T>;
  private client: SupabaseClient;
  private tableName: string;
  private mapper: RowMapper<T>;
  private hydrated = false;

  constructor(
    client: SupabaseClient,
    tableName: string,
    mapper: RowMapper<T>
  ) {
    this.cache = new MemoryStore<T>();
    this.client = client;
    this.tableName = tableName;
    this.mapper = mapper;
  }

  /** Load all rows from Supabase into the in-memory cache. */
  async hydrate(): Promise<void> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*');

      if (error) {
        logger.error(`Hydration error (${this.tableName}):`, error);
        throw error;
      }

      for (const row of data || []) {
        const item = this.mapper.fromRow(row);
        this.cache.create(item);
      }

      this.hydrated = true;
      logger.info(`Hydrated ${this.tableName}: ${this.cache.size} items`);
    } catch (err) {
      logger.error(`Failed to hydrate ${this.tableName}, starting with empty cache:`, err);
      this.hydrated = true; // Continue with empty cache rather than blocking startup
    }
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  // ─── Synchronous Store<T> interface ───────────────────────────────────────

  get(id: string): T | undefined {
    return this.cache.get(id);
  }

  getAll(): T[] {
    return this.cache.getAll();
  }

  find(predicate: (item: T) => boolean): T[] {
    return this.cache.find(predicate);
  }

  create(item: T): T {
    const result = this.cache.create(item);
    this.persistCreate(item);
    return result;
  }

  update(id: string, partial: Partial<T>): T {
    const result = this.cache.update(id, partial);
    this.persistUpdate(id, result);
    return result;
  }

  delete(id: string): boolean {
    const result = this.cache.delete(id);
    if (result) {
      this.persistDelete(id);
    }
    return result;
  }

  // ─── Async persistence (fire-and-forget) ──────────────────────────────────

  private persistCreate(item: T): void {
    const row = this.mapper.toRow(item);
    this.client
      .from(this.tableName)
      .upsert(row)
      .then(({ error }) => {
        if (error) {
          logger.error(`Persist create error (${this.tableName}/${item.id}):`, error);
        }
      });
  }

  private persistUpdate(id: string, item: T): void {
    const row = this.mapper.toRow(item);
    this.client
      .from(this.tableName)
      .upsert(row)
      .then(({ error }) => {
        if (error) {
          logger.error(`Persist update error (${this.tableName}/${id}):`, error);
        }
      });
  }

  private persistDelete(id: string): void {
    this.client
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          logger.error(`Persist delete error (${this.tableName}/${id}):`, error);
        }
      });
  }
}
