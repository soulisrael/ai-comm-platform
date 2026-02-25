/**
 * Persists messages to the separate `messages` table in Supabase.
 * Messages are stored in-memory on Conversation objects but also
 * need their own table for querying, analytics, and history.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Message } from '../types/message';
import { messageToRow } from './db-types';
import logger from '../services/logger';

export class MessageSync {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Persist a single message (fire-and-forget). */
  persistMessage(message: Message): void {
    const row = messageToRow(message);
    this.client
      .from('messages')
      .upsert(row)
      .then(({ error }) => {
        if (error) {
          logger.error(`MessageSync persist error (${message.id}):`, error);
        }
      });
  }

  /** Load all messages for a conversation from the database. */
  async loadConversationMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) {
      logger.error(`MessageSync load error (${conversationId}):`, error);
      return [];
    }

    const { messageFromRow } = await import('./db-types');
    return (data || []).map(messageFromRow);
  }
}
