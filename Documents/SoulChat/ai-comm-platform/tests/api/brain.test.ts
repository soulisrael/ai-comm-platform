import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../../src/api/server';
import { ClaudeAPI } from '../../src/services/claude-api';
import { vi } from 'vitest';

// Use temp brain directory to avoid mutating real data
const tempBrainPath = path.resolve(__dirname, '../../.brain-api-test-temp');
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

function createMockClaude(): ClaudeAPI {
  return {
    chat: vi.fn().mockResolvedValue({ content: 'Ok', inputTokens: 10, outputTokens: 5, model: 'test' }),
    chatJSON: vi.fn().mockResolvedValue({
      data: { intent: 'support', confidence: 0.9, language: 'English', sentiment: 'neutral', summary: 'test' },
      inputTokens: 10, outputTokens: 5, model: 'test',
    }),
    getUsage: vi.fn().mockReturnValue({ totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 }),
    resetUsage: vi.fn(),
  } as unknown as ClaudeAPI;
}

describe('Brain API', () => {
  let app: Awaited<ReturnType<typeof createApp>>['app'];

  beforeEach(async () => {
    if (fs.existsSync(tempBrainPath)) {
      fs.rmSync(tempBrainPath, { recursive: true, force: true });
    }
    copyDir(sourceBrainPath, tempBrainPath);

    // Override cwd for brain path resolution
    const result = await createApp({ claude: createMockClaude(), brainPath: tempBrainPath, skipAuth: true });
    app = result.app;
  });

  afterEach(() => {
    if (fs.existsSync(tempBrainPath)) {
      fs.rmSync(tempBrainPath, { recursive: true, force: true });
    }
  });

  describe('GET /api/brain/modules', () => {
    it('should list all brain modules', async () => {
      const res = await request(app).get('/api/brain/modules');

      expect(res.status).toBe(200);
      expect(res.body.modules).toBeDefined();
      expect(res.body.modules.length).toBeGreaterThan(0);

      const names = res.body.modules.map((m: { name: string }) => m.name);
      expect(names).toContain('sales/products');
      expect(names).toContain('support/faq');
    });
  });

  describe('GET /api/brain/modules/:category/:subcategory', () => {
    it('should return module data', async () => {
      const res = await request(app).get('/api/brain/modules/sales/products');

      expect(res.status).toBe(200);
      expect(res.body.products).toBeDefined();
      expect(res.body.products.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent module', async () => {
      const res = await request(app).get('/api/brain/modules/sales/nonexistent');
      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid category', async () => {
      const res = await request(app).get('/api/brain/modules/invalid/products');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/brain/agents', () => {
    it('should return agent configs', async () => {
      const res = await request(app).get('/api/brain/agents');

      expect(res.status).toBe(200);
      expect(res.body.router).toBeDefined();
      expect(res.body.sales).toBeDefined();
      expect(res.body.support).toBeDefined();
    });
  });

  describe('GET /api/brain/company', () => {
    it('should return company info', async () => {
      const res = await request(app).get('/api/brain/company');

      expect(res.status).toBe(200);
      expect(res.body.info).toBeDefined();
      expect(res.body.toneOfVoice).toBeDefined();
      expect(res.body.team).toBeDefined();
    });
  });

  describe('POST /api/brain/reload', () => {
    it('should reload brain data', async () => {
      const res = await request(app).post('/api/brain/reload');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
