import { sendReminderBatch } from './email.js';
import { sendScheduleDigest } from './telegram.js';
import type { Env } from './server.js';

type FetchImpl = typeof fetch;

export function manilaDatePlus(days: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const base = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
  );
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

interface DueRow {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string | null;
  service_type: string;
  appointment_date: string;
  appointment_time: string;
}

export async function runScheduled(
  env: Env,
  ctx: ExecutionContext,
  fetchImpl: FetchImpl = fetch,
): Promise<{ date: string; reminded: number }> {
  const date = manilaDatePlus(1);
  const { results } = await env.DB.prepare(
    `SELECT id, patient_name, patient_phone, patient_email, service_type,
       appointment_date, appointment_time
     FROM appointments
     WHERE appointment_date = ? AND status = 'confirmed' AND reminder_sent = ?
     ORDER BY appointment_time`,
  )
    .bind(date, 0)
    .all<DueRow>();

  if (results.length === 0) return { date, reminded: 0 };

  const work = (async () => {
    await sendScheduleDigest(env, date, results, fetchImpl);
    await sendReminderBatch(env, results, fetchImpl);
    for (const row of results) {
      await env.DB.prepare(`UPDATE appointments SET reminder_sent = 1 WHERE id = ?`)
        .bind(row.id)
        .run();
    }
  })();
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else await work;

  return { date, reminded: results.length };
}
