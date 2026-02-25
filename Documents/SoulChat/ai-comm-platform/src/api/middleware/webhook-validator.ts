import { Request, Response, NextFunction } from 'express';
import type { ChannelType } from '../../types/message';
import type { ChannelManager } from '../../channels/channel-manager';
import logger from '../../services/logger';

const recentMessageIds = new Set<string>();
const MAX_DEDUP_SIZE = 10_000;

function dedup(messageId: string): boolean {
  if (recentMessageIds.has(messageId)) return true;
  recentMessageIds.add(messageId);
  if (recentMessageIds.size > MAX_DEDUP_SIZE) {
    // Evict oldest entries (Set maintains insertion order)
    const iter = recentMessageIds.values();
    for (let i = 0; i < MAX_DEDUP_SIZE / 2; i++) {
      recentMessageIds.delete(iter.next().value!);
    }
  }
  return false;
}

export function createWebhookValidator(channelManager: ChannelManager) {
  return function validateWebhook(channel: ChannelType) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const adapter = channelManager.getAdapter(channel);
      if (!adapter) {
        logger.warn(`Webhook received for unregistered channel: ${channel}`);
        res.sendStatus(404);
        return;
      }

      // Verify webhook signature
      const isValid = adapter.verifyWebhook(req.headers as Record<string, string | string[] | undefined>, req.body);
      if (!isValid) {
        logger.warn(`Invalid webhook signature for ${channel}`);
        res.sendStatus(403);
        return;
      }

      // Parse and check for duplicate messages
      const parsed = adapter.parseIncomingMessage(req.body);
      if (parsed?.messageId && dedup(parsed.messageId)) {
        logger.debug(`Duplicate message ignored: ${parsed.messageId}`);
        res.sendStatus(200);
        return;
      }

      next();
    };
  };
}

// Export for testing
export { dedup, recentMessageIds };
