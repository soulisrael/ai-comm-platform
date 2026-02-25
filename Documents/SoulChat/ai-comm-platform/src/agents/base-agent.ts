import { AgentType } from '../types/conversation';
import { AgentResponse } from '../types/agent';
import { Message } from '../types/message';
import { Conversation } from '../types/conversation';
import logger from '../services/logger';

export abstract class BaseAgent {
  public readonly name: string;
  public readonly type: AgentType;

  constructor(name: string, type: AgentType) {
    this.name = name;
    this.type = type;
  }

  abstract processMessage(
    message: Message,
    conversation: Conversation,
    brain: Record<string, unknown>
  ): Promise<AgentResponse>;

  protected buildSystemPrompt(brainData: Record<string, unknown>): string {
    return `You are the ${this.name} agent (type: ${this.type}).\n\nBrain data:\n${JSON.stringify(brainData, null, 2)}`;
  }

  protected log(level: 'error' | 'warn' | 'info' | 'debug', message: string): void {
    logger.log(level, message, { agent: this.name, agentType: this.type });
  }
}
