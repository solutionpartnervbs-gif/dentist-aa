import { routeAgentRequest } from 'agents';
import { DentalAgent } from './agent.js';
import { handleChatMessage } from './chat.js';
import {
  deleteAppointment,
  getAppointment,
  listAppointments,
  secretsEqual,
  updateAppointment,
  verifyAdmin,
} from './admin.js';
import { sendBookingAlert } from './telegram.js';
import { handleTelegramWebhook } from './telegram.js';
import { sendBookingConfirmation } from './email.js';
import { runScheduled } from './scheduled.js';
import { getAppointmentReceipt, generateClinicReport } from './tools.js';
import { handleIncomingCall, handleCallProcess } from './calls.js';

import { handleVoiceTool } from './voice.js';
import { hasEmbeddedSite, serveEmbedded } from './static.js';
import { handleAvailability, handleBook, handleBookingConfig } from './booking.js';

export { DentalAgent };

export interface Env {
  ASSETS: Fetcher;
  DentalAgent: DurableObjectNamespace<DentalAgent>;
  AI: Ai;
  DB: D1Database;
  ADMIN_PASSWORD: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BASE44_API_KEY?: string;
  BASE44_AGENT_ID?: string;
  BASE44_CONVERSATION_ID?: string;
  VOICE_TOOL_SECRET?: string;
}

async function handleChat(
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const message =
    typeof body === 'object' && body !== null
      ? (body as { message?: unknown }).message
      : undefined;
  const sessionId =
    typeof body === 'object' && body !== null
      ? (body as { sessionId?: unknown }).sessionId
      : undefined;
  if (typeof message !== 'string' || message.trim() === '') {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }
  const mode =
    typeof body === 'object' && body !== null
      ? (body as { mode?: unknown }).mode
      : undefined;
  const draft =
    typeof body === 'object' && body !== null
      ? (body as { draft?: unknown }).draft
      : undefined;
  if (mode === 'base44') {
    return handleBase44Chat(request, env, message, sessionId);
  }

  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }
  try {
    const result = await handleChatMessage(env.DB, message, draft);
    if (result.booked && ctx?.waitUntil) {
      const booked = result.booked;
      ctx.waitUntil(
        Promise.all([
          sendBookingAlert(env, booked),
          sendBookingConfirmation(env, booked),
        ]).then(() => {}),
      );
    }
    return Response.json({
      reply: result.reply,
      speech: result.speech,
      draft: result.draft ?? null,
      client: result.client,
      booked: result.booked,
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
      source: 'local_receptionist',
    });
  } catch (err) {
    console.error('chat failed', err);
    return Response.json({ error: 'Chat failed' }, { status: 500 });
  }
}

async function handleBase44Chat(
  request: Request,
  env: Env,
  message: string,
  sessionId?: unknown,
): Promise<Response> {
  void request;
  if (!message || message.trim() === '') {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }
  // Credentials come from the environment only (never commit them).
  const token = env.BASE44_API_KEY;
  const agentId = env.BASE44_AGENT_ID;
  const conversationId = env.BASE44_CONVERSATION_ID;

  if (token && agentId && conversationId) {
    try {
      const res = await fetch(
        `https://app.base44.com/api/agents/${agentId}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: 'user', content: message }),
        },
      );

      if (res.ok) {
        const data = (await res.json()) as { content?: string; role?: string };
        const reply = data.content || 'Thank you for your message.';
        return Response.json({
          reply,
          source: 'base44_superagent',
          agentId,
          sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        });
      }
      const errText = await res.text();
      console.error('Base44 error:', res.status, errText);
    } catch (err) {
      console.error('Base44 connection failed:', err);
    }
  }

  if (env.DB) {
    const result = await handleChatMessage(env.DB, message);
    return Response.json({
      reply: result.reply,
      booked: result.booked,
      source: 'local_fallback',
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    });
  }
  return Response.json({ error: 'Base44 chat unavailable' }, { status: 502 });
}

async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
  ctx?: ExecutionContext,
): Promise<Response> {
  if (!(await verifyAdmin(request, env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }

  // Reports endpoint
  if (request.method === 'GET' && url.pathname === '/api/admin/reports') {
    const date = url.searchParams.get('date') ?? undefined;
    const report = await generateClinicReport(env.DB, { date });
    return Response.json({ report });
  }

  // Manual reminder trigger
  if (request.method === 'POST' && url.pathname === '/api/admin/reminders/send') {
    const res = await runScheduled(env, ctx as ExecutionContext);
    return Response.json({ ok: true, reminded: res.reminded, date: res.date });
  }

  const idMatch = url.pathname.match(
    /^\/api\/admin\/appointments\/([^/]+)$/,
  );

  try {
    if (request.method === 'GET' && url.pathname === '/api/admin/appointments') {
      const appointments = await listAppointments(env.DB, {
        date: url.searchParams.get('date') ?? undefined,
        status: url.searchParams.get('status') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
      });
      return Response.json({ appointments });
    }

    if (idMatch && request.method === 'PATCH') {
      let patch: {
        status?: string;
        appointment_date?: string;
        appointment_time?: string;
      };
      try {
        patch = (await request.json()) as typeof patch;
      } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
      }
      if (
        typeof patch !== 'object' ||
        patch === null ||
        Array.isArray(patch)
      ) {
        return Response.json({ error: 'Invalid patch body' }, { status: 400 });
      }
      const updated = await updateAppointment(env.DB, idMatch[1], patch);
      if (!updated) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      return Response.json({ appointment: updated });
    }

    if (idMatch && request.method === 'DELETE') {
      const { deleted } = await deleteAppointment(env.DB, idMatch[1]);
      if (deleted === 0) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      return Response.json({ deleted });
    }

    if (request.method === 'GET' && idMatch) {
      const appointment = await getAppointment(env.DB, idMatch[1]);
      if (!appointment) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      return Response.json({ appointment });
    }
  } catch (err) {
    if (err instanceof Error && (err as { statusCode?: number }).statusCode === 409) {
      return Response.json({ error: 'Slot already taken' }, { status: 409 });
    }
    if (
      err instanceof Error &&
      /SLOT_TAKEN|UNIQUE constraint/i.test(err.message)
    ) {
      return Response.json({ error: 'Slot already taken' }, { status: 409 });
    }
    if (err instanceof Error && err.message.startsWith('INVALID_')) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

async function handleTelegram(request: Request, env: Env): Promise<Response> {
  const configured = env.TELEGRAM_WEBHOOK_SECRET;
  if (configured) {
    const got = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (!(await secretsEqual(got, configured))) {
      return Response.json({ ok: false }, { status: 403 });
    }
  } else {
    console.log('telegram webhook secret not configured — accepting (dev only)');
  }
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
  if (!env.DB) {
    return Response.json({ error: 'Database not configured' }, { status: 500 });
  }
  const result = await handleTelegramWebhook(env.DB, payload);
  return Response.json(result);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx?: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      url.pathname === '/api/chat' &&
      request.method === 'POST'
    ) {
      return handleChat(request, env, ctx);
    }

    if (url.pathname === '/api/availability' && request.method === 'GET') {
      return handleAvailability(request, env);
    }
    if (url.pathname === '/api/config' && request.method === 'GET') {
      return handleBookingConfig();
    }
    if (url.pathname === '/api/book' && request.method === 'POST') {
      return handleBook(request, env, ctx);
    }

    if (url.pathname === '/api/voice/tool' && request.method === 'POST') {
      return handleVoiceTool(request, env);
    }

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true });
    }

    // Appointment receipt endpoint
    const receiptMatch = url.pathname.match(
      /^\/api\/appointments\/([^/]+)\/receipt$/,
    );
    if (request.method === 'GET' && receiptMatch) {
      if (!env.DB) {
        return Response.json({ error: 'Database not configured' }, { status: 500 });
      }
      const receipt = await getAppointmentReceipt(env.DB, receiptMatch[1]);
      if (!receipt) {
        return Response.json({ error: 'Receipt not found' }, { status: 404 });
      }
      return Response.json(receipt);
    }

    // Voice call incoming & processing endpoints
    if (url.pathname === '/api/calls/incoming' && request.method === 'POST') {
      return handleIncomingCall(request, env);
    }
    if (url.pathname === '/api/calls/process' && request.method === 'POST') {
      return handleCallProcess(request, env);
    }

    // Base44 Superagent bridge endpoint
    if (url.pathname === '/api/base44/chat' && request.method === 'POST') {
      let body: { message?: string; content?: string; sessionId?: string } | null = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400 });
      }
      const msg = body?.message || body?.content || '';
      return handleBase44Chat(request, env, msg, body?.sessionId);
    }

    // Bundled-site deploys have no ASSETS binding: serve the site packaged inside this Worker.
    if (!env.ASSETS && hasEmbeddedSite() && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/agents/')) {
        const page = serveEmbedded(url.pathname, request.method);
        return page ?? Response.json({ error: 'Not found' }, { status: 404 });
      }
    }

    if (request.method === 'GET' && url.pathname === '/') {
      url.pathname = '/index.html';
    }

    if (request.method === 'GET' && url.pathname.endsWith('.html')) {
      if (env.ASSETS) {
        const asset = await env.ASSETS.fetch(
          new Request(new URL(url.pathname, url), request),
        );
        if (asset.status !== 404) return asset;
      }
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (
      url.pathname.startsWith('/api/admin/')
    ) {
      return handleAdmin(request, env, url, ctx);
    }

    if (url.pathname === '/api/telegram/webhook' && request.method === 'POST') {
      return handleTelegram(request, env);
    }

    if (url.pathname.startsWith('/agents/')) {
      return (
        (await routeAgentRequest(request, env)) ??
        Response.json({ error: 'Not found' }, { status: 404 })
      );
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    void controller;
    await runScheduled(env, ctx);
  },
} satisfies ExportedHandler<Env>;

