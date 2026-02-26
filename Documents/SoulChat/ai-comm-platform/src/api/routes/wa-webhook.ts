import { Router, Request, Response } from 'express';
import { WaConfigRepository } from '../../database/repositories/wa-config-repository';
import { ConversationEngine } from '../../conversation/conversation-engine';
import { MessageBatcher } from '../../services/message-batcher';
import { ServiceWindowManager } from '../../services/service-window';
import logger from '../../services/logger';

export function createWaWebhookRouter(
  waConfigRepo: WaConfigRepository,
  engine: ConversationEngine,
  messageBatcher: MessageBatcher,
  serviceWindow: ServiceWindowManager,
): Router {
  const router = Router();

  // GET /whatsapp — webhook verification (Meta sends GET to verify)
  router.get('/whatsapp', async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode !== 'subscribe') {
      res.sendStatus(403);
      return;
    }

    const config = await waConfigRepo.get();
    if (!config || token !== config.verifyToken) {
      logger.warn('WhatsApp webhook verification failed: token mismatch');
      res.sendStatus(403);
      return;
    }

    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  });

  // POST /whatsapp — incoming messages and status updates
  router.post('/whatsapp', async (req: Request, res: Response) => {
    const body = req.body;

    // Always respond 200 quickly to Meta
    res.sendStatus(200);

    try {
      const entries = body?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const value = change?.value;
          if (!value) continue;

          // Process incoming messages
          const messages = value.messages || [];
          for (const msg of messages) {
            await processIncomingMessage(msg, value, engine, messageBatcher, serviceWindow);
          }

          // Process status updates
          const statuses = value.statuses || [];
          for (const status of statuses) {
            processStatusUpdate(status);
          }
        }
      }
    } catch (err) {
      logger.error('WhatsApp webhook processing error:', err);
    }
  });

  return router;
}

async function processIncomingMessage(
  msg: any,
  value: any,
  engine: ConversationEngine,
  messageBatcher: MessageBatcher,
  serviceWindow: ServiceWindowManager,
): Promise<void> {
  const from = msg.from; // phone number
  const type = msg.type;
  const contactInfo = value.contacts?.[0];
  const senderName = contactInfo?.profile?.name || from;

  let content = '';
  if (type === 'text') {
    content = msg.text?.body || '';
  } else if (type === 'image' || type === 'video' || type === 'document' || type === 'audio') {
    content = msg[type]?.caption || `[${type}]`;
  } else if (type === 'location') {
    content = `[location: ${msg.location?.latitude},${msg.location?.longitude}]`;
  } else if (type === 'reaction') {
    content = `[reaction: ${msg.reaction?.emoji}]`;
  } else {
    content = `[${type}]`;
  }

  if (!content) return;

  logger.info(`WhatsApp message from ${from}: ${content.substring(0, 50)}`);

  // Determine entry point from referral data (CTWA ads)
  const referral = msg.referral || value.metadata?.referral;
  const entryPoint = referral?.source === 'ad' ? 'ctwa_ad' as const : 'organic' as const;

  // Use message batcher to debounce rapid messages
  messageBatcher.onIncomingMessage(from, content);

  // Note: The batcher callback will handle the actual engine.handleIncomingMessage
  // and service window updates. The batcher was initialized with the appropriate callback.
}

function processStatusUpdate(status: any): void {
  const messageId = status.id;
  const recipientId = status.recipient_id;
  const statusValue = status.status; // sent, delivered, read, failed

  logger.info(`WhatsApp status update: ${messageId} → ${statusValue} (to: ${recipientId})`);

  // TODO: Update message delivery status in DB when message persistence layer supports it
}
