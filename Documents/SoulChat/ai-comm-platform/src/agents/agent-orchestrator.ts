import { AgentType, Conversation, ConversationContext } from '../types/conversation';
import { AgentResponse } from '../types/agent';
import { Message, createMessage, ChannelType } from '../types/message';
import { Contact } from '../types/contact';
import { ClaudeAPI } from '../services/claude-api';
import { PromptBuilder } from './prompt-builder';
import { RouterAgent } from './router-agent';
import { AgentRunner, AgentRunnerResult } from './agent-runner';
import { CustomAgentRepository } from '../database/repositories/custom-agent-repository';
import { costTracker } from '../services/cost-tracker';
import logger from '../services/logger';

export interface OrchestratorResult {
  response: AgentResponse;
  conversation: Conversation;
  routingDecision?: {
    intent: string;
    confidence: number;
    selectedAgent: AgentType;
    customAgentId?: string;
    customAgentName?: string;
  };
}

export class AgentOrchestrator {
  private claude: ClaudeAPI;
  private promptBuilder: PromptBuilder;
  private router: RouterAgent;
  private agentRunner: AgentRunner;
  private customAgentRepo: CustomAgentRepository;

  constructor(
    claude: ClaudeAPI,
    customAgentRepo: CustomAgentRepository
  ) {
    this.claude = claude;
    this.customAgentRepo = customAgentRepo;
    this.promptBuilder = new PromptBuilder();
    this.router = new RouterAgent(claude, this.promptBuilder, customAgentRepo);
    this.agentRunner = new AgentRunner(claude, customAgentRepo, this.promptBuilder);
    logger.info('AgentOrchestrator initialized (custom agents only)');
  }

  async handleMessage(
    incomingMessage: Message,
    conversation?: Conversation,
    contact?: Contact | null
  ): Promise<OrchestratorResult> {
    // Create or update conversation
    if (!conversation) {
      conversation = this.createConversation(incomingMessage);
    }

    // Add incoming message to conversation
    conversation.messages.push(incomingMessage);
    conversation.updatedAt = new Date();

    // Skip AI for human-managed conversations
    if (conversation.status === 'human_active' || conversation.status === 'paused') {
      return {
        response: {
          message: '',
          shouldHandoff: false,
          confidence: 0,
        },
        conversation,
      };
    }

    return this.handleCustomAgentMessage(incomingMessage, conversation, contact);
  }

  private async handleCustomAgentMessage(
    incomingMessage: Message,
    conversation: Conversation,
    contact?: Contact | null
  ): Promise<OrchestratorResult> {
    let routingDecision: OrchestratorResult['routingDecision'];

    // Route if no custom agent assigned
    if (!conversation.customAgentId) {
      const routeResult = await this.router.routeToCustomAgent(
        incomingMessage.content,
        conversation.messages,
        undefined
      );

      conversation.customAgentId = routeResult.agentId;

      // Load agent name for routing decision
      const agentRow = await this.customAgentRepo.findById(routeResult.agentId);
      const agentName = agentRow?.name || routeResult.agentId;

      routingDecision = {
        intent: routeResult.reasoning,
        confidence: routeResult.confidence,
        selectedAgent: 'support', // legacy compat
        customAgentId: routeResult.agentId,
        customAgentName: agentName,
      };

      logger.info(`Routed to custom agent: ${agentName} (confidence: ${routeResult.confidence})`);
    } else {
      // Check if should transfer to different agent
      const transferCheck = await this.router.shouldTransfer(
        incomingMessage.content,
        conversation.customAgentId
      );

      if (transferCheck.shouldTransfer && transferCheck.suggestedAgentId) {
        logger.info(`Transferring from ${conversation.customAgentId} to ${transferCheck.suggestedAgentId}: ${transferCheck.reasoning}`);
        conversation.customAgentId = transferCheck.suggestedAgentId;

        const agentRow = await this.customAgentRepo.findById(transferCheck.suggestedAgentId);
        routingDecision = {
          intent: transferCheck.reasoning || 'העברה בין סוכנים',
          confidence: 0.8,
          selectedAgent: 'support',
          customAgentId: transferCheck.suggestedAgentId,
          customAgentName: agentRow?.name,
        };
      }
    }

    // Run the custom agent
    const runResult = await this.agentRunner.run(
      conversation.customAgentId!,
      incomingMessage.content,
      conversation.messages,
      contact
    );

    // Handle handoff — simple Hebrew message
    if (runResult.shouldHandoff) {
      logger.info(`Handoff triggered: ${runResult.handoffReason}`);
      conversation.status = 'handoff';
      conversation.currentAgent = 'handoff';

      const handoffMessage = 'אנחנו מחברים אותך עם נציג אנושי. הוא יקבל את כל פרטי השיחה. רגע אחד בבקשה!';

      const outgoingMessage = createMessage({
        conversationId: conversation.id,
        contactId: conversation.contactId,
        direction: 'outbound',
        type: 'text',
        content: handoffMessage,
        channel: conversation.channel,
        metadata: { customAgentId: conversation.customAgentId },
      });
      conversation.messages.push(outgoingMessage);

      const handoffResponse: AgentResponse = {
        message: handoffMessage,
        shouldHandoff: true,
        handoffReason: runResult.handoffReason,
        confidence: 1.0,
      };

      return { response: handoffResponse, conversation, routingDecision };
    }

    // Handle transfer
    if (runResult.shouldTransfer && runResult.suggestedAgentId) {
      conversation.customAgentId = runResult.suggestedAgentId;
      // Re-run with the new agent
      const rerunResult = await this.agentRunner.run(
        runResult.suggestedAgentId,
        incomingMessage.content,
        conversation.messages,
        contact
      );
      runResult.message = rerunResult.message;
    }

    // Build response
    const response: AgentResponse = {
      message: runResult.message,
      shouldHandoff: false,
      confidence: runResult.confidence,
      action: 'send_message',
    };

    // Add response message
    const outgoingMessage = createMessage({
      conversationId: conversation.id,
      contactId: conversation.contactId,
      direction: 'outbound',
      type: 'text',
      content: response.message,
      channel: conversation.channel,
      metadata: { customAgentId: conversation.customAgentId },
    });
    conversation.messages.push(outgoingMessage);
    conversation.status = 'waiting';

    // Log daily cost summary
    const dailyCost = costTracker.getDailyCost();
    if (dailyCost.totalCalls > 0 && dailyCost.totalCalls % 10 === 0) {
      logger.info('[COST SUMMARY]', {
        totalCalls: dailyCost.totalCalls,
        estimatedCost: `$${dailyCost.estimatedCost.toFixed(4)}`,
        cacheHitRate: `${(dailyCost.cacheHitRate * 100).toFixed(1)}%`,
      });
    }

    return { response, conversation, routingDecision };
  }

  switchAgent(conversation: Conversation, newAgentType: AgentType): void {
    logger.info(`Switching agent from ${conversation.currentAgent} to ${newAgentType}`);
    conversation.currentAgent = newAgentType;
    conversation.updatedAt = new Date();
  }

  switchCustomAgent(conversation: Conversation, customAgentId: string): void {
    logger.info(`Switching to custom agent: ${customAgentId}`);
    conversation.customAgentId = customAgentId;
    conversation.updatedAt = new Date();
  }

  getRouter(): RouterAgent {
    return this.router;
  }

  getAgentRunner(): AgentRunner {
    return this.agentRunner;
  }

  private createConversation(message: Message): Conversation {
    const context: ConversationContext = {
      intent: null,
      sentiment: null,
      language: null,
      leadScore: null,
      tags: [],
      customFields: {},
    };

    return {
      id: `conv-${Date.now()}`,
      contactId: message.contactId,
      channel: message.channel,
      status: 'active',
      currentAgent: null,
      messages: [],
      context,
      startedAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
