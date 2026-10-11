# Deployment runbook

## Where things live

| Piece                      | Host                                      | Notes                                                                              |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Frontend (`apps/web`)      | Vercel                                    | Free, static Vite build                                                            |
| Backend (`apps/api`)       | Render                                    | Free web service — **sleeps after 15 min idle**, 30–60s cold start on next request |
| Postgres                   | Neon                                      | Unrelated to either hosting provider above                                         |
| Redis                      | Upstash                                   | Rate limiting + per-project lock                                                   |
| File storage               | Cloudflare R2                             | Blob storage for file content                                                      |
| User-generated app deploys | Vercel (separate from the frontend above) | Uses `VERCEL_TOKEN` — this is Tachi deploying _other people's_ projects, not itself |

## First-time setup

1. **Render** (backend): New Web Service → root directory `apps/api` → Build Command `bun install` → Start Command `bun run start` → Health Check Path `/health`.
2. **Vercel** (frontend): New Project → root directory `apps/web` → Vite auto-detected.
3. Set `CORS_ORIGIN` (Render) to the deployed Vercel URL.
4. Set `VITE_API_URL` (Vercel) to the deployed Render URL.
5. Update the Clerk webhook endpoint to `https://<render-url>/api/webhooks/clerk`.
6. (Optional) Set up a free cron ping against `https://<render-url>/health` every ~10 minutes to reduce cold starts.

## Env vars

**Render (backend):**

```
DATABASE_URL
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
CLERK_WEBHOOK_SIGNING_SECRET
GEMINI_API_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
VERCEL_TOKEN
VERCEL_TEAM_ID        (only if the token is team-scoped)
CORS_ORIGIN            (the Vercel frontend URL)
```

**Vercel (frontend):**

```
VITE_CLERK_PUBLISHABLE_KEY
VITE_API_URL            (the Render backend URL)
```

## Redeploying

Both Render and Vercel redeploy automatically on push to your default branch. No manual steps needed for routine updates.

## Rotating a secret

1. Update the value in the provider's dashboard (Render or Vercel, as applicable).
2. Trigger a redeploy (Render: Manual Deploy → Deploy latest commit; Vercel: Redeploy from the dashboard, or just push an empty commit).
3. Env var changes don't take effect until the service restarts — editing the value alone isn't enough.

## Post-deploy smoke test

Sign up → create a project → send a chat prompt → confirm the live preview updates → revert to an earlier snapshot → export the zip. This exercises the full stack (Clerk, Neon, R2, Upstash, Gemini, Vercel deploy-of-projects) in one pass.
