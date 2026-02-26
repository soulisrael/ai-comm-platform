import logger from './logger';

const DEFAULT_BATCH_DELAY = 3000; // 3 seconds

interface PendingBatch {
  messages: string[];
  timer: ReturnType<typeof setTimeout>;
  conversationId: string;
}

export class MessageBatcher {
  private pending: Map<string, PendingBatch> = new Map();
  private batchDelay: number;
  private onBatchReady: (conversationId: string, combinedMessage: string) => void | Promise<void>;

  constructor(
    onBatchReady: (conversationId: string, combinedMessage: string) => void | Promise<void>,
    batchDelay = DEFAULT_BATCH_DELAY
  ) {
    this.onBatchReady = onBatchReady;
    this.batchDelay = batchDelay;
  }

  /**
   * Add an incoming message. If there's already a pending batch for this conversation,
   * append to it and reset the timer. Otherwise create a new batch.
   */
  onIncomingMessage(conversationId: string, text: string): void {
    const existing = this.pending.get(conversationId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(text);
      existing.timer = setTimeout(() => this.processBatch(conversationId), this.batchDelay);
    } else {
      const timer = setTimeout(() => this.processBatch(conversationId), this.batchDelay);
      this.pending.set(conversationId, { messages: [text], timer, conversationId });
    }
  }

  /**
   * Process a batch: combine all pending messages and send to callback.
   */
  private async processBatch(conversationId: string): Promise<void> {
    const batch = this.pending.get(conversationId);
    if (!batch) return;
    this.pending.delete(conversationId);

    const combined = batch.messages.join('\n');
    logger.info(`Processing batch for ${conversationId}: ${batch.messages.length} messages combined`);

    try {
      await this.onBatchReady(conversationId, combined);
    } catch (err) {
      logger.error(`Batch processing failed for ${conversationId}:`, err);
    }
  }

  /** Check if there's a pending batch for a conversation */
  hasPending(conversationId: string): boolean {
    return this.pending.has(conversationId);
  }

  /** Get pending message count for a conversation */
  getPendingCount(conversationId: string): number {
    return this.pending.get(conversationId)?.messages.length || 0;
  }

  /** Cancel a pending batch */
  cancel(conversationId: string): void {
    const batch = this.pending.get(conversationId);
    if (batch) {
      clearTimeout(batch.timer);
      this.pending.delete(conversationId);
    }
  }

  /** Cancel all pending batches */
  cancelAll(): void {
    for (const [id, batch] of this.pending) {
      clearTimeout(batch.timer);
    }
    this.pending.clear();
  }
}
