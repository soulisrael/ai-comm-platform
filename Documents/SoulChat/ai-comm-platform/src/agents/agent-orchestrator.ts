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
import logger from '../services/logger';

export interface OrchestratorResult {
  response: AgentResponse;
  conversation: Conversation;
  routingDecision?: {
    intent: string;
    confidence: number;
    selectedAgent: AgentType;
  };
}

export class AgentOrchestrator {
  private claude: ClaudeAPI;
  private brainLoader: BrainLoader;
  private brainSearch: BrainSearch;
  private promptBuilder: PromptBuilder;

  private router: RouterAgent;
  private salesAgent: SalesAgent;
  private supportAgent: SupportAgent;
  private trialMeetingAgent: TrialMeetingAgent;
  private handoffAgent: HandoffAgent;

  constructor(claude: ClaudeAPI, brainLoader: BrainLoader) {
    this.claude = claude;
    this.brainLoader = brainLoader;
    this.brainSearch = new BrainSearch(brainLoader);
    this.promptBuilder = new PromptBuilder(this.brainSearch);

    // Initialize all agents
    this.router = new RouterAgent(claude, this.promptBuilder, this.brainSearch);
    this.salesAgent = new SalesAgent(claude, this.promptBuilder);
    this.supportAgent = new SupportAgent(claude, this.promptBuilder, this.brainSearch);
    this.trialMeetingAgent = new TrialMeetingAgent(claude, this.promptBuilder);
    this.handoffAgent = new HandoffAgent(this.brainSearch);
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

      // Add both the agent's message and handoff message
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

    // Add response message to conversation
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

    // Update conversation status
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

  getAllAgents(): Record<AgentType, BaseAgent> {
    return {
      router: this.router,
      sales: this.salesAgent,
      support: this.supportAgent,
      trial_meeting: this.trialMeetingAgent,
      handoff: this.handoffAgent,
    };
  }

  getBrainSearch(): BrainSearch {
    return this.brainSearch;
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
