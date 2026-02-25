import axios from 'axios';
import crypto from 'crypto';
import type { Message } from '../types/message';
import type { ChannelAdapter, Button, ParsedIncomingMessage } from './channel-adapter';
import logger from '../services/logger';

const API_VERSION = 'v17.0';

export class InstagramAdapter implements ChannelAdapter {
  readonly name = 'instagram' as const;
  private pageId: string;
  private accessToken: string;
  private appSecret: string;
  private verifyToken: string;

  constructor(config?: {
    pageId?: string;
    accessToken?: string;
    appSecret?: string;
    verifyToken?: string;
  }) {
    this.pageId = config?.pageId || process.env.INSTAGRAM_PAGE_ID || '';
    this.accessToken = config?.accessToken || process.env.INSTAGRAM_TOKEN || '';
    this.appSecret = config?.appSecret || process.env.INSTAGRAM_APP_SECRET || '';
    this.verifyToken = config?.verifyToken || process.env.INSTAGRAM_VERIFY_TOKEN || '';
  }

  private get baseUrl() {
    return `https://graph.facebook.com/${API_VERSION}/${this.pageId}`;
  }

  async sendMessage(to: string, message: Message): Promise<void> {
    await this.post('/messages', {
      recipient: { id: to },
      message: { text: message.content },
      messaging_type: 'RESPONSE',
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    // Send image as attachment
    await this.post('/messages', {
      recipient: { id: to },
      message: {
        attachment: {
          type: 'image',
          payload: { url: imageUrl },
        },
      },
    });
    // Send caption as separate text if provided
    if (caption) {
      await this.post('/messages', {
        recipient: { id: to },
        message: { text: caption },
      });
    }
  }

  async sendButtons(to: string, text: string, _buttons: Button[]): Promise<void> {
    // Instagram has limited button support in DMs — fall back to text
    await this.post('/messages', {
      recipient: { id: to },
      message: { text },
    });
  }

  async sendTemplate(to: string, templateName: string, params: Record<string, unknown>): Promise<void> {
    // Instagram uses human_agent tag for messages outside 24h window
    await this.post('/messages', {
      recipient: { id: to },
      message: { text: (params.text as string) || templateName },
      tag: 'HUMAN_AGENT',
    });
  }

  verifyWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): boolean {
    if (!this.appSecret) return true;
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
      const messaging = entry?.messaging?.[0];

      if (!messaging?.message) return null;

      const senderId = messaging.sender?.id;
      const msg = messaging.message;

      let content = '';
      const metadata: Record<string, unknown> = { igMessageId: msg.mid };

      if (msg.text) {
        content = msg.text;
      } else if (msg.attachments?.[0]) {
        const att = msg.attachments[0];
        content = att.type === 'image' ? '[Image]' : `[${att.type}]`;
        metadata.attachmentUrl = att.payload?.url;
        metadata.attachmentType = att.type;
      } else {
        return null;
      }

      return {
        channelUserId: senderId,
        content,
        messageId: msg.mid,
        metadata,
      };
    } catch (err) {
      logger.error('Instagram parse error:', err);
      return null;
    }
  }

  private async post(path: string, data: unknown): Promise<unknown> {
    try {
      const res = await axios.post(`${this.baseUrl}${path}`, data, {
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        params: { access_token: this.accessToken },
      });
      return res.data;
    } catch (err: any) {
      logger.error('Instagram API error:', err.response?.data || err.message);
      throw err;
    }
  }
}
