import Anthropic from '@anthropic-ai/sdk';
import logger from './logger';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface TokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_RETRIES = 3;

export class ClaudeAPI {
  private client: Anthropic;
  private usage: TokenUsage = { totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 };

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required. Set it in .env or pass it to the constructor.');
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const { systemPrompt, messages, temperature = 0.7, maxTokens = 1024, model = DEFAULT_MODEL } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        const content = response.content
          .filter(block => block.type === 'text')
          .map(block => (block as Anthropic.TextBlock).text)
          .join('');

        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;

        this.usage.totalInputTokens += inputTokens;
        this.usage.totalOutputTokens += outputTokens;
        this.usage.totalCalls += 1;

        logger.debug('Claude API call successful', {
          model,
          inputTokens,
          outputTokens,
          attempt,
        });

        return { content, inputTokens, outputTokens, model };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(`Claude API attempt ${attempt}/${MAX_RETRIES} failed`, {
          error: lastError.message,
        });

        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Claude API call failed after all retries', { error: lastError?.message });
    throw new Error(`Claude API call failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  async chatJSON<T = Record<string, unknown>>(options: ChatOptions): Promise<{ data: T } & Omit<ChatResult, 'content'>> {
    const result = await this.chat(options);

    try {
      // Extract JSON from the response — handle markdown code blocks
      let jsonStr = result.content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const data = JSON.parse(jsonStr) as T;
      return {
        data,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
      };
    } catch {
      logger.error('Failed to parse Claude response as JSON', { content: result.content.slice(0, 200) });
      throw new Error(`Failed to parse Claude response as JSON: ${result.content.slice(0, 100)}...`);
    }
  }

  getUsage(): TokenUsage {
    return { ...this.usage };
  }

  resetUsage(): void {
    this.usage = { totalInputTokens: 0, totalOutputTokens: 0, totalCalls: 0 };
  }
}
