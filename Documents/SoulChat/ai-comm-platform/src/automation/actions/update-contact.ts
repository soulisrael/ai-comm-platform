import type { ContactManager } from '../../conversation/contact-manager';
import logger from '../../services/logger';

export function executeUpdateContact(
  config: Record<string, any>,
  context: Record<string, any>,
  contactManager: ContactManager,
): void {
  const contactId = context.contactId;
  if (!contactId) {
    logger.warn('update_contact action: missing contactId');
    return;
  }

  const updates: Record<string, any> = {};
  if (config.name !== undefined) updates.name = config.name;
  if (config.email !== undefined) updates.email = config.email;
  if (config.phone !== undefined) updates.phone = config.phone;
  if (config.metadata !== undefined) updates.metadata = config.metadata;

  if (Object.keys(updates).length === 0) {
    logger.warn('update_contact action: no fields to update');
    return;
  }

  contactManager.updateContact(contactId, updates);
  logger.info(`Flow action: updated contact ${contactId}`, { fields: Object.keys(updates) });
}
