import { Router, Request, Response } from 'express';
import { ConversationEngine } from '../../conversation/conversation-engine';
import { ConversationStatus, AgentType } from '../../types/conversation';
import { ChannelType } from '../../types/message';
import { AppError } from '../middleware/error-handler';

export function createConversationsRouter(engine: ConversationEngine): Router {
  const router = Router();
  const convManager = engine.getConversationManager();
  const orchestrator = engine.getOrchestrator();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  /**
   * @swagger
   * /api/conversations:
   *   get:
   *     summary: List conversations
   *     tags: [Conversations]
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *       - in: query
   *         name: channel
   *         schema:
   *           type: string
   *       - in: query
   *         name: agent
   *         schema:
   *           type: string
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of conversations
   */
  router.get('/', (req: Request, res: Response) => {
    const { status, channel, agent, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);

    const conversations = convManager.findConversations({
      status: status as ConversationStatus | undefined,
      channel: channel as ChannelType | undefined,
      currentAgent: agent as AgentType | undefined,
    });

    const start = (pageNum - 1) * limitNum;
    const paginated = conversations.slice(start, start + limitNum);

    res.json({
      conversations: paginated.map(c => ({
        id: c.id,
        contactId: c.contactId,
        channel: c.channel,
        status: c.status,
        currentAgent: c.currentAgent,
        messageCount: c.messages.length,
        context: c.context,
        startedAt: c.startedAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: conversations.length,
        pages: Math.ceil(conversations.length / limitNum),
      },
    });
  });

  /**
   * @swagger
   * /api/conversations/{id}:
   *   get:
   *     summary: Get conversation details
   *     tags: [Conversations]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Conversation details
   */
  router.get('/:id', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }
    res.json(conversation);
  });

  /**
   * @swagger
   * /api/conversations/{id}/handoff:
   *   post:
   *     summary: Trigger human handoff
   *     tags: [Conversations]
   */
  router.post('/:id/handoff', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    engine.handleHandoff(id);
    res.json({ success: true, status: 'handoff', reason: (req.body || {}).reason || 'Manual handoff' });
  });

  /**
   * @swagger
   * /api/conversations/{id}/takeover:
   *   post:
   *     summary: Human agent takes full control
   *     tags: [Conversations]
   */
  router.post('/:id/takeover', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const { humanAgentId } = req.body || {};
    if (!humanAgentId) {
      throw new AppError('humanAgentId is required', 400, 'VALIDATION_ERROR');
    }

    convManager.updateStatus(id, 'human_active');
    convManager.updateContext(id, {
      customFields: { ...conversation.context.customFields, humanAgentId },
    });

    res.json({ success: true, status: 'human_active', humanAgentId });
  });

  /**
   * @swagger
   * /api/conversations/{id}/pause:
   *   post:
   *     summary: Pause AI auto-responding
   *     tags: [Conversations]
   */
  router.post('/:id/pause', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    convManager.updateStatus(id, 'paused');
    res.json({ success: true, status: 'paused' });
  });

  /**
   * @swagger
   * /api/conversations/{id}/resume:
   *   post:
   *     summary: Resume AI control
   *     tags: [Conversations]
   */
  router.post('/:id/resume', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const { agentType, customAgentId } = req.body || {};

    if (customAgentId) {
      orchestrator.switchCustomAgent(conversation, customAgentId);
    } else if (agentType) {
      convManager.updateAgent(id, agentType);
    }

    engine.resumeAI(id);
    res.json({
      success: true,
      status: 'active',
      agentType: agentType || conversation.currentAgent,
      customAgentId: customAgentId || conversation.customAgentId,
    });
  });

  /**
   * @swagger
   * /api/conversations/{id}/transfer:
   *   post:
   *     summary: Transfer between human agents
   *     tags: [Conversations]
   */
  router.post('/:id/transfer', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const { fromAgentId, toAgentId, internalNote } = req.body || {};
    if (!fromAgentId || !toAgentId) {
      throw new AppError('fromAgentId and toAgentId are required', 400, 'VALIDATION_ERROR');
    }

    convManager.updateContext(id, {
      customFields: {
        ...conversation.context.customFields,
        humanAgentId: toAgentId,
        transferredFrom: fromAgentId,
        transferNote: internalNote,
      },
    });

    res.json({ success: true, transferredTo: toAgentId });
  });

  /**
   * @swagger
   * /api/conversations/{id}/reply:
   *   post:
   *     summary: Human agent sends a reply
   *     tags: [Conversations]
   */
  router.post('/:id/reply', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    if (!['human_active', 'handoff'].includes(conversation.status)) {
      throw new AppError(
        'Can only reply when status is human_active or handoff',
        400,
        'INVALID_STATUS'
      );
    }

    const { agentId, message } = req.body || {};
    if (!agentId || !message) {
      throw new AppError('agentId and message are required', 400, 'VALIDATION_ERROR');
    }

    const reply = engine.handleHumanReply(id, agentId, message);
    res.json({ success: true, message: reply });
  });

  /**
   * @swagger
   * /api/conversations/{id}/note:
   *   post:
   *     summary: Add internal note
   *     tags: [Conversations]
   */
  router.post('/:id/note', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const { agentId, note } = req.body || {};
    if (!agentId || !note) {
      throw new AppError('agentId and note are required', 400, 'VALIDATION_ERROR');
    }

    const notes = (conversation.context.customFields.notes as Array<{ agentId: string; note: string; timestamp: string }>) || [];
    notes.push({ agentId, note, timestamp: new Date().toISOString() });
    convManager.updateContext(id, {
      customFields: { ...conversation.context.customFields, notes },
    });

    res.json({ success: true });
  });

  /**
   * @swagger
   * /api/conversations/{id}/close:
   *   post:
   *     summary: Close conversation
   *     tags: [Conversations]
   */
  router.post('/:id/close', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    convManager.closeConversation(id, (req.body || {}).reason);
    res.json({ success: true, status: 'closed' });
  });

  /**
   * @swagger
   * /api/conversations/{id}/switch-agent:
   *   post:
   *     summary: Switch active AI agent type
   *     tags: [Conversations]
   */
  router.post('/:id/switch-agent', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const { agentType, customAgentId } = req.body;

    // If customAgentId provided, switch to custom agent
    if (customAgentId) {
      orchestrator.switchCustomAgent(conversation, customAgentId);
      res.json({ success: true, customAgentId });
      return;
    }

    const validAgents: AgentType[] = ['sales', 'support', 'trial_meeting'];
    if (!agentType || !validAgents.includes(agentType)) {
      throw new AppError(`agentType must be one of: ${validAgents.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    orchestrator.switchAgent(conversation, agentType);
    convManager.updateAgent(id, agentType);

    res.json({ success: true, agentType });
  });

  /**
   * @swagger
   * /api/conversations/{id}/transfer-to-agent:
   *   post:
   *     summary: Transfer to a different custom agent
   *     tags: [Conversations]
   */
  router.post('/:id/transfer-to-agent', (req: Request, res: Response) => {
    const id = param(req, 'id');
    const conversation = convManager.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    const { targetAgentId } = req.body || {};
    if (!targetAgentId) {
      throw new AppError('targetAgentId is required', 400, 'VALIDATION_ERROR');
    }

    orchestrator.switchCustomAgent(conversation, targetAgentId);
    res.json({ success: true, customAgentId: targetAgentId });
  });

  return router;
}
