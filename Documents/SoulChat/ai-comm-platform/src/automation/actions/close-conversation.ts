import type { ConversationManager } from '../../conversation/conversation-manager';
import logger from '../../services/logger';

export function executeCloseConversation(
  config: Record<string, any>,
  context: Record<string, any>,
  conversationManager: ConversationManager,
): void {
  const conversationId = context.conversationId;
  if (!conversationId) {
    logger.warn('close_conversation action: missing conversationId');
    return;
  }

  const reason = config.reason || 'Closed by automation flow';
  conversationManager.closeConversation(conversationId, reason);
  logger.info(`Flow action: closed conversation ${conversationId} (${reason})`);
}
