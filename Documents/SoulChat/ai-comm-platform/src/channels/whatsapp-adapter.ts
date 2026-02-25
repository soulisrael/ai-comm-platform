import axios from 'axios';
import crypto from 'crypto';
import type { Message } from '../types/message';
import type { ChannelAdapter, Button, ParsedIncomingMessage } from './channel-adapter';
import logger from '../services/logger';

const API_VERSION = 'v17.0';

export class WhatsAppAdapter implements ChannelAdapter {
  readonly name = 'whatsapp' as const;
  private phoneNumberId: string;
  private accessToken: string;
  private appSecret: string;
  private verifyToken: string;

  constructor(config?: {
    phoneNumberId?: string;
    accessToken?: string;
    appSecret?: string;
    verifyToken?: string;
  }) {
    this.phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_ID || '';
    this.accessToken = config?.accessToken || process.env.WHATSAPP_TOKEN || '';
    this.appSecret = config?.appSecret || process.env.WHATSAPP_APP_SECRET || '';
    this.verifyToken = config?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || '';
  }

  private get baseUrl() {
    return `https://graph.facebook.com/${API_VERSION}/${this.phoneNumberId}`;
  }

  async sendMessage(to: string, message: Message): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: message.content },
    });
    await this.markAsRead(to);
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    });
  }

  async sendButtons(to: string, text: string, buttons: Button[]): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  }

  async sendTemplate(to: string, templateName: string, params: Record<string, unknown>): Promise<void> {
    await this.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: params.language || 'en' },
        components: params.components || [],
      },
    });
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): boolean {
    if (!this.appSecret) return true; // Skip validation if no secret configured
    const signature = headers['x-hub-signature-256'] as string | undefined;
    if (!signature) return false;

    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = 'sha256=' + crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  parseIncomingMessage(body: unknown): ParsedIncomingMessage | null {
    try {
      const data = body as any;
      const entry = data?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value?.messages?.[0]) return null;

      const msg = value.messages[0];
      const contact = value.contacts?.[0];

      let content = '';
      const metadata: Record<string, unknown> = { waMessageId: msg.id, type: msg.type };

      switch (msg.type) {
        case 'text':
          content = msg.text?.body || '';
          break;
        case 'image':
          content = msg.image?.caption || '[Image]';
          metadata.imageId = msg.image?.id;
          break;
        case 'button':
          content = msg.button?.text || '';
          metadata.buttonPayload = msg.button?.payload;
          break;
        case 'interactive':
          if (msg.interactive?.type === 'button_reply') {
            content = msg.interactive.button_reply?.title || '';
            metadata.buttonId = msg.interactive.button_reply?.id;
          } else if (msg.interactive?.type === 'list_reply') {
            content = msg.interactive.list_reply?.title || '';
            metadata.listId = msg.interactive.list_reply?.id;
          }
          break;
        default:
          content = `[Unsupported: ${msg.type}]`;
      }

      return {
        channelUserId: msg.from,
        content,
        senderName: contact?.profile?.name,
        messageId: msg.id,
        metadata,
      };
    } catch (err) {
      logger.error('WhatsApp parse error:', err);
      return null;
    }
  }

  private async markAsRead(messageId: string): Promise<void> {
    try {
      await this.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch {
      // Non-critical — ignore
    }
  }

  private async post(path: string, data: unknown): Promise<unknown> {
    try {
      const res = await axios.post(`${this.baseUrl}${path}`, data, {
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (err: any) {
      logger.error('WhatsApp API error:', err.response?.data || err.message);
      throw err;
    }
  }
}
