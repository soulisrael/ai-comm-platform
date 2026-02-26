import { Router, Request, Response } from 'express';

export function createCompanyRouter(): Router {
  const router = Router();

  // GET /settings — Stub: returns empty (brain removed)
  router.get('/settings', (_req: Request, res: Response) => {
    res.json({
      company: {},
      toneOfVoice: {},
    });
  });

  // PUT /settings — Stub: accepts but doesn't persist
  router.put('/settings', (req: Request, res: Response) => {
    const { company, toneOfVoice } = req.body || {};
    res.json({
      company: company || {},
      toneOfVoice: toneOfVoice || {},
    });
  });

  return router;
}
