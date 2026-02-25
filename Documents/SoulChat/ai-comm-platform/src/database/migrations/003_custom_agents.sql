-- ============================================================================
-- Custom Agents Migration
-- Adds custom_agents, topics, and agent_topics tables.
-- Adds custom_agent_id and human_agent_id to conversations.
-- Adds sender_type, custom_agent_id, is_internal_note to messages.
-- Run this SQL in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ============================================================================

-- 1. Custom Agents table
CREATE TABLE IF NOT EXISTS custom_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  routing_keywords TEXT[] DEFAULT '{}',
  routing_description TEXT,
  handoff_rules JSONB DEFAULT '{}',
  transfer_rules JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{"temperature": 0.7, "maxTokens": 1024, "language": "he", "model": "gpt-4"}',
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Topics table
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Agent-Topics junction table
CREATE TABLE IF NOT EXISTS agent_topics (
  agent_id UUID NOT NULL REFERENCES custom_agents(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, topic_id)
);

-- 4. ALTER conversations - add custom_agent_id and human_agent_id
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS custom_agent_id UUID REFERENCES custom_agents(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS human_agent_id TEXT;

-- 5. ALTER messages - add sender_type, custom_agent_id, is_internal_note
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'ai_agent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS custom_agent_id UUID REFERENCES custom_agents(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_internal_note BOOLEAN DEFAULT false;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_custom_agents_active ON custom_agents(active);
CREATE INDEX IF NOT EXISTS idx_agent_topics_agent ON agent_topics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_topics_topic ON agent_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_custom_agent ON conversations(custom_agent_id);

-- 7. Auto-update triggers
CREATE OR REPLACE TRIGGER trg_custom_agents_updated
  BEFORE UPDATE ON custom_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_topics_updated
  BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Row Level Security
ALTER TABLE custom_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON custom_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON agent_topics FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Seed Data (Hebrew)
-- ============================================================================

-- Agents
INSERT INTO custom_agents (id, name, description, system_prompt, routing_keywords, routing_description, is_default, active, settings) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'סניף קריית אונו',
  'סוכן המטפל בפניות לסניף קריית אונו',
  'אתה סוכן שירות לקוחות של סניף קריית אונו. ענה רק על נושאים שאתה מכיר: חוג מוזיקה, חוג אנגלית, וגן עם אמא.',
  ARRAY['קריית אונו', 'קרית אונו', 'אונו'],
  'סניף קריית אונו - חוגי מוזיקה, אנגלית, וגן עם אמא',
  false,
  true,
  '{"temperature": 0.7, "maxTokens": 1024, "language": "he", "model": "gpt-4"}'
),
(
  'a1000000-0000-0000-0000-000000000002',
  'סניף רמת השרון',
  'סוכן המטפל בפניות לסניף רמת השרון',
  'אתה סוכן שירות לקוחות של סניף רמת השרון. ענה רק על נושאים שאתה מכיר: שחייה וריקוד.',
  ARRAY['רמת השרון', 'רמת שרון'],
  'סניף רמת השרון - שחייה וריקוד',
  false,
  true,
  '{"temperature": 0.7, "maxTokens": 1024, "language": "he", "model": "gpt-4"}'
),
(
  'a1000000-0000-0000-0000-000000000003',
  'סוכן כללי',
  'סוכן ברירת מחדל שמטפל בפניות כלליות',
  'אתה סוכן שירות לקוחות כללי. עזור ללקוחות עם שאלות כלליות ונתב אותם לסניף המתאים.',
  ARRAY['כללי', 'עזרה', 'מידע'],
  'סוכן כללי - מידע כללי ומדיניות',
  true,
  true,
  '{"temperature": 0.7, "maxTokens": 1024, "language": "he", "model": "gpt-4"}'
);

-- Topics
INSERT INTO topics (id, name, description, content, is_shared) VALUES
(
  'b1000000-0000-0000-0000-000000000001',
  'חוג מוזיקה',
  'חוג מוזיקה לילדים בסניף קריית אונו',
  '{
    "description": "חוג מוזיקה לילדים - לימוד כלי נגינה, שירה ותיאוריה מוזיקלית",
    "details": "החוג מתאים לילדים בגילאי 4-12. כולל לימוד פסנתר, גיטרה, ותיאוריה מוזיקלית בסיסית.",
    "schedule": "ימים שני ורביעי, 16:00-17:00",
    "price": "350 שח לחודש",
    "faq": [
      {"question": "מאיזה גיל אפשר להתחיל?", "answer": "החוג מתאים לילדים מגיל 4."},
      {"question": "האם צריך להביא כלי נגינה?", "answer": "לא, כלי נגינה מסופקים בחוג. ניתן גם להביא כלי אישי."},
      {"question": "האם יש שיעור ניסיון?", "answer": "כן, השיעור הראשון הוא שיעור ניסיון ללא עלות."}
    ],
    "customFields": {}
  }',
  false
),
(
  'b1000000-0000-0000-0000-000000000002',
  'חוג אנגלית',
  'חוג אנגלית לילדים בסניף קריית אונו',
  '{
    "description": "חוג אנגלית לילדים - לימוד שפה באמצעות משחקים ופעילויות",
    "details": "הקורס מתמקד בדיבור, הקשבה, קריאה וכתיבה. מתאים לרמות שונות מתחילים ומתקדמים.",
    "schedule": "ימים ראשון ושלישי, 15:00-16:00",
    "price": "400 שח לחודש",
    "faq": [
      {"question": "מהי רמת האנגלית הנדרשת?", "answer": "אין צורך בידע מוקדם, יש קבוצות לכל הרמות."},
      {"question": "כמה ילדים בקבוצה?", "answer": "עד 12 ילדים בקבוצה לתשומת לב אישית."}
    ],
    "customFields": {}
  }',
  false
),
(
  'b1000000-0000-0000-0000-000000000003',
  'גן עם אמא',
  'פעילות גן עם אמא לגילאי 0-3 בסניף קריית אונו',
  '{
    "description": "גן עם אמא - פעילות משותפת להורה וילד בסביבה חמה ומעשירה",
    "details": "מפגשים שבועיים הכוללים משחק חופשי, פעילות מוזיקלית, יצירה ותנועה. מתאים לגילאי 0-3.",
    "schedule": "ימים חמישי, 09:30-11:00",
    "price": "250 שח לחודש",
    "faq": [
      {"question": "האם חייבים להגיע עם אמא?", "answer": "לא, כל מבוגר מלווה מוזמן - אבא, סבתא, סבא, או כל מטפל."},
      {"question": "מה צריך להביא?", "answer": "ביגוד נוח, כוס שתייה ונשנוש קל לילד."}
    ],
    "customFields": {}
  }',
  false
),
(
  'b1000000-0000-0000-0000-000000000004',
  'שחייה',
  'חוג שחייה בסניף רמת השרון',
  '{
    "description": "חוג שחייה לילדים ומבוגרים - בריכה מקורה ומחוממת",
    "details": "שיעורי שחייה לכל הגילאים והרמות. כולל שחייה חופשית ואימוני תחרות.",
    "schedule": "ימים שני, רביעי, שישי, 07:00-20:00",
    "price": "450 שח לחודש",
    "faq": [
      {"question": "מאיזה גיל מתחילים שיעורי שחייה?", "answer": "מגיל 3 שיעורים עם הורה, מגיל 5 שיעורים עצמאיים."},
      {"question": "האם הבריכה מחוממת?", "answer": "כן, הבריכה מקורה ומחוממת כל השנה."},
      {"question": "מה צריך להביא?", "answer": "בגד ים, מגבת, כפכפים וכובע שחייה."}
    ],
    "customFields": {}
  }',
  false
),
(
  'b1000000-0000-0000-0000-000000000005',
  'ריקוד',
  'חוג ריקוד בסניף רמת השרון',
  '{
    "description": "חוג ריקוד - סגנונות מגוונים כולל בלט, היפ הופ, וריקודי עם",
    "details": "שיעורי ריקוד לגילאי 4 ומעלה. כולל הופעות סוף שנה.",
    "schedule": "ימים שלישי וחמישי, 16:00-18:00",
    "price": "380 שח לחודש",
    "faq": [
      {"question": "איזה סגנונות ריקוד יש?", "answer": "בלט, היפ הופ, ריקודי עם, וג׳אז."},
      {"question": "האם צריך ניסיון קודם?", "answer": "לא, יש קבוצות למתחילים ולמתקדמים."}
    ],
    "customFields": {}
  }',
  false
),
(
  'b1000000-0000-0000-0000-000000000006',
  'מדיניות כללית',
  'מדיניות כללית החלה על כל הסניפים',
  '{
    "description": "מדיניות כללית - ביטולים, החזרים, שעות פעילות ותקנון",
    "details": "מדיניות הביטולים: ניתן לבטל עד 14 יום לפני תחילת הקורס להחזר מלא. מדיניות החזרים: החזר יחסי לפי חודשים שנותרו.",
    "schedule": "שעות פעילות: ראשון-חמישי 08:00-20:00, שישי 08:00-13:00",
    "price": "",
    "faq": [
      {"question": "מה מדיניות הביטולים?", "answer": "ניתן לבטל עד 14 יום לפני תחילת הקורס להחזר מלא. לאחר מכן, החזר יחסי."},
      {"question": "מה שעות הפעילות?", "answer": "ראשון עד חמישי 08:00-20:00, שישי 08:00-13:00, שבת סגור."},
      {"question": "האם יש הנחה לאחים?", "answer": "כן, 10% הנחה לילד השני ו-15% לילד השלישי ומעלה."},
      {"question": "איך יוצרים קשר?", "answer": "ניתן לפנות בווטסאפ, בטלפון 03-1234567, או במייל info@example.co.il."}
    ],
    "customFields": {}
  }',
  true
);

-- Agent-Topic links
-- קריית אונו -> מוזיקה, אנגלית, גן עם אמא, מדיניות כללית
INSERT INTO agent_topics (agent_id, topic_id) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003'),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000006');

-- רמת השרון -> שחייה, ריקוד, מדיניות כללית
INSERT INTO agent_topics (agent_id, topic_id) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004'),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005'),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006');

-- סוכן כללי -> מדיניות כללית
INSERT INTO agent_topics (agent_id, topic_id) VALUES
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000006');
