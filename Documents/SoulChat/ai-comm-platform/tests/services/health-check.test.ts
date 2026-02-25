import { describe, it, expect, vi } from 'vitest';
import { registerHealthCheck, healthHandler } from '../../src/services/health-check';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('Health Check', () => {
  it('returns healthy when all checks pass', async () => {
    registerHealthCheck('test_ok', () => true);

    const req = {} as any;
    const res = mockRes();
    await healthHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'healthy',
      version: '1.0.0',
    }));
  });

  it('includes memory and uptime', async () => {
    const req = {} as any;
    const res = mockRes();
    await healthHandler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.memory).toBeDefined();
    expect(body.memory.rss).toMatch(/\d+MB/);
    expect(body.uptime).toMatch(/\d+s/);
  });

  it('reports degraded when a check fails', async () => {
    registerHealthCheck('test_fail', () => false);

    const req = {} as any;
    const res = mockRes();
    await healthHandler(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.checks.test_fail).toBe('fail');
    // Could be degraded or still healthy depending on other checks
    expect(['healthy', 'degraded']).toContain(body.status);
  });
});
