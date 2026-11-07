# Suyat voice receptionist (NVIDIA Nemotron Voice Agent) — PARKED

> **Parked.** The site currently ships a *chatbot with a voice* (browser speech-to-text and text-to-speech, in `web/`). This NVIDIA service is an optional later upgrade for real-time, interruptible voice; nothing here is wired into the site.

A real-time voice agent (speech in → LLM + tools → speech out) that books through the same Worker as the website chat and phone line.

```
caller ─ mic ─▶ NVIDIA Nemotron Voice Agent (Pipecat, Docker)   ◀── this folder customises it
                 │  ASR → LLM (prompt.yaml + tools.yaml) → TTS
                 └─ tool calls ─▶ POST {SUYAT_API_BASE}/api/voice/tool  (Bearer VOICE_TOOL_SECRET)
                                   └─ Worker: src/voice.ts → src/tools.ts → D1  (single source of truth)
```

## Status (honest)
| Part | State |
|---|---|
| Worker endpoint `/api/voice/tool` (auth, 4 tools, speakable replies) | **Done, tested** (`tests/voice.test.ts`, run with `npm test`) |
| `tool_implementation.py` handlers | **Done, tested** (`python3 -m unittest voice/test_tools.py`), and run end to end against a local Worker |
| `prompt.yaml`, `tools.yaml`, `expected-conversation.yaml` | **Written, not yet run through an LLM** |
| Applying the overlay to an NVA checkout, Docker start, live conversation test, real microphone round trip | **Not done**: needs the NVA repo, Docker, an `NVIDIA_API_KEY`, and a browser with a mic. Not possible from the build session. |

Treat the agent as unvalidated until the steps below pass.

## What you need
- A host with Docker Compose (no GPU for the public-endpoints runtime).
- `NVIDIA_API_KEY` from https://build.nvidia.com, set by you in `.env` (never in chat or git).
- The Worker deployed with a secret: `npx wrangler secret put VOICE_TOOL_SECRET` (long random value). Without it the endpoint returns 503.

## Steps
1. Clone NVIDIA's repo: `git clone https://github.com/NVIDIA-AI-Blueprints/nemotron-voice-agent.git` and copy `.env.example` to `.env` there; fill `NVIDIA_API_KEY`.
2. Get NVIDIA's customisation skill (it was removed from the working tree but is in git history):
   `git archive 5e9e433 digital-health-skills | tar -x -C /tmp/nva-skill`, then follow `skills/ambient-healthcare-agent-with-nemotron-voice-agent/references/custom/guide.md` using this folder's `prompt.yaml`, `tools.yaml`, `tool_implementation.py` and `expected-conversation.yaml` as the "custom" scenario. (The skill expects an agent to drive it and pauses for your approval before sending fixtures to an endpoint.)
3. Pass `SUYAT_API_BASE` and `VOICE_TOOL_SECRET` (see `.env.example`) into the NVA container environment.
4. Start the customised generic recipe per NVIDIA's docs, run the expected-conversation validator, then do a real mic test in the NVA web UI.

## Security notes
- The tool secret grants booking, cancelling and rescheduling. Keep it server-side; rotate if exposed.
- Identity is the mobile number only (same as the chat). Anyone who knows a number and date can cancel that booking. Add a verification step (e.g. a code by SMS) before production.
- No rate limiting on `/api/voice/tool` yet.
- Calls to the phone network (Twilio/SIP) are out of scope: NVA's browser/WebRTC transport is what this targets. The existing `/api/calls/*` text-based phone flow is unchanged.
- Voice recordings and transcripts: decide retention and consent (health-adjacent data; Philippine Data Privacy Act) before real patients use it.

## Re-branding for another client
Edit the clinic name, branches, hours and services in `prompt.yaml`, the service enum in `tools.yaml`, and the booking prefix in the Worker.
