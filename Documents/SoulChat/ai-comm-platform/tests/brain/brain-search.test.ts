import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainSearch } from '../../src/brain/brain-search';

const brainPath = path.resolve(__dirname, '../../brain');

describe('BrainSearch', () => {
  let loader: BrainLoader;
  let search: BrainSearch;

  beforeAll(() => {
    loader = new BrainLoader(brainPath);
    loader.loadAll();
    search = new BrainSearch(loader);
  });

  describe('searchByKeywords', () => {
    it('should find results for product-related keywords', () => {
      const results = search.searchByKeywords(['product', 'price'], 'sales');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find results across all categories', () => {
      const results = search.searchByKeywords(['help', 'support']);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for nonsense keywords', () => {
      const results = search.searchByKeywords(['xyzabc123nonexistent']);
      expect(results).toHaveLength(0);
    });

    it('should sort results by relevance score', () => {
      const results = search.searchByKeywords(['shipping', 'delivery'], 'support');
      if (results.length > 1) {
        expect(results[0].relevanceScore).toBeGreaterThanOrEqual(results[1].relevanceScore);
      }
    });
  });

  describe('searchFAQ', () => {
    it('should find FAQ for shipping question', () => {
      const results = search.searchFAQ('How long does shipping take?');
      expect(results.length).toBeGreaterThan(0);
      const faqData = results[0].entry.data as { keywords: string[] };
      expect(faqData.keywords).toContain('shipping');
    });

    it('should find FAQ for return policy question', () => {
      const results = search.searchFAQ('Can I return my order?');
      expect(results.length).toBeGreaterThan(0);
      const faqData = results[0].entry.data as { keywords: string[] };
      expect(faqData.keywords).toContain('return');
    });

    it('should find FAQ for working hours question', () => {
      const results = search.searchFAQ('What time are you open?');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for unrelated query', () => {
      const results = search.searchFAQ('xyzabc123');
      expect(results).toHaveLength(0);
    });
  });

  describe('getProduct', () => {
    it('should find product by ID', () => {
      const product = search.getProduct('prod-001');
      expect(product).toBeDefined();
      expect(product!.id).toBe('prod-001');
      expect(product!.price).toBe(99);
    });

    it('should return undefined for non-existent product', () => {
      const product = search.getProduct('nonexistent');
      expect(product).toBeUndefined();
    });
  });

  describe('getProducts', () => {
    it('should return all products', () => {
      const products = search.getProducts();
      expect(products.length).toBeGreaterThan(0);
    });

    it('should filter products by category', () => {
      const products = search.getProducts('main');
      expect(products.length).toBeGreaterThan(0);
      expect(products.every(p => p.category === 'main')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const products = search.getProducts('nonexistent_cat');
      expect(products).toHaveLength(0);
    });
  });

  describe('getPolicy', () => {
    it('should get return policy', () => {
      const policy = search.getPolicy('returnPolicy');
      expect(policy).toBeDefined();
      expect((policy as { daysAllowed: number }).daysAllowed).toBe(30);
    });

    it('should get shipping policy', () => {
      const policy = search.getPolicy('shippingPolicy');
      expect(policy).toBeDefined();
    });

    it('should return undefined for non-existent policy', () => {
      const policy = search.getPolicy('nonexistent');
      expect(policy).toBeUndefined();
    });
  });

  describe('findRelevantBrainData', () => {
    it('should include company info for any agent', () => {
      const data = search.findRelevantBrainData('hello', 'sales');
      expect(data.companyInfo).toBeDefined();
      expect(data.toneOfVoice).toBeDefined();
    });

    it('should include sales data for sales agent', () => {
      const data = search.findRelevantBrainData('I want to buy a product', 'sales');
      expect(data.products).toBeDefined();
      expect(data.pricingRules).toBeDefined();
      expect(data.objectionHandling).toBeDefined();
    });

    it('should include support data for support agent', () => {
      const data = search.findRelevantBrainData('I have a problem', 'support');
      expect(data.faq).toBeDefined();
      expect(data.policies).toBeDefined();
      expect(data.troubleshooting).toBeDefined();
    });

    it('should include routing rules for router agent', () => {
      const data = search.findRelevantBrainData('hello', 'router');
      expect(data.routingRules).toBeDefined();
    });

    it('should include handoff rules for handoff agent', () => {
      const data = search.findRelevantBrainData('I want a human', 'handoff');
      expect(data.handoffRules).toBeDefined();
      expect(data.team).toBeDefined();
    });

    it('should include agent instructions', () => {
      const data = search.findRelevantBrainData('hello', 'sales');
      expect(data.agentInstructions).toBeDefined();
    });
  });
});
