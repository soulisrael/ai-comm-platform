import logger from './logger';

interface AlertRule {
  name: string;
  check: () => boolean;
  cooldownMs: number;
}

const lastFired = new Map<string, number>();
const rules: AlertRule[] = [];

// Error rate tracking
let recentErrors = 0;
let recentTotal = 0;

export function trackRequest(isError: boolean): void {
  recentTotal++;
  if (isError) recentErrors++;

  // Reset counters every 5 minutes
  if (recentTotal >= 1000) {
    recentErrors = 0;
    recentTotal = 0;
  }
}

export function registerAlertRule(rule: AlertRule): void {
  rules.push(rule);
}

// Built-in rules
registerAlertRule({
  name: 'high_error_rate',
  check: () => recentTotal > 50 && (recentErrors / recentTotal) > 0.1,
  cooldownMs: 5 * 60 * 1000,
});

export function checkAlerts(): void {
  const now = Date.now();

  for (const rule of rules) {
    try {
      if (rule.check()) {
        const last = lastFired.get(rule.name) || 0;
        if (now - last >= rule.cooldownMs) {
          lastFired.set(rule.name, now);
          fireAlert(rule.name);
        }
      }
    } catch (err: any) {
      logger.error(`Alert check failed: ${rule.name}`, { error: err.message });
    }
  }
}

function fireAlert(name: string): void {
  logger.warn(`ALERT: ${name}`, {
    alert: name,
    severity: 'warning',
    timestamp: new Date().toISOString(),
  });
  // Future: extend with email, Slack, PagerDuty, etc.
}

// Run alert checks periodically
let intervalId: ReturnType<typeof setInterval> | null = null;

export function startAlertLoop(intervalMs = 60_000): void {
  if (intervalId) return;
  intervalId = setInterval(checkAlerts, intervalMs);
  logger.info('Alert loop started');
}

export function stopAlertLoop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
