import axios from 'axios';
import type { Message } from '../types/message';
import type { ChannelAdapter, Button, ParsedIncomingMessage } from './channel-adapter';
import logger from '../services/logger';

export class TelegramAdapter implements ChannelAdapter {
  readonly name = 'telegram' as const;
  private botToken: string;
  private secretToken: string;

  constructor(config?: { botToken?: string; secretToken?: string }) {
    this.botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.secretToken = config?.secretToken || process.env.TELEGRAM_SECRET_TOKEN || '';
  }

  private get baseUrl() {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(to: string, message: Message): Promise<void> {
    await this.post('/sendMessage', {
      chat_id: to,
      text: message.content,
      parse_mode: 'HTML',
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    await this.post('/sendPhoto', {
      chat_id: to,
      photo: imageUrl,
      ...(caption ? { caption } : {}),
    });
  }

  async sendButtons(to: string, text: string, buttons: Button[]): Promise<void> {
    await this.post('/sendMessage', {
      chat_id: to,
      text,
      reply_markup: {
        inline_keyboard: [
          buttons.map(b => ({ text: b.title, callback_data: b.id })),
        ],
      },
    });
  }

  async sendTemplate(to: string, templateName: string, params: Record<string, unknown>): Promise<void> {
    // Telegram doesn't have templates — send as plain text
    const text = (params.text as string) || templateName;
    await this.post('/sendMessage', {
      chat_id: to,
      text,
    });
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>): boolean {
    if (!this.secretToken) return true;
    const token = headers['x-telegram-bot-api-secret-token'] as string | undefined;
    return token === this.secretToken;
  }

  parseIncomingMessage(body: unknown): ParsedIncomingMessage | null {
    try {
      const update = body as any;

      // Handle regular messages
      if (update.message) {
        const msg = update.message;
        const chat = msg.chat;
        const from = msg.from;

        let content = '';
        const metadata: Record<string, unknown> = { tgMessageId: msg.message_id, tgChatId: chat.id };

        if (msg.text) {
          content = msg.text;
        } else if (msg.photo) {
          // Photo array — last element is highest resolution
          const photo = msg.photo[msg.photo.length - 1];
          content = msg.caption || '[Photo]';
          metadata.photoFileId = photo.file_id;
        } else if (msg.document) {
          content = msg.caption || `[Document: ${msg.document.file_name}]`;
          metadata.documentFileId = msg.document.file_id;
        } else {
          content = '[Unsupported message type]';
        }

        return {
          channelUserId: String(chat.id),
          content,
          senderName: [from?.first_name, from?.last_name].filter(Boolean).join(' ') || undefined,
          messageId: String(msg.message_id),
          metadata,
        };
      }

      // Handle callback queries (button clicks)
      if (update.callback_query) {
        const cb = update.callback_query;
        const chat = cb.message?.chat;

        return {
          channelUserId: String(chat?.id || cb.from?.id),
          content: cb.data || '',
          senderName: [cb.from?.first_name, cb.from?.last_name].filter(Boolean).join(' ') || undefined,
          messageId: String(cb.id),
          metadata: { callbackQueryId: cb.id, isCallback: true },
        };
      }

      return null;
    } catch (err) {
      logger.error('Telegram parse error:', err);
      return null;
    }
  }

  private async post(path: string, data: unknown): Promise<unknown> {
    try {
      const res = await axios.post(`${this.baseUrl}${path}`, data);
      return res.data;
    } catch (err: any) {
      logger.error('Telegram API error:', err.response?.data || err.message);
      throw err;
    }
  }
}
