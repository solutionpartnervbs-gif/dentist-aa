import type { Env } from './server.js';

interface TelegramButton {
  text: string;
  callback_data: string;
}

function botToken(env: Env): string | null {
  const vars = env as unknown as Record<string, string | undefined>;
  return vars['TELEGRAM_BOT_TOKEN'] ?? null;
}

function chatId(env: Env): string | null {
  const vars = env as unknown as Record<string, string | undefined>;
  return vars['TELEGRAM_CHAT_ID'] ?? null;
}

export async function sendTelegram(
  env: Env,
  text: string,
  buttons: TelegramButton[][] = [],
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const token = botToken(env);
  const chat = chatId(env);
  if (!token || !chat) {
    console.log('telegram skipped (missing secrets)', text);
    return false;
  }
  const body: Record<string, unknown> = { chat_id: chat, text };
  if (buttons.length > 0) body['reply_markup'] = { inline_keyboard: buttons };
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function bookingAlertButtons(id: string): TelegramButton[][] {
  return [
    [
      { text: 'Mark Completed', callback_data: `complete:${id}` },
      { text: 'Cancel Slot', callback_data: `cancel:${id}` },
    ],
  ];
}

export async function sendBookingAlert(
  env: Env,
  appt: {
    id: string;
    patient_name: string;
    patient_phone: string;
    service_type: string;
    appointment_date: string;
    appointment_time: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const text =
    `New booking: ${appt.service_type} on ${appt.appointment_date} at ${appt.appointment_time}\n` +
    `Patient: ${appt.patient_name} (${appt.patient_phone})`;
  return sendTelegram(env, text, bookingAlertButtons(appt.id), fetchImpl);
}

export async function sendScheduleDigest(
  env: Env,
  date: string,
  appts: {
    appointment_time: string;
    patient_name: string;
    patient_phone: string;
    service_type: string;
  }[],
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const lines = appts.map(
    (a) =>
      `${a.appointment_time} — ${a.patient_name} (${a.patient_phone}), ${a.service_type}`,
  );
  const text =
    appts.length > 0
      ? `Schedule for ${date}:\n${lines.join('\n')}`
      : `No appointments scheduled for ${date}.`;
  return sendTelegram(env, text, [], fetchImpl);
}

export async function handleTelegramWebhook(
  db: D1Database,
  payload: unknown,
): Promise<{ ok: boolean; action?: string; id?: string }> {
  const data =
    typeof payload === 'object' && payload !== null
      ? (payload as { callback_query?: { data?: unknown } }).callback_query
          ?.data
      : undefined;
  if (typeof data !== 'string') return { ok: false };
  const m = data.match(/^(complete|cancel):(.+)$/);
  if (!m) return { ok: false };
  const [, action, id] = m;
  const status = action === 'complete' ? 'completed' : 'cancelled';
  await db
    .prepare(`UPDATE appointments SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();
  return { ok: true, action, id };
}
