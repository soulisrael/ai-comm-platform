import { Router, Request, Response } from 'express';
import { ConversationEngine } from '../../conversation/conversation-engine';

export function createAnalyticsRouter(engine: ConversationEngine): Router {
  const router = Router();
  const convManager = engine.getConversationManager();
  const contactManager = engine.getContactManager();

  /**
   * @swagger
   * /api/analytics/overview:
   *   get:
   *     summary: Get platform analytics overview
   *     tags: [Analytics]
   *     responses:
   *       200:
   *         description: Analytics overview
   */
  router.get('/overview', (_req: Request, res: Response) => {
    const stats = convManager.getStats();
    const allConversations = convManager.getAllConversations();
    const contacts = contactManager.getAllContacts();

    // Messages by channel
    const messagesByChannel: Record<string, number> = {};
    const messagesByAgent: Record<string, number> = {};
    let totalMessages = 0;
    let handoffCount = 0;
    let closedCount = 0;

    for (const conv of allConversations) {
      totalMessages += conv.messages.length;

      messagesByChannel[conv.channel] = (messagesByChannel[conv.channel] || 0) + conv.messages.length;

      if (conv.currentAgent) {
        messagesByAgent[conv.currentAgent] = (messagesByAgent[conv.currentAgent] || 0) + conv.messages.length;
      }

      if (conv.status === 'handoff' || conv.status === 'human_active') {
        handoffCount++;
      }
      if (conv.status === 'closed') {
        closedCount++;
      }
    }

    const totalConversations = allConversations.length;
    const resolutionRate = totalConversations > 0
      ? Math.round((closedCount / totalConversations) * 100)
      : 0;
    const handoffRate = totalConversations > 0
      ? Math.round((handoffCount / totalConversations) * 100)
      : 0;

    res.json({
      totalConversations,
      activeConversations: stats.active + stats.waiting,
      totalContacts: contacts.length,
      totalMessages,
      resolutionRate,
      handoffRate,
      messagesByChannel,
      messagesByAgent,
      conversationStats: stats,
    });
  });

  /**
   * @swagger
   * /api/analytics/conversations:
   *   get:
   *     summary: Conversation volume over time
   *     tags: [Analytics]
   *     parameters:
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *       - in: query
   *         name: groupBy
   *         schema:
   *           type: string
   *           enum: [hour, day, week]
   */
  router.get('/conversations', (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const allConversations = convManager.getAllConversations();

    let filtered = allConversations;
    if (startDate) {
      const start = new Date(startDate as string);
      filtered = filtered.filter(c => c.startedAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      filtered = filtered.filter(c => c.startedAt <= end);
    }

    // Group conversations
    const groups: Record<string, number> = {};
    for (const conv of filtered) {
      const key = getGroupKey(conv.startedAt, groupBy as string);
      groups[key] = (groups[key] || 0) + 1;
    }

    const data = Object.entries(groups)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    res.json({ groupBy, data, total: filtered.length });
  });

  return router;
}

function getGroupKey(date: Date, groupBy: string): string {
  switch (groupBy) {
    case 'hour':
      return `${date.toISOString().slice(0, 13)}:00`;
    case 'week': {
      const d = new Date(date);
      d.setDate(d.getDate() - d.getDay());
      return d.toISOString().slice(0, 10);
    }
    case 'day':
    default:
      return date.toISOString().slice(0, 10);
  }
}
