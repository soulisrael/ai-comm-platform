import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { BrainLoader } from '../../src/brain/brain-loader';

const brainPath = path.resolve(__dirname, '../../brain');

describe('BrainLoader', () => {
  let loader: BrainLoader;

  beforeEach(() => {
    loader = new BrainLoader(brainPath);
  });

  it('should load all brain categories', () => {
    const data = loader.loadAll();
    expect(data.size).toBe(4);
    expect(data.has('sales')).toBe(true);
    expect(data.has('support')).toBe(true);
    expect(data.has('company')).toBe(true);
    expect(data.has('config')).toBe(true);
  });

  it('should load sales category with correct entries', () => {
    const entries = loader.loadCategory('sales');
    const subcategories = entries.map(e => e.subcategory).sort();
    expect(subcategories).toContain('products');
    expect(subcategories).toContain('pricing-rules');
    expect(subcategories).toContain('objection-handling');
    expect(subcategories).toContain('sales-scripts');
    expect(subcategories).toContain('competitor-comparison');
  });

  it('should load support category with correct entries', () => {
    const entries = loader.loadCategory('support');
    const subcategories = entries.map(e => e.subcategory).sort();
    expect(subcategories).toContain('faq');
    expect(subcategories).toContain('policies');
    expect(subcategories).toContain('troubleshooting');
    expect(subcategories).toContain('escalation-rules');
    expect(subcategories).toContain('canned-responses');
  });

  it('should load company category', () => {
    const entries = loader.loadCategory('company');
    const subcategories = entries.map(e => e.subcategory).sort();
    expect(subcategories).toContain('info');
    expect(subcategories).toContain('tone-of-voice');
    expect(subcategories).toContain('team');
  });

  it('should load config category', () => {
    const entries = loader.loadCategory('config');
    const subcategories = entries.map(e => e.subcategory).sort();
    expect(subcategories).toContain('agent-instructions');
    expect(subcategories).toContain('routing-rules');
    expect(subcategories).toContain('handoff-rules');
  });

  it('should get a specific entry', () => {
    loader.loadAll();
    const entry = loader.getEntry('sales', 'products');
    expect(entry).toBeDefined();
    expect(entry!.category).toBe('sales');
    expect(entry!.subcategory).toBe('products');
    expect(entry!.data).toHaveProperty('products');
  });

  it('should return undefined for non-existent entry', () => {
    loader.loadAll();
    const entry = loader.getEntry('sales', 'nonexistent');
    expect(entry).toBeUndefined();
  });

  it('should reload brain data', () => {
    loader.loadAll();
    const data = loader.reload();
    expect(data.size).toBe(4);
  });

  it('should validate brain data', () => {
    loader.loadAll();
    const { valid, errors } = loader.validate();
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('should return empty array for non-existent category path', () => {
    const badLoader = new BrainLoader('/nonexistent/path');
    const entries = badLoader.loadCategory('sales');
    expect(entries).toHaveLength(0);
  });
});
