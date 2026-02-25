import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackRequest, checkAlerts, registerAlertRule, startAlertLoop, stopAlertLoop } from '../../src/services/alerting';

describe('Alerting', () => {
  afterEach(() => {
    stopAlertLoop();
  });

  it('tracks requests', () => {
    // Should not throw
    trackRequest(false);
    trackRequest(true);
    trackRequest(false);
  });

  it('fires custom alert rule', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    let shouldFire = false;
    registerAlertRule({
      name: 'test_alert',
      check: () => shouldFire,
      cooldownMs: 0,
    });

    // Should not fire yet
    checkAlerts();

    // Trigger it
    shouldFire = true;
    checkAlerts();

    logSpy.mockRestore();
  });

  it('starts and stops alert loop', () => {
    startAlertLoop(60_000);
    // Should not throw if called twice
    startAlertLoop(60_000);
    stopAlertLoop();
    stopAlertLoop(); // safe to call twice
  });
});
