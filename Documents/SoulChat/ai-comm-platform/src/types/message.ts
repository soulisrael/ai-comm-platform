export type MessageDirection = 'inbound' | 'outbound';

export type MessageType = 'text' | 'image' | 'button' | 'template' | 'system';

export type ChannelType = 'whatsapp' | 'instagram' | 'telegram' | 'web';

export interface Message {
  id: string;
  conversationId: string;
  contactId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  channel: ChannelType;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface IncomingMessage extends Message {
  direction: 'inbound';
}

export interface OutgoingMessage extends Message {
  direction: 'outbound';
}

// Type guards
export function isIncomingMessage(message: Message): message is IncomingMessage {
  return message.direction === 'inbound';
}

export function isOutgoingMessage(message: Message): message is OutgoingMessage {
  return message.direction === 'outbound';
}

// Factory helper
export function createMessage(params: Omit<Message, 'id' | 'timestamp'> & { id?: string; timestamp?: Date }): Message {
  return {
    id: params.id ?? crypto.randomUUID(),
    timestamp: params.timestamp ?? new Date(),
    ...params,
  };
}
