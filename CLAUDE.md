# Suyat Dental Clinic — AI receptionist

- Backend: Cloudflare Worker `src/` (TypeScript, D1). Tests: `npm test`, types: `npm run typecheck`.
- Frontend: `web/` (Vite + React + TS + Remotion). Build: `npm run build:web` -> `web/dist` (served via wrangler ASSETS). Dev: `npm run dev:web`.
- API contract (do not break): `POST /api/chat`, `POST /api/base44/chat`, `GET /api/appointments/:id/receipt`, `POST /api/calls/process`, `/api/admin/*` (Bearer ADMIN_PASSWORD).
- Brand: cyan #00b4d8, red #ea2825, navy #1f2a44, orange #fdb95a; fonts Plus Jakarta Sans + Space Grotesk.
- Hours: San Nicolas Mon-Tue 9-6; Project 6 (QC) Wed-Sat 10-6; Sunday closed. Tz Asia/Manila.
- Rules: plan in tasks/todo.md, verify before done, minimal impact, fix root causes, update tasks/lessons.md after corrections. Never commit secrets.
- Sample/template for future clients; Suyat is the personalised example. Personalise via `web/src/config/clinic.ts`, `web/src/styles/tokens.css`, `web/index.html`; checklist in docs/NEW-CLIENT.md.
