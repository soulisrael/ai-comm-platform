import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { TopicRow, CustomAgentRow, AgentTopicRow } from '../db-types';
import { TopicCreateInput, TopicUpdateInput } from '../../types/topic';
import logger from '../../services/logger';

export class TopicRepository extends BaseRepository<TopicRow> {
  constructor(client: SupabaseClient) {
    super(client, 'topics');
  }

  async getShared(): Promise<TopicRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('is_shared', true);

    if (error) {
      logger.error('DB getShared error (topics):', error);
      throw error;
    }
    return (data || []) as TopicRow[];
  }

  async getByAgent(agentId: string): Promise<TopicRow[]> {
    const { data: junctionData, error: junctionError } = await this.client
      .from('agent_topics')
      .select('topic_id')
      .eq('agent_id', agentId);

    if (junctionError) {
      logger.error('DB getByAgent junction error:', junctionError);
      throw junctionError;
    }

    const topicIds = (junctionData || []).map((row: { topic_id: string }) => row.topic_id);
    if (topicIds.length === 0) return [];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .in('id', topicIds);

    if (error) {
      logger.error('DB getByAgent topics error:', error);
      throw error;
    }
    return (data || []) as TopicRow[];
  }

  async createTopic(input: unknown): Promise<TopicRow> {
    const validated = TopicCreateInput.parse(input);
    const row: Partial<TopicRow> = {
      name: validated.name,
      description: validated.description ?? null,
      content: validated.content as unknown as Record<string, unknown>,
      is_shared: validated.isShared,
    };

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error('DB createTopic error:', error);
      throw error;
    }
    return data as TopicRow;
  }

  async updateTopic(id: string, input: unknown): Promise<TopicRow> {
    const validated = TopicUpdateInput.parse(input);
    const partial: Partial<TopicRow> = {};

    if (validated.name !== undefined) partial.name = validated.name;
    if (validated.description !== undefined) partial.description = validated.description ?? null;
    if (validated.content !== undefined) partial.content = validated.content as unknown as Record<string, unknown>;
    if (validated.isShared !== undefined) partial.is_shared = validated.isShared;

    return this.update(id, partial);
  }

  async getAgentsUsingTopic(topicId: string): Promise<CustomAgentRow[]> {
    const { data: junctionData, error: junctionError } = await this.client
      .from('agent_topics')
      .select('agent_id')
      .eq('topic_id', topicId);

    if (junctionError) {
      logger.error('DB getAgentsUsingTopic junction error:', junctionError);
      throw junctionError;
    }

    const agentIds = (junctionData || []).map((row: { agent_id: string }) => row.agent_id);
    if (agentIds.length === 0) return [];

    const { data, error } = await this.client
      .from('custom_agents')
      .select('*')
      .in('id', agentIds);

    if (error) {
      logger.error('DB getAgentsUsingTopic agents error:', error);
      throw error;
    }
    return (data || []) as CustomAgentRow[];
  }
}
