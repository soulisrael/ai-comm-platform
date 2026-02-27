-- ============================================================================
-- Migration 005: Team Members, Flow Runs, WhatsApp Config
-- Adds team_members, team_roles, flow_runs, wa_config, wa_templates tables.
-- Adds new columns to flows and conversations.
-- Seeds 3 agents with brain entries, 1 admin, 1 welcome flow.
-- Does NOT drop existing tables!
-- ============================================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. Team Members
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','manager','agent')),
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online','away','busy','offline')),
  max_concurrent_chats INT DEFAULT 5,
  assigned_agents UUID[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Team Roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_roles (
  role TEXT PRIMARY KEY,
  permissions JSONB NOT NULL
);

INSERT INTO team_roles VALUES
('admin', '{"agents":["create","read","update","delete"],"brain":["create","read","update","delete"],"conversations":["read","takeover","transfer","close"],"team":["create","read","update","delete"],"flows":["create","read","update","delete"],"settings":["read","update"],"analytics":["read"]}'),
('manager', '{"agents":["read","update"],"brain":["create","read","update"],"conversations":["read","takeover","transfer","close"],"team":["read"],"flows":["read","update"],"analytics":["read"]}'),
('agent', '{"conversations":["read","takeover","transfer"],"team":[],"analytics":["read_own"]}')
ON CONFLICT (role) DO NOTHING;

-- ============================================================================
-- 3. Alter flows table (add nodes, edges, stats alongside existing steps)
-- ============================================================================

ALTER TABLE flows ADD COLUMN IF NOT EXISTS nodes JSONB DEFAULT '[]';
ALTER TABLE flows ADD COLUMN IF NOT EXISTS edges JSONB DEFAULT '[]';
ALTER TABLE flows ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{"runs": 0, "success": 0, "failed": 0}';

-- ============================================================================
-- 4. Flow Runs (node-based execution tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS flow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  conversation_id TEXT,
  contact_id TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed','paused')),
  current_node_id TEXT,
  context JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- ============================================================================
-- 5. WhatsApp Config
-- ============================================================================

CREATE TABLE IF NOT EXISTS wa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  webhook_url TEXT,
  business_name TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  last_verified_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{"autoReply": true, "batchDelay": 3000}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. WhatsApp Templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS wa_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('marketing','utility','authentication')),
  language TEXT DEFAULT 'he',
  content TEXT NOT NULL,
  header JSONB,
  footer TEXT,
  buttons JSONB DEFAULT '[]',
  meta_status TEXT DEFAULT 'pending' CHECK (meta_status IN ('pending','approved','rejected')),
  meta_template_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. Alter conversations — add new columns
-- ============================================================================

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_human_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS taken_over_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS service_window_start TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS service_window_expires TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS entry_point TEXT DEFAULT 'organic';

-- ============================================================================
-- 8. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow ON flow_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_status ON flow_runs(status);
CREATE INDEX IF NOT EXISTS idx_conversations_human ON conversations(assigned_human_id);
CREATE INDEX IF NOT EXISTS idx_conversations_window ON conversations(service_window_expires);

-- ============================================================================
-- 9. Triggers
-- ============================================================================

CREATE OR REPLACE TRIGGER team_members_updated
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER wa_config_updated
  BEFORE UPDATE ON wa_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER wa_templates_updated
  BEFORE UPDATE ON wa_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 10. Row Level Security
-- ============================================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Full access team_members') THEN
    CREATE POLICY "Full access team_members" ON team_members FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_roles' AND policyname = 'Full access team_roles') THEN
    CREATE POLICY "Full access team_roles" ON team_roles FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'flow_runs' AND policyname = 'Full access flow_runs') THEN
    CREATE POLICY "Full access flow_runs" ON flow_runs FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wa_config' AND policyname = 'Full access wa_config') THEN
    CREATE POLICY "Full access wa_config" ON wa_config FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wa_templates' AND policyname = 'Full access wa_templates') THEN
    CREATE POLICY "Full access wa_templates" ON wa_templates FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================================
-- Seed Data (Hebrew)
-- ============================================================================

-- Clear old seed data for agents
DELETE FROM agent_brain WHERE agent_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);
DELETE FROM agent_topics WHERE agent_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);
DELETE FROM custom_agents WHERE id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);

-- ── Agent 1: מכירות סניף קריית אונו ─────────────────────────────────────────

INSERT INTO custom_agents (id, name, description, system_prompt, routing_keywords, routing_description, is_default, active, settings, handoff_rules)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'מכירות סניף קריית אונו',
  'מטפל בפניות לגבי פעילויות בסניף קריית אונו: מוזיקה, אנגלית, גן עם אמא',
  E'אתה נציג מכירות ידידותי של FunKids Academy בסניף קריית אונו.\nהמטרה שלך לעזור להורים למצוא את הפעילות המתאימה לילד שלהם ולעודד אותם להירשם לשיעור ניסיון חינם.\nכללים:\n- ענה רק על מה שאתה יודע מהמוח שלך\n- אם שואלים על משהו שאתה לא יודע — אמור בנימוס ותציע לחבר לסוכן מתאים\n- תמיד הזכר שיש שיעור ניסיון חינם\n- היה חם, נלהב, ומקצועי\n- תענה בעברית\n- תשובות קצרות (2-4 משפטים) אלא אם הלקוח ביקש פירוט',
  ARRAY['קריית אונו', 'קרית אונו', 'kiryat ono'],
  'מטפל בפניות לגבי פעילויות בסניף קריית אונו: מוזיקה, אנגלית, גן עם אמא',
  false,
  true,
  '{"temperature": 0.7, "maxTokens": 500, "language": "Hebrew", "model": "claude-sonnet-4-5-20250929"}',
  '{"escalateWhen": ["human_request", "complaint"], "maxTurns": 20, "lowConfidenceThreshold": 0.3}'
);

INSERT INTO agent_brain (agent_id, title, content, category, metadata, sort_order) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'חוג מוזיקה',
  E'חוגי מוזיקה שבועיים לילדים גילאי 4-10.\nהילדים לומדים ריתמיקה, כלי הקשה, שירה, ויסודות מוזיקליים.\nשיעור ניסיון ראשון חינם!',
  'product',
  '{"price": "350 ש\"ח/חודש", "schedule": "ימי ראשון ורביעי 16:00-17:00", "ages": "4-10", "teacher": "יעל כהן", "groupSize": "12 ילדים"}',
  1
),
(
  'a1000000-0000-0000-0000-000000000001',
  'חוג אנגלית',
  E'חוגי אנגלית בגישה חווייתית לילדים גילאי 5-12.\nלמידה דרך משחקים, שירים, ותיאטרון.\nשיעור ניסיון ראשון חינם!',
  'product',
  '{"price": "380 ש\"ח/חודש", "schedule": "ימי שני וחמישי 16:00-17:00", "ages": "5-12", "teacher": "Sarah Miller"}',
  2
),
(
  'a1000000-0000-0000-0000-000000000001',
  'גן עם אמא',
  E'פעילות גינון משותפת להורה וילד גילאי 2-6.\nמפגש ניסיון ראשון חינם!',
  'product',
  '{"price": "200 ש\"ח/חודש", "schedule": "ימי שישי 09:00-10:30", "ages": "2-6"}',
  3
),
(
  'a1000000-0000-0000-0000-000000000001',
  'מדיניות ביטולים והנחות',
  E'ביטול עד 14 יום לפני — החזר מלא.\nביטול תוך 14 יום — 75%.\nהנחת אחים: 10%. תשלום רבעוני: 5% הנחה.',
  'policy',
  '{}',
  4
),
(
  'a1000000-0000-0000-0000-000000000001',
  'התנגדויות נפוצות',
  E'''יקר לי'' → הנחת אחים 10%, תשלום רבעוני 5%, שיעור ניסיון חינם.\n''צריך לחשוב'' → שיעור ניסיון חינם וללא התחייבות.',
  'script',
  '{}',
  5
);

-- ── Agent 2: שירות לקוחות ────────────────────────────────────────────────────

INSERT INTO custom_agents (id, name, description, system_prompt, routing_keywords, routing_description, is_default, active, settings, handoff_rules)
VALUES (
  'a1000000-0000-0000-0000-000000000002',
  'שירות לקוחות',
  'מטפל בבעיות, תלונות, ביטולים, והחזרים של לקוחות קיימים',
  E'אתה נציג שירות לקוחות של FunKids Academy.\nתפקידך לעזור ללקוחות קיימים.\nהיה אמפטי.\nתענה בעברית.',
  ARRAY['בעיה', 'תלונה', 'ביטול', 'החזר', 'שירות', 'עזרה'],
  'מטפל בבעיות, תלונות, ביטולים, והחזרים של לקוחות קיימים',
  false,
  true,
  '{"temperature": 0.7, "maxTokens": 500, "language": "Hebrew", "model": "claude-sonnet-4-5-20250929"}',
  '{"escalateWhen": ["human_request", "complaint"], "maxTurns": 20, "lowConfidenceThreshold": 0.3}'
);

INSERT INTO agent_brain (agent_id, title, content, category, metadata, sort_order) VALUES
(
  'a1000000-0000-0000-0000-000000000002',
  'מדיניות החזרות',
  E'ביטול עד 14 יום — החזר מלא. ביטול אחרי — אין החזר על שיעורים שעברו.',
  'policy',
  '{}',
  1
),
(
  'a1000000-0000-0000-0000-000000000002',
  'בעיות נפוצות',
  E'לא קיבל אישור → בקש שם+טלפון. רוצה להחליף קבוצה → הפנה לסניף.',
  'faq',
  '{}',
  2
),
(
  'a1000000-0000-0000-0000-000000000002',
  'שעות פעילות',
  E'א''-ה'' 08:00-19:00, שישי 08:00-13:00, שבת סגור.',
  'general',
  '{}',
  3
),
(
  'a1000000-0000-0000-0000-000000000002',
  'מתי להעביר לנציג',
  E'מבקש נציג. כועס מאוד. החזר מעל 500₪. בעיית בטיחות. מבקש מנהל.',
  'script',
  '{}',
  4
);

-- ── Agent 3: סוכן כללי (ברירת מחדל) ─────────────────────────────────────────

INSERT INTO custom_agents (id, name, description, system_prompt, routing_keywords, routing_description, is_default, active, settings, handoff_rules)
VALUES (
  'a1000000-0000-0000-0000-000000000003',
  'סוכן כללי',
  'סוכן ברירת מחדל לפניות כלליות שלא ברור לאיזה סוכן שייכות',
  E'אתה קבלת הפנים של FunKids Academy.\nעזור ללקוח להבין מה הוא צריך ותכוון לסוכן הנכון.',
  ARRAY[]::TEXT[],
  'סוכן ברירת מחדל לפניות כלליות שלא ברור לאיזה סוכן שייכות',
  true,
  true,
  '{"temperature": 0.7, "maxTokens": 500, "language": "Hebrew", "model": "claude-sonnet-4-5-20250929"}',
  '{"escalateWhen": ["human_request", "complaint"], "maxTurns": 20, "lowConfidenceThreshold": 0.3}'
);

INSERT INTO agent_brain (agent_id, title, content, category, metadata, sort_order) VALUES
(
  'a1000000-0000-0000-0000-000000000003',
  'מידע כללי',
  E'FunKids Academy — מרכזי פעילות לילדים. סניף קריית אונו: מוזיקה, אנגלית, גן עם אמא. סניף רמת השרון: שחייה, ריקוד.',
  'general',
  '{}',
  1
);

-- ── Team Seed: Admin ─────────────────────────────────────────────────────────

INSERT INTO team_members (email, name, role, password_hash) VALUES
('admin@funkids.co.il', 'מנהל המערכת', 'admin', extensions.crypt('admin123', extensions.gen_salt('bf')))
ON CONFLICT (email) DO NOTHING;

-- ── Flow Seed: Welcome ───────────────────────────────────────────────────────

INSERT INTO flows (name, description, trigger_type, trigger_config, nodes, edges, active) VALUES
(
  'ברוכים הבאים',
  'מברך לקוח חדש ומעביר לסוכן ברירת מחדל',
  'new_contact',
  '{}',
  '[{"id":"1","type":"trigger","position":{"x":0,"y":0},"data":{"label":"לקוח חדש"}},{"id":"2","type":"send_message","position":{"x":250,"y":0},"data":{"message":"שלום! ברוכים הבאים ל-FunKids Academy\nאיך אפשר לעזור?"}},{"id":"3","type":"ai_agent","position":{"x":500,"y":0},"data":{"agentId":"a1000000-0000-0000-0000-000000000003"}}]',
  '[{"id":"e1","source":"1","target":"2"},{"id":"e2","source":"2","target":"3"}]',
  true
);
