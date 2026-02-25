import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { BrainCategory, BrainEntry } from '../types/brain';
import logger from '../services/logger';

// Zod schemas for validation
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  currency: z.string(),
  category: z.string(),
  features: z.array(z.string()),
  images: z.array(z.string()),
  inStock: z.boolean(),
  popularityRank: z.number(),
});

const FAQSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  keywords: z.array(z.string()),
  category: z.string(),
});

const ValidationSchemas: Record<string, z.ZodType> = {
  'sales/products': z.object({
    products: z.array(ProductSchema),
    categories: z.array(z.string()),
  }),
  'support/faq': z.object({
    faqs: z.array(FAQSchema),
  }),
};

export class BrainLoader {
  private brainPath: string;
  private data: Map<string, BrainEntry[]> = new Map();

  constructor(brainPath?: string) {
    this.brainPath = brainPath || path.resolve(process.cwd(), 'brain');
  }

  loadAll(): Map<string, BrainEntry[]> {
    const categories: BrainCategory[] = ['sales', 'support', 'company', 'config'];
    for (const category of categories) {
      this.loadCategory(category);
    }
    logger.info('Brain loaded successfully', { categories: categories.length, totalEntries: this.getTotalEntries() });
    return this.data;
  }

  loadCategory(category: BrainCategory): BrainEntry[] {
    const categoryPath = path.join(this.brainPath, category);
    const entries: BrainEntry[] = [];

    if (!fs.existsSync(categoryPath)) {
      logger.warn(`Brain category path not found: ${categoryPath}`);
      return entries;
    }

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const subcategory = path.basename(file, '.json');

        const entry: BrainEntry = {
          id: `${category}/${subcategory}`,
          category,
          subcategory,
          data: parsed,
        };

        entries.push(entry);
      } catch (err) {
        logger.error(`Failed to load brain file: ${filePath}`, { error: String(err) });
      }
    }

    this.data.set(category, entries);
    return entries;
  }

  reload(): Map<string, BrainEntry[]> {
    this.data.clear();
    logger.info('Reloading brain data...');
    return this.loadAll();
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [category, entries] of this.data) {
      for (const entry of entries) {
        const schemaKey = `${category}/${entry.subcategory}`;
        const schema = ValidationSchemas[schemaKey];

        if (schema) {
          const result = schema.safeParse(entry.data);
          if (!result.success) {
            errors.push(`${schemaKey}: ${result.error.message}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  getData(): Map<string, BrainEntry[]> {
    return this.data;
  }

  getEntry(category: BrainCategory, subcategory: string): BrainEntry | undefined {
    const entries = this.data.get(category);
    return entries?.find(e => e.subcategory === subcategory);
  }

  private getTotalEntries(): number {
    let total = 0;
    for (const entries of this.data.values()) {
      total += entries.length;
    }
    return total;
  }
}
