import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { BrainLoader } from '../../brain/brain-loader';
import { BrainManager } from '../../brain/brain-manager';
import { BrainSearch } from '../../brain/brain-search';
import { BrainCategory } from '../../types/brain';
import { AppError } from '../middleware/error-handler';

export function createBrainRouter(
  brainLoader: BrainLoader,
  brainManager: BrainManager,
  _brainSearch: BrainSearch
): Router {
  const router = Router();
  const brainPath = path.resolve(process.cwd(), 'brain');
  const validCategories: BrainCategory[] = ['sales', 'support', 'company', 'config'];

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  /**
   * @swagger
   * /api/brain/modules:
   *   get:
   *     summary: List all brain modules
   *     tags: [Brain]
   *     responses:
   *       200:
   *         description: List of brain modules
   */
  router.get('/modules', (_req: Request, res: Response) => {
    const data = brainLoader.getData();
    const modules: Array<{ name: string; category: string; subcategory: string; entryCount: number }> = [];

    for (const [category, entries] of data) {
      for (const entry of entries) {
        const topLevelKeys = Object.keys(entry.data);
        let entryCount = 0;
        for (const key of topLevelKeys) {
          if (Array.isArray(entry.data[key])) {
            entryCount += (entry.data[key] as unknown[]).length;
          } else {
            entryCount += 1;
          }
        }

        modules.push({
          name: `${category}/${entry.subcategory}`,
          category,
          subcategory: entry.subcategory,
          entryCount,
        });
      }
    }

    res.json({ modules });
  });

  /**
   * @swagger
   * /api/brain/modules/{category}/{subcategory}:
   *   get:
   *     summary: Get module data
   *     tags: [Brain]
   */
  router.get('/modules/:category/:subcategory', (req: Request, res: Response) => {
    const category = param(req, 'category');
    const subcategory = param(req, 'subcategory');
    if (!validCategories.includes(category as BrainCategory)) {
      throw new AppError('Invalid category', 400, 'VALIDATION_ERROR');
    }

    const entry = brainLoader.getEntry(category as BrainCategory, subcategory);
    if (!entry) {
      throw new AppError('Module not found', 404, 'NOT_FOUND');
    }

    res.json(entry.data);
  });

  /**
   * @swagger
   * /api/brain/modules/{category}/{subcategory}:
   *   put:
   *     summary: Update entire module data
   *     tags: [Brain]
   */
  router.put('/modules/:category/:subcategory', (req: Request, res: Response) => {
    const category = param(req, 'category');
    const subcategory = param(req, 'subcategory');
    if (!validCategories.includes(category as BrainCategory)) {
      throw new AppError('Invalid category', 400, 'VALIDATION_ERROR');
    }

    const filePath = path.join(brainPath, category, `${subcategory}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2) + '\n', 'utf-8');
    brainLoader.loadCategory(category as BrainCategory);

    res.json({ success: true, module: `${category}/${subcategory}` });
  });

  /**
   * @swagger
   * /api/brain/modules/{category}/{subcategory}/entries:
   *   post:
   *     summary: Add entry to a module
   *     tags: [Brain]
   */
  router.post('/modules/:category/:subcategory/entries', (req: Request, res: Response) => {
    const category = param(req, 'category');
    const subcategory = param(req, 'subcategory');
    if (!validCategories.includes(category as BrainCategory)) {
      throw new AppError('Invalid category', 400, 'VALIDATION_ERROR');
    }

    brainManager.addEntry(category as BrainCategory, subcategory, req.body);
    res.status(201).json({ success: true });
  });

  /**
   * @swagger
   * /api/brain/modules/{category}/{subcategory}/entries/{entryId}:
   *   put:
   *     summary: Update an entry
   *     tags: [Brain]
   */
  router.put('/modules/:category/:subcategory/entries/:entryId', (req: Request, res: Response) => {
    const category = param(req, 'category');
    const subcategory = param(req, 'subcategory');
    const entryId = param(req, 'entryId');
    if (!validCategories.includes(category as BrainCategory)) {
      throw new AppError('Invalid category', 400, 'VALIDATION_ERROR');
    }

    const updated = brainManager.updateEntry(category as BrainCategory, subcategory, entryId, req.body);
    if (!updated) {
      throw new AppError('Entry not found', 404, 'NOT_FOUND');
    }

    res.json({ success: true });
  });

  /**
   * @swagger
   * /api/brain/modules/{category}/{subcategory}/entries/{entryId}:
   *   delete:
   *     summary: Delete an entry
   *     tags: [Brain]
   */
  router.delete('/modules/:category/:subcategory/entries/:entryId', (req: Request, res: Response) => {
    const category = param(req, 'category');
    const subcategory = param(req, 'subcategory');
    const entryId = param(req, 'entryId');
    if (!validCategories.includes(category as BrainCategory)) {
      throw new AppError('Invalid category', 400, 'VALIDATION_ERROR');
    }

    const deleted = brainManager.deleteEntry(category as BrainCategory, subcategory, entryId);
    if (!deleted) {
      throw new AppError('Entry not found', 404, 'NOT_FOUND');
    }

    res.json({ success: true });
  });

  /**
   * @swagger
   * /api/brain/agents:
   *   get:
   *     summary: Get all agent configs
   *     tags: [Brain]
   */
  router.get('/agents', (_req: Request, res: Response) => {
    const entry = brainLoader.getEntry('config', 'agent-instructions');
    if (!entry) {
      throw new AppError('Agent instructions not found', 404, 'NOT_FOUND');
    }
    res.json(entry.data);
  });

  /**
   * @swagger
   * /api/brain/agents/{agentType}:
   *   put:
   *     summary: Update agent config
   *     tags: [Brain]
   */
  router.put('/agents/:agentType', (req: Request, res: Response) => {
    const agentType = param(req, 'agentType');
    const entry = brainLoader.getEntry('config', 'agent-instructions');
    if (!entry) {
      throw new AppError('Agent instructions not found', 404, 'NOT_FOUND');
    }

    const instructions = entry.data as Record<string, unknown>;
    if (!instructions[agentType]) {
      throw new AppError(`Agent type "${agentType}" not found`, 404, 'NOT_FOUND');
    }

    const existing = instructions[agentType] as Record<string, unknown>;
    instructions[agentType] = { ...existing, ...req.body };

    const filePath = path.join(brainPath, 'config', 'agent-instructions.json');
    fs.writeFileSync(filePath, JSON.stringify(instructions, null, 2) + '\n', 'utf-8');
    brainLoader.loadCategory('config');

    res.json({ success: true, agentType, config: instructions[agentType] });
  });

  /**
   * @swagger
   * /api/brain/company:
   *   get:
   *     summary: Get company info
   *     tags: [Brain]
   */
  router.get('/company', (_req: Request, res: Response) => {
    const info = brainLoader.getEntry('company', 'info');
    const tone = brainLoader.getEntry('company', 'tone-of-voice');
    const team = brainLoader.getEntry('company', 'team');

    res.json({
      info: info?.data,
      toneOfVoice: tone?.data,
      team: team?.data,
    });
  });

  /**
   * @swagger
   * /api/brain/company/{section}:
   *   put:
   *     summary: Update company section
   *     tags: [Brain]
   */
  router.put('/company/:section', (req: Request, res: Response) => {
    const section = param(req, 'section');
    const validSections = ['info', 'tone-of-voice', 'team'];
    if (!validSections.includes(section)) {
      throw new AppError(`Invalid section: ${section}. Valid: ${validSections.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const filePath = path.join(brainPath, 'company', `${section}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2) + '\n', 'utf-8');
    brainLoader.loadCategory('company');

    res.json({ success: true, section });
  });

  /**
   * @swagger
   * /api/brain/reload:
   *   post:
   *     summary: Hot-reload all brain data
   *     tags: [Brain]
   */
  router.post('/reload', (_req: Request, res: Response) => {
    brainLoader.reload();
    res.json({ success: true, message: 'Brain data reloaded' });
  });

  return router;
}
