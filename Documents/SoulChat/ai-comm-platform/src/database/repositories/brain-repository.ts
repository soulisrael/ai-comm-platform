import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { AgentBrainRow, brainEntryFromRow } from '../db-types';
import { BrainEntry, BrainEntryCreateInput, BrainEntryUpdateInput } from '../../types/custom-agent';
import logger from '../../services/logger';

export class BrainRepository extends BaseRepository<AgentBrainRow> {
  constructor(client: SupabaseClient) {
    super(client, 'agent_brain');
  }

  async getByAgent(agentId: string): Promise<BrainEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('agent_id', agentId)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('DB getByAgent error (agent_brain):', error);
      throw error;
    }
    return ((data || []) as AgentBrainRow[]).map(brainEntryFromRow);
  }

  async getByAgentAndCategory(agentId: string, category: string): Promise<BrainEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('agent_id', agentId)
      .eq('category', category)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('DB getByAgentAndCategory error:', error);
      throw error;
    }
    return ((data || []) as AgentBrainRow[]).map(brainEntryFromRow);
  }

  async getActiveByAgent(agentId: string): Promise<BrainEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('agent_id', agentId)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('DB getActiveByAgent error:', error);
      throw error;
    }
    return ((data || []) as AgentBrainRow[]).map(brainEntryFromRow);
  }

  async createEntry(input: unknown): Promise<BrainEntry> {
    const validated = BrainEntryCreateInput.parse(input);
    const row: Partial<AgentBrainRow> = {
      agent_id: validated.agentId,
      title: validated.title,
      content: validated.content,
      category: validated.category,
      metadata: validated.metadata as Record<string, any>,
      sort_order: validated.sortOrder,
      active: validated.active,
    };

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error('DB createEntry error (agent_brain):', error);
      throw error;
    }
    return brainEntryFromRow(data as AgentBrainRow);
  }

  async updateEntry(id: string, input: unknown): Promise<BrainEntry> {
    const validated = BrainEntryUpdateInput.parse(input);
    const partial: Partial<AgentBrainRow> = {};

    if (validated.title !== undefined) partial.title = validated.title;
    if (validated.content !== undefined) partial.content = validated.content;
    if (validated.category !== undefined) partial.category = validated.category;
    if (validated.metadata !== undefined) partial.metadata = validated.metadata as Record<string, any>;
    if (validated.sortOrder !== undefined) partial.sort_order = validated.sortOrder;
    if (validated.active !== undefined) partial.active = validated.active;

    const updated = await this.update(id, partial);
    return brainEntryFromRow(updated);
  }

  async reorder(agentId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await this.client
        .from(this.tableName)
        .update({ sort_order: i })
        .eq('id', orderedIds[i])
        .eq('agent_id', agentId);

      if (error) {
        logger.error('DB reorder error (agent_brain):', error);
        throw error;
      }
    }
  }

  async search(agentId: string, query: string): Promise<BrainEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('agent_id', agentId)
      .eq('active', true)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error('DB search error (agent_brain):', error);
      throw error;
    }
    return ((data || []) as AgentBrainRow[]).map(brainEntryFromRow);
  }

  async duplicateForAgent(sourceAgentId: string, targetAgentId: string): Promise<BrainEntry[]> {
    const entries = await this.getByAgent(sourceAgentId);
    const created: BrainEntry[] = [];

    for (const entry of entries) {
      const newEntry = await this.createEntry({
        agentId: targetAgentId,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        metadata: entry.metadata,
        sortOrder: entry.sortOrder,
        active: entry.active,
      });
      created.push(newEntry);
    }

    return created;
  }
}
