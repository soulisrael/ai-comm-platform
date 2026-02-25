# AI Communication Platform

AI-powered customer communication platform with multi-agent routing, a brain knowledge system, and Supabase persistence.

## Overview

This platform serves as an AI customer communication hub that receives messages across multiple channels, intelligently routes them to specialized AI agents, and manages the full conversation lifecycle — including handoffs to human agents when needed.

**Key flow:**

1. Customer message arrives via API (WhatsApp, Instagram, Telegram, or Web)
2. Router Agent classifies intent and selects the appropriate specialist agent
3. Specialist agent processes the message using brain knowledge and conversation context
4. Response is generated and conversation state is updated
5. Data is persisted to Supabase (or kept in-memory for development)

## Features

- **Multi-channel support** — WhatsApp, Instagram, Telegram, Web
- **Intelligent routing** — AI-based intent classification with keyword fallback
- **Specialized AI agents** — Sales, Support, Trial/Demo booking, Handoff
- **Brain knowledge system** — JSON-based, hot-reloadable configuration for products, FAQs, policies, scripts
- **Lead scoring** — Automatic scoring based on engagement and buying signals
- **Frustration detection** — Escalates to human agents when needed
- **Human handoff** — Conversation summarization and queue management
- **Write-through cache** — Fast synchronous reads with async Supabase persistence
- **Graceful fallback** — Runs with in-memory storage if Supabase is not configured
- **OpenAPI docs** — Swagger UI at `/api/docs`
- **Full test coverage** — 188 tests with Vitest

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Channels   │────▶│  Conversation     │────▶│  Agent           │
│  (Web, WA,   │     │  Engine           │     │  Orchestrator    │
│   IG, TG)    │     └──────────────────┘     └────────┬────────┘
└─────────────┘              │                         │
                             │                    ┌────▼────┐
                    ┌────────▼────────┐           │ Router  │
                    │  Store<T>       │           │ Agent   │
                    │  (Memory or     │           └────┬────┘
                    │   Supabase)     │                │
                    └─────────────────┘     ┌──────────┼──────────┐
                                            │          │          │
                                       ┌────▼──┐ ┌────▼───┐ ┌───▼────┐
                                       │ Sales │ │Support │ │ Trial  │
                                       │ Agent │ │ Agent  │ │ Agent  │
                                       └───────┘ └────────┘ └────────┘
                                            │          │          │
                                       ┌────▼──────────▼──────────▼───┐
                                       │         Brain System          │
                                       │  (Products, FAQs, Policies,  │
                                       │   Scripts, Company Info)      │
                                       └──────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript (strict) |
| API | Express 5 |
| AI | Claude API (`@anthropic-ai/sdk`) |
| Database | Supabase (PostgreSQL) with in-memory fallback |
| Validation | Zod |
| Testing | Vitest + Supertest |
| Logging | Winston |
| Docs | Swagger (OpenAPI 3.0) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/soulisrael/ai-comm-platform.git
cd ai-comm-platform
npm install
```

### Environment Variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for AI) | Claude API key |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | No | Supabase service role key |
| `API_SECRET_KEY` | No | If set, requires `x-api-key` header on all requests |
| `PORT` | No | Server port (default: 3000) |

> Without Supabase credentials, the server runs with in-memory storage — all data resets on restart.

### Running

```bash
# Development (auto-reload)
npm run dev

# Production
npm start

# Interactive CLI for testing agents
npm run chat
```

### Database Setup (Optional)

If using Supabase for persistence:

```bash
# Print the SQL migration to run in Supabase SQL Editor
npm run db:migrate

# Seed with sample data
npm run db:seed
```

## API Routes

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages/incoming` | Process an incoming customer message |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations (with filters and pagination) |
| GET | `/api/conversations/:id` | Get conversation details |
| POST | `/api/conversations/:id/handoff` | Trigger human handoff |
| POST | `/api/conversations/:id/takeover` | Human agent takes control |
| POST | `/api/conversations/:id/pause` | Pause AI auto-responding |
| POST | `/api/conversations/:id/resume` | Resume AI control |
| POST | `/api/conversations/:id/reply` | Human agent sends reply |
| POST | `/api/conversations/:id/close` | Close conversation |
| POST | `/api/conversations/:id/switch-agent` | Switch AI agent type |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts (with search) |
| GET | `/api/contacts/:id` | Get contact details |
| PUT | `/api/contacts/:id` | Update contact info |
| POST | `/api/contacts/:id/tags` | Add tag |
| DELETE | `/api/contacts/:id/tags/:tag` | Remove tag |

### Brain
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/brain/modules` | List all brain modules |
| GET | `/api/brain/modules/:cat/:sub` | Get module data |
| PUT | `/api/brain/modules/:cat/:sub` | Update module |
| GET | `/api/brain/agents` | Get agent configurations |
| GET | `/api/brain/company` | Get company info |
| POST | `/api/brain/reload` | Hot-reload brain data |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Platform analytics |
| GET | `/api/analytics/conversations` | Conversation volume over time |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/docs` | Swagger UI |

## AI Agents

| Agent | Purpose |
|-------|---------|
| **Router** | Classifies intent and routes to the correct specialist agent |
| **Sales** | Guides customers through the sales funnel with lead scoring |
| **Support** | Resolves issues using FAQ search, policies, and troubleshooting guides |
| **Trial Meeting** | Collects customer details and books demo/trial sessions |
| **Handoff** | Manages transition to human agents with conversation summarization |

## Brain System

The brain is a JSON-based knowledge layer that all agents draw from. It's organized into four categories:

```
brain/
├── sales/           # Products, pricing, objection handling, scripts
├── support/         # FAQ, policies, troubleshooting, escalation rules
├── company/         # Company info, tone of voice, team directory
└── config/          # Agent instructions, routing rules, handoff rules
```

Brain data can be updated at runtime via the API (`PUT /api/brain/modules/...`) and hot-reloaded (`POST /api/brain/reload`).

## Testing

```bash
# Run all tests once
npm run test:run

# Watch mode
npm test
```

**188 tests** across 19 test files covering agents, API endpoints, brain system, conversation management, database layer, and types.

## Project Structure

```
src/
├── agents/          # AI agent implementations
├── api/             # Express server, routes, middleware
├── brain/           # Brain loader, manager, search
├── conversation/    # Engine, managers, store, queue
├── database/        # Supabase client, store, repos, migrations
├── services/        # Claude API client, logger
└── types/           # TypeScript interfaces
```

## License

ISC
