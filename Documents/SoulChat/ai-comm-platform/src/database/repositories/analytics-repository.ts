import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { AnalyticsEventRow } from '../db-types';
import logger from '../../services/logger';

export class AnalyticsRepository extends BaseRepository<AnalyticsEventRow> {
  constructor(client: SupabaseClient) {
    super(client, 'analytics_events');
  }

  async trackEvent(
    eventType: string,
    data: Record<string, unknown>,
    conversationId?: string,
    contactId?: string
  ): Promise<AnalyticsEventRow> {
    const row: AnalyticsEventRow = {
      id: crypto.randomUUID(),
      event_type: eventType,
      conversation_id: conversationId || null,
      contact_id: contactId || null,
      data,
      created_at: new Date().toISOString(),
    };
    return this.insert(row);
  }

  async findByType(eventType: string, limit = 100): Promise<AnalyticsEventRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('DB findByType error:', error);
      throw error;
    }
    return (data || []) as AnalyticsEventRow[];
  }

  async countByType(eventType: string): Promise<number> {
    const { count, error } = await this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('event_type', eventType);

    if (error) {
      logger.error('DB countByType error:', error);
      throw error;
    }
    return count || 0;
  }
}
