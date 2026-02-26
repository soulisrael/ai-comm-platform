import { z } from 'zod';

// ─── Brain Entry ─────────────────────────────────────────────────────────────

export interface BrainEntry {
  id: string;
  agentId: string;
  title: string;
  content: string;
  category: string;       // "product" | "policy" | "faq" | "script" | "general"
  metadata: Record<string, any>;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Custom Agent ────────────────────────────────────────────────────────────

export interface CustomAgentSettings {
  temperature: number;
  maxTokens: number;
  language: string;
  model: string;
}

export interface CustomAgent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string | null;
  mainDocumentText: string | null;
  mainDocumentFilename: string | null;
  routingKeywords: string[];
  routingDescription: string | null;
  handoffRules: Record<string, unknown>;
  transferRules: Record<string, unknown>;
  settings: CustomAgentSettings;
  isDefault: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomAgentWithBrain extends CustomAgent {
  brain: BrainEntry[];
}

// Keep legacy alias for compatibility during transition
export type CustomAgentWithTopics = CustomAgentWithBrain;

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const SettingsSchema = z.object({
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().positive().optional().default(500),
  language: z.string().optional().default('Hebrew'),
  model: z.string().optional().default('claude-sonnet-4-5-20250929'),
});

export const CustomAgentCreateInput = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  systemPrompt: z.string().min(1),
  routingKeywords: z.array(z.string()).optional().default([]),
  routingDescription: z.string().nullable().optional(),
  handoffRules: z.record(z.string(), z.unknown()).optional().default({
    escalateWhen: ['human_request', 'complaint'],
    maxTurns: 20,
    lowConfidenceThreshold: 0.3,
  }),
  transferRules: z.record(z.string(), z.unknown()).optional().default({}),
  settings: SettingsSchema.optional().default({
    temperature: 0.7,
    maxTokens: 500,
    language: 'Hebrew',
    model: 'claude-sonnet-4-5-20250929',
  }),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
});

export type CustomAgentCreateInputType = z.infer<typeof CustomAgentCreateInput>;

export const CustomAgentUpdateInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  systemPrompt: z.string().nullable().optional(),
  routingKeywords: z.array(z.string()).optional(),
  routingDescription: z.string().nullable().optional(),
  handoffRules: z.record(z.string(), z.unknown()).optional(),
  transferRules: z.record(z.string(), z.unknown()).optional(),
  settings: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
    language: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});

export type CustomAgentUpdateInputType = z.infer<typeof CustomAgentUpdateInput>;

// ─── Brain Entry Zod Schemas ─────────────────────────────────────────────────

export const BrainEntryCreateInput = z.object({
  agentId: z.string().uuid(),
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional().default('general'),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  sortOrder: z.number().int().optional().default(0),
  active: z.boolean().optional().default(true),
});

export type BrainEntryCreateInputType = z.infer<typeof BrainEntryCreateInput>;

export const BrainEntryUpdateInput = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export type BrainEntryUpdateInputType = z.infer<typeof BrainEntryUpdateInput>;
