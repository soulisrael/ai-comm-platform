import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { CustomAgentRow, TopicRow, AgentTopicRow, customAgentFromRow, topicFromRow } from '../db-types';
import { CustomAgentWithTopics } from '../../types/custom-agent';
import { CustomAgentCreateInput, CustomAgentUpdateInput } from '../../types/custom-agent';
import logger from '../../services/logger';

export class CustomAgentRepository extends BaseRepository<CustomAgentRow> {
  constructor(client: SupabaseClient) {
    super(client, 'custom_agents');
  }

  async getActive(): Promise<CustomAgentRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('active', true);

    if (error) {
      logger.error('DB getActive error (custom_agents):', error);
      throw error;
    }
    return (data || []) as CustomAgentRow[];
  }

  async getDefault(): Promise<CustomAgentRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('DB getDefault error (custom_agents):', error);
      throw error;
    }
    return data as CustomAgentRow;
  }

  async getWithTopics(id: string): Promise<CustomAgentWithTopics | null> {
    const agentRow = await this.findById(id);
    if (!agentRow) return null;

    const { data: junctionData, error: junctionError } = await this.client
      .from('agent_topics')
      .select('topic_id')
      .eq('agent_id', id);

    if (junctionError) {
      logger.error('DB getWithTopics junction error:', junctionError);
      throw junctionError;
    }

    const topicIds = (junctionData || []).map((row: { topic_id: string }) => row.topic_id);
    let topics: TopicRow[] = [];

    if (topicIds.length > 0) {
      const { data: topicData, error: topicError } = await this.client
        .from('topics')
        .select('*')
        .in('id', topicIds);

      if (topicError) {
        logger.error('DB getWithTopics topics error:', topicError);
        throw topicError;
      }
      topics = (topicData || []) as TopicRow[];
    }

    const agent = customAgentFromRow(agentRow);
    return {
      ...agent,
      topics: topics.map(topicFromRow),
    };
  }

  async getAllWithTopics(): Promise<CustomAgentWithTopics[]> {
    const agents = await this.findAll();

    const { data: junctionData, error: junctionError } = await this.client
      .from('agent_topics')
      .select('*');

    if (junctionError) {
      logger.error('DB getAllWithTopics junction error:', junctionError);
      throw junctionError;
    }

    const agentIds = agents.map(a => a.id);
    const topicIds = [...new Set((junctionData || []).map((row: AgentTopicRow) => row.topic_id))];

    let topicsMap = new Map<string, TopicRow>();

    if (topicIds.length > 0) {
      const { data: topicData, error: topicError } = await this.client
        .from('topics')
        .select('*')
        .in('id', topicIds);

      if (topicError) {
        logger.error('DB getAllWithTopics topics error:', topicError);
        throw topicError;
      }
      for (const t of (topicData || []) as TopicRow[]) {
        topicsMap.set(t.id, t);
      }
    }

    const junctionByAgent = new Map<string, string[]>();
    for (const row of (junctionData || []) as AgentTopicRow[]) {
      const list = junctionByAgent.get(row.agent_id) || [];
      list.push(row.topic_id);
      junctionByAgent.set(row.agent_id, list);
    }

    return agents.map(agentRow => {
      const agent = customAgentFromRow(agentRow);
      const agentTopicIds = junctionByAgent.get(agentRow.id) || [];
      const topics = agentTopicIds
        .map(tid => topicsMap.get(tid))
        .filter((t): t is TopicRow => t !== undefined)
        .map(topicFromRow);
      return { ...agent, topics };
    });
  }

  async createAgent(input: unknown): Promise<CustomAgentRow> {
    const validated = CustomAgentCreateInput.parse(input);
    const row: Partial<CustomAgentRow> = {
      name: validated.name,
      description: validated.description ?? null,
      system_prompt: validated.systemPrompt ?? null,
      routing_keywords: validated.routingKeywords,
      routing_description: validated.routingDescription ?? null,
      handoff_rules: validated.handoffRules,
      transfer_rules: validated.transferRules,
      settings: validated.settings as unknown as Record<string, unknown>,
      is_default: validated.isDefault,
      active: validated.active,
    };

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error('DB createAgent error:', error);
      throw error;
    }
    return data as CustomAgentRow;
  }

  async updateAgent(id: string, input: unknown): Promise<CustomAgentRow> {
    const validated = CustomAgentUpdateInput.parse(input);
    const partial: Partial<CustomAgentRow> = {};

    if (validated.name !== undefined) partial.name = validated.name;
    if (validated.description !== undefined) partial.description = validated.description ?? null;
    if (validated.systemPrompt !== undefined) partial.system_prompt = validated.systemPrompt ?? null;
    if (validated.routingKeywords !== undefined) partial.routing_keywords = validated.routingKeywords;
    if (validated.routingDescription !== undefined) partial.routing_description = validated.routingDescription ?? null;
    if (validated.handoffRules !== undefined) partial.handoff_rules = validated.handoffRules;
    if (validated.transferRules !== undefined) partial.transfer_rules = validated.transferRules;
    if (validated.settings !== undefined) partial.settings = validated.settings as unknown as Record<string, unknown>;
    if (validated.isDefault !== undefined) partial.is_default = validated.isDefault;
    if (validated.active !== undefined) partial.active = validated.active;

    return this.update(id, partial);
  }

  async assignTopic(agentId: string, topicId: string): Promise<void> {
    const { error } = await this.client
      .from('agent_topics')
      .insert({ agent_id: agentId, topic_id: topicId });

    if (error) {
      logger.error('DB assignTopic error:', error);
      throw error;
    }
  }

  async removeTopic(agentId: string, topicId: string): Promise<void> {
    const { error } = await this.client
      .from('agent_topics')
      .delete()
      .eq('agent_id', agentId)
      .eq('topic_id', topicId);

    if (error) {
      logger.error('DB removeTopic error:', error);
      throw error;
    }
  }

  async getByKeyword(keyword: string): Promise<CustomAgentRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .contains('routing_keywords', [keyword]);

    if (error) {
      logger.error('DB getByKeyword error:', error);
      throw error;
    }
    return (data || []) as CustomAgentRow[];
  }
}
