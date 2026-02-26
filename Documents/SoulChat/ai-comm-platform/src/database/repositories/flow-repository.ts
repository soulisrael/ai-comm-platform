import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { FlowRow, FlowRunRow, flowFromRow, flowRunFromRow } from '../db-types';
import { Flow, FlowRun, FlowCreateInput, FlowUpdateInput } from '../../types/flow';
import logger from '../../services/logger';

export class FlowRepository extends BaseRepository<FlowRow> {
  constructor(client: SupabaseClient) {
    super(client, 'flows');
  }

  async getAll(): Promise<Flow[]> {
    const rows = await this.findAll();
    return rows.map(flowFromRow);
  }

  async getById(id: string): Promise<Flow | null> {
    const row = await this.findById(id);
    return row ? flowFromRow(row) : null;
  }

  async getActive(): Promise<Flow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('active', true);

    if (error) {
      logger.error('DB getActive error (flows):', error);
      throw error;
    }
    return ((data || []) as FlowRow[]).map(flowFromRow);
  }

  async getByTrigger(triggerType: string): Promise<Flow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('trigger_type', triggerType)
      .eq('active', true);

    if (error) {
      logger.error('DB getByTrigger error (flows):', error);
      throw error;
    }
    return ((data || []) as FlowRow[]).map(flowFromRow);
  }

  async createFlow(input: unknown): Promise<Flow> {
    const validated = FlowCreateInput.parse(input);
    const row: Partial<FlowRow> = {
      name: validated.name,
      description: validated.description ?? null,
      trigger_type: validated.triggerType,
      trigger_config: validated.triggerConfig,
      nodes: validated.nodes as unknown as Record<string, unknown>[],
      edges: validated.edges as unknown as Record<string, unknown>[],
      active: validated.active,
    };

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error('DB createFlow error:', error);
      throw error;
    }
    return flowFromRow(data as FlowRow);
  }

  async updateFlow(id: string, input: unknown): Promise<Flow> {
    const validated = FlowUpdateInput.parse(input);
    const partial: Partial<FlowRow> = {};

    if (validated.name !== undefined) partial.name = validated.name;
    if (validated.description !== undefined) partial.description = validated.description ?? null;
    if (validated.triggerType !== undefined) partial.trigger_type = validated.triggerType;
    if (validated.triggerConfig !== undefined) partial.trigger_config = validated.triggerConfig;
    if (validated.nodes !== undefined) partial.nodes = validated.nodes as unknown as Record<string, unknown>[];
    if (validated.edges !== undefined) partial.edges = validated.edges as unknown as Record<string, unknown>[];
    if (validated.active !== undefined) partial.active = validated.active;

    const updated = await this.update(id, partial);
    return flowFromRow(updated);
  }

  async duplicate(id: string): Promise<Flow> {
    const original = await this.getById(id);
    if (!original) throw new Error(`Flow ${id} not found`);

    return this.createFlow({
      name: `${original.name} (עותק)`,
      description: original.description,
      triggerType: original.triggerType,
      triggerConfig: original.triggerConfig,
      nodes: original.nodes,
      edges: original.edges,
      active: false,
    });
  }

  async updateStats(id: string, status: 'success' | 'failed'): Promise<void> {
    const flow = await this.findById(id);
    if (!flow) return;

    const stats = (flow.stats || { runs: 0, success: 0, failed: 0 }) as Record<string, number>;
    stats.runs = (stats.runs || 0) + 1;
    stats[status] = (stats[status] || 0) + 1;

    await this.update(id, { stats } as Partial<FlowRow>);
  }

  // ─── Flow Runs ──────────────────────────────────────────────────────────────

  async createRun(flowId: string, conversationId?: string, contactId?: string): Promise<FlowRun> {
    const { data, error } = await this.client
      .from('flow_runs')
      .insert({
        flow_id: flowId,
        conversation_id: conversationId || null,
        contact_id: contactId || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('DB createRun error (flow_runs):', error);
      throw error;
    }
    return flowRunFromRow(data as FlowRunRow);
  }

  async getRunsByFlow(flowId: string): Promise<FlowRun[]> {
    const { data, error } = await this.client
      .from('flow_runs')
      .select('*')
      .eq('flow_id', flowId)
      .order('started_at', { ascending: false });

    if (error) {
      logger.error('DB getRunsByFlow error:', error);
      throw error;
    }
    return ((data || []) as FlowRunRow[]).map(flowRunFromRow);
  }

  async updateRun(runId: string, partial: { status?: string; current_node_id?: string; context?: Record<string, unknown>; error?: string; completed_at?: string }): Promise<FlowRun> {
    const { data, error } = await this.client
      .from('flow_runs')
      .update(partial)
      .eq('id', runId)
      .select()
      .single();

    if (error) {
      logger.error('DB updateRun error (flow_runs):', error);
      throw error;
    }
    return flowRunFromRow(data as FlowRunRow);
  }
}
