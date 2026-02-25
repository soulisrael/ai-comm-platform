import { Conversation } from '../types/conversation';
import { Message } from '../types/message';
import logger from '../services/logger';

const MAX_CONTEXT_TOKENS = 50000;
const RECENT_MESSAGES_COUNT = 15;
// Rough estimate: ~4 chars per token
const CHARS_PER_TOKEN = 4;

export interface ContextWindow {
  messages: Message[];
  summary: string | null;
  totalEstimatedTokens: number;
  wasTruncated: boolean;
}

export class ContextWindowManager {
  private maxTokens: number;

  constructor(maxTokens?: number) {
    this.maxTokens = maxTokens || MAX_CONTEXT_TOKENS;
  }

  buildContext(conversation: Conversation, maxTokens?: number): ContextWindow {
    const limit = maxTokens || this.maxTokens;
    const messages = conversation.messages;

    if (messages.length === 0) {
      return { messages: [], summary: null, totalEstimatedTokens: 0, wasTruncated: false };
    }

    const totalTokens = this.estimateTokens(
      messages.map(m => m.content).join(' ')
    );

    // If short enough, return all messages
    if (totalTokens <= limit) {
      return {
        messages: [...messages],
        summary: null,
        totalEstimatedTokens: totalTokens,
        wasTruncated: false,
      };
    }

    // Too long — keep first message + recent messages, summarize the middle
    logger.debug(`Context window truncating: ${messages.length} messages, ~${totalTokens} tokens`);

    const firstMessage = messages[0];
    const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);
    const middleMessages = messages.slice(1, messages.length - RECENT_MESSAGES_COUNT);

    const summary = this.summarizeMessages(middleMessages);

    const contextMessages = [firstMessage, ...recentMessages];
    const contextTokens = this.estimateTokens(
      contextMessages.map(m => m.content).join(' ') + (summary || '')
    );

    return {
      messages: contextMessages,
      summary,
      totalEstimatedTokens: contextTokens,
      wasTruncated: true,
    };
  }

  summarizeMessages(messages: Message[]): string {
    if (messages.length === 0) return '';

    // Local summarization (no API call) — extracts key points
    const inbound = messages.filter(m => m.direction === 'inbound');
    const outbound = messages.filter(m => m.direction === 'outbound');

    const parts: string[] = [];
    parts.push(`[Summary of ${messages.length} earlier messages]`);

    if (inbound.length > 0) {
      const topics = inbound
        .map(m => m.content.slice(0, 80))
        .slice(0, 5);
      parts.push(`Customer discussed: ${topics.join('; ')}`);
    }

    if (outbound.length > 0) {
      const responses = outbound
        .map(m => m.content.slice(0, 80))
        .slice(0, 3);
      parts.push(`Agent responded about: ${responses.join('; ')}`);
    }

    return parts.join('\n');
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  getMaxTokens(): number {
    return this.maxTokens;
  }
}
