import { Router, Request, Response } from 'express';
import { TopicRepository } from '../../database/repositories/topic-repository';
import { CustomAgentRepository } from '../../database/repositories/custom-agent-repository';
import { topicFromRow, customAgentFromRow } from '../../database/db-types';
import { AppError } from '../middleware/error-handler';

export function createTopicsRouter(
  topicRepo: TopicRepository,
  agentRepo: CustomAgentRepository
): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET / — List topics with optional filters
  router.get('/', async (req: Request, res: Response) => {
    const { shared, agentId } = req.query;

    let topics;
    if (agentId) {
      topics = await topicRepo.getByAgent(agentId as string);
    } else if (shared === 'true') {
      topics = await topicRepo.getShared();
    } else {
      topics = await topicRepo.findAll();
    }

    res.json({ topics: topics.map(topicFromRow) });
  });

  // POST / — Create topic
  router.post('/', async (req: Request, res: Response) => {
    const row = await topicRepo.createTopic(req.body);
    res.status(201).json(topicFromRow(row));
  });

  // GET /:id — Get topic + agents using it
  router.get('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const row = await topicRepo.findById(id);
    if (!row) {
      throw new AppError('Topic not found', 404, 'NOT_FOUND');
    }

    const agentRows = await topicRepo.getAgentsUsingTopic(id);
    res.json({
      ...topicFromRow(row),
      agents: agentRows.map(customAgentFromRow),
    });
  });

  // PUT /:id — Update topic
  router.put('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await topicRepo.findById(id);
    if (!existing) {
      throw new AppError('Topic not found', 404, 'NOT_FOUND');
    }
    const updated = await topicRepo.updateTopic(id, req.body);
    res.json(topicFromRow(updated));
  });

  // DELETE /:id — Delete topic (CASCADE handles junction)
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await topicRepo.findById(id);
    if (!existing) {
      throw new AppError('Topic not found', 404, 'NOT_FOUND');
    }
    await topicRepo.deleteById(id);
    res.json({ success: true });
  });

  // POST /:id/duplicate — Duplicate topic
  router.post('/:id/duplicate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await topicRepo.findById(id);
    if (!existing) {
      throw new AppError('Topic not found', 404, 'NOT_FOUND');
    }

    const source = topicFromRow(existing);
    const { name } = req.body || {};
    const newName = name || `${source.name} (copy)`;

    const newRow = await topicRepo.createTopic({
      name: newName,
      description: source.description,
      content: source.content,
      isShared: source.isShared,
    });

    res.status(201).json(topicFromRow(newRow));
  });

  return router;
}
