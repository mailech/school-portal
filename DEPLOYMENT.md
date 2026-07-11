# Deployment — Vercel (frontend) + Render (backend), free tier

This app splits cleanly: the Next.js frontend goes on **Vercel** (always-on, free),
and the backend (**NestJS API + worker**) runs as **one Render free web service**.
Because Render's free tier sleeps after 15 min idle, we keep it awake with a free
external pinger — which also keeps the worker's scheduler (daily sweep, email queue,
reply detection) running.

```
 Browser ──▶ Vercel (apps/web)  ──/api/* proxy──▶  Render web service
                                                    ├─ NestJS API (listens on $PORT)
                                                    └─ Worker (sweep + email + replies)
                                                          │
                                            Neon / Supabase Postgres  (data + pg-boss queue)
            UptimeRobot ──ping /api/health every 10m──▶ (keeps it warm)
```

Why one combined service: Render's free tier bills per always-on service (~750
instance-hours/month ≈ one service) and does **not** include free Background Workers.
So the API and worker run together in a single instance via `scripts/start-prod.mjs`.

---

## 1. Database — Neon (persistent free Postgres)

Render's own free Postgres expires, so use **Neon** (or Supabase). Both your app
data *and* the pg-boss job queue live here, so it must persist.

1. Create a project at https://neon.tech → copy the **pooled** connection string.
2. Ensure it ends with `?sslmode=require`.

## 2. Backend — Render

1. Push this repo to GitHub (see bottom) and connect it at https://render.com →
   **New ▸ Blueprint**. Render reads [`render.yaml`](render.yaml) and creates the
   `school-portal-backend` web service.
2. Set the `sync: false` env vars in the dashboard:
   - `DATABASE_URL` → your Neon string
   - `WEB_ORIGIN` → your Vercel URL (e.g. `https://school-portal.vercel.app`)
   - `MAIL_FROM`, `MAIL_REPLY_TO` (any address for now; `MAIL_TRANSPORT=dev` won't send)
   - `JWT_*` secrets auto-generate; `COOKIE_DOMAIN` is intentionally empty.
3. First deploy runs `prisma migrate deploy` automatically, then boots API + worker.
   Note the service URL, e.g. `https://school-portal-backend.onrender.com`.

### Create the first login (one-time seed)
A fresh DB has no users. From your machine, seed against Neon once:

```powershell
$env:DATABASE_URL="<your-neon-url>"
$env:SEED_ADMIN_EMAIL="admin@yourschool.com"
$env:SEED_ADMIN_PASSWORD="a-strong-password"
$env:SEED_ACCOUNTANT_EMAIL="accountant@yourschool.com"
$env:SEED_ACCOUNTANT_PASSWORD="a-strong-password"
pnpm db:seed:ci
```

(The seed is idempotent and also loads demo dues so the board isn't empty.)

## 3. Frontend — Vercel

1. https://vercel.com → **Add New ▸ Project** → import this repo.
2. Set **Root Directory** to `apps/web`.
3. Add env var **`API_URL`** = your Render URL (`https://school-portal-backend.onrender.com`).
4. Deploy. Next.js proxies `/api/*` to the backend, so auth cookies stay same-origin.

Then set the backend's `WEB_ORIGIN` to the Vercel URL and redeploy the backend.

## 4. Keep it warm (the "works continuously / fast in production" bit)

Render free sleeps after 15 min idle (≈50s cold start). Add a free pinger:

- **UptimeRobot** (https://uptimerobot.com): New Monitor ▸ HTTP(s) ▸
  URL `https://school-portal-backend.onrender.com/api/health` ▸ interval **5 min**.
- or **cron-job.org**: same URL, every 10 min.

This keeps the instance (and the worker's cron/queue) alive, so production responds
instantly instead of cold-starting. *(Vercel Cron on the free plan runs only once a
day, so it can't be the pinger.)*

---

## Notes & limits (free tier honesty)

- **512 MB RAM** on Render free hosts both processes. It fits for light use; if it
  ever OOMs, the fix is to fold the worker's scheduler into the API process (or move
  the worker to a small paid instance).
- **Real email:** default `MAIL_TRANSPORT=dev` does not deliver. For real reminders,
  set `MAIL_TRANSPORT=smtp` + `SMTP_HOST/PORT/USER/PASS` (Gmail: an App Password,
  `smtp.gmail.com:465`, `SMTP_SECURE=true`).
- **Reply detection:** enable IMAP (`IMAP_ENABLED=true` + `IMAP_*`) or Gmail API to
  detect real parent replies; otherwise use the dev simulate-reply flow (needs
  `DEV_ENDPOINTS_ENABLED=true`, which is off by default in production).
- Nothing from the original app was removed — this only adds a combined production
  launcher, a Render blueprint, CI-safe db scripts, and this guide.
```
