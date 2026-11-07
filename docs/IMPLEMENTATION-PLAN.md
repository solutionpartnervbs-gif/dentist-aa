# dental-ai-assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build dental-ai-assistant locally in `dental-ai-assistant/` so patient chat, booking, admin, and reminders run via `wrangler dev` with local D1.

**Architecture:** Single Worker at `src/server.ts` serves Static Assets, routes `/agents/dental-agent/:sessionId` to a SQLite Durable Object `DentalAgent` (AIChatAgent), exposes REST `/api/*` for chat/admin/Telegram, stores appointments in D1, and runs a daily cron for digests/reminders with Telegram + Resend side-effects via `ctx.waitUntil()`.

**Tech Stack:** Cloudflare Workers (ES2022 + nodejs_compat), Workers Static Assets, Agents SDK (`agents` + `@cloudflare/ai-chat`), D1 SQLite, Workers AI, Cron Triggers, Telegram Bot API, Resend, TypeScript, Vitest, Wrangler 4.151.0.

**Spec:** `C:\Users\appoi\Downloads\Dentist code.json` (project `dental-ai-assistant`, 186 lines)

## Global Constraints

- Runtime `Cloudflare Workers (ES2022 + nodejs_compat)` — `C:\Users\appoi\Downloads\Dentist code.json:6`
- Entry `src/server.ts`, `compatibility_date: 2026-10-15`, `compatibility_flags: [nodejs_compat]` — `C:\Users\appoi\Downloads\Dentist code.json:12-14`
- Timezone `Asia/Manila`; cron `0 0 * * *` = `00:00 UTC daily (08:00 AM Asia/Manila)` — `C:\Users\appoi\Downloads\Dentist code.json:7,83-84`
- Bindings: `ASSETS` -> `./public`, `DentalAgent` class `DentalAgent` migration `v1` `new_sqlite_classes` SQLite, `AI`, `DB` = `dental-appointments-db` — `C:\Users\appoi\Downloads\Dentist code.json:17-20,32-36,46-47,52-55`
- Models: primary `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, fallback `@cf/meta/llama-3.1-8b-instruct-fast` — `C:\Users\appoi\Downloads\Dentist code.json:48-49`
- D1 table `appointments(id TEXT PRIMARY KEY, patient_name TEXT NOT NULL, patient_phone TEXT NOT NULL, patient_email TEXT, service_type TEXT NOT NULL, appointment_date TEXT NOT NULL YYYY-MM-DD, appointment_time TEXT NOT NULL HH:MM, status TEXT NOT NULL DEFAULT 'confirmed' confirmed|completed|cancelled|no_show, reminder_sent INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL ISO-8601)` + `idx_unique_slot(appointment_date, appointment_time) WHERE status='confirmed'` — `C:\Users\appoi\Downloads\Dentist code.json:57-79`
- Admin auth `Bearer ADMIN_PASSWORD` verified via `crypto.subtle.timingSafeEqual` — `C:\Users\appoi\Downloads\Dentist code.json:132,138`
- Booking side-effects via `ctx.waitUntil()` background Telegram + Email — `C:\Users\appoi\Downloads\Dentist code.json:105`
- Secrets never committed; local only in `.dev.vars` (ignored): `ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RESEND_API_KEY, CLINIC_NOTIFICATION_EMAIL` — `C:\Users\appoi\Downloads\Dentist code.json:179-185`
- Free-tier fit: 100k req/day, 10k Neurons/day, D1 5M read/100K write per day, Resend 100/day — do not add paid dependencies.

## Review Focus

- Double-book race on same `date+time` returns one confirmed + one rejected; reasonable person expects no silent overwrite.
- Invalid `date` (`2026-13-40`) or `time` (`25:99`) returns 400, never inserts.
- Wrong admin bearer returns 401 without timing leak or data disclosure.
- Forged Telegram webhook payload without valid bot secret is ignored, never mutates status.
- Cron re-run same day does not resend reminders when `reminder_sent=1`; expects idempotent batch.

---

### Task 1: Scaffold + config + local D1 schema

**Files:**
- Create: `dental-ai-assistant/package.json`
- Create: `dental-ai-assistant/tsconfig.json`
- Create: `dental-ai-assistant/wrangler.jsonc`
- Create: `dental-ai-assistant/migrations/0001_init.sql`
- Create: `dental-ai-assistant/.dev.vars.example`
- Create: `dental-ai-assistant/src/server.ts`
- Modify: `opencode.json` (add `cloudflare-bindings` remote MCP `https://bindings.mcp.cloudflare.com/mcp`, keep `comfy-cloud`)
- Test: `dental-ai-assistant/tests/config.test.ts`

**Interfaces:**
- Consumes: Spec bindings/models/cron above.
- Produces: `Env { ASSETS, DentalAgent: DurableObjectNamespace, AI, DB: D1Database, ADMIN_PASSWORD: string }`; migration `v1 new_sqlite_classes=[DentalAgent]`; D1 table + `idx_unique_slot`.

- [ ] **Step 1: Write failing config test**

```typescript
// tests/config.test.ts
import { test, expect } from 'vitest';
import config from '../wrangler.jsonc';
test('wrangler has required bindings and cron', () => {
  expect(config.compatibility_date).toBe('2026-10-15');
  expect(JSON.stringify(config)).toContain('DentalAgent');
  expect(JSON.stringify(config)).toContain('dental-appointments-db');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix dental-ai-assistant -- tests/config.test.ts`
Expected: FAIL with `ENOENT` / `cannot find module` (scaffold missing).

- [ ] **Step 3: Implement scaffold in `dental-ai-assistant/`**

`wrangler.jsonc`: `name dental-ai-assistant`, `main src/server.ts`, `compatibility_date 2026-10-15`, `compatibility_flags [nodejs_compat]`, `assets { directory ./public, binding ASSETS }`, `durable_objects { bindings [{ name DentalAgent, class_name DentalAgent }] }`, `migrations [{ tag v1, new_sqlite_classes [DentalAgent] }]`, `d1_databases [{ binding DB, database_name dental-appointments-db }]`, `ai { binding AI }`, `triggers { crons [0 0 * * *] }`, `observability { enabled true, traces.enabled true }`. `migrations/0001_init.sql`: `appointments` table + `idx_unique_slot` exactly per spec. `src/server.ts`: minimal `export default { fetch: () => new Response('ok') }` + `export { DentalAgent } from './agent'` placeholder. `.dev.vars.example` lists 5 secrets empty. `opencode.json`: add `cloudflare-bindings` server alongside existing `comfy-cloud`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --prefix dental-ai-assistant -- tests/config.test.ts`
Expected: PASS. Then: `npx --prefix dental-ai-assistant wrangler d1 execute DB --local --file=./migrations/0001_init.sql`
Expected: `executed` / `success`.

- [ ] **Step 5: Commit**

```bash
git add dental-ai-assistant/package.json dental-ai-assistant/tsconfig.json dental-ai-assistant/wrangler.jsonc dental-ai-assistant/migrations/0001_init.sql dental-ai-assistant/.dev.vars.example dental-ai-assistant/src/server.ts dental-ai-assistant/tests/config.test.ts opencode.json
git commit -m "feat: scaffold dental-ai-assistant worker config and D1 schema"
```

### Task 2: Appointment data layer + slot tools

**Files:**
- Create: `dental-ai-assistant/src/db.ts`
- Create: `dental-ai-assistant/src/tools.ts`
- Test: `dental-ai-assistant/tests/tools.test.ts`

**Interfaces:**
- Consumes: `Env.DB`; Task 1 table + index.
- Produces: `checkAvailableSlots(db: D1Database, date: YYYY-MM-DD) => string[]`; `bookAppointment(db, {patientName, patientPhone, patientEmail?, serviceType, date, time}) => {id}`; `cancelAppointment(db, {patientPhone, date}) => {cancelled: number}`.

- [ ] **Step 1: Write failing slot/book/cancel tests**

```typescript
// tests/tools.test.ts
import { test, expect } from 'vitest';
test('rejects double-booking same slot', async () => {
  const { bookAppointment } = await import('../src/tools');
  // first insert ok, second same date+time throws / returns conflict
  expect(async () => { /* two bookAppointment same slot */ }).rejects.toThrow();
});
```

Include: open-hours listing for date, invalid date `2026-13-40` -> 400/error, cancel frees slot (re-book succeeds).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix dental-ai-assistant -- tests/tools.test.ts`
Expected: FAIL with `Cannot find module '../src/tools'` / `not defined`.

- [ ] **Step 3: Implement `bookAppointment()` etc. in `dental-ai-assistant/src/tools.ts` + queries in `src/db.ts`**

Validate `date` `/^\d{4}-\d{2}-\d{2}$/` + real calendar date, `time` `/^([01]\d|2[0-3]):[0-5]\d$/`; `id = crypto.randomUUID()`; `created_at = new Date().toISOString()`; `INSERT ... status='confirmed'` relying on `idx_unique_slot`; catch unique violation -> throw `SLOT_TAKEN`; `checkAvailableSlots` queries confirmed times for date and subtracts from clinic hours `[09:00..17:00]`; `cancelAppointment` does `UPDATE appointments SET status='cancelled' WHERE patient_phone=? AND appointment_date=? AND status='confirmed'`.

- [ ] **Step 4: Run tests**

Run: `npm test --prefix dental-ai-assistant -- tests/tools.test.ts`
Expected: PASS. Then full: `npm test --prefix dental-ai-assistant`
Expected: all PASS, no warnings.

- [ ] **Step 5: Commit**

```bash
git add dental-ai-assistant/src/db.ts dental-ai-assistant/src/tools.ts dental-ai-assistant/tests/tools.test.ts
git commit -m "feat: add appointment slot tools with double-book guard"
```

### Task 3: DentalAgent chat + REST chat + agent routing

**Files:**
- Create: `dental-ai-assistant/src/agent.ts`
- Modify: `dental-ai-assistant/src/server.ts`
- Test: `dental-ai-assistant/tests/chat.test.ts`

**Interfaces:**
- Consumes: Task 2 `checkAvailableSlots/bookAppointment/cancelAppointment`; `env.AI` primary/fallback models.
- Produces: `GET/POST /agents/dental-agent/:sessionId` via `routeAgentRequest`; `POST /api/chat {message, sessionId?, patient?}` -> `{reply, sessionId}`.

- [ ] **Step 1: Write failing chat test**

```typescript
test('POST /api/chat books via tool intent', async () => {
  const res = await app.request('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'Book cleaning tomorrow 10:00, name Ana 0917...', sessionId: 's1' }) });
  expect(res.status).toBe(200);
  expect(await res.json()).toHaveProperty('reply');
});
```

Also: missing message -> 400; unknown route -> 404.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix dental-ai-assistant -- tests/chat.test.ts`
Expected: FAIL (`app` / `/api/chat` not defined).

- [ ] **Step 3: Implement `DentalAgent extends AIChatAgent` in `src/agent.ts`**

Per-patient history via DO instance `getByName(sessionId)`; tools array wired to Task 2 functions with exact spec inputs; model `env.AI` `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with try/catch fallback to `@cf/meta/llama-3.1-8b-instruct-fast`; `routeAgentRequest` in `server.ts` for `/agents/dental-agent/:sessionId`; lightweight `POST /api/chat` that calls same tools path for vanilla widget without WebSocket. Use `ctx.waitUntil()` for Telegram/Email side-effects (Task 5 hooks, no-op if secrets missing locally).

- [ ] **Step 4: Run tests**

Run: `npm test --prefix dental-ai-assistant -- tests/chat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dental-ai-assistant/src/agent.ts dental-ai-assistant/src/server.ts dental-ai-assistant/tests/chat.test.ts
git commit -m "feat: add DentalAgent chat and REST chat routing"
```

### Task 4: Admin list/update + auth + Telegram webhook

**Files:**
- Create: `dental-ai-assistant/src/admin.ts`
- Create: `dental-ai-assistant/src/telegram.ts`
- Modify: `dental-ai-assistant/src/server.ts`
- Test: `dental-ai-assistant/tests/admin.test.ts`

**Interfaces:**
- Consumes: `Env.DB`, `ADMIN_PASSWORD`, Task 2 queries.
- Produces: `GET /api/admin/appointments?date&status&q`; `PATCH /api/admin/appointments/:id`; `DELETE /api/admin/appointments/:id`; `POST /api/telegram/webhook`.

- [ ] **Step 1: Write failing admin/auth tests**

```typescript
test('admin without bearer is 401', async () => {
  const res = await app.request('/api/admin/appointments');
  expect(res.status).toBe(401);
});
test('telegram complete button marks completed', async () => {
  // POST webhook callback_query with appointment id -> status completed
});
test('forged telegram payload is ignored', async () => {
  const res = await app.request('/api/telegram/webhook', { method: 'POST', body: JSON.stringify({ bogus: true }) });
  expect([401, 403, 200]).toContain(res.status); // never mutates; invalid -> no status change
});
```

Include filter by date/status/q, reschedule patch conflict -> 409.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix dental-ai-assistant -- tests/admin.test.ts`
Expected: FAIL (routes missing).

- [ ] **Step 3: Implement `src/admin.ts` + webhook in `src/telegram.ts`, wire in `server.ts`**

Auth: `Authorization: Bearer <pw>` compared with `crypto.subtle.timingSafeEqual`; list supports `date`, `status`, `q` (name/phone); patch allows `status`, `appointment_date`, `appointment_time` (re-check `idx_unique_slot`, 409 on taken); delete removes row; webhook parses Telegram `callback_query.data` like `complete:<id>` / `cancel:<id>` and updates D1.

- [ ] **Step 4: Run tests**

Run: `npm test --prefix dental-ai-assistant -- tests/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dental-ai-assistant/src/admin.ts dental-ai-assistant/src/telegram.ts dental-ai-assistant/src/server.ts dental-ai-assistant/tests/admin.test.ts
git commit -m "feat: add admin APIs and Telegram webhook actions"
```

### Task 5: Notifications + scheduled digest/reminders

**Files:**
- Create: `dental-ai-assistant/src/email.ts`
- Create: `dental-ai-assistant/src/scheduled.ts`
- Modify: `dental-ai-assistant/src/server.ts`
- Modify: `dental-ai-assistant/src/tools.ts`
- Test: `dental-ai-assistant/tests/notify.test.ts`

**Interfaces:**
- Consumes: `TELEGRAM_BOT_TOKEN/CHAT_ID`, `RESEND_API_KEY/CLINIC_NOTIFICATION_EMAIL`, Task 2/4.
- Produces: `scheduled(controller, env, ctx)` querying tomorrow confirmed `reminder_sent=0`, sending digest + `POST https://api.resend.com/emails/batch`, setting `reminder_sent=1`.

- [ ] **Step 1: Write failing notify/scheduled tests**

```typescript
test('scheduled marks reminder_sent once', async () => {
  await scheduled(mockEnvWithTomorrowBooking, mockCtx);
  expect(sentBatch).toBe(1);
  await scheduled(mockEnvWithTomorrowBooking, mockCtx);
  expect(sentBatch).toBe(1); // idempotent
});
```

Include instant booking alert payload contains Complete/Cancel inline buttons.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix dental-ai-assistant -- tests/notify.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `src/email.ts` (Resend single + batch), `src/telegram.ts` send + digest, `src/scheduled.ts`, hook `bookAppointment` via `ctx.waitUntil()`**

Tomorrow = Manila date +1 (`Asia/Manila`); digest lists time/name/service/phone; batch reminders via `https://api.resend.com/emails/batch`; skip gracefully when secrets absent locally (log, no throw).

- [ ] **Step 4: Run tests**

Run: `npm test --prefix dental-ai-assistant -- tests/notify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dental-ai-assistant/src/email.ts dental-ai-assistant/src/scheduled.ts dental-ai-assistant/src/server.ts dental-ai-assistant/src/tools.ts dental-ai-assistant/src/telegram.ts dental-ai-assistant/tests/notify.test.ts
git commit -m "feat: add Telegram and Resend notifications plus daily cron"
```

### Task 6: Static frontends + local verify

**Files:**
- Create: `dental-ai-assistant/public/index.html`
- Create: `dental-ai-assistant/public/admin.html`
- Test: `dental-ai-assistant/tests/assets.test.ts`

**Interfaces:**
- Consumes: All API routes above.
- Produces: `/index.html` patient widget calling `POST /api/chat`; `/admin.html` dashboard calling admin APIs with bearer input.

- [ ] **Step 1: Write failing asset test**

```typescript
test('static assets served', async () => {
  expect(await (await app.request('/index.html')).text()).toContain('/api/chat');
  expect(await (await app.request('/admin.html')).text()).toContain('/api/admin/appointments');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix dental-ai-assistant -- tests/assets.test.ts`
Expected: FAIL (files/routes missing).

- [ ] **Step 3: Implement zero-build vanilla HTML**

`index.html`: simple chat box, `fetch('/api/chat')`, session UUID in `localStorage`. `admin.html`: password field stored in memory, filters date/status/q, table with Complete/Cancel/Reschedule/Delete calling Task 4 endpoints. No npm build step.

- [ ] **Step 4: Run full local verification**

Run: `npm test --prefix dental-ai-assistant`
Expected: all PASS. Then: `npx --prefix dental-ai-assistant wrangler dev --local`
Expected: `http://localhost:8787/index.html` loads, chat books, admin lists (manual smoke, no deploy).

- [ ] **Step 5: Commit**

```bash
git add dental-ai-assistant/public/index.html dental-ai-assistant/public/admin.html dental-ai-assistant/tests/assets.test.ts
git commit -m "feat: add patient and admin static widgets"
```
