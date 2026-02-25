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
import { createAutomationRouter } from './routes/automation';
import { createUploadRouter } from './routes/upload';
import { DocxConverter } from '../services/docx-converter';
import { FlowEngine } from '../automation/flow-engine';
import { TriggerManager } from '../automation/triggers/trigger-manager';
import { BroadcastManager } from '../automation/broadcast';
import { TemplateManager } from '../automation/template-manager';
import { ChannelManager } from '../channels/channel-manager';
import { WhatsAppAdapter } from '../channels/whatsapp-adapter';
import { InstagramAdapter } from '../channels/instagram-adapter';
import { TelegramAdapter } from '../channels/telegram-adapter';
import { metricsHandler, messagesTotal, conversationsActive, handoffTotal } from '../services/monitoring';
import { healthHandler, registerHealthCheck } from '../services/health-check';
import { startAlertLoop, trackRequest } from '../services/alerting';
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
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : '*';
  app.use(cors({ origin: corsOrigins }));
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

  // Initialize channel adapters
  const channelManager = new ChannelManager();
  if (process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_TOKEN) {
    channelManager.registerAdapter(new WhatsAppAdapter());
  }
  if (process.env.INSTAGRAM_PAGE_ID || process.env.INSTAGRAM_TOKEN) {
    channelManager.registerAdapter(new InstagramAdapter());
  }
  if (process.env.TELEGRAM_BOT_TOKEN) {
    channelManager.registerAdapter(new TelegramAdapter());
  }

  // Initialize automation engine
  const flowEngine = new FlowEngine({ channelManager, conversationManager, contactManager });
  const triggerManager = new TriggerManager(engine, flowEngine);
  const broadcastManager = new BroadcastManager(channelManager, contactManager);
  const templateManager = new TemplateManager();

  // Register scheduled flows
  triggerManager.registerScheduledFlows();

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

  // Register health checks
  registerHealthCheck('brain', () => brainLoader.getData().size > 0);
  registerHealthCheck('claude_api', () => claude !== null);

  // Track message metrics
  engine.on('message:incoming', ({ message }) => {
    messagesTotal.inc({ channel: message.channel, direction: 'inbound' });
    trackRequest(false);
  });
  engine.on('message:outgoing', ({ message }) => {
    messagesTotal.inc({ channel: message.channel, direction: 'outbound' });
  });
  engine.on('conversation:started', () => {
    conversationsActive.inc();
  });
  engine.on('conversation:closed', () => {
    conversationsActive.dec();
  });
  engine.on('conversation:handoff', () => {
    handoffTotal.inc();
  });

  // Start alert monitoring loop
  startAlertLoop();

  // Health check + metrics endpoints (no auth required)
  app.get('/health', healthHandler);
  app.get('/metrics', metricsHandler);

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

  // Initialize document converter
  const docxConverter = claude ? new DocxConverter(claude, brainLoader) : null;

  // API Routes
  app.use('/api/messages', createMessagesRouter(engine));
  app.use('/api/conversations', createConversationsRouter(engine));
  app.use('/api/contacts', createContactsRouter(engine));
  app.use('/api/brain', createBrainRouter(brainLoader, brainManager, brainSearch));
  if (docxConverter) {
    app.use('/api/brain/upload', createUploadRouter(docxConverter, brainManager, brainLoader));
  }
  app.use('/api/analytics', createAnalyticsRouter(engine));
  app.use('/api/webhooks', createWebhooksRouter(channelManager, engine));
  app.use('/api/automation', createAutomationRouter({ flowEngine, broadcastManager, templateManager, triggerManager }));

  // Error handler (must be last)
  app.use(errorHandler);

  return { app, engine, brainLoader, brainManager, channelManager, flowEngine, broadcastManager, templateManager, triggerManager };
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
