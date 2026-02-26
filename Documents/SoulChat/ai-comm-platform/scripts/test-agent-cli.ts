import * as readline from 'readline';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ClaudeAPI } from '../src/services/claude-api';
import { AgentOrchestrator } from '../src/agents/agent-orchestrator';
import { ConversationEngine, EngineResult } from '../src/conversation/conversation-engine';
import { ConversationManager } from '../src/conversation/conversation-manager';
import { ContactManager } from '../src/conversation/contact-manager';
import { CustomAgentRepository } from '../src/database/repositories/custom-agent-repository';
import { BrainRepository } from '../src/database/repositories/brain-repository';

dotenv.config();

const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const c = (text: string, color: keyof typeof C) => `${C[color]}${text}${C.reset}`;

async function main() {
  console.log(c('\n🤖 AI Communication Platform — Agent CLI', 'bright'));
  console.log(c('==========================================', 'dim'));
  console.log(c('פקודות:', 'cyan'));
  console.log('  /agents           — רשימת סוכנים + כמה פריטים במוח');
  console.log('  /brain <agentId>  — הצגת כל המוח של סוכן');
  console.log('  /switch <name|id> — החלפה ידנית לסוכן');
  console.log('  /history          — היסטוריית שיחה');
  console.log('  /stats            — סטטיסטיקות');
  console.log('  /reset            — שיחה חדשה');
  console.log('  /quit             — יציאה');
  console.log(c('==========================================\n', 'dim'));

  // Initialize Claude
  let claude: ClaudeAPI;
  try {
    claude = new ClaudeAPI();
  } catch {
    console.error(c('❌ ANTHROPIC_API_KEY לא מוגדר. הוסף ל-.env', 'red'));
    process.exit(1);
  }

  // Initialize Supabase + repos
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(c('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY לא מוגדרים ב-.env', 'red'));
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const customAgentRepo = new CustomAgentRepository(supabase);
  const brainRepo = new BrainRepository(supabase);

  // Verify agents exist
  const agents = await customAgentRepo.getAllWithBrain();
  if (agents.length === 0) {
    console.error(c('❌ לא נמצאו סוכנים ב-DB. הרץ את המיגרציה קודם.', 'red'));
    process.exit(1);
  }

  console.log(c(`✅ Supabase מחובר — ${agents.length} סוכנים פעילים`, 'green'));

  // Initialize engine
  const orchestrator = new AgentOrchestrator(claude, customAgentRepo);
  const conversationManager = new ConversationManager();
  const contactManager = new ContactManager();
  const engine = new ConversationEngine(orchestrator, conversationManager, contactManager);

  let currentConversationId: string | undefined;

  // Events
  engine.on('conversation:started', ({ conversation }) => {
    console.log(c(`  📌 שיחה חדשה: ${conversation.id}`, 'dim'));
  });
  engine.on('conversation:handoff', ({ reason }) => {
    console.log(c(`  ⚠️  העברה לנציג: ${reason}`, 'red'));
  });

  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    const conv = currentConversationId
      ? conversationManager.getConversation(currentConversationId)
      : undefined;

    let label: string;
    if (conv?.customAgentId) {
      // Find agent name
      const agent = agents.find(a => a.id === conv.customAgentId);
      label = agent ? c(`[${agent.name}]`, 'magenta') : c(`[${conv.customAgentId.slice(0, 8)}]`, 'magenta');
    } else {
      label = c('[חדש]', 'dim');
    }

    rl.question(`${label} ${c('אתה:', 'green')} `, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }

      if (trimmed.startsWith('/')) {
        await handleCommand(trimmed);
        prompt();
        return;
      }

      try {
        console.log(c('\n⏳ מעבד...', 'dim'));
        const result = await engine.handleIncomingMessage({
          content: trimmed,
          channelUserId: 'cli-user-001',
          channel: 'web',
          senderName: 'CLI User',
        });

        currentConversationId = result.conversation.id;
        displayResult(result);
      } catch (err) {
        console.error(c(`\n❌ שגיאה: ${err}`, 'red'));
      }

      prompt();
    });
  };

  rl.on('close', () => {
    console.log(c('\n👋 להתראות!', 'cyan'));
    process.exit(0);
  });

  prompt();

  async function handleCommand(cmd: string) {
    const parts = cmd.split(' ');
    const command = parts[0];
    const arg = parts.slice(1).join(' ');

    switch (command) {
      case '/agents': {
        const freshAgents = await customAgentRepo.getAllWithBrain();
        console.log(c('\n🤖 סוכנים:', 'cyan'));
        for (const agent of freshAgents) {
          const status = agent.active ? c('פעיל', 'green') : c('לא פעיל', 'red');
          const defaultTag = agent.isDefault ? c(' (ברירת מחדל)', 'yellow') : '';
          const brainCount = agent.brain.length;
          console.log(`  ${c(agent.name, 'bright')}${defaultTag} [${status}] — ${c(`${brainCount} פריטי מוח`, 'dim')}`);
          console.log(c(`    ID: ${agent.id}`, 'dim'));
          if (agent.routingKeywords.length > 0) {
            console.log(c(`    מילות מפתח: ${agent.routingKeywords.join(', ')}`, 'dim'));
          }
          if (brainCount > 0) {
            const titles = agent.brain.map(b => b.title).join(', ');
            console.log(c(`    מוח: ${titles}`, 'dim'));
          }
        }
        break;
      }

      case '/brain': {
        if (!arg) {
          // If in conversation, show current agent's brain
          const conv = currentConversationId
            ? conversationManager.getConversation(currentConversationId)
            : undefined;
          if (conv?.customAgentId) {
            await showBrain(conv.customAgentId);
          } else {
            console.log(c('שימוש: /brain <agentId|agentName>', 'yellow'));
            console.log(c('או שלח הודעה קודם כדי להציג את המוח של הסוכן הנוכחי', 'dim'));
          }
          return;
        }

        // Find agent by ID or name
        const freshAgents = await customAgentRepo.getAllWithBrain();
        const match = freshAgents.find(
          a => a.id === arg || a.id.startsWith(arg) || a.name === arg || a.name.includes(arg)
        );
        if (match) {
          await showBrain(match.id);
        } else {
          console.log(c(`סוכן "${arg}" לא נמצא. השתמש ב-/agents לרשימה.`, 'yellow'));
        }
        break;
      }

      case '/switch': {
        if (!currentConversationId) {
          console.log(c('אין שיחה פעילה. שלח הודעה קודם.', 'yellow'));
          return;
        }
        if (!arg) {
          console.log(c('שימוש: /switch <שם-סוכן|ID>', 'yellow'));
          return;
        }

        const conv = conversationManager.getConversation(currentConversationId);
        if (!conv) return;

        const freshAgents = await customAgentRepo.getAllWithBrain();
        const match = freshAgents.find(
          a => a.name === arg || a.id === arg || a.id.startsWith(arg) || a.name.includes(arg)
        );
        if (match) {
          orchestrator.switchCustomAgent(conv, match.id);
          console.log(c(`✅ הוחלף לסוכן "${match.name}"`, 'green'));
        } else {
          console.log(c(`סוכן "${arg}" לא נמצא. השתמש ב-/agents לרשימה.`, 'yellow'));
        }
        break;
      }

      case '/history': {
        if (!currentConversationId) {
          console.log(c('אין היסטוריית שיחה.', 'yellow'));
          return;
        }
        const messages = conversationManager.getConversationHistory(currentConversationId);
        if (messages.length === 0) {
          console.log(c('אין הודעות עדיין.', 'yellow'));
          return;
        }
        const conv = conversationManager.getConversation(currentConversationId);
        const agentName = conv?.customAgentId
          ? agents.find(a => a.id === conv.customAgentId)?.name || 'סוכן'
          : 'בוט';

        console.log(c('\n📜 היסטוריית שיחה:', 'cyan'));
        for (const msg of messages) {
          if (msg.direction === 'inbound') {
            console.log(`  ${c('אתה:', 'green')} ${msg.content}`);
          } else {
            console.log(`  ${c(`🤖 ${agentName}:`, 'blue')} ${msg.content}`);
          }
        }
        break;
      }

      case '/stats': {
        const stats = conversationManager.getStats();
        const contacts = contactManager.getAllContacts();
        const usage = claude.getUsage();
        console.log(c('\n📊 סטטיסטיקות:', 'cyan'));
        console.log(`  סוכנים:       ${agents.length}`);
        console.log(`  אנשי קשר:    ${contacts.length}`);
        console.log(`  שיחות:        ${stats.total} (פעילות: ${stats.active}, ממתינות: ${stats.waiting})`);
        console.log(`  טוקנים:       ${usage.totalInputTokens} in / ${usage.totalOutputTokens} out`);
        console.log(`  קריאות API:   ${usage.totalCalls}`);
        break;
      }

      case '/reset':
        if (currentConversationId) {
          conversationManager.closeConversation(currentConversationId, 'User reset');
        }
        currentConversationId = undefined;
        console.log(c('🔄 שיחה אופסה. ההודעה הבאה תתחיל שיחה חדשה.', 'green'));
        break;

      case '/quit':
        console.log(c('\n👋 להתראות!', 'cyan'));
        process.exit(0);

      default:
        console.log(c(`פקודה לא מוכרת: ${command}`, 'yellow'));
    }
  }

  async function showBrain(agentId: string) {
    const entries = await brainRepo.getByAgent(agentId);
    const agent = agents.find(a => a.id === agentId);
    const name = agent?.name || agentId;

    if (entries.length === 0) {
      console.log(c(`אין פריטי מוח לסוכן "${name}".`, 'yellow'));
      return;
    }

    console.log(c(`\n🧠 מוח של "${name}" (${entries.length} פריטים):`, 'cyan'));
    for (const entry of entries) {
      const statusIcon = entry.active ? '✅' : '⏸️';
      const categoryLabel = { product: 'מוצר', policy: 'מדיניות', faq: 'שאלות', script: 'תסריט', general: 'כללי' }[entry.category] || entry.category;

      console.log(`\n  ${statusIcon} ${c(entry.title, 'bright')} ${c(`[${categoryLabel}]`, 'dim')}`);
      // Show first 150 chars of content
      const preview = entry.content.replace(/\n/g, ' ').slice(0, 150);
      console.log(c(`     ${preview}${entry.content.length > 150 ? '...' : ''}`, 'dim'));

      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        const meta = Object.entries(entry.metadata).map(([k, v]) => `${k}: ${v}`).join(' | ');
        console.log(c(`     📋 ${meta}`, 'dim'));
      }
    }
  }

  function displayResult(result: EngineResult) {
    // Show routing decision
    if (result.routingDecision) {
      const agentName = result.routingDecision.customAgentName || result.routingDecision.selectedAgent;
      console.log(c(
        `\n🔀 ניתוב: ${agentName} (ביטחון: ${(result.routingDecision.confidence * 100).toFixed(0)}%)`,
        'yellow'
      ));
    }

    // Show agent response with name
    const agentName = result.routingDecision?.customAgentName
      || agents.find(a => a.id === result.conversation.customAgentId)?.name
      || 'בוט';

    console.log(`\n${c(`🤖 ${agentName}:`, 'blue')} ${result.outgoingMessage.content}\n`);
  }
}

main().catch(console.error);
