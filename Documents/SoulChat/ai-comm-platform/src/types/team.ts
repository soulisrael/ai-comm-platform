import { z } from 'zod';

// ─── Team Member ────────────────────────────────────────────────────────────

export type TeamRole = 'admin' | 'manager' | 'agent';
export type TeamStatus = 'online' | 'away' | 'busy' | 'offline';
export type Permission = 'create' | 'read' | 'update' | 'delete' | 'takeover' | 'transfer' | 'close' | 'read_own';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: TeamRole;
  status: TeamStatus;
  maxConcurrentChats: number;
  assignedAgents: string[];
  skills: string[];
  settings: Record<string, unknown>;
  lastSeenAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamRolePermissions {
  role: string;
  permissions: Record<string, Permission[]>;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const TeamMemberCreateInput = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().nullable().optional(),
  role: z.enum(['admin', 'manager', 'agent']).optional().default('agent'),
  password: z.string().min(6),
  maxConcurrentChats: z.number().int().positive().optional().default(5),
  assignedAgents: z.array(z.string().uuid()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
});

export type TeamMemberCreateInputType = z.infer<typeof TeamMemberCreateInput>;

export const TeamMemberUpdateInput = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
  role: z.enum(['admin', 'manager', 'agent']).optional(),
  maxConcurrentChats: z.number().int().positive().optional(),
  assignedAgents: z.array(z.string().uuid()).optional(),
  skills: z.array(z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

export type TeamMemberUpdateInputType = z.infer<typeof TeamMemberUpdateInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInputType = z.infer<typeof LoginInput>;
