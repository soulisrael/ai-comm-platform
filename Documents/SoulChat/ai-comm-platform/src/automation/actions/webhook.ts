import axios from 'axios';
import logger from '../../services/logger';

export async function executeWebhook(
  config: Record<string, any>,
  context: Record<string, any>,
): Promise<void> {
  const url = config.url;
  if (!url) {
    logger.warn('webhook action: no URL configured');
    return;
  }

  try {
    await axios.post(url, {
      flowId: context.flowId,
      conversationId: context.conversationId,
      contactId: context.contactId,
      data: config.data || context,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      },
      timeout: config.timeout || 10_000,
    });
    logger.info(`Flow action: webhook sent to ${url}`);
  } catch (err: any) {
    logger.error(`Flow action: webhook failed for ${url}: ${err.message}`);
    throw err;
  }
}
