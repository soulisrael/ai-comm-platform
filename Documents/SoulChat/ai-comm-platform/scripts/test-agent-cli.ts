import * as readline from 'readline';
import dotenv from 'dotenv';
import { ClaudeAPI } from '../src/services/claude-api';
import { BrainLoader } from '../src/brain/brain-loader';
import { AgentOrchestrator } from '../src/agents/agent-orchestrator';
import { ConversationEngine, EngineResult } from '../src/conversation/conversation-engine';
import { ConversationManager } from '../src/conversation/conversation-manager';
import { ContactManager } from '../src/conversation/contact-manager';
import { AgentType } from '../src/types/conversation';
import path from 'path';

dotenv.config();

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

async function main() {
  console.log(color('\n🤖 AI Communication Platform — Agent CLI', 'bright'));
  console.log(color('==========================================', 'dim'));
  console.log(color('Commands:', 'cyan'));
  console.log('  /switch sales|support|trial_meeting — force switch agent');
  console.log('  /brain products|faq — show brain data');
  console.log('  /history — show conversation history');
  console.log('  /contacts — list all contacts');
  console.log('  /conversations — list all conversations');
  console.log('  /stats — show platform stats');
  console.log('  /reset — start new conversation');
  console.log('  /usage — show token usage');
  console.log('  /quit — exit');
  console.log(color('==========================================\n', 'dim'));

  // Initialize
  let claude: ClaudeAPI;
  try {
    claude = new ClaudeAPI();
  } catch (err) {
    console.error(color('❌ Error: ANTHROPIC_API_KEY not set. Add it to .env file.', 'red'));
    process.exit(1);
  }

  const brainPath = path.resolve(process.cwd(), 'brain');
  const brainLoader = new BrainLoader(brainPath);
  brainLoader.loadAll();

  const orchestrator = new AgentOrchestrator(claude, brainLoader);
  const conversationManager = new ConversationManager();
  const contactManager = new ContactManager();
  const engine = new ConversationEngine(orchestrator, conversationManager, contactManager);

  let currentConversationId: string | undefined;

  // Listen for events
  engine.on('conversation:started', ({ conversation }) => {
    console.log(color(`  📌 New conversation: ${conversation.id}`, 'dim'));
  });
  engine.on('conversation:handoff', ({ reason }) => {
    console.log(color(`  ⚠️  Handoff event: ${reason}`, 'red'));
  });
  engine.on('conversation:closed', () => {
    console.log(color(`  ✅ Conversation closed`, 'dim'));
  });

  console.log(color('✅ Brain loaded. Conversation engine ready.\n', 'green'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    const conv = currentConversationId
      ? conversationManager.getConversation(currentConversationId)
      : undefined;
    const agentLabel = conv?.currentAgent
      ? color(`[${conv.currentAgent}]`, 'magenta')
      : color('[new]', 'dim');
    rl.question(`${agentLabel} ${color('You:', 'green')} `, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      // Handle commands
      if (trimmed.startsWith('/')) {
        handleCommand(trimmed);
        prompt();
        return;
      }

      try {
        console.log(color('\n⏳ Processing...', 'dim'));
        const result = await engine.handleIncomingMessage({
          content: trimmed,
          channelUserId: 'cli-user-001',
          channel: 'web',
          senderName: 'CLI User',
        });

        currentConversationId = result.conversation.id;
        displayResult(result);
      } catch (err) {
        console.error(color(`\n❌ Error: ${err}`, 'red'));
      }

      prompt();
    });
  };

  rl.on('close', () => {
    console.log(color('\n👋 Goodbye!', 'cyan'));
    process.exit(0);
  });

  prompt();

  function handleCommand(cmd: string) {
    const parts = cmd.split(' ');
    const command = parts[0];
    const arg = parts[1];

    switch (command) {
      case '/switch': {
        if (!currentConversationId) {
          console.log(color('No active conversation. Send a message first.', 'yellow'));
          return;
        }
        if (!arg || !['sales', 'support', 'trial_meeting', 'handoff'].includes(arg)) {
          console.log(color('Usage: /switch sales|support|trial_meeting|handoff', 'yellow'));
          return;
        }
        const conv = conversationManager.getConversation(currentConversationId);
        if (conv) {
          orchestrator.switchAgent(conv, arg as AgentType);
          conversationManager.updateAgent(currentConversationId, arg as AgentType);
          console.log(color(`✅ Switched to ${arg} agent`, 'green'));
        }
        break;
      }

      case '/brain': {
        const brainSearch = orchestrator.getBrainSearch();
        if (arg === 'products') {
          const products = brainSearch.getProducts();
          console.log(color('\n📦 Products:', 'cyan'));
          console.log(JSON.stringify(products, null, 2));
        } else if (arg === 'faq') {
          console.log(color('\n❓ FAQ:', 'cyan'));
          const faqEntry = brainLoader.getEntry('support', 'faq');
          if (faqEntry) console.log(JSON.stringify(faqEntry.data, null, 2));
        } else {
          console.log(color('Usage: /brain products|faq', 'yellow'));
        }
        break;
      }

      case '/history': {
        if (!currentConversationId) {
          console.log(color('No conversation history.', 'yellow'));
          return;
        }
        const messages = conversationManager.getConversationHistory(currentConversationId);
        if (messages.length === 0) {
          console.log(color('No messages yet.', 'yellow'));
          return;
        }
        const conv = conversationManager.getConversation(currentConversationId);
        console.log(color('\n📜 Conversation History:', 'cyan'));
        for (const msg of messages) {
          const prefix = msg.direction === 'inbound'
            ? color('  You:', 'green')
            : color(`  ${conv?.currentAgent || 'Bot'}:`, 'blue');
          console.log(`${prefix} ${msg.content.slice(0, 200)}`);
        }
        break;
      }

      case '/contacts': {
        const contacts = contactManager.getAllContacts();
        if (contacts.length === 0) {
          console.log(color('No contacts yet.', 'yellow'));
          return;
        }
        console.log(color('\n👥 Contacts:', 'cyan'));
        for (const c of contacts) {
          console.log(`  ${c.id}: ${c.name || 'Unknown'} (${c.channel}:${c.channelUserId}) — ${c.conversationCount} conversations, tags: [${c.tags.join(', ')}]`);
        }
        break;
      }

      case '/conversations': {
        const convs = conversationManager.getAllConversations();
        if (convs.length === 0) {
          console.log(color('No conversations yet.', 'yellow'));
          return;
        }
        console.log(color('\n💬 Conversations:', 'cyan'));
        for (const c of convs) {
          const isCurrent = c.id === currentConversationId ? ' ← current' : '';
          console.log(`  ${c.id}: status=${c.status}, agent=${c.currentAgent || 'none'}, messages=${c.messages.length}, channel=${c.channel}${isCurrent}`);
        }
        break;
      }

      case '/stats': {
        const stats = conversationManager.getStats();
        const contacts = contactManager.getAllContacts();
        const usage = claude.getUsage();
        console.log(color('\n📊 Platform Stats:', 'cyan'));
        console.log(`  Contacts:           ${contacts.length}`);
        console.log(`  Total conversations: ${stats.total}`);
        console.log(`  Active:             ${stats.active}`);
        console.log(`  Waiting:            ${stats.waiting}`);
        console.log(`  Handoff:            ${stats.handoff}`);
        console.log(`  Closed:             ${stats.closed}`);
        console.log(`  API input tokens:   ${usage.totalInputTokens}`);
        console.log(`  API output tokens:  ${usage.totalOutputTokens}`);
        console.log(`  API calls:          ${usage.totalCalls}`);
        break;
      }

      case '/reset':
        if (currentConversationId) {
          conversationManager.closeConversation(currentConversationId, 'User reset');
        }
        currentConversationId = undefined;
        console.log(color('🔄 Conversation reset. Next message starts a new conversation.', 'green'));
        break;

      case '/usage': {
        const tokenUsage = claude.getUsage();
        console.log(color('\n📊 Token Usage:', 'cyan'));
        console.log(`  Input tokens:  ${tokenUsage.totalInputTokens}`);
        console.log(`  Output tokens: ${tokenUsage.totalOutputTokens}`);
        console.log(`  Total calls:   ${tokenUsage.totalCalls}`);
        break;
      }

      case '/quit':
        console.log(color('\n👋 Goodbye!', 'cyan'));
        process.exit(0);

      default:
        console.log(color(`Unknown command: ${command}`, 'yellow'));
    }
  }

  function displayResult(result: EngineResult) {
    if (result.routingDecision) {
      console.log(color(
        `\n🔀 Routing: ${result.routingDecision.selectedAgent} ` +
        `(confidence: ${(result.routingDecision.confidence * 100).toFixed(0)}%)`,
        'yellow'
      ));
    }

    const agentName = result.agentType || 'Bot';
    console.log(color(`\n${agentName}:`, 'blue') + ` ${result.outgoingMessage.content}`);

    if (result.outgoingMessage.metadata?.action &&
        result.outgoingMessage.metadata.action !== 'send_message') {
      console.log(color(`\n📌 Action: ${result.outgoingMessage.metadata.action}`, 'magenta'));
    }

    console.log('');
  }
}

main().catch(console.error);
