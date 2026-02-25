/**
 * Creates SupabaseStore or MemoryStore instances based on environment configuration.
 */

import { Store, MemoryStore } from '../conversation/memory-store';
import { SupabaseStore, RowMapper } from './supabase-store';
import { MessageSync } from './message-sync';
import { getSupabaseClient } from './supabase-client';
import {
  contactToRow, contactFromRow,
  conversationToRow, conversationFromRow,
} from './db-types';
import { Contact } from '../types/contact';
import { Conversation } from '../types/conversation';
import logger from '../services/logger';

export interface AppStores {
  contactStore: Store<Contact>;
  conversationStore: Store<Conversation>;
  messageSync: MessageSync | null;
}

/**
 * Create stores based on environment.
 * If SUPABASE_URL and SUPABASE_SERVICE_KEY are set, uses SupabaseStore with hydration.
 * Otherwise falls back to plain MemoryStore.
 */
export async function createStores(): Promise<AppStores> {
  const client = getSupabaseClient();

  if (!client) {
    logger.info('No Supabase credentials found. Using in-memory stores.');
    return {
      contactStore: new MemoryStore<Contact>(),
      conversationStore: new MemoryStore<Conversation>(),
      messageSync: null,
    };
  }

  logger.info('Supabase credentials found. Initializing persistent stores...');

  const contactMapper: RowMapper<Contact> = {
    toRow: (c) => contactToRow(c),
    fromRow: (row) => contactFromRow(row as any),
  };

  const conversationMapper: RowMapper<Conversation> = {
    toRow: (c) => conversationToRow(c),
    fromRow: (row) => conversationFromRow(row as any),
  };

  const contactStore = new SupabaseStore<Contact>(client, 'contacts', contactMapper);
  const conversationStore = new SupabaseStore<Conversation>(client, 'conversations', conversationMapper);

  // Hydrate caches from Supabase
  await Promise.all([
    contactStore.hydrate(),
    conversationStore.hydrate(),
  ]);

  const messageSync = new MessageSync(client);

  return { contactStore, conversationStore, messageSync };
}
