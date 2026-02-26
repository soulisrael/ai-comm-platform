import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base-repository';
import { TeamMemberRow, teamMemberFromRow } from '../db-types';
import { TeamMember } from '../../types/team';
import { TeamMemberCreateInput, TeamMemberUpdateInput } from '../../types/team';
import logger from '../../services/logger';

export class TeamRepository extends BaseRepository<TeamMemberRow> {
  constructor(client: SupabaseClient) {
    super(client, 'team_members');
  }

  async getAll(): Promise<TeamMember[]> {
    const rows = await this.findAll();
    return rows.map(teamMemberFromRow);
  }

  async getById(id: string): Promise<TeamMember | null> {
    const row = await this.findById(id);
    return row ? teamMemberFromRow(row) : null;
  }

  async getByEmail(email: string): Promise<TeamMemberRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('DB getByEmail error (team_members):', error);
      throw error;
    }
    return data as TeamMemberRow;
  }

  async getOnline(): Promise<TeamMember[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('active', true)
      .in('status', ['online', 'away']);

    if (error) {
      logger.error('DB getOnline error (team_members):', error);
      throw error;
    }
    return ((data || []) as TeamMemberRow[]).map(teamMemberFromRow);
  }

  async getAvailableForChat(): Promise<TeamMember[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('active', true)
      .eq('status', 'online');

    if (error) {
      logger.error('DB getAvailableForChat error (team_members):', error);
      throw error;
    }
    return ((data || []) as TeamMemberRow[]).map(teamMemberFromRow);
  }

  async create(input: unknown): Promise<TeamMember> {
    const validated = TeamMemberCreateInput.parse(input);
    const row: Partial<TeamMemberRow> = {
      email: validated.email,
      name: validated.name,
      avatar_url: validated.avatarUrl ?? null,
      role: validated.role,
      password_hash: validated.password, // caller must hash before calling
      max_concurrent_chats: validated.maxConcurrentChats,
      assigned_agents: validated.assignedAgents,
      skills: validated.skills,
      settings: validated.settings,
    };

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error('DB create error (team_members):', error);
      throw error;
    }
    return teamMemberFromRow(data as TeamMemberRow);
  }

  async updateMember(id: string, input: unknown): Promise<TeamMember> {
    const validated = TeamMemberUpdateInput.parse(input);
    const partial: Partial<TeamMemberRow> = {};

    if (validated.name !== undefined) partial.name = validated.name;
    if (validated.avatarUrl !== undefined) partial.avatar_url = validated.avatarUrl ?? null;
    if (validated.role !== undefined) partial.role = validated.role;
    if (validated.maxConcurrentChats !== undefined) partial.max_concurrent_chats = validated.maxConcurrentChats;
    if (validated.assignedAgents !== undefined) partial.assigned_agents = validated.assignedAgents;
    if (validated.skills !== undefined) partial.skills = validated.skills;
    if (validated.settings !== undefined) partial.settings = validated.settings;
    if (validated.active !== undefined) partial.active = validated.active;

    const updated = await this.update(id, partial);
    return teamMemberFromRow(updated);
  }

  async updateStatus(id: string, status: string): Promise<TeamMember> {
    const updated = await this.update(id, {
      status,
      last_seen_at: new Date().toISOString(),
    } as Partial<TeamMemberRow>);
    return teamMemberFromRow(updated);
  }

  async authenticate(email: string, passwordHash: string): Promise<TeamMember | null> {
    // Note: actual password comparison should use bcrypt.compare in the service layer.
    // This method finds the member by email; password verification is caller's responsibility.
    const row = await this.getByEmail(email);
    if (!row) return null;
    return teamMemberFromRow(row);
  }
}
