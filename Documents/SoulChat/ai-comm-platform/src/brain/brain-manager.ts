import fs from 'fs';
import path from 'path';
import { BrainCategory } from '../types/brain';
import { BrainLoader } from './brain-loader';
import logger from '../services/logger';

export class BrainManager {
  private brainPath: string;
  private loader: BrainLoader;

  constructor(loader: BrainLoader, brainPath?: string) {
    this.loader = loader;
    this.brainPath = brainPath || path.resolve(process.cwd(), 'brain');
  }

  addEntry(category: BrainCategory, subcategory: string, entry: Record<string, unknown>): void {
    const filePath = this.getFilePath(category, subcategory);
    const existing = this.readFile(filePath);

    // Find the first array in the data and push to it
    const arrayKey = this.findArrayKey(existing);
    if (arrayKey) {
      (existing[arrayKey] as unknown[]).push(entry);
    } else {
      // If no array found, create an "entries" array
      existing.entries = existing.entries || [];
      (existing.entries as unknown[]).push(entry);
    }

    this.writeFile(filePath, existing);
    this.loader.loadCategory(category);
    logger.info('Brain entry added', { category, subcategory });
  }

  updateEntry(category: BrainCategory, subcategory: string, id: string, data: Record<string, unknown>): boolean {
    const filePath = this.getFilePath(category, subcategory);
    const existing = this.readFile(filePath);

    const arrayKey = this.findArrayKey(existing);
    if (!arrayKey) return false;

    const arr = existing[arrayKey] as Record<string, unknown>[];
    const index = arr.findIndex(item => item.id === id);
    if (index === -1) return false;

    arr[index] = { ...arr[index], ...data };

    this.writeFile(filePath, existing);
    this.loader.loadCategory(category);
    logger.info('Brain entry updated', { category, subcategory, id });
    return true;
  }

  deleteEntry(category: BrainCategory, subcategory: string, id: string): boolean {
    const filePath = this.getFilePath(category, subcategory);
    const existing = this.readFile(filePath);

    const arrayKey = this.findArrayKey(existing);
    if (!arrayKey) return false;

    const arr = existing[arrayKey] as Record<string, unknown>[];
    const index = arr.findIndex(item => item.id === id);
    if (index === -1) return false;

    arr.splice(index, 1);

    this.writeFile(filePath, existing);
    this.loader.loadCategory(category);
    logger.info('Brain entry deleted', { category, subcategory, id });
    return true;
  }

  exportBrain(): Record<string, unknown> {
    const exportData: Record<string, unknown> = {};
    const categories: BrainCategory[] = ['sales', 'support', 'company', 'config'];

    for (const category of categories) {
      const categoryPath = path.join(this.brainPath, category);
      if (!fs.existsSync(categoryPath)) continue;

      const categoryData: Record<string, unknown> = {};
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const subcategory = path.basename(file, '.json');
        categoryData[subcategory] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }

      exportData[category] = categoryData;
    }

    return exportData;
  }

  importBrain(data: Record<string, Record<string, unknown>>): void {
    for (const [category, subcategories] of Object.entries(data)) {
      const categoryPath = path.join(this.brainPath, category);
      if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath, { recursive: true });
      }

      for (const [subcategory, content] of Object.entries(subcategories)) {
        const filePath = path.join(categoryPath, `${subcategory}.json`);
        this.writeFile(filePath, content as Record<string, unknown>);
      }
    }

    this.loader.reload();
    logger.info('Brain data imported');
  }

  private getFilePath(category: BrainCategory, subcategory: string): string {
    return path.join(this.brainPath, category, `${subcategory}.json`);
  }

  private readFile(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  private writeFile(filePath: string, data: Record<string, unknown>): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }

  private findArrayKey(data: Record<string, unknown>): string | null {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        return key;
      }
    }
    return null;
  }
}
