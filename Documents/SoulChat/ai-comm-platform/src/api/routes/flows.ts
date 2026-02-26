import { Router, Request, Response } from 'express';
import { FlowRepository } from '../../database/repositories/flow-repository';
import { FlowEngine } from '../../engines/flow-engine';
import { AppError } from '../middleware/error-handler';
import logger from '../../services/logger';

export function createFlowsRouter(flowRepo: FlowRepository, flowEngine: FlowEngine): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET / — list all flows
  router.get('/', async (_req: Request, res: Response) => {
    const flows = await flowRepo.getAll();
    res.json({ flows });
  });

  // POST / — create flow
  router.post('/', async (req: Request, res: Response) => {
    const flow = await flowRepo.createFlow(req.body);
    logger.info(`Flow created: ${flow.id} (${flow.name})`);
    res.status(201).json(flow);
  });

  // GET /:id — get flow by id
  router.get('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const flow = await flowRepo.getById(id);
    if (!flow) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    res.json(flow);
  });

  // PUT /:id — update flow
  router.put('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await flowRepo.getById(id);
    if (!existing) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    const updated = await flowRepo.updateFlow(id, req.body);
    res.json(updated);
  });

  // DELETE /:id — delete flow
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await flowRepo.getById(id);
    if (!existing) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    await flowRepo.deleteById(id);
    res.json({ success: true });
  });

  // POST /:id/duplicate — duplicate flow
  router.post('/:id/duplicate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await flowRepo.getById(id);
    if (!existing) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    const copy = await flowRepo.duplicate(id);
    logger.info(`Flow duplicated: ${id} → ${copy.id}`);
    res.status(201).json(copy);
  });

  // PUT /:id/activate — activate flow
  router.put('/:id/activate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await flowRepo.getById(id);
    if (!existing) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    const updated = await flowRepo.updateFlow(id, { active: true });
    res.json(updated);
  });

  // PUT /:id/deactivate — deactivate flow
  router.put('/:id/deactivate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await flowRepo.getById(id);
    if (!existing) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    const updated = await flowRepo.updateFlow(id, { active: false });
    res.json(updated);
  });

  // POST /:id/test — test run a flow
  router.post('/:id/test', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const flow = await flowRepo.getById(id);
    if (!flow) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }

    const { contactId } = req.body || {};
    const run = await flowEngine.startFlow(id, undefined, contactId, { test: true });
    logger.info(`Flow test started: ${id} → run ${run.id}`);
    res.json({ run });
  });

  // GET /:id/runs — flow run history
  router.get('/:id/runs', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await flowRepo.getById(id);
    if (!existing) {
      throw new AppError('Flow not found', 404, 'NOT_FOUND');
    }
    const runs = await flowRepo.getRunsByFlow(id);
    res.json({ runs });
  });

  // GET /runs/:runId — specific run
  router.get('/runs/:runId', async (req: Request, res: Response) => {
    const runId = param(req, 'runId');
    // We need to search across all flow runs — use the flow_runs table directly
    // For now, return 404 placeholder since FlowRepository doesn't have getRunById
    throw new AppError('Not implemented yet — use GET /flows/:id/runs', 501, 'NOT_IMPLEMENTED');
  });

  return router;
}
