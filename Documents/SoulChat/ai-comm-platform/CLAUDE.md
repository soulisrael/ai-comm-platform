# AI Customer Communication Platform — הנחיות ל-Claude Code

## קונספט
כל סוכן AI = ישות עצמאית עם מוח משלו.
המוח מכיל את כל הידע שהסוכן צריך.
ראוטר מנתב לקוחות לסוכן הנכון.
נציגים אנושיים יכולים לקחת שליטה על שיחות.
Flows ויזואליים מנהלים אוטומציות עם nodes וחצים.

## ארכיטקטורה
- Router (מערכת) — מנתב הודעות לסוכן הנכון
- Handoff (מערכת) — מעביר לנציג אנושי
- סוכנים מותאמים (DB) — כל אחד עם מוח עצמאי
- FlowEngine — מריץ אוטומציות ויזואליות
- MessageBatcher — מאחד הודעות ברצף (debounce 3s)

## DB Tables
- `custom_agents` — סוכנים שהמשתמש בונה
- `agent_brain` — פריטי ידע, כל פריט שייך לסוכן אחד
  categories: product, policy, faq, script, general
- `team_members` — נציגים אנושיים (admin/manager/agent)
- `team_roles` — הרשאות לפי תפקיד
- `flows` — אוטומציות ויזואליות (nodes + edges JSON)
- `flow_runs` — ריצות של flows
- `wa_config` — הגדרות WhatsApp Cloud API
- `wa_templates` — תבניות הודעה מאושרות
- `conversations` — כולל custom_agent_id, assigned_human_id, service_window_expires
- `messages` — כולל sender_type, custom_agent_id, is_internal_note

## WhatsApp Rules
- חלון שירות 24h מהודעת לקוח אחרונה (72h מ-CTWA ads)
- בתוך חלון: free-form + utility templates = חינם
- מחוץ לחלון: רק template messages מאושרים (בתשלום)
- Marketing + Authentication = תמיד בתשלום
- Message batching: debounce 3s למניעת תשובות מרובות

## שפה
- כל תקשורת עם לקוחות: עברית
- דשבורד: עברית + RTL
- קוד ותיעוד טכני: אנגלית

## Cost Optimization (קריטי!)
כל קריאה ל-Claude API חייבת לכלול:
1. **Prompt Caching**: cache_control: { type: "ephemeral" } על system prompt + מוח
2. **Smart Router**: keyword match לפני Claude call (חוסך 70% קריאות)
3. **History Trimming**: מקסימום 10 הודעות, 2000 tokens
4. **Relevant Brain**: אם מעל 6 פריטי מוח → שלח רק רלוונטיים + scripts/policies
5. **max_tokens**: 300 לסוכן, 100 לראוטר, 500 לבדיקה
6. **Cost Tracking**: לוג כל קריאה עם tokens + cache hit/miss

## טכנולוגיות
Node.js + TypeScript, Express, Supabase, Claude API (Sonnet 4.5),
React + Vite + Tailwind (RTL), React Flow (flows), BullMQ + Redis, Vitest

## Dashboard Pages
- 🏠 ראשי — סטטיסטיקות כלליות + לפי סוכן
- 🤖 סוכנים — בונה סוכנים + עורך מוח
- 💬 צ'אט חי — 3 פאנלים RTL + חלון 24h + שליטה אנושית
- ⚡ אוטומציות — Flow Builder ויזואלי (React Flow)
- 👥 צוות — ניהול נציגים, תפקידים, שיוכים
- 📱 WhatsApp — חיבור, תבניות, סטטוס חלון
- 👥 אנשי קשר
- 📊 אנליטיקס
- ⚙️ הגדרות
