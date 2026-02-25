import { Contact } from '../types/contact';
import { ChannelType } from '../types/message';
import { Store, MemoryStore } from './memory-store';
import logger from '../services/logger';

export class ContactManager {
  private store: Store<Contact>;

  constructor(store?: Store<Contact>) {
    this.store = store || new MemoryStore<Contact>();
  }

  getOrCreateContact(channelUserId: string, channel: ChannelType, name?: string): Contact {
    // Look for existing contact by channel + userId
    const existing = this.store.find(
      c => c.channelUserId === channelUserId && c.channel === channel
    );

    if (existing.length > 0) {
      const contact = existing[0];
      contact.lastSeenAt = new Date();
      if (name && !contact.name) {
        contact.name = name;
      }
      this.store.update(contact.id, contact);
      return contact;
    }

    // Create new contact
    const contact: Contact = {
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name || null,
      phone: null,
      email: null,
      channel,
      channelUserId,
      tags: [],
      customFields: {},
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      conversationCount: 0,
      metadata: {},
    };

    this.store.create(contact);
    logger.info(`Contact created: ${contact.id}`, { channelUserId, channel });
    return contact;
  }

  getContact(contactId: string): Contact | undefined {
    return this.store.get(contactId);
  }

  updateContact(contactId: string, data: Partial<Contact>): Contact {
    const contact = this.store.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    const updated = this.store.update(contactId, { ...data, id: contactId });
    logger.debug(`Contact updated: ${contactId}`);
    return updated;
  }

  addTag(contactId: string, tag: string): Contact {
    const contact = this.store.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
      this.store.update(contactId, contact);
      logger.debug(`Tag added to contact ${contactId}: ${tag}`);
    }
    return contact;
  }

  removeTag(contactId: string, tag: string): Contact {
    const contact = this.store.get(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    contact.tags = contact.tags.filter(t => t !== tag);
    this.store.update(contactId, contact);
    logger.debug(`Tag removed from contact ${contactId}: ${tag}`);
    return contact;
  }

  getContactHistory(contactId: string): Contact | undefined {
    return this.store.get(contactId);
  }

  incrementConversationCount(contactId: string): void {
    const contact = this.store.get(contactId);
    if (contact) {
      contact.conversationCount += 1;
      this.store.update(contactId, contact);
    }
  }

  searchContacts(query: string): Contact[] {
    const lower = query.toLowerCase();
    return this.store.find(c => {
      if (c.name && c.name.toLowerCase().includes(lower)) return true;
      if (c.phone && c.phone.includes(query)) return true;
      if (c.email && c.email.toLowerCase().includes(lower)) return true;
      if (c.channelUserId.toLowerCase().includes(lower)) return true;
      if (c.tags.some(t => t.toLowerCase().includes(lower))) return true;
      return false;
    });
  }

  getAllContacts(): Contact[] {
    return this.store.getAll();
  }
}
