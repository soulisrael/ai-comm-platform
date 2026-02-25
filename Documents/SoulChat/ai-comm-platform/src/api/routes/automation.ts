import { Router, Request, Response } from 'express';
import type { FlowEngine } from '../../automation/flow-engine';
import type { BroadcastManager } from '../../automation/broadcast';
import type { TemplateManager } from '../../automation/template-manager';
import type { TriggerManager } from '../../automation/triggers/trigger-manager';
import type { Flow } from '../../types/automation';
import logger from '../../services/logger';

export interface AutomationDeps {
  flowEngine: FlowEngine;
  broadcastManager: BroadcastManager;
  templateManager: TemplateManager;
  triggerManager: TriggerManager;
}

export function createAutomationRouter(deps: AutomationDeps): Router {
  const router = Router();
  const { flowEngine, broadcastManager, templateManager, triggerManager } = deps;

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // ── Flows ───────────────────────────────────────────

  /**
   * @swagger
   * /api/automation/flows:
   *   get:
   *     summary: List all flows
   *     tags: [Automation]
   */
  router.get('/flows', (_req: Request, res: Response) => {
    const flows = flowEngine.getAllFlows();
    res.json(flows);
  });

  /**
   * @swagger
   * /api/automation/flows:
   *   post:
   *     summary: Create a new flow
   *     tags: [Automation]
   */
  router.post('/flows', (req: Request, res: Response) => {
    try {
      const { name, description, trigger, triggerConfig, steps } = req.body;
      if (!name || !trigger) {
        res.status(400).json({ error: 'name and trigger are required' });
        return;
      }

      const flow: Flow = {
        id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        description,
        trigger,
        triggerConfig: triggerConfig || {},
        steps: steps || [],
        active: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      flowEngine.registerFlow(flow);
      res.status(201).json(flow);
    } catch (err: any) {
      logger.error('Create flow error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/flows/{id}:
   *   get:
   *     summary: Get flow details
   *     tags: [Automation]
   */
  router.get('/flows/:id', (req: Request, res: Response) => {
    const flow = flowEngine.getFlow(param(req, 'id'));
    if (!flow) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }
    res.json(flow);
  });

  /**
   * @swagger
   * /api/automation/flows/{id}:
   *   put:
   *     summary: Update a flow
   *     tags: [Automation]
   */
  router.put('/flows/:id', (req: Request, res: Response) => {
    try {
      const flow = flowEngine.getFlow(param(req, 'id'));
      if (!flow) {
        res.status(404).json({ error: 'Flow not found' });
        return;
      }

      const updated = flowEngine.updateFlow(param(req, 'id'), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/flows/{id}:
   *   delete:
   *     summary: Delete a flow
   *     tags: [Automation]
   */
  router.delete('/flows/:id', (req: Request, res: Response) => {
    const deleted = flowEngine.deleteFlow(param(req, 'id'));
    if (!deleted) {
      res.status(404).json({ error: 'Flow not found' });
      return;
    }
    triggerManager.removeCronJob(param(req, 'id'));
    res.json({ deleted: true });
  });

  /**
   * @swagger
   * /api/automation/flows/{id}/activate:
   *   post:
   *     summary: Activate a flow
   *     tags: [Automation]
   */
  router.post('/flows/:id/activate', (req: Request, res: Response) => {
    try {
      const flow = flowEngine.activateFlow(param(req, 'id'));
      if (flow.trigger === 'scheduled') {
        triggerManager.registerCronJob(flow);
      }
      res.json(flow);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/flows/{id}/deactivate:
   *   post:
   *     summary: Deactivate a flow
   *     tags: [Automation]
   */
  router.post('/flows/:id/deactivate', (req: Request, res: Response) => {
    try {
      const flow = flowEngine.deactivateFlow(param(req, 'id'));
      triggerManager.removeCronJob(param(req, 'id'));
      res.json(flow);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/flows/{id}/executions:
   *   get:
   *     summary: Get flow execution history
   *     tags: [Automation]
   */
  router.get('/flows/:id/executions', (req: Request, res: Response) => {
    const executions = flowEngine.getExecutionsByFlow(param(req, 'id'));
    res.json(executions);
  });

  // ── Broadcasts ──────────────────────────────────────

  /**
   * @swagger
   * /api/automation/broadcasts:
   *   get:
   *     summary: List all broadcasts
   *     tags: [Automation]
   */
  router.get('/broadcasts', (_req: Request, res: Response) => {
    res.json(broadcastManager.getAllBroadcasts());
  });

  /**
   * @swagger
   * /api/automation/broadcasts:
   *   post:
   *     summary: Create a broadcast
   *     tags: [Automation]
   */
  router.post('/broadcasts', (req: Request, res: Response) => {
    try {
      const { name, target, message, schedule } = req.body;
      if (!name || !message?.content) {
        res.status(400).json({ error: 'name and message.content are required' });
        return;
      }

      const broadcast = broadcastManager.createBroadcast({
        name,
        target: target || {},
        message,
        schedule: schedule ? new Date(schedule) : undefined,
      });

      res.status(201).json(broadcast);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/broadcasts/{id}/send:
   *   post:
   *     summary: Send a broadcast
   *     tags: [Automation]
   */
  router.post('/broadcasts/:id/send', async (req: Request, res: Response) => {
    try {
      const broadcast = await broadcastManager.sendBroadcast(param(req, 'id'));
      res.json(broadcast);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/broadcasts/{id}/cancel:
   *   post:
   *     summary: Cancel a broadcast
   *     tags: [Automation]
   */
  router.post('/broadcasts/:id/cancel', (req: Request, res: Response) => {
    try {
      const broadcast = broadcastManager.cancelBroadcast(param(req, 'id'));
      res.json(broadcast);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/broadcasts/{id}/status:
   *   get:
   *     summary: Get broadcast delivery status
   *     tags: [Automation]
   */
  router.get('/broadcasts/:id/status', (req: Request, res: Response) => {
    const status = broadcastManager.getBroadcastStatus(param(req, 'id'));
    if (!status) {
      res.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    res.json(status);
  });

  // ── Templates ───────────────────────────────────────

  /**
   * @swagger
   * /api/automation/templates:
   *   get:
   *     summary: List all templates
   *     tags: [Automation]
   */
  router.get('/templates', (_req: Request, res: Response) => {
    res.json(templateManager.getAllTemplates());
  });

  /**
   * @swagger
   * /api/automation/templates:
   *   post:
   *     summary: Create a template
   *     tags: [Automation]
   */
  router.post('/templates', (req: Request, res: Response) => {
    try {
      const { name, content, variables, channel } = req.body;
      if (!name || !content) {
        res.status(400).json({ error: 'name and content are required' });
        return;
      }

      const template = templateManager.createTemplate(name, content, variables, channel);
      res.status(201).json(template);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/templates/{id}:
   *   put:
   *     summary: Update a template
   *     tags: [Automation]
   */
  router.put('/templates/:id', (req: Request, res: Response) => {
    try {
      const template = templateManager.updateTemplate(param(req, 'id'), req.body);
      res.json(template);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  /**
   * @swagger
   * /api/automation/templates/{id}:
   *   delete:
   *     summary: Delete a template
   *     tags: [Automation]
   */
  router.delete('/templates/:id', (req: Request, res: Response) => {
    const deleted = templateManager.deleteTemplate(param(req, 'id'));
    if (!deleted) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    res.json({ deleted: true });
  });

  return router;
}
