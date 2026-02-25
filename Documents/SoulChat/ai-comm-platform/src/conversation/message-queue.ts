import { Message } from '../types/message';
import logger from '../services/logger';

interface QueueItem {
  message: Message;
  resolve: (value: void) => void;
  reject: (reason: unknown) => void;
}

export class MessageQueue {
  private queues: Map<string, QueueItem[]> = new Map();
  private processing: Set<string> = new Set();
  private handler: ((message: Message) => Promise<void>) | null = null;

  setHandler(handler: (message: Message) => Promise<void>): void {
    this.handler = handler;
  }

  async enqueue(message: Message): Promise<void> {
    const conversationId = message.conversationId;

    return new Promise<void>((resolve, reject) => {
      if (!this.queues.has(conversationId)) {
        this.queues.set(conversationId, []);
      }
      this.queues.get(conversationId)!.push({ message, resolve, reject });

      logger.debug(`Message queued for conversation ${conversationId}`, {
        queueLength: this.queues.get(conversationId)!.length,
      });

      // Start processing if not already processing this conversation
      if (!this.processing.has(conversationId)) {
        this.processQueue(conversationId);
      }
    });
  }

  isProcessing(conversationId: string): boolean {
    return this.processing.has(conversationId);
  }

  getQueueLength(conversationId: string): number {
    return this.queues.get(conversationId)?.length || 0;
  }

  private async processQueue(conversationId: string): Promise<void> {
    if (this.processing.has(conversationId)) return;
    this.processing.add(conversationId);

    try {
      while (true) {
        const queue = this.queues.get(conversationId);
        if (!queue || queue.length === 0) break;

        const item = queue.shift()!;

        try {
          if (this.handler) {
            await this.handler(item.message);
          }
          item.resolve();
        } catch (err) {
          logger.error(`Error processing message in queue`, {
            conversationId,
            messageId: item.message.id,
            error: String(err),
          });
          item.reject(err);
        }
      }
    } finally {
      this.processing.delete(conversationId);
      // Clean up empty queues
      const queue = this.queues.get(conversationId);
      if (queue && queue.length === 0) {
        this.queues.delete(conversationId);
      }
    }
  }
}
