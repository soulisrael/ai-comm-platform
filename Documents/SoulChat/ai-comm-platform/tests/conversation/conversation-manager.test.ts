import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from '../../src/conversation/conversation-manager';
import { createMessage } from '../../src/types/message';

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  describe('startConversation', () => {
    it('should create a new conversation', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');

      expect(conv.id).toBeDefined();
      expect(conv.contactId).toBe('contact-1');
      expect(conv.channel).toBe('whatsapp');
      expect(conv.status).toBe('active');
      expect(conv.currentAgent).toBeNull();
      expect(conv.messages).toHaveLength(0);
    });
  });

  describe('getConversation', () => {
    it('should retrieve a conversation by ID', () => {
      const created = manager.startConversation('contact-1', 'whatsapp');
      const found = manager.getConversation(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should return undefined for non-existent ID', () => {
      expect(manager.getConversation('nonexistent')).toBeUndefined();
    });
  });

  describe('getActiveConversation', () => {
    it('should find active conversation for a contact', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      const found = manager.getActiveConversation('contact-1');

      expect(found).toBeDefined();
      expect(found!.id).toBe(conv.id);
    });

    it('should return undefined if no active conversation', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      manager.closeConversation(conv.id);

      expect(manager.getActiveConversation('contact-1')).toBeUndefined();
    });

    it('should find waiting conversations as active', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      manager.updateStatus(conv.id, 'waiting');

      const found = manager.getActiveConversation('contact-1');
      expect(found).toBeDefined();
    });
  });

  describe('addMessage', () => {
    it('should add a message to a conversation', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      const msg = createMessage({
        conversationId: conv.id,
        contactId: 'contact-1',
        direction: 'inbound',
        type: 'text',
        content: 'Hello!',
        channel: 'whatsapp',
        metadata: {},
      });

      const updated = manager.addMessage(conv.id, msg);
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].content).toBe('Hello!');
    });

    it('should throw for non-existent conversation', () => {
      const msg = createMessage({
        conversationId: 'nonexistent',
        contactId: 'contact-1',
        direction: 'inbound',
        type: 'text',
        content: 'Hello!',
        channel: 'whatsapp',
        metadata: {},
      });

      expect(() => manager.addMessage('nonexistent', msg)).toThrow('Conversation not found');
    });
  });

  describe('updateStatus', () => {
    it('should update conversation status', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      manager.updateStatus(conv.id, 'handoff');

      const updated = manager.getConversation(conv.id);
      expect(updated!.status).toBe('handoff');
    });
  });

  describe('closeConversation', () => {
    it('should close a conversation with reason', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      manager.closeConversation(conv.id, 'resolved');

      const closed = manager.getConversation(conv.id);
      expect(closed!.status).toBe('closed');
      expect(closed!.context.customFields.closeReason).toBe('resolved');
    });
  });

  describe('getConversationHistory', () => {
    it('should return all messages', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      for (let i = 0; i < 5; i++) {
        manager.addMessage(conv.id, createMessage({
          conversationId: conv.id,
          contactId: 'contact-1',
          direction: 'inbound',
          type: 'text',
          content: `Message ${i}`,
          channel: 'whatsapp',
          metadata: {},
        }));
      }

      const history = manager.getConversationHistory(conv.id);
      expect(history).toHaveLength(5);
    });

    it('should respect limit parameter', () => {
      const conv = manager.startConversation('contact-1', 'whatsapp');
      for (let i = 0; i < 10; i++) {
        manager.addMessage(conv.id, createMessage({
          conversationId: conv.id,
          contactId: 'contact-1',
          direction: 'inbound',
          type: 'text',
          content: `Message ${i}`,
          channel: 'whatsapp',
          metadata: {},
        }));
      }

      const history = manager.getConversationHistory(conv.id, 3);
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Message 7');
    });
  });

  describe('findConversations', () => {
    it('should filter by status', () => {
      manager.startConversation('contact-1', 'whatsapp');
      const conv2 = manager.startConversation('contact-2', 'telegram');
      manager.updateStatus(conv2.id, 'handoff');

      const handoffs = manager.findConversations({ status: 'handoff' });
      expect(handoffs).toHaveLength(1);
      expect(handoffs[0].contactId).toBe('contact-2');
    });

    it('should filter by channel', () => {
      manager.startConversation('contact-1', 'whatsapp');
      manager.startConversation('contact-2', 'telegram');

      const telegram = manager.findConversations({ channel: 'telegram' });
      expect(telegram).toHaveLength(1);
    });

    it('should filter by contactId', () => {
      manager.startConversation('contact-1', 'whatsapp');
      manager.startConversation('contact-2', 'whatsapp');

      const results = manager.findConversations({ contactId: 'contact-1' });
      expect(results).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return correct counts', () => {
      manager.startConversation('c1', 'whatsapp');
      const conv2 = manager.startConversation('c2', 'telegram');
      manager.updateStatus(conv2.id, 'waiting');
      const conv3 = manager.startConversation('c3', 'web');
      manager.updateStatus(conv3.id, 'handoff');
      const conv4 = manager.startConversation('c4', 'instagram');
      manager.closeConversation(conv4.id);

      const stats = manager.getStats();
      expect(stats.total).toBe(4);
      expect(stats.active).toBe(1);
      expect(stats.waiting).toBe(1);
      expect(stats.handoff).toBe(1);
      expect(stats.closed).toBe(1);
    });
  });
});
