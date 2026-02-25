import { SupabaseClient } from '@supabase/supabase-js';
import logger from '../../services/logger';

export abstract class BaseRepository<TRow extends { id: string }> {
  protected client: SupabaseClient;
  protected tableName: string;

  constructor(client: SupabaseClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  async findById(id: string): Promise<TRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error(`DB findById error (${this.tableName}):`, error);
      throw error;
    }
    return data as TRow;
  }

  async findAll(): Promise<TRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*');

    if (error) {
      logger.error(`DB findAll error (${this.tableName}):`, error);
      throw error;
    }
    return (data || []) as TRow[];
  }

  async insert(row: TRow): Promise<TRow> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error(`DB insert error (${this.tableName}):`, error);
      throw error;
    }
    return data as TRow;
  }

  async update(id: string, partial: Partial<TRow>): Promise<TRow> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(partial)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`DB update error (${this.tableName}):`, error);
      throw error;
    }
    return data as TRow;
  }

  async deleteById(id: string): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error(`DB delete error (${this.tableName}):`, error);
      return false;
    }
    return true;
  }
}
