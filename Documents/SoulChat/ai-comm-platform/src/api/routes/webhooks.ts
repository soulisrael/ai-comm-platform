import { Router, Request, Response } from 'express';
import type { ChannelManager } from '../../channels/channel-manager';
import type { ConversationEngine, RawIncomingMessage } from '../../conversation/conversation-engine';
import { createWebhookValidator } from '../middleware/webhook-validator';
import logger from '../../services/logger';

export function createWebhooksRouter(channelManager: ChannelManager, engine: ConversationEngine): Router {
  const router = Router();
  const validate = createWebhookValidator(channelManager);

  /**
   * @swagger
   * /api/webhooks/whatsapp:
   *   get:
   *     summary: WhatsApp webhook verification
   *     tags: [Webhooks]
   *   post:
   *     summary: WhatsApp incoming webhook
   *     tags: [Webhooks]
   */
  router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('WhatsApp webhook verification failed');
    res.sendStatus(403);
  });

  router.post('/whatsapp', validate('whatsapp'), async (req: Request, res: Response) => {
    // Respond immediately to avoid webhook timeout
    res.sendStatus(200);

    try {
      const adapter = channelManager.getAdapter('whatsapp');
      if (!adapter) return;

      const parsed = adapter.parseIncomingMessage(req.body);
      if (!parsed) return;

      const raw: RawIncomingMessage = {
        content: parsed.content,
        channelUserId: parsed.channelUserId,
        channel: 'whatsapp',
        senderName: parsed.senderName,
        metadata: parsed.metadata,
      };

      const result = await engine.handleIncomingMessage(raw);

      // Send response back via WhatsApp
      await channelManager.sendResponse('whatsapp', parsed.channelUserId, result.outgoingMessage);
    } catch (err) {
      logger.error('WhatsApp webhook processing error:', err);
    }
  });

  /**
   * @swagger
   * /api/webhooks/instagram:
   *   get:
   *     summary: Instagram webhook verification
   *     tags: [Webhooks]
   *   post:
   *     summary: Instagram incoming webhook
   *     tags: [Webhooks]
   */
  router.get('/instagram', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('Instagram webhook verified');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('Instagram webhook verification failed');
    res.sendStatus(403);
  });

  router.post('/instagram', validate('instagram'), async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
      const adapter = channelManager.getAdapter('instagram');
      if (!adapter) return;

      const parsed = adapter.parseIncomingMessage(req.body);
      if (!parsed) return;

      const raw: RawIncomingMessage = {
        content: parsed.content,
        channelUserId: parsed.channelUserId,
        channel: 'instagram',
        senderName: parsed.senderName,
        metadata: parsed.metadata,
      };

      const result = await engine.handleIncomingMessage(raw);
      await channelManager.sendResponse('instagram', parsed.channelUserId, result.outgoingMessage);
    } catch (err) {
      logger.error('Instagram webhook processing error:', err);
    }
  });

  /**
   * @swagger
   * /api/webhooks/telegram:
   *   post:
   *     summary: Telegram incoming webhook
   *     tags: [Webhooks]
   */
  router.post('/telegram', validate('telegram'), async (req: Request, res: Response) => {
    res.sendStatus(200);

    try {
      const adapter = channelManager.getAdapter('telegram');
      if (!adapter) return;

      const parsed = adapter.parseIncomingMessage(req.body);
      if (!parsed) return;

      const raw: RawIncomingMessage = {
        content: parsed.content,
        channelUserId: parsed.channelUserId,
        channel: 'telegram',
        senderName: parsed.senderName,
        metadata: parsed.metadata,
      };

      const result = await engine.handleIncomingMessage(raw);
      await channelManager.sendResponse('telegram', parsed.channelUserId, result.outgoingMessage);
    } catch (err) {
      logger.error('Telegram webhook processing error:', err);
    }
  });

  return router;
}
