import { Request, Response } from 'express';
import logger from './logger';

const startTime = Date.now();

interface HealthCheck {
  name: string;
  check: () => Promise<boolean> | boolean;
}

const checks: HealthCheck[] = [];

export function registerHealthCheck(name: string, check: () => Promise<boolean> | boolean): void {
  checks.push({ name, check });
}

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const results: Record<string, 'ok' | 'fail'> = {};
  let allHealthy = true;

  for (const { name, check } of checks) {
    try {
      const ok = await check();
      results[name] = ok ? 'ok' : 'fail';
      if (!ok) allHealthy = false;
    } catch {
      results[name] = 'fail';
      allHealthy = false;
    }
  }

  const mem = process.memoryUsage();
  const uptimeMs = Date.now() - startTime;

  const body = {
    status: allHealthy ? 'healthy' : (Object.values(results).some(v => v === 'ok') ? 'degraded' : 'unhealthy'),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: `${Math.floor(uptimeMs / 1000)}s`,
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
    checks: results,
  };

  const statusCode = body.status === 'healthy' ? 200 : body.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(body);

  if (!allHealthy) {
    logger.warn('Health check degraded', { checks: results });
  }
}
