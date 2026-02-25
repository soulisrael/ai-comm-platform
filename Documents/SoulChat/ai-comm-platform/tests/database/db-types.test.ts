import { describe, it, expect } from 'vitest';
import {
  contactToRow, contactFromRow,
  conversationToRow, conversationFromRow,
  messageToRow, messageFromRow,
  ContactRow, ConversationRow, MessageRow,
} from '../../src/database/db-types';
import { Contact } from '../../src/types/contact';
import { Conversation } from '../../src/types/conversation';
import { Message } from '../../src/types/message';

describe('db-types mapping', () => {
  describe('Contact roundtrip', () => {
    it('should convert Contact → Row → Contact without data loss', () => {
      const contact: Contact = {
        id: 'contact-1',
        name: 'Alice',
        phone: '+1234567890',
        email: 'alice@example.com',
        channel: 'web',
        channelUserId: 'user-alice',
        tags: ['vip', 'early-adopter'],
        customFields: { company: 'Acme' },
        firstSeenAt: new Date('2025-01-01T00:00:00Z'),
        lastSeenAt: new Date('2025-06-15T12:30:00Z'),
        conversationCount: 5,
        metadata: { source: 'organic' },
      };

      const row = contactToRow(contact);
      const restored = contactFromRow(row);

      expect(restored.id).toBe(contact.id);
      expect(restored.name).toBe(contact.name);
      expect(restored.phone).toBe(contact.phone);
      expect(restored.email).toBe(contact.email);
      expect(restored.channel).toBe(contact.channel);
      expect(restored.channelUserId).toBe(contact.channelUserId);
      expect(restored.tags).toEqual(contact.tags);
      expect(restored.customFields).toEqual(contact.customFields);
      expect(restored.firstSeenAt.toISOString()).toBe(contact.firstSeenAt.toISOString());
      expect(restored.lastSeenAt.toISOString()).toBe(contact.lastSeenAt.toISOString());
      expect(restored.conversationCount).toBe(contact.conversationCount);
      expect(restored.metadata).toEqual(contact.metadata);
    });

    it('should handle null fields', () => {
      const contact: Contact = {
        id: 'contact-2',
        name: null,
        phone: null,
        email: null,
        channel: 'whatsapp',
        channelUserId: 'wa-123',
        tags: [],
        customFields: {},
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        conversationCount: 0,
        metadata: {},
      };

      const row = contactToRow(contact);
      const restored = contactFromRow(row);

      expect(restored.name).toBeNull();
      expect(restored.phone).toBeNull();
      expect(restored.email).toBeNull();
    });
  });

  describe('Conversation roundtrip', () => {
    it('should convert Conversation → Row → Conversation without data loss', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        contactId: 'contact-1',
        channel: 'web',
        status: 'active',
        currentAgent: 'sales',
        messages: [],
        context: {
          intent: 'purchase',
          sentiment: 'positive',
          language: 'English',
          leadScore: 85,
          tags: ['high-value'],
          customFields: { product: 'Pro' },
        },
        startedAt: new Date('2025-03-01T10:00:00Z'),
        updatedAt: new Date('2025-03-01T10:05:00Z'),
      };

      const row = conversationToRow(conversation);
      const restored = conversationFromRow(row);

      expect(restored.id).toBe(conversation.id);
      expect(restored.contactId).toBe(conversation.contactId);
      expect(restored.channel).toBe(conversation.channel);
      expect(restored.status).toBe(conversation.status);
      expect(restored.currentAgent).toBe(conversation.currentAgent);
      expect(restored.messages).toEqual([]); // messages stored separately
      expect(restored.context.intent).toBe('purchase');
      expect(restored.context.leadScore).toBe(85);
      expect(restored.startedAt.toISOString()).toBe(conversation.startedAt.toISOString());
    });
  });

  describe('Message roundtrip', () => {
    it('should convert Message → Row → Message without data loss', () => {
      const message: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        direction: 'inbound',
        type: 'text',
        content: 'Hello, I need help!',
        channel: 'web',
        metadata: { source: 'widget' },
        timestamp: new Date('2025-03-01T10:00:00Z'),
      };

      const row = messageToRow(message);
      const restored = messageFromRow(row);

      expect(restored.id).toBe(message.id);
      expect(restored.conversationId).toBe(message.conversationId);
      expect(restored.contactId).toBe(message.contactId);
      expect(restored.direction).toBe(message.direction);
      expect(restored.type).toBe(message.type);
      expect(restored.content).toBe(message.content);
      expect(restored.channel).toBe(message.channel);
      expect(restored.metadata).toEqual(message.metadata);
      expect(restored.timestamp.toISOString()).toBe(message.timestamp.toISOString());
    });
  });

  describe('Row field naming', () => {
    it('should use snake_case in contact rows', () => {
      const contact: Contact = {
        id: 'c-1',
        name: 'Test',
        phone: null,
        email: null,
        channel: 'web',
        channelUserId: 'u-1',
        tags: [],
        customFields: {},
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        conversationCount: 0,
        metadata: {},
      };

      const row = contactToRow(contact);
      expect(row).toHaveProperty('channel_user_id');
      expect(row).toHaveProperty('custom_fields');
      expect(row).toHaveProperty('first_seen_at');
      expect(row).toHaveProperty('last_seen_at');
      expect(row).toHaveProperty('conversation_count');
      // Should NOT have camelCase
      expect(row).not.toHaveProperty('channelUserId');
      expect(row).not.toHaveProperty('customFields');
    });

    it('should use snake_case in message rows', () => {
      const message: Message = {
        id: 'm-1',
        conversationId: 'conv-1',
        contactId: 'c-1',
        direction: 'inbound',
        type: 'text',
        content: 'hi',
        channel: 'web',
        metadata: {},
        timestamp: new Date(),
      };

      const row = messageToRow(message);
      expect(row).toHaveProperty('conversation_id');
      expect(row).toHaveProperty('contact_id');
      expect(row).not.toHaveProperty('conversationId');
      expect(row).not.toHaveProperty('contactId');
    });
  });
});
