import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { BrainLoader } from '../../src/brain/brain-loader';
import { BrainManager } from '../../src/brain/brain-manager';

// Use a temp brain directory to avoid mutating real data
const tempBrainPath = path.resolve(__dirname, '../../.brain-test-temp');
const sourceBrainPath = path.resolve(__dirname, '../../brain');

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('BrainManager', () => {
  let loader: BrainLoader;
  let manager: BrainManager;

  beforeEach(() => {
    removeDir(tempBrainPath);
    copyDir(sourceBrainPath, tempBrainPath);
    loader = new BrainLoader(tempBrainPath);
    loader.loadAll();
    manager = new BrainManager(loader, tempBrainPath);
  });

  afterEach(() => {
    removeDir(tempBrainPath);
  });

  describe('addEntry', () => {
    it('should add a new product', () => {
      const newProduct = {
        id: 'prod-002',
        name: 'New Test Product',
        description: 'A new test product',
        price: 49.99,
        currency: 'USD',
        category: 'addon',
        features: ['Test feature'],
        images: [],
        inStock: true,
        popularityRank: 2,
      };

      manager.addEntry('sales', 'products', newProduct);

      // Verify the file was updated
      const filePath = path.join(tempBrainPath, 'sales', 'products.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.products).toHaveLength(2);
      expect(data.products[1].id).toBe('prod-002');
    });

    it('should add a new FAQ entry', () => {
      const newFAQ = {
        id: 'faq-004',
        question: 'Do you offer gift wrapping?',
        answer: 'Yes! We offer gift wrapping for $5.',
        keywords: ['gift', 'wrap', 'wrapping'],
        category: 'general',
      };

      manager.addEntry('support', 'faq', newFAQ);

      const filePath = path.join(tempBrainPath, 'support', 'faq.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.faqs).toHaveLength(4);
      expect(data.faqs[3].id).toBe('faq-004');
    });
  });

  describe('updateEntry', () => {
    it('should update an existing product', () => {
      const updated = manager.updateEntry('sales', 'products', 'prod-001', {
        price: 79.99,
        name: 'Updated Product Name',
      });

      expect(updated).toBe(true);

      const filePath = path.join(tempBrainPath, 'sales', 'products.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.products[0].price).toBe(79.99);
      expect(data.products[0].name).toBe('Updated Product Name');
    });

    it('should return false for non-existent entry', () => {
      const updated = manager.updateEntry('sales', 'products', 'nonexistent', { price: 10 });
      expect(updated).toBe(false);
    });
  });

  describe('deleteEntry', () => {
    it('should delete an existing FAQ entry', () => {
      const deleted = manager.deleteEntry('support', 'faq', 'faq-001');
      expect(deleted).toBe(true);

      const filePath = path.join(tempBrainPath, 'support', 'faq.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(data.faqs).toHaveLength(2);
      expect(data.faqs.find((f: { id: string }) => f.id === 'faq-001')).toBeUndefined();
    });

    it('should return false for non-existent entry', () => {
      const deleted = manager.deleteEntry('support', 'faq', 'nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('exportBrain', () => {
    it('should export all brain data', () => {
      const exported = manager.exportBrain();
      expect(exported).toHaveProperty('sales');
      expect(exported).toHaveProperty('support');
      expect(exported).toHaveProperty('company');
      expect(exported).toHaveProperty('config');

      const sales = exported.sales as Record<string, unknown>;
      expect(sales).toHaveProperty('products');
      expect(sales).toHaveProperty('pricing-rules');
    });
  });

  describe('importBrain', () => {
    it('should import brain data', () => {
      const exportedData = manager.exportBrain();

      // Clear and reimport
      removeDir(tempBrainPath);
      fs.mkdirSync(tempBrainPath, { recursive: true });

      const freshLoader = new BrainLoader(tempBrainPath);
      const freshManager = new BrainManager(freshLoader, tempBrainPath);

      freshManager.importBrain(exportedData as Record<string, Record<string, unknown>>);

      // Verify data was imported
      freshLoader.loadAll();
      const entry = freshLoader.getEntry('sales', 'products');
      expect(entry).toBeDefined();
      expect(entry!.data).toHaveProperty('products');
    });
  });
});
