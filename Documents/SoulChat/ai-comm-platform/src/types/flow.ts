import { z } from 'zod';

// ─── Flow ───────────────────────────────────────────────────────────────────

export type FlowTriggerType = 'message_received' | 'keyword' | 'schedule' | 'webhook' | 'manual' | 'new_contact';
export type FlowNodeType = 'trigger' | 'ai_agent' | 'send_message' | 'wait_reply' | 'delay' | 'condition' | 'human_handoff' | 'tag' | 'http_request' | 'close' | 'transfer_agent' | 'check_window';
export type FlowRunStatus = 'running' | 'completed' | 'failed' | 'paused';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface FlowStats {
  runs: number;
  success: number;
  failed: number;
}

export interface Flow {
  id: string;
  name: string;
  description: string | null;
  triggerType: FlowTriggerType;
  triggerConfig: Record<string, unknown>;
  nodes: FlowNode[];
  edges: FlowEdge[];
  active: boolean;
  stats: FlowStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowRun {
  id: string;
  flowId: string;
  conversationId: string | null;
  contactId: string | null;
  status: FlowRunStatus;
  currentNodeId: string | null;
  context: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.string(), z.any()).optional().default({}),
});

const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  label: z.string().optional(),
});

export const FlowCreateInput = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  triggerType: z.enum(['message_received', 'keyword', 'schedule', 'webhook', 'manual', 'new_contact']),
  triggerConfig: z.record(z.string(), z.unknown()).optional().default({}),
  nodes: z.array(FlowNodeSchema).optional().default([]),
  edges: z.array(FlowEdgeSchema).optional().default([]),
  active: z.boolean().optional().default(false),
});

export type FlowCreateInputType = z.infer<typeof FlowCreateInput>;

export const FlowUpdateInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  triggerType: z.enum(['message_received', 'keyword', 'schedule', 'webhook', 'manual', 'new_contact']).optional(),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  nodes: z.array(FlowNodeSchema).optional(),
  edges: z.array(FlowEdgeSchema).optional(),
  active: z.boolean().optional(),
});

export type FlowUpdateInputType = z.infer<typeof FlowUpdateInput>;
