import type { ConversationManager } from '../../conversation/conversation-manager';
import type { AgentType } from '../../types/conversation';
import logger from '../../services/logger';

export function executeAssignAgent(
  config: Record<string, any>,
  context: Record<string, any>,
  conversationManager: ConversationManager,
): void {
  const conversationId = context.conversationId;
  const agentType = config.agentType as AgentType;

  if (!conversationId || !agentType) {
    logger.warn('assign_agent action: missing conversationId or agentType');
    return;
  }

  conversationManager.updateAgent(conversationId, agentType);
  logger.info(`Flow action: assigned agent "${agentType}" to conversation ${conversationId}`);
}
