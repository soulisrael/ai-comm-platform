import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import path from 'path';

import { ClaudeAPI } from '../services/claude-api';
import { BrainLoader } from '../brain/brain-loader';
import { BrainManager } from '../brain/brain-manager';
import { BrainSearch } from '../brain/brain-search';
import { AgentOrchestrator } from '../agents/agent-orchestrator';
import { ConversationEngine } from '../conversation/conversation-engine';
import { ConversationManager } from '../conversation/conversation-manager';
import { ContactManager } from '../conversation/contact-manager';
import { createStores } from '../database/store-factory';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { createMessagesRouter } from './routes/messages';
import { createConversationsRouter } from './routes/conversations';
import { createContactsRouter } from './routes/contacts';
import { createBrainRouter } from './routes/brain';
import { createAnalyticsRouter } from './routes/analytics';
import { createWebhooksRouter } from './routes/webhooks';
import logger from '../services/logger';

dotenv.config();

export async function createApp(options?: {
  claude?: ClaudeAPI;
  brainPath?: string;
  skipAuth?: boolean;
}) {
  const app = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(compression());
  app.use(morgan('combined', {
    stream: { write: (message: string) => logger.info(message.trim()) },
    skip: (req) => req.url === '/health',
  }));
  app.use(express.json({ limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
  });
  app.use('/api/', limiter);

  // Auth (skip in test mode if configured)
  if (!options?.skipAuth) {
    app.use(authMiddleware);
  }

  // Initialize brain
  const brainPath = options?.brainPath || path.resolve(process.cwd(), 'brain');
  const brainLoader = new BrainLoader(brainPath);
  brainLoader.loadAll();
  const brainManager = new BrainManager(brainLoader, brainPath);
  const brainSearch = new BrainSearch(brainLoader);

  // Initialize Claude API
  let claude: ClaudeAPI;
  if (options?.claude) {
    claude = options.claude;
  } else {
    try {
      claude = new ClaudeAPI();
    } catch {
      logger.warn('ANTHROPIC_API_KEY not set. AI agents will not work.');
      claude = null as unknown as ClaudeAPI;
    }
  }

  // Initialize stores (SupabaseStore or MemoryStore based on env)
  const { contactStore, conversationStore, messageSync } = await createStores();

  // Initialize engine with injected stores
  const orchestrator = new AgentOrchestrator(claude, brainLoader);
  const conversationManager = new ConversationManager(conversationStore);
  const contactManager = new ContactManager(contactStore);
  const engine = new ConversationEngine(orchestrator, conversationManager, contactManager);

  // Hook message events for Supabase persistence
  if (messageSync) {
    engine.on('message:incoming', ({ message }) => {
      messageSync.persistMessage(message);
    });
    engine.on('message:outgoing', ({ message }) => {
      messageSync.persistMessage(message);
    });
    logger.info('Message sync to Supabase enabled.');
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // Swagger docs
  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'AI Communication Platform API',
        version: '1.0.0',
        description: 'REST API for the AI-powered customer communication platform',
      },
      servers: [{ url: `http://localhost:${process.env.PORT || 3000}` }],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
          },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    apis: [path.join(__dirname, 'routes', '*.ts'), path.join(__dirname, 'routes', '*.js')],
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  // API Routes
  app.use('/api/messages', createMessagesRouter(engine));
  app.use('/api/conversations', createConversationsRouter(engine));
  app.use('/api/contacts', createContactsRouter(engine));
  app.use('/api/brain', createBrainRouter(brainLoader, brainManager, brainSearch));
  app.use('/api/analytics', createAnalyticsRouter(engine));
  app.use('/api/webhooks', createWebhooksRouter());

  // Error handler (must be last)
  app.use(errorHandler);

  return { app, engine, brainLoader, brainManager };
}

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  createApp().then(({ app }) => {
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API docs: http://localhost:${PORT}/api/docs`);
      logger.info(`Health: http://localhost:${PORT}/health`);
    });
  });
}

export default createApp;
