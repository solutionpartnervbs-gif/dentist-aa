# Suyat Dental Clinic — 24/7 Online AI Receptionist & Booking System

An intelligent, full-stack clinic receptionist and patient appointment management system powered by **Cloudflare Workers**, **Workers AI**, **Agents SDK (`@cloudflare/ai-chat`)**, and **SQLite D1**.

---

## 🌟 Features

1. **Online booking site (`/`, React frontend in `web/`) with a booking form and a virtual assistant**
   - Natural conversational appointment bookings, slot availability inquiries, cancellations, and rescheduling.
   - Dual-branch intelligence:
     - **San Nicolas, Pangasinan**: Monday – Tuesday (9:00 AM – 6:00 PM)
     - **Project 6, Quezon City**: Wednesday – Saturday (10:00 AM – 6:00 PM)

2. **Official Proof of Appointment & Digital Receipts (`/receipt.html?id=...`)**
   - Instant generation of verified digital appointment receipts upon booking.
   - Formatted booking reference code (`SUYAT-XXXXXXXX`), patient details, branch address, and pre-appointment preparation guidelines.
   - Clean, printer-optimized layout (`window.print()`) for saving or printing official appointment slips.

3. **Inbound Voice Call Answering (`/api/calls/incoming` & `/api/calls/process`)**
   - Telephony webhook compatible with Twilio Voice, Telnyx, Vapi, Retell, and SIP carriers.
   - Greets callers in natural speech, parses voice input, checks clinic slots, confirms bookings verbally, and delivers SMS proof of appointment receipts to the caller's phone.

4. **Staff Admin & Reporting Dashboard (`/admin.html`)**
   - Live analytics: Total bookings, Confirmed, Completed, Cancelled, and No-Shows.
   - Service breakdown statistics (Cleaning, Root Canal, Extraction, Whitening, Braces, etc.).
   - One-click daily summary report generator (`/api/admin/reports`).
   - On-demand automated reminder trigger (`/api/admin/reminders/send`).
   - One-click receipt viewer and CSV export.

5. **Automated Patient Reminders (`src/scheduled.ts`)**
   - Cron trigger (`0 0 * * *`) sends reminder emails (via Resend) and clinic schedule digests (via Telegram Bot) 24 hours prior to scheduled visits.

6. **Base44 Superagent Integration**
   - Seamless bridge endpoint (`/api/base44/chat`) allowing Base44 Superagents to query clinic availability, create appointments, and fetch clinic reports.

---

## 🛠️ Architecture & Tech Stack

- **Runtime:** Cloudflare Workers (ES2022 + `nodejs_compat`)
- **Frontend:** `web/` — Vite + React + TypeScript, animated with Remotion (`@remotion/player` on the site; same compositions render to MP4). Built to `web/dist` and served via Workers Static Assets
- **Database:** Cloudflare D1 SQLite (`dental-appointments-db`)
- **Agent Framework:** Cloudflare Agents SDK (`agents` & `@cloudflare/ai-chat`)
- **AI Models:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (fallback: `@cf/meta/llama-3.1-8b-instruct-fast`)
- **Testing:** Vitest (41 unit and integration tests)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.dev.vars.example` to `.dev.vars`:
```bash
ADMIN_PASSWORD=your_secure_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
RESEND_API_KEY=your_resend_key
CLINIC_NOTIFICATION_EMAIL=clinic@example.com
```

### 3. Run Test Suite
```bash
npm test
```
All 41 tests validate booking collision prevention, input validation, receipts, rescheduling, voice webhooks, and administrative reporting.

### 4. Run Locally
```bash
npm run dev
```
Open your browser at:
- **Patient Portal & Receptionist:** `http://localhost:8787/`
- **Staff Admin & Reports Dashboard:** `http://localhost:8787/admin.html`
- **Sample Appointment Receipt:** `http://localhost:8787/receipt.html`

---

## 🚢 Deployment

### Deploying to Cloudflare Workers
```bash
npx wrangler deploy
```

### GitHub Actions CI/CD
Pushing to `main` will automatically trigger `.github/workflows/deploy.yml` to run tests and deploy to Cloudflare when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured in your repository secrets.

---

> **Using this as a client sample?** See [`docs/NEW-CLIENT.md`](docs/NEW-CLIENT.md) for the personalisation checklist.

## 🚀 Deploying
```bash
npm run deploy           # standard: build web/dist and `wrangler deploy` (Cloudflare serves the static files)
npm run deploy:bundled   # same app, with the site packaged inside the Worker (wrangler.bundled.jsonc)
```
Use `deploy:bundled` where the Static Assets upload is blocked (e.g. a restricted network proxy). It restores `src/embedded-assets.ts` afterwards; never commit the generated version. Rollback: `npx wrangler rollback` or the Cloudflare dashboard (Workers → Deployments).

## 🎬 Frontend (`web/`)

```bash
npm run dev:web        # Vite dev server (proxies /api to wrangler dev on :8787)
npm run dev            # wrangler dev --local (serves web/dist; run build:web first)
npm run build:web      # typecheck + production build -> web/dist
npm run test:web       # frontend unit tests
npm run render:clips   # re-render poster stills (public/images/posters/*.webp)
npm run render:clips -- --video   # also MP4 promo clips -> web/public/clips (gitignored)
npm --prefix web run studio       # Remotion Studio to edit compositions
```

Compositions live in `web/src/remotion/` (HeroReel, ServicesShowcase, BookingSteps, ReceptionistWave). Clinic copy, services, branches and hours are in `web/src/config/clinic.ts`.
Base44 now needs `BASE44_API_KEY`, `BASE44_AGENT_ID` and `BASE44_CONVERSATION_ID` in the environment (no defaults); without them the Base44 tab falls back to the local assistant.
