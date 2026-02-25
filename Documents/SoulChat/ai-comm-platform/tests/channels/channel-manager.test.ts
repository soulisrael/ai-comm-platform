import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelManager } from '../../src/channels/channel-manager';
import type { ChannelAdapter } from '../../src/channels/channel-adapter';
import type { Message } from '../../src/types/message';

function createMockAdapter(name: string): ChannelAdapter {
  return {
    name: name as any,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendImage: vi.fn().mockResolvedValue(undefined),
    sendButtons: vi.fn().mockResolvedValue(undefined),
    sendTemplate: vi.fn().mockResolvedValue(undefined),
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseIncomingMessage: vi.fn().mockReturnValue(null),
  };
}

const mockMessage: Message = {
  id: 'msg1',
  conversationId: 'conv1',
  contactId: 'c1',
  direction: 'outbound',
  type: 'text',
  content: 'Test message',
  channel: 'whatsapp',
  metadata: {},
  timestamp: new Date(),
};

describe('ChannelManager', () => {
  let manager: ChannelManager;
  let whatsappAdapter: ChannelAdapter;
  let telegramAdapter: ChannelAdapter;

  beforeEach(() => {
    manager = new ChannelManager();
    whatsappAdapter = createMockAdapter('whatsapp');
    telegramAdapter = createMockAdapter('telegram');
  });

  describe('registerAdapter', () => {
    it('registers an adapter', () => {
      manager.registerAdapter(whatsappAdapter);
      expect(manager.hasAdapter('whatsapp')).toBe(true);
    });

    it('registers multiple adapters', () => {
      manager.registerAdapter(whatsappAdapter);
      manager.registerAdapter(telegramAdapter);
      expect(manager.getRegisteredChannels()).toEqual(['whatsapp', 'telegram']);
    });
  });

  describe('getAdapter', () => {
    it('returns registered adapter', () => {
      manager.registerAdapter(whatsappAdapter);
      expect(manager.getAdapter('whatsapp')).toBe(whatsappAdapter);
    });

    it('returns undefined for unregistered channel', () => {
      expect(manager.getAdapter('instagram')).toBeUndefined();
    });
  });

  describe('sendResponse', () => {
    it('sends via the correct adapter', async () => {
      manager.registerAdapter(whatsappAdapter);
      manager.registerAdapter(telegramAdapter);

      await manager.sendResponse('whatsapp', '+1234567890', mockMessage);

      expect(whatsappAdapter.sendMessage).toHaveBeenCalledWith('+1234567890', mockMessage);
      expect(telegramAdapter.sendMessage).not.toHaveBeenCalled();
    });

    it('does nothing for unregistered channel', async () => {
      await manager.sendResponse('instagram', 'user1', mockMessage);
      // Should not throw
    });

    it('throws if adapter.sendMessage throws', async () => {
      const errorAdapter = createMockAdapter('whatsapp');
      (errorAdapter.sendMessage as any).mockRejectedValue(new Error('API error'));
      manager.registerAdapter(errorAdapter);

      await expect(manager.sendResponse('whatsapp', '+1234567890', mockMessage)).rejects.toThrow('API error');
    });
  });

  describe('sendImage', () => {
    it('delegates to adapter', async () => {
      manager.registerAdapter(whatsappAdapter);
      await manager.sendImage('whatsapp', '+1234567890', 'https://example.com/img.jpg', 'Caption');

      expect(whatsappAdapter.sendImage).toHaveBeenCalledWith('+1234567890', 'https://example.com/img.jpg', 'Caption');
    });
  });

  describe('sendButtons', () => {
    it('delegates to adapter', async () => {
      manager.registerAdapter(telegramAdapter);
      await manager.sendButtons('telegram', '123', 'Pick:', [{ id: '1', title: 'A' }]);

      expect(telegramAdapter.sendButtons).toHaveBeenCalledWith('123', 'Pick:', [{ id: '1', title: 'A' }]);
    });
  });

  describe('sendTemplate', () => {
    it('delegates to adapter', async () => {
      manager.registerAdapter(whatsappAdapter);
      await manager.sendTemplate('whatsapp', '+1234567890', 'welcome', { language: 'en' });

      expect(whatsappAdapter.sendTemplate).toHaveBeenCalledWith('+1234567890', 'welcome', { language: 'en' });
    });
  });
});
