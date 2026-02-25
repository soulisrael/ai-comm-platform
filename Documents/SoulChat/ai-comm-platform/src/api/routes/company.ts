import { Router, Request, Response } from 'express';
import { BrainLoader } from '../../brain/brain-loader';
import { BrainManager } from '../../brain/brain-manager';

export function createCompanyRouter(
  brainLoader: BrainLoader,
  brainManager: BrainManager
): Router {
  const router = Router();

  // GET /settings — Returns company info + tone of voice from brain
  router.get('/settings', (_req: Request, res: Response) => {
    const companyEntry = brainLoader.getEntry('company', 'info');
    const configEntry = brainLoader.getEntry('config', 'tone');

    res.json({
      company: companyEntry?.data || {},
      toneOfVoice: configEntry?.data || {},
    });
  });

  // PUT /settings — Update company settings in brain
  router.put('/settings', (req: Request, res: Response) => {
    const { company, toneOfVoice } = req.body || {};

    if (company) {
      const existing = brainLoader.getEntry('company', 'info');
      if (existing) {
        // Update all fields from the body
        for (const [key, value] of Object.entries(company)) {
          brainManager.updateEntry('company', 'info', key, value as Record<string, unknown>);
        }
      } else {
        brainManager.addEntry('company', 'info', company);
      }
    }

    if (toneOfVoice) {
      const existing = brainLoader.getEntry('config', 'tone');
      if (existing) {
        for (const [key, value] of Object.entries(toneOfVoice)) {
          brainManager.updateEntry('config', 'tone', key, value as Record<string, unknown>);
        }
      } else {
        brainManager.addEntry('config', 'tone', toneOfVoice);
      }
    }

    // Reload and return updated
    const companyEntry = brainLoader.getEntry('company', 'info');
    const configEntry = brainLoader.getEntry('config', 'tone');

    res.json({
      company: companyEntry?.data || {},
      toneOfVoice: configEntry?.data || {},
    });
  });

  return router;
}
