import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageBatcher } from '../../src/services/message-batcher';

vi.mock('../../src/services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('MessageBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires callback after delay for a single message', async () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'Hello');

    // Should not fire immediately
    expect(callback).not.toHaveBeenCalled();

    // Advance time by 3 seconds
    vi.advanceTimersByTime(3000);
    await vi.runAllTimersAsync();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('conv-1', 'Hello');
  });

  it('combines 3 sequential messages into a single callback', async () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'First');
    vi.advanceTimersByTime(1000); // 1s in

    batcher.onIncomingMessage('conv-1', 'Second');
    vi.advanceTimersByTime(1000); // 2s in (1s after second msg)

    batcher.onIncomingMessage('conv-1', 'Third');

    // Should not have fired yet — timer resets on each message
    expect(callback).not.toHaveBeenCalled();

    // Advance 3s after last message
    vi.advanceTimersByTime(3000);
    await vi.runAllTimersAsync();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('conv-1', 'First\nSecond\nThird');
  });

  it('handles multiple conversations independently', async () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'Hello from 1');
    batcher.onIncomingMessage('conv-2', 'Hello from 2');

    vi.advanceTimersByTime(3000);
    await vi.runAllTimersAsync();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledWith('conv-1', 'Hello from 1');
    expect(callback).toHaveBeenCalledWith('conv-2', 'Hello from 2');
  });

  it('cancel() prevents the callback from firing', async () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'Should be cancelled');
    batcher.cancel('conv-1');

    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();

    expect(callback).not.toHaveBeenCalled();
  });

  it('cancelAll() cancels all pending batches', async () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'Msg 1');
    batcher.onIncomingMessage('conv-2', 'Msg 2');
    batcher.cancelAll();

    vi.advanceTimersByTime(5000);
    await vi.runAllTimersAsync();

    expect(callback).not.toHaveBeenCalled();
  });

  it('hasPending() returns correct status', () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    expect(batcher.hasPending('conv-1')).toBe(false);

    batcher.onIncomingMessage('conv-1', 'Hello');
    expect(batcher.hasPending('conv-1')).toBe(true);
    expect(batcher.hasPending('conv-2')).toBe(false);
  });

  it('getPendingCount() returns correct count', () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    expect(batcher.getPendingCount('conv-1')).toBe(0);

    batcher.onIncomingMessage('conv-1', 'First');
    expect(batcher.getPendingCount('conv-1')).toBe(1);

    batcher.onIncomingMessage('conv-1', 'Second');
    expect(batcher.getPendingCount('conv-1')).toBe(2);

    batcher.onIncomingMessage('conv-1', 'Third');
    expect(batcher.getPendingCount('conv-1')).toBe(3);
  });

  it('clears pending state after batch is processed', async () => {
    const callback = vi.fn();
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'Hello');
    expect(batcher.hasPending('conv-1')).toBe(true);

    vi.advanceTimersByTime(3000);
    await vi.runAllTimersAsync();

    expect(batcher.hasPending('conv-1')).toBe(false);
    expect(batcher.getPendingCount('conv-1')).toBe(0);
  });

  it('handles callback errors gracefully', async () => {
    const callback = vi.fn().mockRejectedValue(new Error('callback failed'));
    const batcher = new MessageBatcher(callback, 3000);

    batcher.onIncomingMessage('conv-1', 'Hello');

    // Should not throw
    vi.advanceTimersByTime(3000);
    await vi.runAllTimersAsync();

    expect(callback).toHaveBeenCalledOnce();
    // Batch should still be cleaned up
    expect(batcher.hasPending('conv-1')).toBe(false);
  });
});
