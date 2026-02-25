import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { ConversationRow } from '../db-types';
import logger from '../../services/logger';

export interface ConversationFiltersDB {
  status?: string;
  channel?: string;
  currentAgent?: string;
  contactId?: string;
  startedAfter?: string;
  startedBefore?: string;
}

export class ConversationRepository extends BaseRepository<ConversationRow> {
  constructor(client: SupabaseClient) {
    super(client, 'conversations');
  }

  async findByContactAndStatus(contactId: string, statuses: string[]): Promise<ConversationRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('contact_id', contactId)
      .in('status', statuses)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('DB findByContactAndStatus error:', error);
      throw error;
    }
    return (data || []) as ConversationRow[];
  }

  async findByFilters(filters: ConversationFiltersDB): Promise<ConversationRow[]> {
    let query = this.client.from(this.tableName).select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.channel) query = query.eq('channel', filters.channel);
    if (filters.currentAgent) query = query.eq('current_agent', filters.currentAgent);
    if (filters.contactId) query = query.eq('contact_id', filters.contactId);
    if (filters.startedAfter) query = query.gte('started_at', filters.startedAfter);
    if (filters.startedBefore) query = query.lte('started_at', filters.startedBefore);

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      logger.error('DB findByFilters error:', error);
      throw error;
    }
    return (data || []) as ConversationRow[];
  }
}
