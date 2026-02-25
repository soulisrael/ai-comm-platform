import type { ChannelManager } from '../channels/channel-manager';
import type { ContactManager } from '../conversation/contact-manager';
import type { ChannelType } from '../types/message';
import type { Broadcast } from '../types/automation';
import { createMessage } from '../types/message';
import { MemoryStore } from '../conversation/memory-store';
import logger from '../services/logger';

interface BroadcastConfig {
  name: string;
  target: {
    tags?: string[];
    channel?: ChannelType;
    customFilter?: (contact: any) => boolean;
  };
  message: {
    content: string;
    type?: string;
    buttons?: Array<{ id: string; title: string }>;
  };
  schedule?: Date;
}

// Rate limits per channel (messages per second)
const RATE_LIMITS: Record<string, number> = {
  whatsapp: 80,
  telegram: 30,
  instagram: 20,
  web: 100,
};

export class BroadcastManager {
  private broadcasts = new MemoryStore<Broadcast>();
  private channelManager: ChannelManager;
  private contactManager: ContactManager;
  private scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(channelManager: ChannelManager, contactManager: ContactManager) {
    this.channelManager = channelManager;
    this.contactManager = contactManager;
  }

  createBroadcast(config: BroadcastConfig): Broadcast {
    const broadcast: Broadcast = {
      id: `bcast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: config.name,
      messageContent: config.message.content,
      messageType: config.message.type || 'text',
      targetFilter: {
        tags: config.target.tags,
        channel: config.target.channel,
      },
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      status: config.schedule ? 'scheduled' : 'draft',
      scheduledFor: config.schedule,
      createdAt: new Date(),
    };

    // Count matching recipients
    const recipients = this.getMatchingContacts(config.target);
    broadcast.totalRecipients = recipients.length;

    this.broadcasts.create(broadcast);
    logger.info(`Broadcast created: ${broadcast.id} (${broadcast.name}), ${recipients.length} recipients`);

    // Schedule if needed
    if (config.schedule && config.schedule.getTime() > Date.now()) {
      const delay = config.schedule.getTime() - Date.now();
      const timer = setTimeout(() => {
        this.sendBroadcast(broadcast.id).catch(err =>
          logger.error(`Scheduled broadcast failed: ${err.message}`)
        );
      }, delay);
      this.scheduledTimers.set(broadcast.id, timer);
    }

    return broadcast;
  }

  async sendBroadcast(broadcastId: string): Promise<Broadcast> {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast) throw new Error(`Broadcast not found: ${broadcastId}`);
    if (broadcast.status === 'cancelled') throw new Error('Broadcast was cancelled');
    if (broadcast.status === 'completed') throw new Error('Broadcast already completed');

    broadcast.status = 'sending';
    broadcast.startedAt = new Date();
    this.broadcasts.update(broadcastId, broadcast);

    const filter = broadcast.targetFilter as BroadcastConfig['target'];
    const recipients = this.getMatchingContacts(filter);
    broadcast.totalRecipients = recipients.length;

    const channel = (filter.channel || 'web') as ChannelType;
    const rateLimit = RATE_LIMITS[channel] || 30;
    const batchDelay = Math.ceil(1000 / rateLimit);

    logger.info(`Sending broadcast ${broadcast.name} to ${recipients.length} contacts via ${channel}`);

    for (const contact of recipients) {
      const current = this.broadcasts.get(broadcastId);
      if (current?.status === 'cancelled') break;

      try {
        const message = createMessage({
          conversationId: '',
          contactId: contact.id,
          direction: 'outbound',
          type: 'text',
          content: broadcast.messageContent,
          channel,
          metadata: { broadcastId },
        });

        await this.channelManager.sendResponse(channel, contact.channelUserId, message);
        broadcast.sentCount++;
        broadcast.deliveredCount++;
      } catch (err: any) {
        broadcast.failedCount++;
        logger.error(`Broadcast send failed for ${contact.id}: ${err.message}`);
      }

      this.broadcasts.update(broadcastId, broadcast);

      // Rate limiting delay
      if (batchDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    const finalState = this.broadcasts.get(broadcastId);
    broadcast.status = finalState?.status === 'cancelled' ? 'cancelled' : 'completed';
    broadcast.completedAt = new Date();
    this.broadcasts.update(broadcastId, broadcast);

    logger.info(`Broadcast ${broadcast.name} completed: ${broadcast.sentCount} sent, ${broadcast.failedCount} failed`);
    return this.broadcasts.get(broadcastId)!;
  }

  getBroadcast(broadcastId: string): Broadcast | undefined {
    return this.broadcasts.get(broadcastId);
  }

  getAllBroadcasts(): Broadcast[] {
    return this.broadcasts.getAll();
  }

  getBroadcastStatus(broadcastId: string): Pick<Broadcast, 'sentCount' | 'deliveredCount' | 'failedCount' | 'status' | 'totalRecipients'> | null {
    const b = this.broadcasts.get(broadcastId);
    if (!b) return null;
    return {
      status: b.status,
      totalRecipients: b.totalRecipients,
      sentCount: b.sentCount,
      deliveredCount: b.deliveredCount,
      failedCount: b.failedCount,
    };
  }

  cancelBroadcast(broadcastId: string): Broadcast {
    const broadcast = this.broadcasts.get(broadcastId);
    if (!broadcast) throw new Error(`Broadcast not found: ${broadcastId}`);

    broadcast.status = 'cancelled';
    this.broadcasts.update(broadcastId, broadcast);

    // Cancel scheduled timer
    const timer = this.scheduledTimers.get(broadcastId);
    if (timer) {
      clearTimeout(timer);
      this.scheduledTimers.delete(broadcastId);
    }

    logger.info(`Broadcast cancelled: ${broadcast.name}`);
    return broadcast;
  }

  private getMatchingContacts(filter: BroadcastConfig['target']): Array<{ id: string; channelUserId: string }> {
    const allContacts = this.contactManager.getAllContacts();

    return allContacts.filter(contact => {
      if (filter.channel && contact.channel !== filter.channel) return false;
      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => contact.tags.includes(tag));
        if (!hasAllTags) return false;
      }
      if (filter.customFilter && !filter.customFilter(contact)) return false;
      return true;
    });
  }
}
