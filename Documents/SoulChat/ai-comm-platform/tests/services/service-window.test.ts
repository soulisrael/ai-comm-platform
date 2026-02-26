import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceWindowManager, EntryPoint, WindowStatus } from '../../src/services/service-window';

vi.mock('../../src/services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function createMockSupabase(selectData: any = null, selectError: any = null) {
  const chain: any = {};

  // update chain
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: selectData, error: selectError });

  const client: any = {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };

  return client;
}

describe('ServiceWindowManager', () => {
  describe('openWindow', () => {
    it('sets 24h expiry for organic entry point', async () => {
      const client = createMockSupabase();
      const manager = new ServiceWindowManager(client);

      const result = await manager.openWindow('conv-1', 'organic');

      expect(result.isOpen).toBe(true);
      expect(result.entryPoint).toBe('organic');
      expect(result.remainingSeconds).toBe(24 * 60 * 60);
      expect(result.start).toBeInstanceOf(Date);
      expect(result.expires).toBeInstanceOf(Date);

      // Verify expires is ~24h from start
      const diffMs = result.expires!.getTime() - result.start!.getTime();
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    });

    it('sets 72h expiry for ctwa_ad entry point', async () => {
      const client = createMockSupabase();
      const manager = new ServiceWindowManager(client);

      const result = await manager.openWindow('conv-1', 'ctwa_ad');

      expect(result.isOpen).toBe(true);
      expect(result.entryPoint).toBe('ctwa_ad');
      expect(result.remainingSeconds).toBe(72 * 60 * 60);

      const diffMs = result.expires!.getTime() - result.start!.getTime();
      expect(diffMs).toBe(72 * 60 * 60 * 1000);
    });

    it('sets 72h expiry for fb_cta entry point', async () => {
      const client = createMockSupabase();
      const manager = new ServiceWindowManager(client);

      const result = await manager.openWindow('conv-1', 'fb_cta');

      expect(result.isOpen).toBe(true);
      expect(result.entryPoint).toBe('fb_cta');
      expect(result.remainingSeconds).toBe(72 * 60 * 60);
    });

    it('defaults to organic entry point', async () => {
      const client = createMockSupabase();
      const manager = new ServiceWindowManager(client);

      const result = await manager.openWindow('conv-1');

      expect(result.entryPoint).toBe('organic');
      expect(result.remainingSeconds).toBe(24 * 60 * 60);
    });

    it('calls supabase update with correct data', async () => {
      const client = createMockSupabase();
      const manager = new ServiceWindowManager(client);

      await manager.openWindow('conv-1', 'organic');

      expect(client.from).toHaveBeenCalledWith('conversations');
      expect(client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_point: 'organic',
          service_window_start: expect.any(String),
          service_window_expires: expect.any(String),
        })
      );
      expect(client._chain.eq).toHaveBeenCalledWith('id', 'conv-1');
    });
  });

  describe('refreshWindow', () => {
    it('preserves existing entry_point when refreshing', async () => {
      const client = createMockSupabase({ entry_point: 'ctwa_ad', service_window_start: new Date().toISOString() });
      const manager = new ServiceWindowManager(client);

      const result = await manager.refreshWindow('conv-1');

      expect(result.entryPoint).toBe('ctwa_ad');
      expect(result.remainingSeconds).toBe(72 * 60 * 60);
    });

    it('defaults to organic if no entry_point in DB', async () => {
      const client = createMockSupabase({ entry_point: null, service_window_start: null });
      const manager = new ServiceWindowManager(client);

      const result = await manager.refreshWindow('conv-1');

      expect(result.entryPoint).toBe('organic');
      expect(result.remainingSeconds).toBe(24 * 60 * 60);
    });
  });

  describe('isWindowOpen', () => {
    it('returns open status when window has not expired', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12h from now
      const client = createMockSupabase({
        service_window_start: now.toISOString(),
        service_window_expires: future.toISOString(),
        entry_point: 'organic',
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.isWindowOpen('conv-1');

      expect(result.isOpen).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(result.entryPoint).toBe('organic');
    });

    it('returns closed status when window has expired', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
      const client = createMockSupabase({
        service_window_start: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        service_window_expires: past.toISOString(),
        entry_point: 'organic',
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.isWindowOpen('conv-1');

      expect(result.isOpen).toBe(false);
      expect(result.remainingSeconds).toBe(0);
    });

    it('returns closed status when no window data exists', async () => {
      const client = createMockSupabase(null, { message: 'not found' });
      const manager = new ServiceWindowManager(client);

      const result = await manager.isWindowOpen('conv-1');

      expect(result.isOpen).toBe(false);
      expect(result.start).toBeNull();
      expect(result.expires).toBeNull();
      expect(result.remainingSeconds).toBe(0);
    });

    it('returns closed status when service_window_expires is null', async () => {
      const client = createMockSupabase({
        service_window_start: null,
        service_window_expires: null,
        entry_point: null,
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.isWindowOpen('conv-1');

      expect(result.isOpen).toBe(false);
    });
  });

  describe('canSendFreeForm', () => {
    it('returns true when window is open', async () => {
      const future = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const client = createMockSupabase({
        service_window_start: new Date().toISOString(),
        service_window_expires: future.toISOString(),
        entry_point: 'organic',
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.canSendFreeForm('conv-1');
      expect(result).toBe(true);
    });

    it('returns false when window is closed', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      const client = createMockSupabase({
        service_window_start: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        service_window_expires: past.toISOString(),
        entry_point: 'organic',
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.canSendFreeForm('conv-1');
      expect(result).toBe(false);
    });
  });

  describe('requiresTemplate', () => {
    it('returns false when window is open (free-form allowed)', async () => {
      const future = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const client = createMockSupabase({
        service_window_start: new Date().toISOString(),
        service_window_expires: future.toISOString(),
        entry_point: 'organic',
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.requiresTemplate('conv-1');
      expect(result).toBe(false);
    });

    it('returns true when window is closed (template required)', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000);
      const client = createMockSupabase({
        service_window_start: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        service_window_expires: past.toISOString(),
        entry_point: 'organic',
      });
      const manager = new ServiceWindowManager(client);

      const result = await manager.requiresTemplate('conv-1');
      expect(result).toBe(true);
    });
  });
});
