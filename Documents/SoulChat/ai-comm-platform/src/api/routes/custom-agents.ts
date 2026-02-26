import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { CustomAgentRepository } from '../../database/repositories/custom-agent-repository';
import { BrainRepository } from '../../database/repositories/brain-repository';
import { AgentRunner } from '../../agents/agent-runner';
import { ClaudeAPI } from '../../services/claude-api';
import { customAgentFromRow } from '../../database/db-types';
import { AppError } from '../middleware/error-handler';
import logger from '../../services/logger';

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.txt', '.pdf', '.docx'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt, .pdf, and .docx files are accepted'));
    }
  },
});

export function createCustomAgentsRouter(
  agentRepo: CustomAgentRepository,
  brainRepo: BrainRepository,
  agentRunner: AgentRunner,
  claude: ClaudeAPI
): Router {
  const router = Router();

  function param(req: Request, name: string): string {
    return req.params[name] as string;
  }

  // GET / — List agents with optional active filter
  router.get('/', async (req: Request, res: Response) => {
    const { active } = req.query;

    let agents;
    if (active === 'true') {
      agents = await agentRepo.getActive();
    } else if (active === 'false') {
      const all = await agentRepo.findAll();
      agents = all.filter(a => !a.active);
    } else {
      agents = await agentRepo.findAll();
    }

    // Get brain entry counts per agent
    const allWithBrain = await agentRepo.getAllWithBrain();
    const brainCountMap = new Map<string, number>();
    for (const a of allWithBrain) {
      brainCountMap.set(a.id, a.brain.length);
    }

    res.json({
      agents: agents.map(row => ({
        ...customAgentFromRow(row),
        brainEntryCount: brainCountMap.get(row.id) || 0,
      })),
    });
  });

  // POST / — Create agent
  router.post('/', async (req: Request, res: Response) => {
    const row = await agentRepo.createAgent(req.body);
    res.status(201).json(customAgentFromRow(row));
  });

  // GET /:id — Get agent with full brain
  router.get('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const agent = await agentRepo.getWithBrain(id);
    if (!agent) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    res.json(agent);
  });

  // PUT /:id — Update agent
  router.put('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const updated = await agentRepo.updateAgent(id, req.body);
    res.json(customAgentFromRow(updated));
  });

  // DELETE /:id — Delete agent (brain entries cascade-deleted)
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    await agentRepo.deleteById(id);
    res.json({ success: true });
  });

  // POST /:id/duplicate — Duplicate agent + brain entries
  router.post('/:id/duplicate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const source = await agentRepo.getWithBrain(id);
    if (!source) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    const { name } = req.body || {};
    const newName = name || `${source.name} (copy)`;

    const newRow = await agentRepo.createAgent({
      name: newName,
      description: source.description,
      systemPrompt: source.systemPrompt,
      routingKeywords: source.routingKeywords,
      routingDescription: source.routingDescription,
      handoffRules: source.handoffRules,
      transferRules: source.transferRules,
      settings: source.settings,
      isDefault: false,
      active: false,
    });

    // Duplicate brain entries
    await brainRepo.duplicateForAgent(id, newRow.id);

    const result = await agentRepo.getWithBrain(newRow.id);
    res.status(201).json(result);
  });

  // POST /:id/test — Test agent with a message
  router.post('/:id/test', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    const { message } = req.body || {};
    if (!message) {
      throw new AppError('message is required', 400, 'VALIDATION_ERROR');
    }

    const result = await agentRunner.run(id, message, []);
    res.json({
      response: result.message,
      confidence: result.confidence,
      shouldHandoff: result.shouldHandoff,
      shouldTransfer: result.shouldTransfer,
    });
  });

  // PUT /:id/activate — Set active = true
  router.put('/:id/activate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const updated = await agentRepo.updateAgent(id, { active: true });
    res.json(customAgentFromRow(updated));
  });

  // PUT /:id/deactivate — Set active = false
  router.put('/:id/deactivate', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }
    const updated = await agentRepo.updateAgent(id, { active: false });
    res.json(customAgentFromRow(updated));
  });

  // POST /:id/upload-document — Upload main document (txt/pdf/docx)
  router.post(
    '/:id/upload-document',
    (req: Request, res: Response, next: NextFunction) => {
      documentUpload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          return next(new AppError(
            err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message,
            400,
            'UPLOAD_ERROR'
          ));
        }
        if (err) {
          return next(new AppError(err.message, 400, 'UPLOAD_ERROR'));
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = param(req, 'id');
        const existing = await agentRepo.findById(id);
        if (!existing) {
          throw new AppError('Agent not found', 404, 'NOT_FOUND');
        }

        const file = req.file;
        if (!file) {
          throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
        }

        const filename = file.originalname;
        const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
        let text: string;

        if (ext === '.txt') {
          text = file.buffer.toString('utf-8');
        } else if (ext === '.docx') {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          text = result.value;
        } else if (ext === '.pdf') {
          // Dynamic import for pdf-parse
          const pdfModule = await import('pdf-parse');
          const pdfParse = (pdfModule as any).default || pdfModule;
          const pdfData = await pdfParse(file.buffer);
          text = pdfData.text;
        } else {
          throw new AppError('Unsupported file type', 400, 'VALIDATION_ERROR');
        }

        if (!text.trim()) {
          throw new AppError('Document is empty', 400, 'VALIDATION_ERROR');
        }

        const updated = await agentRepo.updateDocument(id, text, filename);
        logger.info(`Document uploaded for agent ${id}: ${filename} (${text.length} chars)`);

        res.json({
          success: true,
          filename,
          textLength: text.length,
          agent: customAgentFromRow(updated),
        });
      } catch (err) {
        if (err instanceof AppError) return next(err);
        const message = err instanceof Error ? err.message : 'Upload failed';
        next(new AppError(message, 500, 'UPLOAD_ERROR'));
      }
    }
  );

  // DELETE /:id/document — Remove main document
  router.delete('/:id/document', async (req: Request, res: Response) => {
    const id = param(req, 'id');
    const existing = await agentRepo.findById(id);
    if (!existing) {
      throw new AppError('Agent not found', 404, 'NOT_FOUND');
    }

    const updated = await agentRepo.updateDocument(id, null, null);
    logger.info(`Document removed for agent ${id}`);
    res.json({ success: true, agent: customAgentFromRow(updated) });
  });

  return router;
}
