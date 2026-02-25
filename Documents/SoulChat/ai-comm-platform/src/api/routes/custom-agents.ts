import { Router, Request, Response } from 'express';
import { CustomAgentRepository } from '../../database/repositories/custom-agent-repository';
import { TopicRepository } from '../../database/repositories/topic-repository';
import { AgentRunner } from '../../agents/agent-runner';
import { ClaudeAPI } from '../../services/claude-api';
import { customAgentFromRow } from '../../database/db-types';
import { AppError } from '../middleware/error-handler';

export function createCustomAgentsRouter(
  agentRepo: CustomAgentRepository,
  topicRepo: TopicRepository,
  agentRunner: AgentRunner,
  claude: ClaudeAPI
): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET / — List agents with optional active filter
  router.get('/', async (req: Request, res: Response) => {
    const { active } = req.query;

    let agents;
    if (active === 'true') {
      agents = await agentRepo.getActive();
    } else if (active === 'false') {
      const all = await agentRepo.findAll();
      agents = all.filter(a => !a.active);
    } else {
      agents = await agentRepo.findAll();
    }

    // Get topic counts per agent
    const allWithTopics = await agentRepo.getAllWithTopics();
    const topicCountMap = new Map<string, number>();
    for (const a of allWithTopics) {
      topicCountMap.set(a.id, a.topics.length);
    }

    res.json({
      agents: agents.map(row => ({
        ...customAgentFromRow(row),
        topicCount: topicCountMap.get(row.id) || 0,
      })),
    });
  });

  // POST / — Create agent
  router.post('/', async (req: Request, res: Response) => {
    const row = await agentRepo.createAgent(req.body);
    res.status(201).json(customAgentFromRow(row));
  });

  // GET /:id — Get agent with full topics
  router.get('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const agent = await agentRepo.getWithTopics(id);
    if (!agent) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    res.json(agent);
  });

  // PUT /:id — Update agent
  router.put('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const updated = await agentRepo.updateAgent(id, req.body);
    res.json(customAgentFromRow(updated));
  });

  // DELETE /:id — Delete agent
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    await agentRepo.deleteById(id);
    res.json({ success: true });
  });

  // POST /:id/duplicate — Duplicate agent + topic links
  router.post('/:id/duplicate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const source = await agentRepo.getWithTopics(id);
    if (!source) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    const { name } = req.body || {};
    const newName = name || `${source.name} (copy)`;

    const newRow = await agentRepo.createAgent({
      name: newName,
      description: source.description,
      systemPrompt: source.systemPrompt,
      routingKeywords: source.routingKeywords,
      routingDescription: source.routingDescription,
      handoffRules: source.handoffRules,
      transferRules: source.transferRules,
      settings: source.settings,
      isDefault: false,
      active: false,
    });

    // Copy topic links
    for (const topic of source.topics) {
      await agentRepo.assignTopic(newRow.id, topic.id);
    }

    const result = await agentRepo.getWithTopics(newRow.id);
    res.status(201).json(result);
  });

  // POST /:id/test — Test agent with a message
  router.post('/:id/test', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    const { message } = req.body || {};
    if (!message) {
      throw new AppError('message is required', 400, 'VALIDATION_ERROR');
    }

    const result = await agentRunner.run(id, message, []);
    res.json({
      response: result.message,
      confidence: result.confidence,
      shouldHandoff: result.shouldHandoff,
      shouldTransfer: result.shouldTransfer,
    });
  });

  // PUT /:id/activate — Set active = true
  router.put('/:id/activate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const updated = await agentRepo.updateAgent(id, { active: true });
    res.json(customAgentFromRow(updated));
  });

  // PUT /:id/deactivate — Set active = false
  router.put('/:id/deactivate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const updated = await agentRepo.updateAgent(id, { active: false });
    res.json(customAgentFromRow(updated));
  });

  // GET /:id/topics — List topics linked to agent
  router.get('/:id/topics', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const topics = await topicRepo.getByAgent(id);
    res.json({ topics: topics.map(t => ({ ...t })) });
  });

  // POST /:id/topics — Link topic to agent
  router.post('/:id/topics', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    const { topicId } = req.body || {};
    if (!topicId) {
      throw new AppError('topicId is required', 400, 'VALIDATION_ERROR');
    }

    const topic = await topicRepo.findById(topicId);
    if (!topic) {
      throw new AppError('Topic not found', 404, 'NOT_FOUND');
    }

    await agentRepo.assignTopic(id, topicId);
    res.status(201).json({ success: true });
  });

  // DELETE /:id/topics/:topicId — Unlink topic from agent
  router.delete('/:id/topics/:topicId', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const topicId = param(req, 'topicId');

    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    await agentRepo.removeTopic(id, topicId);
    res.json({ success: true });
  });

  return router;
}
