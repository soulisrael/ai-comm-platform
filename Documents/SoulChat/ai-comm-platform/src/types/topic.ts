import { z } from 'zod';

export interface TopicFAQ {
  question: string;
  answer: string;
}

export interface TopicContent {
  description: string;
  details?: string;
  schedule?: string;
  price?: string;
  faq: TopicFAQ[];
  customFields: Record<string, unknown>;
  images?: string[];
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  content: TopicContent;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TopicCreateInput = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  content: z.object({
    description: z.string(),
    details: z.string().optional(),
    schedule: z.string().optional(),
    price: z.string().optional(),
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional().default([]),
    customFields: z.record(z.string(), z.unknown()).optional().default({}),
    images: z.array(z.string()).optional(),
  }).optional().default({ description: '', faq: [], customFields: {} }),
  isShared: z.boolean().optional().default(false),
});

export type TopicCreateInputType = z.infer<typeof TopicCreateInput>;

export const TopicUpdateInput = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  content: z.object({
    description: z.string().optional(),
    details: z.string().optional(),
    schedule: z.string().optional(),
    price: z.string().optional(),
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    customFields: z.record(z.string(), z.unknown()).optional(),
    images: z.array(z.string()).optional(),
  }).optional(),
  isShared: z.boolean().optional(),
});

export type TopicUpdateInputType = z.infer<typeof TopicUpdateInput>;
