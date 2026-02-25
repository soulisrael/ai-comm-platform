# Operations Runbook

## Quick Reference

| Task | Command |
|------|---------|
| Check health | `curl https://your-backend.railway.app/health` |
| View metrics | `curl https://your-backend.railway.app/metrics` |
| Run tests | `npm run test:run` |
| Deploy | `bash scripts/deploy.sh` |
| View logs | See platform dashboard (Railway/Fly.io) |

---

## System Health

### Check Health Status
```bash
curl -s https://your-backend.railway.app/health | jq
```

Response includes:
- `status`: healthy / degraded / unhealthy
- `checks`: brain, claude_api (and database/redis when configured)
- `uptime`, `memory`

### Check Prometheus Metrics
```bash
curl -s https://your-backend.railway.app/metrics
```

Key metrics:
- `messages_total` — message throughput by channel/direction
- `conversations_active` — gauge of active conversations
- `agent_response_time_seconds` — AI response latency
- `handoff_total` — human handoff count

---

## Restart Services

### Railway
```bash
railway restart
```

### Fly.io
```bash
fly apps restart ai-comm-platform
```

### Docker
```bash
docker-compose restart backend
```

---

## Rollback a Deployment

### Railway
1. Go to Railway dashboard → Deployments
2. Click on the previous successful deployment
3. Click "Rollback"

### Fly.io
```bash
fly releases
fly deploy --image <previous-image-ref>
```

### Git
```bash
git revert HEAD
git push origin main
# CI will auto-deploy the reverted commit
```

---

## Update Brain Data

1. Edit files in `brain/` directory
2. Commit and push:
   ```bash
   git add brain/
   git commit -m "Update brain data"
   git push origin main
   ```
3. CI will automatically deploy

For hot-reload without deploy, use the Brain API:
```bash
curl -X POST https://your-backend.railway.app/api/brain/entries \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category":"support","subcategory":"faq","entry":{"id":"new-faq","question":"...","answer":"..."}}'
```

---

## Add a New Team Member

1. Add their email to Supabase Auth (Dashboard → Authentication → Users)
2. Share the dashboard URL and API key
3. They can log in at `https://your-dashboard.vercel.app`

---

## Check Logs

### Railway
```bash
railway logs
```

### Fly.io
```bash
fly logs --app ai-comm-platform
```

### Local
```bash
tail -f logs/combined.log
tail -f logs/error.log
```

---

## Common Issues & Fixes

### WhatsApp Webhook Stopped Working
1. Check webhook status in Meta Developer Dashboard
2. Re-verify webhook:
   ```bash
   npm run setup:webhooks
   ```
3. Check `WHATSAPP_APP_SECRET` matches Meta app config
4. Check logs for signature validation failures

### High Response Times
1. Check Claude API status at status.anthropic.com
2. Check `agent_response_time_seconds` metric
3. If Claude is slow, responses may take 5-15s (normal for complex queries)
4. Consider adding response caching for common questions

### Messages Not Sending
1. Check channel adapter tokens are valid and not expired
2. Test manually:
   ```bash
   npm run test:whatsapp +1234567890
   ```
3. Check rate limits — WhatsApp: 80/s, Telegram: 30/s
4. Check logs for API errors: `grep "API error" logs/error.log`

### Database Connection Issues
1. Check Supabase project status at app.supabase.com
2. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
3. Server falls back to MemoryStore if Supabase is unavailable

### Redis Connection Issues
1. Check Upstash dashboard for connection status
2. Verify `REDIS_URL` is set correctly
3. BullMQ queues will fail silently — automation flows still work in-memory

### Dashboard Won't Load
1. Check Vercel deployment status
2. Verify `VITE_API_URL` points to correct backend URL
3. Check CORS: backend must allow the dashboard domain
4. Check browser console for errors

---

## Environment Variables

See `.env.production.example` for the complete list with documentation.

Required for basic operation:
- `ANTHROPIC_API_KEY` — AI agents
- `API_KEY` — dashboard/API auth

Required for persistence:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`

Required for channels:
- WhatsApp: `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`
- Instagram: `INSTAGRAM_PAGE_ID`, `INSTAGRAM_TOKEN`, `INSTAGRAM_APP_SECRET`
- Telegram: `TELEGRAM_BOT_TOKEN`
