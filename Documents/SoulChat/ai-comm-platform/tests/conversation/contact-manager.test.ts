import { describe, it, expect, beforeEach } from 'vitest';
import { ContactManager } from '../../src/conversation/contact-manager';

describe('ContactManager', () => {
  let manager: ContactManager;

  beforeEach(() => {
    manager = new ContactManager();
  });

  describe('getOrCreateContact', () => {
    it('should create a new contact', () => {
      const contact = manager.getOrCreateContact('user-123', 'whatsapp', 'John');

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe('John');
      expect(contact.channel).toBe('whatsapp');
      expect(contact.channelUserId).toBe('user-123');
      expect(contact.conversationCount).toBe(0);
    });

    it('should return existing contact', () => {
      const first = manager.getOrCreateContact('user-123', 'whatsapp', 'John');
      const second = manager.getOrCreateContact('user-123', 'whatsapp');

      expect(second.id).toBe(first.id);
      expect(second.name).toBe('John');
    });

    it('should update name if contact had no name', () => {
      manager.getOrCreateContact('user-123', 'whatsapp');
      const updated = manager.getOrCreateContact('user-123', 'whatsapp', 'John');

      expect(updated.name).toBe('John');
    });

    it('should update lastSeenAt on return visit', () => {
      const first = manager.getOrCreateContact('user-123', 'whatsapp');
      const firstSeen = first.lastSeenAt;

      // Small delay to ensure timestamp differs
      const second = manager.getOrCreateContact('user-123', 'whatsapp');
      expect(second.lastSeenAt.getTime()).toBeGreaterThanOrEqual(firstSeen.getTime());
    });

    it('should create separate contacts for different channels', () => {
      const wa = manager.getOrCreateContact('user-123', 'whatsapp');
      const tg = manager.getOrCreateContact('user-123', 'telegram');

      expect(wa.id).not.toBe(tg.id);
    });
  });

  describe('updateContact', () => {
    it('should update contact fields', () => {
      const contact = manager.getOrCreateContact('user-123', 'whatsapp');
      const updated = manager.updateContact(contact.id, {
        email: 'john@example.com',
        phone: '+1234567890',
      });

      expect(updated.email).toBe('john@example.com');
      expect(updated.phone).toBe('+1234567890');
    });

    it('should throw for non-existent contact', () => {
      expect(() => manager.updateContact('nonexistent', { name: 'x' })).toThrow('Contact not found');
    });
  });

  describe('tags', () => {
    it('should add a tag', () => {
      const contact = manager.getOrCreateContact('user-123', 'whatsapp');
      manager.addTag(contact.id, 'vip');

      const updated = manager.getContact(contact.id);
      expect(updated!.tags).toContain('vip');
    });

    it('should not add duplicate tags', () => {
      const contact = manager.getOrCreateContact('user-123', 'whatsapp');
      manager.addTag(contact.id, 'vip');
      manager.addTag(contact.id, 'vip');

      const updated = manager.getContact(contact.id);
      expect(updated!.tags.filter(t => t === 'vip')).toHaveLength(1);
    });

    it('should remove a tag', () => {
      const contact = manager.getOrCreateContact('user-123', 'whatsapp');
      manager.addTag(contact.id, 'vip');
      manager.addTag(contact.id, 'lead');
      manager.removeTag(contact.id, 'vip');

      const updated = manager.getContact(contact.id);
      expect(updated!.tags).not.toContain('vip');
      expect(updated!.tags).toContain('lead');
    });
  });

  describe('incrementConversationCount', () => {
    it('should increment the count', () => {
      const contact = manager.getOrCreateContact('user-123', 'whatsapp');
      expect(contact.conversationCount).toBe(0);

      manager.incrementConversationCount(contact.id);
      manager.incrementConversationCount(contact.id);

      const updated = manager.getContact(contact.id);
      expect(updated!.conversationCount).toBe(2);
    });
  });

  describe('searchContacts', () => {
    beforeEach(() => {
      const c1 = manager.getOrCreateContact('user-1', 'whatsapp', 'Alice Smith');
      manager.updateContact(c1.id, { email: 'alice@example.com', phone: '+1111111111' });
      manager.addTag(c1.id, 'vip');

      const c2 = manager.getOrCreateContact('user-2', 'telegram', 'Bob Jones');
      manager.updateContact(c2.id, { email: 'bob@example.com' });

      manager.getOrCreateContact('user-3', 'web', 'Charlie Brown');
    });

    it('should search by name', () => {
      const results = manager.searchContacts('Alice');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice Smith');
    });

    it('should search by email', () => {
      const results = manager.searchContacts('bob@example');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bob Jones');
    });

    it('should search by phone', () => {
      const results = manager.searchContacts('1111111');
      expect(results).toHaveLength(1);
    });

    it('should search by tag', () => {
      const results = manager.searchContacts('vip');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Alice Smith');
    });

    it('should return empty for no match', () => {
      const results = manager.searchContacts('zzz_no_match');
      expect(results).toHaveLength(0);
    });
  });

  describe('getAllContacts', () => {
    it('should return all contacts', () => {
      manager.getOrCreateContact('user-1', 'whatsapp');
      manager.getOrCreateContact('user-2', 'telegram');

      expect(manager.getAllContacts()).toHaveLength(2);
    });
  });
});
