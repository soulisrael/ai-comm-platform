import { AgentType, Conversation, ConversationContext } from '../types/conversation';
import { AgentResponse } from '../types/agent';
import { Message, createMessage, ChannelType } from '../types/message';
import { Contact } from '../types/contact';
import { ClaudeAPI } from '../services/claude-api';
import { BrainLoader } from '../brain/brain-loader';
import { BrainSearch } from '../brain/brain-search';
import { PromptBuilder } from './prompt-builder';
import { BaseAgent } from './base-agent';
import { RouterAgent } from './router-agent';
import { SalesAgent } from './sales-agent';
import { SupportAgent } from './support-agent';
import { TrialMeetingAgent } from './trial-meeting-agent';
import { HandoffAgent } from './handoff-agent';
import { AgentRunner, AgentRunnerResult } from './agent-runner';
import { CustomAgentRepository } from '../database/repositories/custom-agent-repository';
import { TopicRepository } from '../database/repositories/topic-repository';
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
  private brainLoader: BrainLoader;
  private brainSearch: BrainSearch;
  private promptBuilder: PromptBuilder;

  // Legacy agents
  private router: RouterAgent;
  private salesAgent: SalesAgent;
  private supportAgent: SupportAgent;
  private trialMeetingAgent: TrialMeetingAgent;
  private handoffAgent: HandoffAgent;

  // Custom agent engine
  private agentRunner: AgentRunner | null = null;
  private customAgentRepo: CustomAgentRepository | null = null;

  constructor(
    claude: ClaudeAPI,
    brainLoader: BrainLoader,
    customAgentRepo?: CustomAgentRepository,
    topicRepo?: TopicRepository
  ) {
    this.claude = claude;
    this.brainLoader = brainLoader;
    this.brainSearch = new BrainSearch(brainLoader);
    this.promptBuilder = new PromptBuilder(this.brainSearch);

    // Initialize legacy agents
    this.router = new RouterAgent(claude, this.promptBuilder, this.brainSearch, customAgentRepo);
    this.salesAgent = new SalesAgent(claude, this.promptBuilder);
    this.supportAgent = new SupportAgent(claude, this.promptBuilder, this.brainSearch);
    this.trialMeetingAgent = new TrialMeetingAgent(claude, this.promptBuilder);
    this.handoffAgent = new HandoffAgent(this.brainSearch);

    // Initialize custom agent engine if repos provided
    if (customAgentRepo && topicRepo) {
      this.customAgentRepo = customAgentRepo;
      this.agentRunner = new AgentRunner(claude, customAgentRepo, topicRepo, this.promptBuilder);
      logger.info('Custom agent engine initialized');
    }
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

    // ─── Custom agent flow ──────────────────────────────────────────────
    if (this.agentRunner && this.customAgentRepo) {
      return this.handleCustomAgentMessage(incomingMessage, conversation, contact);
    }

    // ─── Legacy agent flow ──────────────────────────────────────────────
    return this.handleLegacyMessage(incomingMessage, conversation, contact);
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
        conversation.messages
      );

      conversation.customAgentId = routeResult.agentId;

      // Load agent name for routing decision
      const agentRow = await this.customAgentRepo!.findById(routeResult.agentId);
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

        const agentRow = await this.customAgentRepo!.findById(transferCheck.suggestedAgentId);
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
    const runResult = await this.agentRunner!.run(
      conversation.customAgentId!,
      incomingMessage.content,
      conversation.messages,
      contact
    );

    // Handle handoff
    if (runResult.shouldHandoff) {
      logger.info(`Handoff triggered: ${runResult.handoffReason}`);
      conversation.status = 'handoff';
      conversation.currentAgent = 'handoff';

      const handoffResponse = await this.handoffAgent.processMessage(
        incomingMessage,
        conversation,
        {}
      );

      const outgoingMessage = createMessage({
        conversationId: conversation.id,
        contactId: conversation.contactId,
        direction: 'outbound',
        type: 'text',
        content: handoffResponse.message,
        channel: conversation.channel,
        metadata: { customAgentId: conversation.customAgentId },
      });
      conversation.messages.push(outgoingMessage);

      return { response: handoffResponse, conversation, routingDecision };
    }

    // Handle transfer
    if (runResult.shouldTransfer && runResult.suggestedAgentId) {
      conversation.customAgentId = runResult.suggestedAgentId;
      // Re-run with the new agent
      const rerunResult = await this.agentRunner!.run(
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

    return { response, conversation, routingDecision };
  }

  private async handleLegacyMessage(
    incomingMessage: Message,
    conversation: Conversation,
    contact?: Contact | null
  ): Promise<OrchestratorResult> {
    let routingDecision: OrchestratorResult['routingDecision'];

    // If new conversation or no current agent → run Router first
    if (!conversation.currentAgent || conversation.currentAgent === 'router') {
      const routerResponse = await this.router.processMessage(
        incomingMessage,
        conversation,
        {}
      );

      const selectedAgent = routerResponse.suggestedAgent || 'support';
      conversation.currentAgent = selectedAgent;
      conversation.context.intent = routerResponse.message;

      routingDecision = {
        intent: routerResponse.message,
        confidence: routerResponse.confidence,
        selectedAgent,
      };

      logger.info(`Routed to ${selectedAgent} (confidence: ${routerResponse.confidence})`);
    }

    // Execute the selected agent
    const agent = this.getAgent(conversation.currentAgent!);
    const brainData = this.brainSearch.findRelevantBrainData(
      incomingMessage.content,
      conversation.currentAgent!
    );

    let response: AgentResponse;

    if (agent instanceof SalesAgent || agent instanceof SupportAgent || agent instanceof TrialMeetingAgent) {
      response = await agent.processMessage(incomingMessage, conversation, brainData, contact);
    } else {
      response = await agent.processMessage(incomingMessage, conversation, brainData);
    }

    // Handle handoff
    if (response.shouldHandoff && response.suggestedAgent === 'handoff') {
      logger.info(`Handoff triggered: ${response.handoffReason}`);
      conversation.currentAgent = 'handoff';
      conversation.status = 'handoff';

      const handoffResponse = await this.handoffAgent.processMessage(
        incomingMessage,
        conversation,
        {}
      );

      if (response.message) {
        conversation.messages.push(createMessage({
          conversationId: conversation.id,
          contactId: conversation.contactId,
          direction: 'outbound',
          type: 'text',
          content: response.message,
          channel: conversation.channel,
          metadata: { agent: conversation.currentAgent },
        }));
      }

      response = handoffResponse;
    }

    // Add response message
    const outgoingMessage = createMessage({
      conversationId: conversation.id,
      contactId: conversation.contactId,
      direction: 'outbound',
      type: 'text',
      content: response.message,
      channel: conversation.channel,
      metadata: { agent: conversation.currentAgent },
    });
    conversation.messages.push(outgoingMessage);

    if (response.action === 'close_conversation') {
      conversation.status = 'closed';
    } else if (response.action === 'transfer_to_human') {
      conversation.status = 'handoff';
    } else {
      conversation.status = 'waiting';
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

  getAllAgents(): Record<AgentType, BaseAgent> {
    return {
      router: this.router,
      sales: this.salesAgent,
      support: this.supportAgent,
      trial_meeting: this.trialMeetingAgent,
      handoff: this.handoffAgent,
    };
  }

  getRouter(): RouterAgent {
    return this.router;
  }

  getAgentRunner(): AgentRunner | null {
    return this.agentRunner;
  }

  getBrainSearch(): BrainSearch {
    return this.brainSearch;
  }

  isCustomAgentMode(): boolean {
    return this.agentRunner !== null;
  }

  private getAgent(agentType: AgentType): BaseAgent {
    switch (agentType) {
      case 'sales': return this.salesAgent;
      case 'support': return this.supportAgent;
      case 'trial_meeting': return this.trialMeetingAgent;
      case 'handoff': return this.handoffAgent;
      case 'router': return this.router;
      default: return this.supportAgent;
    }
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
