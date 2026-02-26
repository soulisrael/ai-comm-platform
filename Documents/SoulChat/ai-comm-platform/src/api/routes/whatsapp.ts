import { Router, Request, Response } from 'express';
import { WaConfigRepository } from '../../database/repositories/wa-config-repository';
import { WhatsAppSender } from '../../services/wa-sender';
import { AppError } from '../middleware/error-handler';
import logger from '../../services/logger';

export function createWhatsAppRouter(waConfigRepo: WaConfigRepository): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET /config — current WhatsApp config
  router.get('/config', async (_req: Request, res: Response) => {
    const config = await waConfigRepo.get();
    if (!config) {
      res.json({ config: null, connected: false });
      return;
    }
    // Mask access token for security
    res.json({
      config: {
        ...config,
        accessToken: config.accessToken ? '***' + config.accessToken.slice(-4) : null,
      },
      connected: config.status === 'connected',
    });
  });

  // PUT /config — update WhatsApp config
  router.put('/config', async (req: Request, res: Response) => {
    const { phoneNumberId, wabaId, accessToken, verifyToken, businessName, webhookUrl } = req.body;

    if (!phoneNumberId || !accessToken) {
      throw new AppError('phoneNumberId and accessToken are required', 400, 'VALIDATION_ERROR');
    }

    const config = await waConfigRepo.upsert({
      phone_number_id: phoneNumberId,
      waba_id: wabaId || '',
      access_token: accessToken,
      verify_token: verifyToken || `vt_${Date.now()}`,
      business_name: businessName || null,
      webhook_url: webhookUrl || null,
      status: 'disconnected', // will be verified
    });

    logger.info(`WhatsApp config updated: ${phoneNumberId}`);
    res.json({ config, connected: false });
  });

  // POST /config/test — test WhatsApp connection
  router.post('/config/test', async (_req: Request, res: Response) => {
    const config = await waConfigRepo.get();
    if (!config) {
      throw new AppError('WhatsApp not configured', 400, 'NOT_CONFIGURED');
    }

    try {
      // Test by calling the WhatsApp Business API phone number endpoint
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${config.phoneNumberId}`,
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        }
      );

      if (response.ok) {
        await waConfigRepo.upsert({
          id: config.id,
          phone_number_id: config.phoneNumberId,
          waba_id: config.wabaId,
          access_token: config.accessToken,
          verify_token: config.verifyToken,
          status: 'connected',
          last_verified_at: new Date().toISOString(),
        });
        res.json({ success: true, status: 'connected' });
      } else {
        const data = await response.json() as any;
        await waConfigRepo.upsert({
          id: config.id,
          phone_number_id: config.phoneNumberId,
          waba_id: config.wabaId,
          access_token: config.accessToken,
          verify_token: config.verifyToken,
          status: 'error',
        });
        res.json({ success: false, status: 'error', error: data?.error?.message || `HTTP ${response.status}` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.json({ success: false, status: 'error', error: message });
    }
  });

  // POST /config/send-test — send a test message
  router.post('/config/send-test', async (req: Request, res: Response) => {
    const config = await waConfigRepo.get();
    if (!config) {
      throw new AppError('WhatsApp not configured', 400, 'NOT_CONFIGURED');
    }

    const { to, message } = req.body;
    if (!to || !message) {
      throw new AppError('to and message are required', 400, 'VALIDATION_ERROR');
    }

    const sender = new WhatsAppSender({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
    });

    const result = await sender.sendMessage(to, message);
    res.json(result);
  });

  // GET /auth/meta-config — return Meta app config for frontend SDK init
  router.get('/auth/meta-config', async (_req: Request, res: Response) => {
    res.json({
      appId: process.env.META_APP_ID || '',
      configId: process.env.META_CONFIG_ID || '',
    });
  });

  // POST /auth/exchange-token — exchange FB login code for long-lived token
  router.post('/auth/exchange-token', async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) {
      throw new AppError('code is required', 400, 'VALIDATION_ERROR');
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) {
      throw new AppError('META_APP_ID and META_APP_SECRET must be configured', 500, 'CONFIG_ERROR');
    }

    const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
    const fbRes = await fetch(url);
    const fbData = await fbRes.json() as any;

    if (!fbRes.ok || !fbData.access_token) {
      const errMsg = fbData?.error?.message || `Token exchange failed (HTTP ${fbRes.status})`;
      logger.error('Meta token exchange failed:', errMsg);
      throw new AppError(errMsg, 400, 'TOKEN_EXCHANGE_FAILED');
    }

    await waConfigRepo.upsert({
      access_token: fbData.access_token,
      verify_token: `vt_${Date.now()}`,
      phone_number_id: '',
      waba_id: '',
      status: 'disconnected',
    });

    logger.info('Meta token exchanged and saved');
    res.json({ success: true });
  });

  // POST /auth/complete-signup — finalize embedded signup (register webhook + save IDs)
  router.post('/auth/complete-signup', async (req: Request, res: Response) => {
    const { wabaId, phoneNumberId } = req.body;
    if (!wabaId || !phoneNumberId) {
      throw new AppError('wabaId and phoneNumberId are required', 400, 'VALIDATION_ERROR');
    }

    const config = await waConfigRepo.get();
    if (!config?.accessToken) {
      throw new AppError('Token not found. Run exchange-token first.', 400, 'NOT_CONFIGURED');
    }

    // Subscribe app to WABA webhooks
    const subRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.accessToken}` },
      }
    );

    if (!subRes.ok) {
      const subData = await subRes.json() as any;
      const errMsg = subData?.error?.message || `Webhook subscription failed (HTTP ${subRes.status})`;
      logger.error('Webhook subscription failed:', errMsg);
      throw new AppError(errMsg, 400, 'WEBHOOK_SUB_FAILED');
    }

    const webhookUrl = `${process.env.BASE_URL || ''}/api/webhooks/whatsapp`;
    const verifyToken = config.verifyToken || `vt_${Date.now()}`;

    await waConfigRepo.upsert({
      id: config.id,
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      access_token: config.accessToken,
      verify_token: verifyToken,
      webhook_url: webhookUrl,
      status: 'connected',
      last_verified_at: new Date().toISOString(),
    });

    logger.info(`WhatsApp embedded signup completed: WABA=${wabaId}, Phone=${phoneNumberId}`);
    res.json({ success: true, status: 'connected' });
  });

  // GET /templates — list all templates
  router.get('/templates', async (_req: Request, res: Response) => {
    const templates = await waConfigRepo.getTemplates();
    res.json({ templates });
  });

  // POST /templates — create template
  router.post('/templates', async (req: Request, res: Response) => {
    const { name, category, content, language, header, footer, buttons } = req.body;
    if (!name || !category || !content) {
      throw new AppError('name, category, and content are required', 400, 'VALIDATION_ERROR');
    }

    const template = await waConfigRepo.createTemplate({
      template_name: name,
      category,
      content,
      language: language || 'he',
      header: header || null,
      footer: footer || null,
      buttons: buttons || [],
      meta_status: 'pending',
    });

    logger.info(`WhatsApp template created: ${name}`);
    res.status(201).json(template);
  });

  // PUT /templates/:id — update template
  router.put('/templates/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await waConfigRepo.getTemplateById(id);
    if (!existing) {
      throw new AppError('Template not found', 404, 'NOT_FOUND');
    }

    // For now, only update content fields via a new create (templates are immutable in Meta)
    // This is a local-only update; actual Meta sync happens via /sync
    const { name, category, content, language, header, footer, buttons } = req.body;
    const template = await waConfigRepo.createTemplate({
      template_name: name || existing.templateName,
      category: category || existing.category,
      content: content || existing.content,
      language: language || existing.language,
      header: header !== undefined ? header : existing.header,
      footer: footer !== undefined ? footer : existing.footer,
      buttons: buttons || existing.buttons,
      meta_status: 'pending',
    });

    res.json(template);
  });

  // DELETE /templates/:id — delete template
  router.delete('/templates/:id', async (_req: Request, res: Response) => {
    // Templates don't have a dedicated delete in repo, but we can update status
    throw new AppError('Template deletion requires Meta API sync', 501, 'NOT_IMPLEMENTED');
  });

  // POST /templates/:id/sync — sync template status from Meta
  router.post('/templates/:id/sync', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await waConfigRepo.getTemplateById(id);
    if (!existing) {
      throw new AppError('Template not found', 404, 'NOT_FOUND');
    }

    const config = await waConfigRepo.get();
    if (!config) {
      throw new AppError('WhatsApp not configured', 400, 'NOT_CONFIGURED');
    }

    // If we have a meta_template_id, fetch status from Meta
    if (existing.metaTemplateId) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${existing.metaTemplateId}`,
          { headers: { Authorization: `Bearer ${config.accessToken}` } }
        );
        const data = await response.json() as any;
        const metaStatus = data?.status === 'APPROVED' ? 'approved'
          : data?.status === 'REJECTED' ? 'rejected' : 'pending';

        const updated = await waConfigRepo.updateTemplateStatus(id, metaStatus);
        res.json(updated);
        return;
      } catch {
        // Fall through to pending
      }
    }

    res.json(existing);
  });

  return router;
}
