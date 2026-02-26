import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { WaConfigRow, WaTemplateRow, waConfigFromRow, waTemplateFromRow } from '../db-types';
import { WaConfig, WaTemplate } from '../../types/whatsapp';
import logger from '../../services/logger';

export class WaConfigRepository extends BaseRepository<WaConfigRow> {
  constructor(client: SupabaseClient) {
    super(client, 'wa_config');
  }

  async get(): Promise<WaConfig | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('DB get error (wa_config):', error);
      throw error;
    }
    return waConfigFromRow(data as WaConfigRow);
  }

  async upsert(config: Partial<WaConfigRow>): Promise<WaConfig> {
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(config)
      .select()
      .single();

    if (error) {
      logger.error('DB upsert error (wa_config):', error);
      throw error;
    }
    return waConfigFromRow(data as WaConfigRow);
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  async getTemplates(): Promise<WaTemplate[]> {
    const { data, error } = await this.client
      .from('wa_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('DB getTemplates error (wa_templates):', error);
      throw error;
    }
    return ((data || []) as WaTemplateRow[]).map(waTemplateFromRow);
  }

  async getTemplateById(id: string): Promise<WaTemplate | null> {
    const { data, error } = await this.client
      .from('wa_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('DB getTemplateById error:', error);
      throw error;
    }
    return waTemplateFromRow(data as WaTemplateRow);
  }

  async createTemplate(template: Partial<WaTemplateRow>): Promise<WaTemplate> {
    const { data, error } = await this.client
      .from('wa_templates')
      .insert(template)
      .select()
      .single();

    if (error) {
      logger.error('DB createTemplate error:', error);
      throw error;
    }
    return waTemplateFromRow(data as WaTemplateRow);
  }

  async updateTemplateStatus(id: string, metaStatus: string, metaTemplateId?: string): Promise<WaTemplate> {
    const partial: Partial<WaTemplateRow> = { meta_status: metaStatus };
    if (metaTemplateId) partial.meta_template_id = metaTemplateId;

    const { data, error } = await this.client
      .from('wa_templates')
      .update(partial)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('DB updateTemplateStatus error:', error);
      throw error;
    }
    return waTemplateFromRow(data as WaTemplateRow);
  }
}
