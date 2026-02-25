import type { ChannelType, Message } from '../types/message';

export interface Button {
  id: string;
  title: string;
}

export interface ParsedIncomingMessage {
  channelUserId: string;
  content: string;
  senderName?: string;
  messageId: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  name: ChannelType;
  sendMessage(to: string, message: Message): Promise<void>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<void>;
  sendButtons(to: string, text: string, buttons: Button[]): Promise<void>;
  sendTemplate(to: string, templateName: string, params: Record<string, unknown>): Promise<void>;
  verifyWebhook(headers: Record<string, string | string[] | undefined>, body: unknown): boolean;
  parseIncomingMessage(body: unknown): ParsedIncomingMessage | null;
}
