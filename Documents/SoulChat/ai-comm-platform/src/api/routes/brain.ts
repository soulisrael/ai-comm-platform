import { Router, Request, Response } from 'express';
import { BrainRepository } from '../../database/repositories/brain-repository';
import { AppError } from '../middleware/error-handler';

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
