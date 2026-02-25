import { ChannelType } from './message';

export interface Contact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  channel: ChannelType;
  channelUserId: string;
  tags: string[];
  customFields: Record<string, unknown>;
  firstSeenAt: Date;
  lastSeenAt: Date;
  conversationCount: number;
  metadata: Record<string, unknown>;
}
