# Fee Dues Register — School Fee-Dues Administration Portal

A production-grade, **staff-only** portal for tracking school fee dues, chasing them
automatically by email, and confirming payments the moment a parent replies.

- **Traffic-light register** — every student's installments at a glance
  (`upcoming → reminded → overdue → under review → paid`).
- **Automated email engine** — pre-due reminders, overdue notices, and escalation,
  sent on an idempotent daily sweep.
- **Reply detection** — a parent's email reply flips the installment to *under review*;
  an accountant confirms *payment received* (green) or *not a payment* (back to red).
- **Full audit trail**, RBAC, transactional writes, and a durable job queue — with **no
  internal errors reaching the user**.

Phase 1 is used only by school staff (`ADMIN`, `ACCOUNTANT`). The architecture is built
so a future **student** or **parent** portal drops in without rework (extensible role
enum, feature modules with public service interfaces, read models kept separate from
write/domain logic).

---

## Architecture

A **pnpm monorepo** — three runnable apps over three shared packages.

```
apps/
  api/       NestJS HTTP API — auth/RBAC, CRUD, dues board, accountant actions
  worker/    NestJS worker — daily sweep, outbound email, inbound reply processing
  web/       Next.js (App Router) — the staff portal
packages/
  db/        Prisma schema, client, migrations, seed  (shared by api + worker)
  types/     Shared enums + zod DTOs + view types      (shared by api + worker + web)
  core/      Domain logic: payment state machine, sweep planner, reply matching, ports
```

**Key design choices**

- **Postgres only — no Redis, no Docker.** The durable job queue is
  [`pg-boss`](https://github.com/timgit/pg-boss) (Postgres-backed) behind a `QueuePort`
  interface, preserving retries + exponential backoff, dead-letter queues, cron
  scheduling, and idempotency. It can be swapped for BullMQ/Redis without touching
  business code.
- **Local-first email, Gmail-ready.** Outbound goes through Nodemailer; the default dev
  transport writes `.eml` files to `apps/worker/dev-mail/` so the whole demo runs with
  only Postgres. Inbound has an IMAP adapter and a Gmail-API adapter behind an
  `InboundMailPort`, selectable by config. A dev **simulate-reply** endpoint feeds the
  real matching pipeline for a no-mail-server demo.
- **One state machine, shared.** `transition(status, event)` in `packages/core` is the
  single source of truth for every status change — used identically by the API
  (accountant actions) and the worker (sweep). Illegal transitions throw a typed error.
- **Money** is stored as `Decimal(12,2)`; sums are compared in integer paise to avoid
  float drift. Currency ₹ INR, timezone `Asia/Kolkata` (both configurable).

---

## Prerequisites

- **Node.js 20+** (tested on 24).
- **pnpm** via Corepack — run `corepack enable` once (do not `npm i -g pnpm`).
- **PostgreSQL 16** running locally (a native Windows install/service is fine). Add
  `...\PostgreSQL\16\bin` to your PATH if you want the `psql`/`createdb` CLIs.

No Redis, no Docker required.

---

## Setup

```bash
# 1. Install dependencies (also generates the Prisma client)
corepack enable
pnpm install

# 2. Configure environment
cp .env.example .env
#    Edit DATABASE_URL to match your Postgres (user, password, host, port).

# 3. Create the database (any one of these)
createdb schoolportal
#    …or in psql:  CREATE DATABASE schoolportal;
#    …or via pgAdmin.

# 4. Build the shared packages, then migrate + seed
pnpm build:packages
pnpm db:migrate       # applies migrations
pnpm db:seed          # loads a demo school (see below)
```

The seed creates a demo year (2026-27), a class (**Grade 5 A**) with three ₹10,000
installments, four students, and dues covering every status — plus two staff logins:

| Role       | Email                     | Password        |
|------------|---------------------------|-----------------|
| Admin      | `admin@school.test`       | `Admin@12345`   |
| Accountant | `accountant@school.test`  | `Account@12345` |

> Change `SEED_*` in `.env` before seeding for different demo credentials.

---

## Running

Open three terminals (or run in the background):

```bash
pnpm dev:api      # NestJS API      → http://localhost:4000/api
pnpm dev:worker   # queue + sweep + email
pnpm dev:web      # Next.js portal  → http://localhost:3000
```

The web app proxies `/api/*` to the API (same-origin, so auth cookies just work).
Sign in at <http://localhost:3000/login>.

For production: `pnpm build`, then `pnpm --filter @app/db migrate:deploy`, and run
`pnpm start:api`, `pnpm start:worker`, and `pnpm --filter @app/web start`.

---

## Demo: the red → yellow → green cycle

With all three apps running and the demo seeded:

1. **See the register.** Sign in as the accountant → **Dues board**. You'll see 2 red
   (overdue), 1 yellow (a parent already replied), 1 green (paid), plus reminded/upcoming.
2. **Run the reminder sweep now** (instead of waiting for 6 AM):
   as the **admin**, `POST /api/dev/run-sweep` (or use the button-less dev endpoint via
   curl). The worker sends pre-due reminders + escalation notices; watch
   `apps/worker/dev-mail/` fill with `.eml` files. Re-running is idempotent — no duplicates.
3. **Simulate a parent reply** to an overdue installment:
   `POST /api/dev/simulate-reply` with `{ "dueId": "<an overdue due id>", "body": "We paid via UPI" }`.
   The worker matches it (by email thread) and flips the installment **yellow**; it appears
   in the **Reply queue**.
4. **Confirm it.** In the Reply queue, click **Payment received** → the installment turns
   **green** and a "payment received" email is queued to the parent. Or **Not a payment** →
   back to **red**.

Dev endpoints are gated by `DEV_ENDPOINTS_ENABLED` (`true` in the sample env; set `false`
in production).

---

## Configuration

All settings live in `.env` (validated on boot with zod — the app refuses to start on a
bad config). Highlights:

### Email — switching from dev to real delivery

- **Local demo (default):** `MAIL_TRANSPORT=dev` writes `.eml` files, no server needed.
- **Real SMTP (incl. Gmail/Workspace):** set `MAIL_TRANSPORT=smtp` and `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for Gmail use an **App Password** and
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`).

### Inbound reply detection

- **IMAP fallback:** `EMAIL_PROVIDER=smtp_imap`, `IMAP_ENABLED=true`, and the `IMAP_*`
  vars. The worker polls unseen messages on `IMAP_POLL_CRON`, parses them, matches to a
  due, and flips it yellow.
- **Gmail API (primary per the brief):** `EMAIL_PROVIDER=gmail_api` with `GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER`. The adapter uses an OAuth2
  refresh token to pull unread mail and mark it read. In a production deployment this is
  driven by `users.watch` + a Google Cloud **Pub/Sub** push subscription that enqueues an
  `inbound-poll` job (add a small HTTP push endpoint that calls the queue). The pull logic
  is identical either way.

### Reminder timing

`reminderOffsetDays` (10), `overdueGraceDays` (0), `escalationOffsetDays` (10), and the
daily sweep cron are seeded from env but stored in the DB (`AppSetting`) and editable in
**Templates & settings**. Timing changes apply on the next sweep; a changed sweep-cron
takes effect after a worker restart.

---

## Payment status state machine

| Status         | Colour  | Meaning                                             |
|----------------|---------|-----------------------------------------------------|
| `UPCOMING`     | grey    | Due far off; nothing sent.                          |
| `REMINDED`     | blue    | Pre-due reminder sent, not yet due, unpaid.         |
| `OVERDUE`      | **red** | Due date passed, unpaid (escalation stays red).     |
| `UNDER_REVIEW` | **yellow** | A parent reply arrived; awaiting confirmation.   |
| `PAID`         | **green**  | Payment confirmed. Terminal for that installment. |

Transitions and their emails live in `packages/core/src/payment/state-machine.ts` and are
exhaustively unit-tested. Two accountants acting on the same due can't both win — writes
use an optimistic status precondition (compare-and-set) and return a typed `409`.

---

## Testing

```bash
pnpm test                       # all package tests
pnpm --filter @app/core test    # domain unit tests
```

- **Unit (pure, no DB) — 47 tests, all passing:** every state-machine transition and
  guard (legal + illegal), the sweep planner's window/grace/escalation boundaries +
  idempotency + timezone correctness, and reply matching (thread / sender / ambiguous).
- **Integration flows** verified end-to-end during development against a live Postgres:
  auth + refresh-token rotation with reuse detection, RBAC (401/403), fee-sum validation,
  CSV import with per-row errors, mark-paid transaction + audit + concurrency guard, the
  idempotent sweep (reminders/overdue/escalation), reply → yellow → confirm/reject, and
  the manual "email all overdue" blast.

---

## Security & privacy

- No public registration — an admin creates staff. **RBAC enforced on every endpoint**,
  not just in the UI.
- Passwords hashed with **argon2id**; short-lived access JWT + rotating refresh tokens
  (reuse of a rotated token revokes the whole family); rate-limited auth; **httpOnly**
  cookies. Set `COOKIE_SECURE=true` and strong `JWT_*` secrets in production.
- Stores personal data of minors and parents — access is restricted to authenticated
  staff, secrets live in env, and parent contact details are **never** logged in plaintext
  (pino redaction). CSV content is validated; all DB access is parameterised via Prisma.
- Every state-changing action is recorded in the audit log (who / what / when).

---

## Troubleshooting (Windows + pnpm + Prisma)

- **`EPERM: rename … query_engine…dll`** on install — a running `api`/`worker` has the
  Prisma engine loaded. Stop them, then `pnpm --filter @app/db exec prisma generate`.
- **pnpm build-script prompts** — approvals live in `pnpm-workspace.yaml`
  (`onlyBuiltDependencies`); the listed native deps (`@prisma/*`, `@swc/core`, `esbuild`,
  `@node-rs/argon2`, `sharp`) are pre-approved.
- **Port already in use** — the API is `4000`, the web app `3000`. Free them before
  restarting.
- **`prisma migrate reset`** is intentionally blocked from non-interactive runs; the seed
  is idempotent, so `pnpm db:seed` restores the demo without a reset.
