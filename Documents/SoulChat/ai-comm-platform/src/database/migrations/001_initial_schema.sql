-- ============================================================================
-- AI Communication Platform - Initial Schema
-- Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  email TEXT,
  channel TEXT NOT NULL,
  channel_user_id TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_channel_user
  ON contacts (channel, channel_user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_last_seen ON contacts (last_seen_at DESC);

-- 2. Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_agent TEXT,
  context JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations (updated_at DESC);

-- 3. Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  direction TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  channel TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages (contact_id);

-- 4. Handoffs
CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs (status);
CREATE INDEX IF NOT EXISTS idx_handoffs_conversation ON handoffs (conversation_id);

-- 5. Brain Entries
CREATE TABLE IF NOT EXISTS brain_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_entries_cat_sub
  ON brain_entries (category, subcategory);

-- 6. Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type TEXT NOT NULL,
  conversation_id TEXT REFERENCES conversations(id),
  contact_id TEXT REFERENCES contacts(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events (created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_conversations_updated
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_handoffs_updated
  BEFORE UPDATE ON handoffs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_brain_entries_updated
  BEFORE UPDATE ON brain_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (enable but allow all for service key)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Service-role policies (full access for backend)
CREATE POLICY "service_all" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON handoffs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON brain_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON analytics_events FOR ALL USING (true) WITH CHECK (true);
