import { Router, Request, Response } from 'express';
import logger from '../../services/logger';

export function createWebhooksRouter(): Router {
  const router = Router();

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

  router.post('/whatsapp', (req: Request, res: Response) => {
    logger.info('WhatsApp webhook received', { body: JSON.stringify(req.body).slice(0, 200) });
    // TODO: Implement in Phase 8
    res.sendStatus(200);
  });

  /**
   * @swagger
   * /api/webhooks/instagram:
   *   post:
   *     summary: Instagram incoming webhook
   *     tags: [Webhooks]
   */
  router.post('/instagram', (req: Request, res: Response) => {
    logger.info('Instagram webhook received', { body: JSON.stringify(req.body).slice(0, 200) });
    // TODO: Implement in Phase 8
    res.sendStatus(200);
  });

  /**
   * @swagger
   * /api/webhooks/telegram:
   *   post:
   *     summary: Telegram incoming webhook
   *     tags: [Webhooks]
   */
  router.post('/telegram', (req: Request, res: Response) => {
    logger.info('Telegram webhook received', { body: JSON.stringify(req.body).slice(0, 200) });
    // TODO: Implement in Phase 8
    res.sendStatus(200);
  });

  return router;
}
