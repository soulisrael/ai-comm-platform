import { Router, Request, Response } from 'express';
import { BrainRepository } from '../../database/repositories/brain-repository';
import { AppError } from '../middleware/error-handler';

export function createBrainRouter(brainRepo: BrainRepository): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET /agent/:agentId — List brain entries for an agent
  router.get('/agent/:agentId', async (req: Request, res: Response) => {
    const agentId = param(req, 'agentId');
    const { category, active } = req.query;

    let entries;
    if (category) {
      entries = await brainRepo.getByAgentAndCategory(agentId, category as string);
    } else if (active === 'true') {
      entries = await brainRepo.getActiveByAgent(agentId);
    } else {
      entries = await brainRepo.getByAgent(agentId);
    }

    res.json({ entries });
  });

  // GET /search/:agentId — Search brain entries for an agent
  router.get('/search/:agentId', async (req: Request, res: Response) => {
    const agentId = param(req, 'agentId');
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      throw new AppError('q query parameter is required', 400, 'VALIDATION_ERROR');
    }

    const entries = await brainRepo.search(agentId, q);
    res.json({ entries });
  });

  // GET /:id — Get single brain entry
  router.get('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const entry = await brainRepo.findById(id);
    if (!entry) {
      throw new AppError('Brain entry not found', 404, 'NOT_FOUND');
    }
    res.json(entry);
  });

  // POST / — Create brain entry
  router.post('/', async (req: Request, res: Response) => {
    const entry = await brainRepo.createEntry(req.body);
    res.status(201).json(entry);
  });

  // PUT /:id — Update brain entry
  router.put('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await brainRepo.findById(id);
    if (!existing) {
      throw new AppError('Brain entry not found', 404, 'NOT_FOUND');
    }
    const updated = await brainRepo.updateEntry(id, req.body);
    res.json(updated);
  });

  // DELETE /:id — Delete brain entry
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await brainRepo.findById(id);
    if (!existing) {
      throw new AppError('Brain entry not found', 404, 'NOT_FOUND');
    }
    await brainRepo.deleteById(id);
    res.json({ success: true });
  });

  // PUT /reorder/:agentId — Reorder brain entries for an agent
  router.put('/reorder/:agentId', async (req: Request, res: Response) => {
    const agentId = param(req, 'agentId');
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      throw new AppError('orderedIds array is required', 400, 'VALIDATION_ERROR');
    }
    await brainRepo.reorder(agentId, orderedIds);
    res.json({ success: true });
  });

  return router;
}

/**
 * Nested brain router for /api/custom-agents/:agentId/brain
 */
export function createAgentBrainRouter(brainRepo: BrainRepository): Router {
  const router = Router({ mergeParams: true });

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET / — list brain entries (optional ?category filter)
  router.get('/', async (req: Request, res: Response) => {
    const agentId = param(req, 'agentId');
    const { category } = req.query;

    let entries;
    if (category) {
      entries = await brainRepo.getByAgentAndCategory(agentId, category as string);
    } else {
      entries = await brainRepo.getByAgent(agentId);
    }
    res.json({ entries });
  });

  // POST / — create brain entry
  router.post('/', async (req: Request, res: Response) => {
    const agentId = param(req, 'agentId');
    const entry = await brainRepo.createEntry({ ...req.body, agentId });
    res.status(201).json(entry);
  });

  // PUT /reorder — reorder entries
  router.put('/reorder', async (req: Request, res: Response) => {
    const agentId = param(req, 'agentId');
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      throw new AppError('orderedIds array is required', 400, 'VALIDATION_ERROR');
    }
    await brainRepo.reorder(agentId, orderedIds);
    res.json({ success: true });
  });

  // PUT /:entryId — update brain entry
  router.put('/:entryId', async (req: Request, res: Response) => {
    const entryId = param(req, 'entryId');
    const existing = await brainRepo.findById(entryId);
    if (!existing) {
      throw new AppError('Brain entry not found', 404, 'NOT_FOUND');
    }
    const updated = await brainRepo.updateEntry(entryId, req.body);
    res.json(updated);
  });

  // DELETE /:entryId — delete brain entry
  router.delete('/:entryId', async (req: Request, res: Response) => {
    const entryId = param(req, 'entryId');
    const existing = await brainRepo.findById(entryId);
    if (!existing) {
      throw new AppError('Brain entry not found', 404, 'NOT_FOUND');
    }
    await brainRepo.deleteById(entryId);
    res.json({ success: true });
  });

  return router;
}
