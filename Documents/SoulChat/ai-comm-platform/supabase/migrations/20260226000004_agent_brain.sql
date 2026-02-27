-- ============================================================================
-- Agent Brain Migration
-- Adds agent_brain table (per-agent knowledge base).
-- Updates custom_agents with main_document columns.
-- Seeds 3 agents with brain entries.
-- Does NOT drop existing tables (topics, agent_topics remain untouched).
-- ============================================================================

-- 1. Add missing columns to custom_agents
ALTER TABLE custom_agents ADD COLUMN IF NOT EXISTS main_document_text TEXT DEFAULT NULL;
ALTER TABLE custom_agents ADD COLUMN IF NOT EXISTS main_document_filename TEXT DEFAULT NULL;

-- 2. Agent Brain table — per-agent knowledge
CREATE TABLE IF NOT EXISTS agent_brain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES custom_agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_agent_brain_agent ON agent_brain(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_brain_category ON agent_brain(agent_id, category);

-- 4. Auto-update trigger
CREATE OR REPLACE TRIGGER agent_brain_updated
  BEFORE UPDATE ON agent_brain
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Row Level Security
ALTER TABLE agent_brain ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_brain' AND policyname = 'Full access agent_brain'
  ) THEN
    CREATE POLICY "Full access agent_brain" ON agent_brain FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================================
-- Seed Data (Hebrew)
-- Delete old seed data, insert fresh agents + brain entries
-- ============================================================================

-- Clear old seed data
DELETE FROM agent_topics WHERE agent_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);
DELETE FROM agent_brain WHERE agent_id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);
DELETE FROM custom_agents WHERE id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
);

-- Agent 1: מכירות סניף קריית אונו
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

-- Agent 2: שירות לקוחות
INSERT INTO custom_agents (id, name, description, system_prompt, routing_keywords, routing_description, is_default, active, settings, handoff_rules)
VALUES (
  'a1000000-0000-0000-0000-000000000002',
  'שירות לקוחות',
  'מטפל בבעיות, תלונות, ביטולים, והחזרים של לקוחות קיימים',
  E'אתה נציג שירות לקוחות של FunKids Academy.\nתפקידך לעזור ללקוחות קיימים עם שאלות, בעיות ובקשות.\nכללים:\n- היה אמפטי ופתור בעיות\n- אם לא יכול לפתור — העבר לנציג אנושי\n- תענה בעברית\n- אל תבטיח דברים שאתה לא בטוח לגביהם',
  ARRAY['בעיה', 'תלונה', 'ביטול', 'החזר', 'שירות', 'עזרה'],
  'מטפל בבעיות, תלונות, ביטולים, והחזרים של לקוחות קיימים',
  false,
  true,
  '{"temperature": 0.7, "maxTokens": 500, "language": "Hebrew", "model": "claude-sonnet-4-5-20250929"}',
  '{"escalateWhen": ["human_request", "complaint"], "maxTurns": 20, "lowConfidenceThreshold": 0.3}'
);

-- Agent 3: סוכן כללי (ברירת מחדל)
INSERT INTO custom_agents (id, name, description, system_prompt, routing_keywords, routing_description, is_default, active, settings, handoff_rules)
VALUES (
  'a1000000-0000-0000-0000-000000000003',
  'סוכן כללי',
  'סוכן ברירת מחדל לפניות כלליות שלא ברור לאיזה סוכן שייכות',
  E'אתה קבלת הפנים של FunKids Academy.\nכשלקוח פונה ולא ברור מה הוא צריך, עזור לו להבין ותכוון אותו לסוכן הנכון.\nהסניפים שלנו: קריית אונו (מוזיקה, אנגלית, גן עם אמא) ורמת השרון (שחייה, ריקוד).\nהיה ידידותי וחם.',
  ARRAY[]::TEXT[],
  'סוכן ברירת מחדל לפניות כלליות שלא ברור לאיזה סוכן שייכות',
  true,
  true,
  '{"temperature": 0.7, "maxTokens": 500, "language": "Hebrew", "model": "claude-sonnet-4-5-20250929"}',
  '{"escalateWhen": ["human_request", "complaint"], "maxTurns": 20, "lowConfidenceThreshold": 0.3}'
);

-- ============================================================================
-- Brain entries for Agent 1: מכירות סניף קריית אונו
-- ============================================================================

INSERT INTO agent_brain (agent_id, title, content, category, metadata, sort_order) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'חוג מוזיקה',
  E'חוגי מוזיקה שבועיים לילדים גילאי 4-10.\nהילדים לומדים ריתמיקה, כלי הקשה, שירה, ויסודות מוזיקליים.\nהשיעורים כוללים: הכרת כלי נגינה, שירה בקבוצה, תנועה למוזיקה.\nלא צריך ניסיון קודם.\n\nשיעור ניסיון ראשון חינם!',
  'product',
  '{"price": "350 ש\"ח/חודש", "schedule": "ימי ראשון ורביעי 16:00-17:00", "ages": "4-10", "teacher": "יעל כהן", "groupSize": "12 ילדים"}',
  1
),
(
  'a1000000-0000-0000-0000-000000000001',
  'חוג אנגלית',
  E'חוגי אנגלית בגישה חווייתית לילדים גילאי 5-12.\nלמידה דרך משחקים, שירים, ותיאטרון.\nיש קבוצות לכל הרמות — מתחילים עד מתקדמים.\nלא צריך ידע קודם.\n\nשיעור ניסיון ראשון חינם!',
  'product',
  '{"price": "380 ש\"ח/חודש", "schedule": "ימי שני וחמישי 16:00-17:00", "ages": "5-12", "teacher": "Sarah Miller", "levels": "מתחילים, בינוניים, מתקדמים"}',
  2
),
(
  'a1000000-0000-0000-0000-000000000001',
  'גן עם אמא',
  E'פעילות גינון משותפת להורה וילד גילאי 2-6.\nבכל מפגש שותלים, מטפלים ולומדים על צמחים.\nחוויה ירוקה ומחברת! גם אבא מוזמן כמובן 😊\n\nמה להביא: בגדים שלא אכפת שיתלכלכו. הכל השאר עלינו.\n\nמפגש ניסיון ראשון חינם!',
  'product',
  '{"price": "200 ש\"ח/חודש", "schedule": "ימי שישי 09:00-10:30", "ages": "2-6", "parentRequired": "כן"}',
  3
),
(
  'a1000000-0000-0000-0000-000000000001',
  'מדיניות ביטולים והנחות',
  E'ביטול עד 14 יום לפני תחילת הקורס — החזר מלא.\nביטול תוך 14 יום — החזר 75%.\n\nהנחת אחים: 10% הנחה לילד שני מאותה משפחה.\nתשלום רבעוני: 5% הנחה.\n\nאמצעי תשלום: אשראי, ביט, או העברה בנקאית.',
  'policy',
  '{}',
  4
),
(
  'a1000000-0000-0000-0000-000000000001',
  'התנגדויות נפוצות',
  E'לקוח אומר ''יקר לי'': ''אני מבין שתקציב חשוב. שווה לדעת שיש לנו הנחת אחים של 10% ותשלום רבעוני עם 5% הנחה. בנוסף, שיעור הניסיון חינם — ככה אפשר לראות אם הילד נהנה לפני שמתחייבים.''\n\nלקוח אומר ''צריך לחשוב על זה'': ''בטח, קחו את הזמן! רק שתדעו ששיעור הניסיון חינם וללא התחייבות. אפשר פשוט לבוא ולראות אם הילד נהנה.''\n\nלקוח אומר ''יש לנו כבר חוגים'': ''מעולה שהילד פעיל! הרבה ילדים אצלנו משלבים כמה פעילויות. מה דעתך על שיעור ניסיון חינם כדי לראות?''',
  'script',
  '{}',
  5
);

-- ============================================================================
-- Brain entries for Agent 2: שירות לקוחות
-- ============================================================================

INSERT INTO agent_brain (agent_id, title, content, category, metadata, sort_order) VALUES
(
  'a1000000-0000-0000-0000-000000000002',
  'מדיניות החזרות וביטולים',
  E'ביטול עד 14 יום לפני — החזר מלא.\nביטול תוך 14 יום — 75%.\nביטול אחרי תחילת קורס — אין החזר על שיעורים שעברו.\n\nשיעור שהוחמץ: אין החזר אבל אפשר להשלים בקבוצה אחרת באותו שבוע.\n\nלביטול: צריך מספר הזמנה. אם הלקוח לא זוכר — בקש שם מלא וטלפון ותעביר לנציג.',
  'policy',
  '{}',
  1
),
(
  'a1000000-0000-0000-0000-000000000002',
  'בעיות נפוצות ופתרונות',
  E'לקוח לא קיבל אישור הרשמה: ''אני בודק את זה עכשיו. האם תוכל לשלוח לי את השם המלא ומספר הטלפון?''\n\nלקוח רוצה להחליף קבוצה: ''אשמח לעזור! למעבר בין קבוצות צריך לפנות לסניף. תרצה שאחבר אותך?''\n\nלקוח רוצה לדעת על חיוב: ''החיובים מתבצעים ב-1 לכל חודש. לפרטים על חיוב ספציפי אני צריך להעביר לצוות הכספים.''',
  'faq',
  '{}',
  2
),
(
  'a1000000-0000-0000-0000-000000000002',
  'שעות פעילות',
  E'ראשון-חמישי: 08:00-19:00\nשישי: 08:00-13:00\nשבת: סגור\n\nסניף קריית אונו: 03-1234567\nסניף רמת השרון: 09-7654321\nמייל: info@funkids.co.il',
  'general',
  '{}',
  3
),
(
  'a1000000-0000-0000-0000-000000000002',
  'מתי להעביר לנציג אנושי',
  E'תמיד תעביר לנציג אנושי כשהלקוח:\n- מבקש נציג אנושי\n- כועס מאוד (3 הודעות שליליות ברצף)\n- מבקש החזר כספי מעל 500 ש"ח\n- מדווח על בעיית בטיחות\n- מבקש לדבר עם מנהל',
  'script',
  '{}',
  4
);

-- ============================================================================
-- Brain entries for Agent 3: סוכן כללי
-- ============================================================================

INSERT INTO agent_brain (agent_id, title, content, category, metadata, sort_order) VALUES
(
  'a1000000-0000-0000-0000-000000000003',
  'מידע כללי על FunKids Academy',
  E'FunKids Academy — מרכזי פעילות לילדים.\n\nסניף קריית אונו: חוג מוזיקה, חוג אנגלית, גן עם אמא.\nסניף רמת השרון: שחייה, ריקוד.\n\nלכל הפעילויות יש שיעור ניסיון ראשון חינם!\n\nשעות פעילות: א''-ה'' 08:00-19:00, שישי 08:00-13:00.',
  'general',
  '{}',
  1
);
