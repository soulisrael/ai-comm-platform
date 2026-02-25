import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { ContactRow } from '../db-types';
import logger from '../../services/logger';

export class ContactRepository extends BaseRepository<ContactRow> {
  constructor(client: SupabaseClient) {
    super(client, 'contacts');
  }

  async findByChannelUser(channel: string, channelUserId: string): Promise<ContactRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('channel', channel)
      .eq('channel_user_id', channelUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('DB findByChannelUser error:', error);
      throw error;
    }
    return data as ContactRow;
  }

  async search(query: string): Promise<ContactRow[]> {
    const pattern = `%${query}%`;
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .or(`name.ilike.${pattern},email.ilike.${pattern},channel_user_id.ilike.${pattern}`);

    if (error) {
      logger.error('DB search error:', error);
      throw error;
    }
    return (data || []) as ContactRow[];
  }
}
