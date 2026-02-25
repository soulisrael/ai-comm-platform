import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { HandoffRow } from '../db-types';
import logger from '../../services/logger';

export class HandoffRepository extends BaseRepository<HandoffRow> {
  constructor(client: SupabaseClient) {
    super(client, 'handoffs');
  }

  async findPending(): Promise<HandoffRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('DB findPending error:', error);
      throw error;
    }
    return (data || []) as HandoffRow[];
  }

  async assign(id: string, assignedTo: string): Promise<HandoffRow> {
    return this.update(id, {
      assigned_to: assignedTo,
      status: 'assigned',
    } as Partial<HandoffRow>);
  }

  async resolve(id: string): Promise<HandoffRow> {
    return this.update(id, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    } as Partial<HandoffRow>);
  }
}
