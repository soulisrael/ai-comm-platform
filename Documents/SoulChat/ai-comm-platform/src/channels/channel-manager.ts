import type { ChannelType, Message } from '../types/message';
import type { ChannelAdapter, Button } from './channel-adapter';
import logger from '../services/logger';

export class ChannelManager {
  private adapters = new Map<ChannelType, ChannelAdapter>();

  registerAdapter(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.name, adapter);
    logger.info(`Channel adapter registered: ${adapter.name}`);
  }

  getAdapter(channel: ChannelType): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  hasAdapter(channel: ChannelType): boolean {
    return this.adapters.has(channel);
  }

  getRegisteredChannels(): ChannelType[] {
    return Array.from(this.adapters.keys());
  }

  async sendResponse(channel: ChannelType, to: string, message: Message): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      logger.warn(`No adapter registered for channel: ${channel}`);
      return;
    }

    try {
      await adapter.sendMessage(to, message);
    } catch (err) {
      logger.error(`Failed to send message via ${channel}:`, err);
      throw err;
    }
  }

  async sendImage(channel: ChannelType, to: string, imageUrl: string, caption?: string): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      logger.warn(`No adapter registered for channel: ${channel}`);
      return;
    }

    await adapter.sendImage(to, imageUrl, caption);
  }

  async sendButtons(channel: ChannelType, to: string, text: string, buttons: Button[]): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      logger.warn(`No adapter registered for channel: ${channel}`);
      return;
    }

    await adapter.sendButtons(to, text, buttons);
  }

  async sendTemplate(channel: ChannelType, to: string, templateName: string, params: Record<string, unknown>): Promise<void> {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      logger.warn(`No adapter registered for channel: ${channel}`);
      return;
    }

    await adapter.sendTemplate(to, templateName, params);
  }
}
