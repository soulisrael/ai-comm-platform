import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BroadcastManager } from '../../src/automation/broadcast';

function createMockChannelManager() {
  return {
    sendResponse: vi.fn().mockResolvedValue(undefined),
    getAdapter: vi.fn(),
    hasAdapter: vi.fn().mockReturnValue(true),
    registerAdapter: vi.fn(),
    getRegisteredChannels: vi.fn().mockReturnValue(['whatsapp']),
    sendImage: vi.fn(),
    sendButtons: vi.fn(),
    sendTemplate: vi.fn(),
  } as any;
}

function createMockContactManager() {
  return {
    getAllContacts: vi.fn().mockReturnValue([
      { id: 'c1', channelUserId: '+111', channel: 'whatsapp', tags: ['vip'] },
      { id: 'c2', channelUserId: '+222', channel: 'whatsapp', tags: ['new'] },
      { id: 'c3', channelUserId: '+333', channel: 'telegram', tags: ['vip'] },
    ]),
    getContact: vi.fn(),
  } as any;
}

describe('BroadcastManager', () => {
  let manager: BroadcastManager;
  let channelManager: ReturnType<typeof createMockChannelManager>;
  let contactManager: ReturnType<typeof createMockContactManager>;

  beforeEach(() => {
    channelManager = createMockChannelManager();
    contactManager = createMockContactManager();
    manager = new BroadcastManager(channelManager, contactManager);
  });

  describe('createBroadcast', () => {
    it('creates a broadcast with target count', () => {
      const broadcast = manager.createBroadcast({
        name: 'Test Broadcast',
        target: { tags: ['vip'], channel: 'whatsapp' },
        message: { content: 'Hello VIPs!' },
      });

      expect(broadcast.name).toBe('Test Broadcast');
      expect(broadcast.totalRecipients).toBe(1); // only c1 is whatsapp + vip
      expect(broadcast.status).toBe('draft');
    });

    it('creates a scheduled broadcast', () => {
      const future = new Date(Date.now() + 3600000);
      const broadcast = manager.createBroadcast({
        name: 'Scheduled',
        target: {},
        message: { content: 'Hi' },
        schedule: future,
      });

      expect(broadcast.status).toBe('scheduled');
      expect(broadcast.scheduledFor).toEqual(future);
    });
  });

  describe('sendBroadcast', () => {
    it('sends to all matching contacts', async () => {
      const broadcast = manager.createBroadcast({
        name: 'VIP Blast',
        target: { tags: ['vip'] },
        message: { content: 'Exclusive offer!' },
      });

      const result = await manager.sendBroadcast(broadcast.id);
      expect(result.status).toBe('completed');
      expect(result.sentCount).toBe(2); // c1 (whatsapp + vip) and c3 (telegram + vip)
      expect(channelManager.sendResponse).toHaveBeenCalledTimes(2);
    });

    it('tracks failed sends', async () => {
      channelManager.sendResponse.mockRejectedValueOnce(new Error('fail'));

      const broadcast = manager.createBroadcast({
        name: 'Partial',
        target: { channel: 'whatsapp' },
        message: { content: 'Hi' },
      });

      const result = await manager.sendBroadcast(broadcast.id);
      expect(result.failedCount).toBe(1);
      expect(result.sentCount).toBe(1);
    });

    it('throws for non-existent broadcast', async () => {
      await expect(manager.sendBroadcast('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('cancelBroadcast', () => {
    it('cancels a broadcast', () => {
      const broadcast = manager.createBroadcast({
        name: 'Cancel Me',
        target: {},
        message: { content: 'Hi' },
      });

      const cancelled = manager.cancelBroadcast(broadcast.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('prevents sending cancelled broadcast', async () => {
      const broadcast = manager.createBroadcast({
        name: 'Cancel Me',
        target: {},
        message: { content: 'Hi' },
      });

      manager.cancelBroadcast(broadcast.id);
      await expect(manager.sendBroadcast(broadcast.id)).rejects.toThrow('cancelled');
    });
  });

  describe('getBroadcastStatus', () => {
    it('returns status counts', async () => {
      const broadcast = manager.createBroadcast({
        name: 'Status Test',
        target: { channel: 'whatsapp' },
        message: { content: 'Hi' },
      });

      await manager.sendBroadcast(broadcast.id);

      const status = manager.getBroadcastStatus(broadcast.id);
      expect(status?.status).toBe('completed');
      expect(status?.sentCount).toBe(2);
    });

    it('returns null for non-existent', () => {
      expect(manager.getBroadcastStatus('nonexistent')).toBeNull();
    });
  });
});
