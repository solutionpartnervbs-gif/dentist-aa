import { test, expect, vi } from 'vitest';

// Pin "now" to a Monday (Manila) so "tomorrow" is always an open day. Without this the test fails every Saturday,
// when tomorrow is Sunday and the clinic is closed.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-11-09T04:00:00Z'));
import { makeMockDb } from './mockdb';
import { bookAppointment } from '../src/tools';
import { runScheduled } from '../src/scheduled';
import { sendBookingAlert } from '../src/telegram';

function tomorrow(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const base = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
  );
  return new Date(base + 86_400_000).toISOString().slice(0, 10);
}

function capture() {
  const sent: { url: string; body: unknown }[] = [];
  const fetchImpl = async (url: string, init?: { body?: unknown }) => {
    sent.push({
      url,
      body:
        typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body ?? null,
    });
    return { ok: true } as Response;
  };
  return { sent, fetchImpl };
}

function baseEnv(db: ReturnType<typeof makeMockDb>) {
  return {
    DB: db,
    TELEGRAM_BOT_TOKEN: 'tok',
    TELEGRAM_CHAT_ID: 'chat',
    RESEND_API_KEY: 'key',
    CLINIC_NOTIFICATION_EMAIL: 'clinic@example.com',
  } as never;
}

const pending: Promise<unknown>[] = [];
const ctx = {
  waitUntil: (p: Promise<unknown>) => {
    pending.push(p);
  },
} as never;
const drain = () => Promise.all(pending.splice(0));

test('scheduled marks reminder_sent once (idempotent)', async () => {
  const db = makeMockDb();
  await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    patientEmail: 'ana@example.com',
    serviceType: 'cleaning',
    date: tomorrow(),
    time: '10:00',
  });
  const { sent, fetchImpl } = capture();
  const first = await runScheduled(baseEnv(db), ctx, fetchImpl as typeof fetch);
  await drain();
  expect(first.reminded).toBe(1);
  expect(sent.some((s) => s.url.includes('resend'))).toBe(true);
  expect(sent.some((s) => s.url.includes('telegram'))).toBe(true);

  const second = await runScheduled(baseEnv(db), ctx, fetchImpl as typeof fetch);
  await drain();
  expect(second.reminded).toBe(0);
});

test('instant booking alert carries Complete/Cancel buttons', async () => {
  const { sent, fetchImpl } = capture();
  await sendBookingAlert(
    baseEnv(makeMockDb()),
    {
      id: 'abc',
      patient_name: 'Ana',
      patient_phone: '09170000001',
      service_type: 'cleaning',
      appointment_date: '2026-10-20',
      appointment_time: '10:00',
    },
    fetchImpl as typeof fetch,
  );
  const telegram = sent.find((s) => s.url.includes('telegram'));
  expect(telegram).toBeDefined();
  expect(JSON.stringify(telegram!.body)).toContain('complete:abc');
  expect(JSON.stringify(telegram!.body)).toContain('cancel:abc');
});
