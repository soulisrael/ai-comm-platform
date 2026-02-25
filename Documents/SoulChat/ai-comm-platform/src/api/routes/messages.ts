import { Router, Request, Response } from 'express';
import { ConversationEngine } from '../../conversation/conversation-engine';
import { ChannelType } from '../../types/message';
import { AppError } from '../middleware/error-handler';

export function createMessagesRouter(engine: ConversationEngine): Router {
  const router = Router();

  /**
   * @swagger
   * /api/messages/incoming:
   *   post:
   *     summary: Process an incoming message
   *     tags: [Messages]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [channelUserId, channel, content]
   *             properties:
   *               channelUserId:
   *                 type: string
   *               channel:
   *                 type: string
   *                 enum: [whatsapp, instagram, telegram, web]
   *               content:
   *                 type: string
   *               senderName:
   *                 type: string
   *               metadata:
   *                 type: object
   *     responses:
   *       200:
   *         description: Message processed successfully
   */
  router.post('/incoming', async (req: Request, res: Response) => {
    const { channelUserId, channel, content, senderName, metadata } = req.body;

    if (!channelUserId || !channel || !content) {
      throw new AppError('channelUserId, channel, and content are required', 400, 'VALIDATION_ERROR');
    }

    const validChannels: ChannelType[] = ['whatsapp', 'instagram', 'telegram', 'web'];
    if (!validChannels.includes(channel)) {
      throw new AppError(`Invalid channel: ${channel}`, 400, 'VALIDATION_ERROR');
    }

    const result = await engine.handleIncomingMessage({
      channelUserId,
      channel,
      content,
      senderName,
      metadata,
    });

    res.json({
      conversationId: result.conversation.id,
      response: result.outgoingMessage.content,
      agent: result.agentType,
      routingDecision: result.routingDecision,
    });
  });

  return router;
}
