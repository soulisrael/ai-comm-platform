import { describe, it, expect } from 'vitest';
import { MemoryStore, Store } from '../../src/conversation/memory-store';
import { ConversationManager } from '../../src/conversation/conversation-manager';
import { ContactManager } from '../../src/conversation/contact-manager';
import { Conversation } from '../../src/types/conversation';
import { Contact } from '../../src/types/contact';

describe('Store<T> interface integration', () => {
  describe('ConversationManager with Store<Conversation>', () => {
    it('should accept a MemoryStore via Store interface', () => {
      const store: Store<Conversation> = new MemoryStore<Conversation>();
      const manager = new ConversationManager(store);

      const conversation = manager.startConversation('contact-1', 'web');

      expect(conversation.id).toBeDefined();
      expect(conversation.contactId).toBe('contact-1');
      expect(conversation.status).toBe('active');
    });

    it('should work with all manager operations', () => {
      const store: Store<Conversation> = new MemoryStore<Conversation>();
      const manager = new ConversationManager(store);

      // Start conversation
      const conv = manager.startConversation('contact-1', 'web');

      // Get it back
      const fetched = manager.getConversation(conv.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(conv.id);

      // Update status
      manager.updateStatus(conv.id, 'handoff');
      const updated = manager.getConversation(conv.id);
      expect(updated!.status).toBe('handoff');

      // Close
      manager.closeConversation(conv.id, 'resolved');
      const closed = manager.getConversation(conv.id);
      expect(closed!.status).toBe('closed');
    });

    it('should find conversations with filters', () => {
      const store: Store<Conversation> = new MemoryStore<Conversation>();
      const manager = new ConversationManager(store);

      manager.startConversation('c1', 'web');
      manager.startConversation('c2', 'whatsapp');
      manager.startConversation('c3', 'web');

      const webConvs = manager.findConversations({ channel: 'web' });
      expect(webConvs).toHaveLength(2);

      const allConvs = manager.getAllConversations();
      expect(allConvs).toHaveLength(3);
    });

    it('should return stats', () => {
      const store: Store<Conversation> = new MemoryStore<Conversation>();
      const manager = new ConversationManager(store);

      const conv1 = manager.startConversation('c1', 'web');
      manager.startConversation('c2', 'web');

      manager.updateStatus(conv1.id, 'closed');

      const stats = manager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1);
      expect(stats.closed).toBe(1);
    });
  });

  describe('ContactManager with Store<Contact>', () => {
    it('should accept a MemoryStore via Store interface', () => {
      const store: Store<Contact> = new MemoryStore<Contact>();
      const manager = new ContactManager(store);

      const contact = manager.getOrCreateContact('user-1', 'web', 'Alice');

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe('Alice');
      expect(contact.channelUserId).toBe('user-1');
    });

    it('should reuse existing contacts', () => {
      const store: Store<Contact> = new MemoryStore<Contact>();
      const manager = new ContactManager(store);

      const c1 = manager.getOrCreateContact('user-1', 'web', 'Alice');
      const c2 = manager.getOrCreateContact('user-1', 'web');

      expect(c1.id).toBe(c2.id);
    });

    it('should manage tags', () => {
      const store: Store<Contact> = new MemoryStore<Contact>();
      const manager = new ContactManager(store);

      const contact = manager.getOrCreateContact('user-1', 'web');
      manager.addTag(contact.id, 'vip');
      manager.addTag(contact.id, 'premium');

      const updated = manager.getContact(contact.id);
      expect(updated!.tags).toContain('vip');
      expect(updated!.tags).toContain('premium');

      manager.removeTag(contact.id, 'vip');
      const afterRemove = manager.getContact(contact.id);
      expect(afterRemove!.tags).not.toContain('vip');
      expect(afterRemove!.tags).toContain('premium');
    });

    it('should search contacts', () => {
      const store: Store<Contact> = new MemoryStore<Contact>();
      const manager = new ContactManager(store);

      manager.getOrCreateContact('user-1', 'web', 'Alice Smith');
      manager.getOrCreateContact('user-2', 'web', 'Bob Jones');
      manager.getOrCreateContact('user-3', 'whatsapp', 'Alice Cooper');

      const results = manager.searchContacts('Alice');
      expect(results).toHaveLength(2);
    });

    it('should increment conversation count', () => {
      const store: Store<Contact> = new MemoryStore<Contact>();
      const manager = new ContactManager(store);

      const contact = manager.getOrCreateContact('user-1', 'web');
      expect(contact.conversationCount).toBe(0);

      manager.incrementConversationCount(contact.id);
      manager.incrementConversationCount(contact.id);

      const updated = manager.getContact(contact.id);
      expect(updated!.conversationCount).toBe(2);
    });
  });

  describe('Default store creation', () => {
    it('ConversationManager creates MemoryStore if none provided', () => {
      const manager = new ConversationManager();
      const conv = manager.startConversation('c1', 'web');
      expect(conv).toBeDefined();
    });

    it('ContactManager creates MemoryStore if none provided', () => {
      const manager = new ContactManager();
      const contact = manager.getOrCreateContact('u1', 'web');
      expect(contact).toBeDefined();
    });
  });
});
