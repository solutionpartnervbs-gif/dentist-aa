import { test, expect, vi } from 'vitest';

vi.mock('agents', () => ({ routeAgentRequest: async () => null }));
vi.mock('@cloudflare/ai-chat', () => ({
  AIChatAgent: class {
    protected env!: never;
    protected messages!: never[];
    constructor() {}
  },
}));

import server from '../src/server';
import { makeMockDb } from './mockdb';

const mk = (secret?: string) => ({ DB: makeMockDb(), ADMIN_PASSWORD: 'x', VOICE_TOOL_SECRET: secret }) as never;
const call = (env: never, tool: string, args: object, token = 's3cret') =>
  server.fetch(
    new Request('http://x/api/voice/tool', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ tool, arguments: args }),
    }),
    env,
  );

test('disabled (503) when no secret is configured', async () => {
  expect((await call(mk(undefined), 'check_available_slots', { date: '2026-11-10' })).status).toBe(503);
});

test('rejects a wrong or missing token', async () => {
  const env = mk('s3cret');
  expect((await call(env, 'check_available_slots', { date: '2026-11-10' }, 'nope')).status).toBe(401);
  const none = await server.fetch(new Request('http://x/api/voice/tool', { method: 'POST', body: '{}' }), env);
  expect(none.status).toBe(401);
});

test('check → book → double book → reschedule → cancel', async () => {
  const env = mk('s3cret');
  const slots = (await (await call(env, 'check_available_slots', { date: '2026-11-10' })).json()) as { status: string; slots: string[] };
  expect(slots.status).toBe('found');
  expect(slots.slots).toContain('10:00');

  const book = { patient_name: 'Ana Reyes', patient_phone: '09171234567', service_type: 'cleaning', date: '2026-11-10', time: '10:00' };
  const b = (await (await call(env, 'book_appointment', book)).json()) as { status: string; booking_reference: string };
  expect(b.status).toBe('booked');
  expect(b.booking_reference).toMatch(/^SUYAT-/);

  const dup = (await (await call(env, 'book_appointment', { ...book, patient_name: 'Ben' })).json()) as { status: string; code: string };
  expect(dup).toMatchObject({ status: 'error', code: 'SLOT_TAKEN' });

  const re = (await (await call(env, 'reschedule_appointment', { patient_phone: '09171234567', old_date: '2026-11-10', new_date: '2026-11-11', new_time: '11:00' })).json()) as { status: string };
  expect(re.status).toBe('rescheduled');

  const c = (await (await call(env, 'cancel_appointment', { patient_phone: '09171234567', date: '2026-11-11' })).json()) as { status: string };
  expect(c.status).toBe('cancelled');
  // (the mock DB cannot evaluate the literal status filter, so test not-found on a date with no booking)
  const none = (await (await call(env, 'cancel_appointment', { patient_phone: '09171234567', date: '2026-12-01' })).json()) as { status: string };
  expect(none.status).toBe('not_found');
});

test('unknown tool is 400, bad inputs return a speakable error', async () => {
  const env = mk('s3cret');
  expect((await call(env, 'drop_tables', {})).status).toBe(400);
  const r = (await (await call(env, 'book_appointment', { patient_name: '', patient_phone: '1', service_type: 'x', date: '2026-11-10', time: '10:00' })).json()) as { status: string; response_text: string };
  expect(r.status).toBe('error');
  expect(r.response_text.length).toBeGreaterThan(5);
});

test('spoken dates and times are speakable, never ISO or 24h', async () => {
  const { spokenDate, spokenTime } = await import('../src/voice');
  expect(spokenDate('2026-11-10')).toBe('Nov 10th 2026');
  expect(spokenDate('2026-11-01')).toBe('Nov 1st 2026');
  expect(spokenDate('2026-11-12')).toBe('Nov 12th 2026');
  expect(spokenDate('2026-11-23')).toBe('Nov 23rd 2026');
  expect(spokenTime('13:00')).toBe('1:00 PM');
  expect(spokenTime('09:00')).toBe('9:00 AM');
  expect(spokenTime('12:00')).toBe('12:00 PM');
  const r = (await (await call(mk('s3cret'), 'check_available_slots', { date: '2026-11-10' })).json()) as { response_text: string };
  expect(r.response_text).toContain('Nov 10th 2026');
  expect(r.response_text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
});
