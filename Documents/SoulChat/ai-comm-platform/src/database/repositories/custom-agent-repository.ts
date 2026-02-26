import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { CustomAgentRow, AgentBrainRow, customAgentFromRow, brainEntryFromRow } from '../db-types';
import { CustomAgentWithBrain } from '../../types/custom-agent';
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

  async getWithBrain(id: string): Promise<CustomAgentWithBrain | null> {
    const agentRow = await this.findById(id);
    if (!agentRow) return null;

    const { data: brainData, error: brainError } = await this.client
      .from('agent_brain')
      .select('*')
      .eq('agent_id', id)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (brainError) {
      logger.error('DB getWithBrain brain error:', brainError);
      throw brainError;
    }

    const agent = customAgentFromRow(agentRow);
    const brain = ((brainData || []) as AgentBrainRow[]).map(brainEntryFromRow);

    return { ...agent, brain };
  }

  async getAllWithBrain(): Promise<CustomAgentWithBrain[]> {
    const agents = await this.findAll();

    const { data: brainData, error: brainError } = await this.client
      .from('agent_brain')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (brainError) {
      logger.error('DB getAllWithBrain brain error:', brainError);
      throw brainError;
    }

    const brainByAgent = new Map<string, AgentBrainRow[]>();
    for (const row of (brainData || []) as AgentBrainRow[]) {
      const list = brainByAgent.get(row.agent_id) || [];
      list.push(row);
      brainByAgent.set(row.agent_id, list);
    }

    return agents.map(agentRow => {
      const agent = customAgentFromRow(agentRow);
      const brainRows = brainByAgent.get(agentRow.id) || [];
      const brain = brainRows.map(brainEntryFromRow);
      return { ...agent, brain };
    });
  }

  // Legacy alias — used by router and prompt builder
  async getWithTopics(id: string): Promise<CustomAgentWithBrain | null> {
    return this.getWithBrain(id);
  }

  async getAllWithTopics(): Promise<CustomAgentWithBrain[]> {
    return this.getAllWithBrain();
  }

  async createAgent(input: unknown): Promise<CustomAgentRow> {
    const validated = CustomAgentCreateInput.parse(input);
    const row: Partial<CustomAgentRow> = {
      name: validated.name,
      description: validated.description ?? null,
      system_prompt: validated.systemPrompt,
      main_document_text: null,
      main_document_filename: null,
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

  async updateDocument(id: string, text: string | null, filename: string | null): Promise<CustomAgentRow> {
    return this.update(id, {
      main_document_text: text,
      main_document_filename: filename,
    } as Partial<CustomAgentRow>);
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
