export type BrainCategory = 'sales' | 'support' | 'company' | 'config';

export interface BrainEntry {
  id: string;
  category: BrainCategory;
  subcategory: string;
  data: Record<string, unknown>;
}

export interface BrainSearchResult {
  entry: BrainEntry;
  relevanceScore: number;
  source: string;
}

export interface ProductEntry {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  features: string[];
  images: string[];
  inStock: boolean;
  popularityRank: number;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
}

export interface PolicyEntry {
  [key: string]: unknown;
}
