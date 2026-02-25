import { z } from 'zod';
import { Topic } from './topic';

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

export interface CustomAgentWithTopics extends CustomAgent {
  topics: Topic[];
}

const SettingsSchema = z.object({
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().positive().optional().default(1024),
  language: z.string().optional().default('he'),
  model: z.string().optional().default('gpt-4'),
});

export const CustomAgentCreateInput = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  systemPrompt: z.string().nullable().optional(),
  routingKeywords: z.array(z.string()).optional().default([]),
  routingDescription: z.string().nullable().optional(),
  handoffRules: z.record(z.string(), z.unknown()).optional().default({}),
  transferRules: z.record(z.string(), z.unknown()).optional().default({}),
  settings: SettingsSchema.optional().default({ temperature: 0.7, maxTokens: 1024, language: 'he', model: 'gpt-4' }),
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
