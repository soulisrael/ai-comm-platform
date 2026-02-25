import logger from '../../services/logger';

export interface WaitResult {
  delayMs: number;
}

export function executeWait(config: Record<string, any>): WaitResult {
  const delayMs = parseDelay(config);
  logger.info(`Flow action: wait ${delayMs}ms before next step`);
  return { delayMs };
}

function parseDelay(config: Record<string, any>): number {
  if (config.delayMs) return Number(config.delayMs);

  const amount = Number(config.amount || config.delay || 0);
  const unit = (config.unit || 'seconds') as string;

  switch (unit) {
    case 'seconds': return amount * 1000;
    case 'minutes': return amount * 60 * 1000;
    case 'hours': return amount * 60 * 60 * 1000;
    case 'days': return amount * 24 * 60 * 60 * 1000;
    default: return amount * 1000;
  }
}
