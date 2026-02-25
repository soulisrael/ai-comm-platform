/**
 * Lazy singleton Supabase client.
 * Returns null if SUPABASE_URL / SUPABASE_SERVICE_KEY env vars are missing,
 * allowing graceful fallback to MemoryStore.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let initialized = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (initialized) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    initialized = true;
    client = null;
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  initialized = true;
  return client;
}

/** Reset for testing purposes. */
export function resetSupabaseClient(): void {
  client = null;
  initialized = false;
}
