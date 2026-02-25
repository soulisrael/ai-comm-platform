import type { ContactManager } from '../../conversation/contact-manager';
import logger from '../../services/logger';

export function executeAddTag(
  config: Record<string, any>,
  context: Record<string, any>,
  contactManager: ContactManager,
): void {
  const contactId = context.contactId;
  const tag = config.tag;

  if (!contactId || !tag) {
    logger.warn('add_tag action: missing contactId or tag');
    return;
  }

  const contact = contactManager.getContact(contactId);
  if (!contact) {
    logger.warn(`add_tag action: contact not found: ${contactId}`);
    return;
  }

  const currentTags = (contact.tags || []) as string[];
  if (!currentTags.includes(tag)) {
    contactManager.updateContact(contactId, { tags: [...currentTags, tag] });
    logger.info(`Flow action: added tag "${tag}" to contact ${contactId}`);
  }
}
