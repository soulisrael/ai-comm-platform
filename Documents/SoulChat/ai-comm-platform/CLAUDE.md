# AI Customer Communication Platform — הנחיות ל-Claude Code

## קונספט
כל סוכן = ישות עצמאית עם מוח משלו.
המוח מכיל את כל הידע שהסוכן צריך.
ראוטר מנתב לקוחות לסוכן הנכון.

```
סוכן → מוח (כל המידע שלו)
ראוטר → מחליט מי מטפל
```

## ארכיטקטורה
- Router (מערכת) — מנתב הודעות
- Handoff (מערכת) — מעביר לנציג אנושי
- סוכנים מותאמים (DB) — כל אחד עם מוח עצמאי

## DB
- custom_agents — סוכנים שהמשתמש בונה
- agent_brain — פריטי ידע, כל פריט שייך לסוכן אחד
  categories: product, policy, faq, script, general
- conversations — כולל custom_agent_id
- messages — כולל sender_type, custom_agent_id, is_internal_note

## שפה
- כל תקשורת עם לקוחות: עברית
- דשבורד: עברית + RTL
- קוד ותיעוד טכני: אנגלית

## טכנולוגיות
Node.js + TypeScript, Express, Supabase, Claude API (Sonnet 4.5),
React + Vite + Tailwind (RTL), BullMQ + Redis, Vitest
