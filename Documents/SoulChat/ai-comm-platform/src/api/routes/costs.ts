import { Router, Request, Response } from 'express';
import { costTracker } from '../../services/cost-tracker';

export function createCostsRouter(): Router {
  const router = Router();

  // GET /today — today's cost summary
  router.get('/today', (_req: Request, res: Response) => {
    const summary = costTracker.getDailyCost();
    res.json(summary);
  });

  // GET /daily — daily costs (for chart)
  router.get('/daily', (_req: Request, res: Response) => {
    // Currently we only have in-memory data for today
    // Future: persist to DB for historical data
    const today = costTracker.getDailyCost();
    const date = new Date().toISOString().split('T')[0];
    res.json({
      days: [{ date, ...today }],
    });
  });

  // GET /by-agent — cost breakdown by agent
  router.get('/by-agent', (req: Request, res: Response) => {
    // Get agent IDs from query or return all known agents
    const { agentId } = req.query;
    if (agentId) {
      const summary = costTracker.getAgentCost(agentId as string);
      res.json({ agents: [{ agentId, ...summary }] });
    } else {
      // Return the overall daily summary since we don't have per-agent listing
      const daily = costTracker.getDailyCost();
      res.json({ agents: [], total: daily });
    }
  });

  // GET /summary — monthly summary
  router.get('/summary', (_req: Request, res: Response) => {
    const daily = costTracker.getDailyCost();
    // Estimate monthly from today's data
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    res.json({
      today: daily,
      estimatedMonthly: {
        ...daily,
        estimatedCost: daily.estimatedCost * daysInMonth,
      },
    });
  });

  return router;
}
