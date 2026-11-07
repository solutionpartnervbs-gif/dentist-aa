# Frontend rebuild — Suyat Dental (Remotion + interactive)

Branch: `claude/great-pascal-lq0833`. Plan: `/root/.claude/plans/rebuild-the-frontend-with-ethereal-crab.md`

## Baseline (before changes)
- `npm test`: 7 files / 41 tests pass. `npm run typecheck`: errors in `tests/receptionist-features.test.ts` (`unknown` JSON).

## Code review findings (current `public/*.html` + `src/`)
Security
- [x] Hardcoded Base44 key/agent/conversation IDs `src/server.ts:98-102` -> env only. **User must still rotate the leaked key (it is in git history).**
- [x] Stored XSS: `admin.html` builds rows with innerHTML from patient-controlled fields (fixed in web/)
- [x] Admin password prefilled "test" (fixed in web/)
- [x] CSV export unescaped (quotes / formula injection) (fixed in web/)
- [ ] Not fixed here (flag): /api/calls/* unsigned, Telegram webhook open without secret, no rate limit, phone-only identity
Bugs
- [x] (RESOLVED: `src/db.ts` BRANCHES is the one source; San Nicolas Mon-Tue 9-6, Project 6 Wed-Sat 10-6, Sun closed) Hours conflict: marketing (SN Mon-Tue 9-6, P6 Wed-Sat 10-6) vs `db.ts` (Mon-Fri 9-17, Sat 9-13); Sunday maps to Project 6
- [x] Quick-chips now use phrasings the parser handles; original: Quick-chips send phrasing the regex parser cannot handle ("next Monday", "tomorrow at 10:00 AM")
- [x] Voice call overwrites chat mic `onresult`; listening state sticks (fixed in web/)
- [x] Hardcoded caller `+639170000001` shared by all web callers (fixed in web/)
- [x] Receipt page shows fake data when API fails (fixed in web/)
- [x] Base44 tab default; fragile reply shape (fixed in web/)
A11y / responsive
- [x] No mobile nav; low contrast text; no focus trap/Esc in call modal; unlabeled input; canvas runs forever, ignores reduced-motion; admin table overflows on phones (fixed in web/)
Dead code
- [x] navy-yard pages, duplicate logo, unused images, fake "Remotion" canvas (fixed in web/)

## Plan checklist
- [x] Phase 1 scaffold `web/` (Vite+React+TS), wrangler assets -> `web/dist`
- [x] Phase 2 Remotion compositions (HeroReel, ServicesShowcase, BookingSteps, ReceptionistWave) + render script
- [x] Phase 3 pages: Landing, Chat/Voice, Receipt, Admin
- [x] Phase 4 backend fixes (Base44 env, hours single source, parser)
- [ ] Verify: tests, build, Playwright 390/768/1440, reduced-motion, render clips
- [ ] Commit, push, draft PR

## Results
- Root: 42 worker tests pass (assets test rewritten for the new frontend); web: 5 unit tests; `npm run build:web` OK.
- Playwright @390/768/1440: no horizontal overflow, no console errors, mobile menu, service-card -> chat reply works, reduced-motion shows posters, admin XSS payload inert.
- `render:clips --video` produces 4 MP4s.
- Phase 4 partial: only Base44 secrets moved to env. Hours/branch single-source NOT changed (tests encode backend hours as spec; product decision).
- Not done / flagged: Twilio signature check, rate limiting, phone-only identity, Telegram secret enforcement, stray root logs/PDFs/vendored `digital-health-skills/`.
- Logo: repo PNG had an opaque gray background; replaced by live SVG/text lockup (`web/src/components/Logo.tsx`). Drop in an official transparent logo to replace.

## Voice agent (NVIDIA skill) — scaffold
- [x] Worker `/api/voice/tool` (bearer secret, fails closed, 4 tools, spoken-format replies) + 5 tests
- [x] `voice/` prompt, tools, Python handlers (+5 tests), expected-conversation, README
- [x] End-to-end: Python handlers vs local Worker (book/dup/reschedule/cancel/wrong secret)
- [ ] NOT DONE: apply to NVA checkout, Docker start, live LLM validation, real mic test (needs NVIDIA_API_KEY + host + browser)
- [ ] Before production: caller verification, rate limit, consent/retention, resolve backend-vs-site hours

## Chatbot with a voice (current focus; NVIDIA voice/ service is PARKED)
- [x] Multi-turn conversation: server returns/accepts a `draft` (validated by `cleanDraft`), one question at a time, confirm before booking
- [x] Spoken-language parsing (`src/nlu.ts`): relative dates, weekdays, month names, times (2pm, two pm, noon), spoken phone digits, names, service synonyms, yes/no incl. Filipino
- [x] Cancel / reschedule by conversation; FAQ (hours, branches, services, thanks); toothache empathy without medical advice
- [x] Bug fixes: "cancel my appointment" was routed to status check; past dates were bookable; chip phrasing the bot could not parse
- [x] `speech` field (no ISO dates / 24h times / links / emoji) used for TTS; found+fixed AM/PM double conversion in browser test
- [x] UI: Read replies aloud (persisted), Talk mode (hands-free), Stop speaking, barge-in, best English voice, call modal uses the same chat brain
- [x] Browser test with scripted fake mic/speaker: full hands-free booking
- [ ] Not verified: real microphone/speaker, other browsers (Firefox has no SpeechRecognition), accents/noise accuracy

## Deployed (2026-11-06)
- [x] `npm run deploy:bundled` -> dental-ai-assistant, version edbe0e5a (previous: 86395fd1). Verified active at 100% via API.
- [ ] Live URL is behind Cloudflare Access (login redirect): owner must add a bypass/remove the policy for public use. Not changed by me.
- [ ] Not set: BASE44_CONVERSATION_ID (Base44 tab falls back to local bot), VOICE_TOOL_SECRET (voice tool endpoint disabled: correct). Rotate leaked Base44 key.

## Clean professional booking site (2026-11-06)
- [x] Tooth mascot removed everywhere (avatar, floating button, hero video, call screen)
- [x] Service emoji replaced by real images cropped from the owner's banner (web/public/images/services)
- [x] Hero: large bold dentist photo (headline overlap + mobile stacking bugs found in screenshots and fixed)
- [x] Booking form: /api/availability, /api/config, /api/book (+8 tests); validation, live slots, success with reference
- [x] Primary buttons/links on accessible action colour (fixes the contrast findings)
- [x] Chat is now a secondary helper; Base44 toggle and sound-wave strip removed from the page
- [ ] Not done: rate limiting on /api/book and /api/chat; real-device voice test

## Chatbot icon that roams the site (2026-11-06)
- [x] Owner's tooth icon is the chatbot: floats, hops between sections on scroll (side gutters on wide screens, bottom corners otherwise), reacts to listening/speaking/thinking
- [x] Click opens a chat popup (bottom sheet on phones); Esc closes, focus returns to the icon; conversation kept
- [x] Accessibility: Pause control (footer + chat header, remembered), fully still under prefers-reduced-motion, 44px targets, labelled button
- [x] Browser-verified at 1600/1280/390 px; found and fixed: pause still bobbed, popup overflowed, greeting bubble covered a card
- [ ] Not deployed yet (site on afterhourswellness.site still has the previous version)

## Milky: dialogue instead of voice (2026-11-06)
- [x] Icon renamed "Milky"; speaks in text bubbles: time-of-day greeting, "trying to help" line, suggestions per section, reactions in the booking form (web/src/config/dialogue.ts)
- [x] "Where is Milky?": chat answers + Milky hops, pulses and says hello (also footer link, works with tips off); closes the chat sheet on phones
- [x] Chat gives small-talk replies (hello, who are you) from the server; +5 tests
- [x] Voice removed from the site (mic, read-aloud, talk mode, call screen, wave); drops the 384 KB video-player chunk
- [x] Controls: Milky's tips on/off + Pause motion (chat panel and footer), both remembered
- [x] Bug found by testing: first click on "Confirm appointment" was lost when leaving a field inserted error text above the button. Fixed (no blur errors on untouched fields, focus kept on button press) + 4 regression tests
- [ ] NVIDIA voice/ service and /api/voice/tool, /api/calls remain in the repo but nothing on the site uses them
- [ ] Not deployed; GitHub push blocked (commits are local until access is restored)
