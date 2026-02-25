import type { ChannelManager } from '../../channels/channel-manager';
import type { ChannelType } from '../../types/message';
import { createMessage } from '../../types/message';
import logger from '../../services/logger';

export async function executeSendMessage(
  config: Record<string, any>,
  context: Record<string, any>,
  channelManager: ChannelManager,
): Promise<void> {
  const channel = (context.channel || config.channel || 'web') as ChannelType;
  const to = context.channelUserId || config.to;
  const content = config.content || config.message || '';

  if (!to) {
    logger.warn('send_message action: no recipient');
    return;
  }

  const message = createMessage({
    conversationId: context.conversationId || '',
    contactId: context.contactId || '',
    direction: 'outbound',
    type: 'text',
    content,
    channel,
    metadata: { automated: true, flowId: context.flowId },
  });

  await channelManager.sendResponse(channel, to, message);
  logger.info(`Flow action: sent message to ${to} via ${channel}`);
}
