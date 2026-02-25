import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { MessageRow } from '../db-types';
import logger from '../../services/logger';

export class MessageRepository extends BaseRepository<MessageRow> {
  constructor(client: SupabaseClient) {
    super(client, 'messages');
  }

  async findByConversation(conversationId: string, limit?: number): Promise<MessageRow[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('DB findByConversation error:', error);
      throw error;
    }
    return (data || []) as MessageRow[];
  }

  async countByConversation(conversationId: string): Promise<number> {
    const { count, error } = await this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (error) {
      logger.error('DB countByConversation error:', error);
      throw error;
    }
    return count || 0;
  }
}
