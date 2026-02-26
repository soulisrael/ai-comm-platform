import logger from './logger';

export interface WaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WaSenderConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

export class WhatsAppSender {
  private phoneNumberId: string;
  private accessToken: string;
  private apiBase: string;

  constructor(config: WaSenderConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
    this.apiBase = `https://graph.facebook.com/${config.apiVersion || 'v21.0'}/${config.phoneNumberId}`;
  }

  /**
   * Send a text message (only works within 24h window).
   */
  async sendMessage(to: string, text: string): Promise<WaSendResult> {
    return this.callApi('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    });
  }

  /**
   * Send a template message (works anytime, subject to Meta approval).
   */
  async sendTemplate(to: string, templateName: string, languageCode = 'he', params?: Record<string, string>[]): Promise<WaSendResult> {
    const components: any[] = [];
    if (params && params.length > 0) {
      components.push({
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: Object.values(p)[0] })),
      });
    }

    return this.callApi('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    });
  }

  /**
   * Send typing indicator (read receipt).
   */
  async sendTypingIndicator(to: string): Promise<void> {
    try {
      await this.callApi('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        to,
      });
    } catch {
      // Non-critical, ignore errors
    }
  }

  /**
   * Send media message (image, document, etc.).
   */
  async sendMediaMessage(to: string, mediaUrl: string, type: 'image' | 'document' | 'video' | 'audio', caption?: string): Promise<WaSendResult> {
    const mediaPayload: Record<string, any> = { link: mediaUrl };
    if (caption) mediaPayload.caption = caption;

    return this.callApi('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: mediaPayload,
    });
  }

  /**
   * Validate if we can send a specific message type.
   */
  validateBeforeSend(isWindowOpen: boolean, messageType: 'text' | 'template' | 'media'): { canSend: boolean; reason?: string } {
    if (messageType === 'template') {
      return { canSend: true }; // Templates always allowed
    }
    if (!isWindowOpen) {
      return { canSend: false, reason: '\u05D7\u05DC\u05D5\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA 24 \u05E9\u05E2\u05D5\u05EA \u05E1\u05D2\u05D5\u05E8. \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05DC\u05D5\u05D7 \u05E8\u05E7 \u05D4\u05D5\u05D3\u05E2\u05D5\u05EA \u05EA\u05D1\u05E0\u05D9\u05EA.' };
    }
    return { canSend: true };
  }

  private async callApi(endpoint: string, body: Record<string, any>): Promise<WaSendResult> {
    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        logger.error(`WhatsApp API error: ${errMsg}`, { endpoint, status: response.status });
        return { success: false, error: errMsg };
      }

      const messageId = data?.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`WhatsApp API call failed: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }
}
