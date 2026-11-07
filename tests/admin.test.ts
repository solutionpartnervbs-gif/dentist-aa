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

function authed(db: ReturnType<typeof makeMockDb>, password = 'secret') {
  return {
    DB: db,
    AI: null,
    ADMIN_PASSWORD: password,
  } as never;
}

function get(
  path: string,
  password?: string,
  db = makeMockDb(),
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (password !== undefined) headers['authorization'] = `Bearer ${password}`;
  return server.fetch(new Request(`http://localhost${path}`, { headers }), authed(db));
}

test('admin with unset password fails closed', async () => {
  const { verifyAdmin } = await import('../src/admin');
  // Bypass Headers normalization (which trims 'Bearer ' to 'Bearer'):
  // an exactly-empty bearer must never authenticate, even with no password set.
  const req = {
    headers: { get: () => 'Bearer ' },
  } as unknown as Request;
  await expect(
    verifyAdmin(req, { ADMIN_PASSWORD: '' } as never),
  ).resolves.toBe(false);
});

test('admin without bearer is 401', async () => {
  const res = await get('/api/admin/appointments?date=2026-10-20');
  expect(res.status).toBe(401);
});

test('admin with wrong bearer is 401', async () => {
  const res = await get('/api/admin/appointments?date=2026-10-20', 'wrong');
  expect(res.status).toBe(401);
});

test('admin lists appointments filtered by date', async () => {
  const db = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  const res = await get('/api/admin/appointments?date=2026-10-20', 'secret', db);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { appointments: unknown[] };
  expect(body.appointments).toHaveLength(1);
});

test('admin reschedule conflict is 409', async () => {
  const db = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  const first = await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  await bookAppointment(db as never, {
    patientName: 'Ben',
    patientPhone: '09170000002',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '11:00',
  });
  const res = await server.fetch(
    new Request(`http://localhost/api/admin/appointments/${first.id}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ appointment_time: '11:00' }),
    }),
    authed(db),
  );
  expect(res.status).toBe(409);
});

test('telegram complete button marks completed', async () => {
  const db = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  const { id } = await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  const res = await server.fetch(
    new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callback_query: { data: `complete:${id}` },
      }),
    }),
    authed(db),
  );
  expect(res.status).toBe(200);
  const list = await get('/api/admin/appointments?status=completed', 'secret', db);
  const body = (await list.json()) as { appointments: { id: string }[] };
  expect(body.appointments.map((a) => a.id)).toContain(id);
});

test('forged telegram payload is ignored', async () => {  const db = makeMockDb();
  const res = await server.fetch(
    new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bogus: true }),
    }),
    authed(db),
  );
  expect([200, 401, 403]).toContain(res.status);
  const body = (await res.json()) as { ok: boolean };
  expect(body.ok).toBe(false);
});

function webhook(
  db: ReturnType<typeof makeMockDb>,
  payload: unknown,
  secret?: string,
  configured = 'hook-secret',
) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (secret !== undefined) {
    headers['x-telegram-bot-api-secret-token'] = secret;
  }
  return server.fetch(
    new Request('http://localhost/api/telegram/webhook', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }),
    {
      DB: db,
      AI: null,
      ADMIN_PASSWORD: 'secret',
      TELEGRAM_WEBHOOK_SECRET: configured,
    } as never,
  );
}

test('webhook without secret header is rejected and mutates nothing', async () => {
  const db = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  const { id } = await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  const res = await webhook(db, { callback_query: { data: `cancel:${id}` } });
  expect(res.status).toBe(403);
  const list = await get('/api/admin/appointments?date=2026-10-20', 'secret', db);
  const body = (await list.json()) as { appointments: { status: string }[] };
  expect(body.appointments).toHaveLength(1);
  expect(body.appointments[0].status).toBe('confirmed');
});

test('webhook with valid secret header is honored', async () => {  const db = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  const { id } = await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  const res = await webhook(
    db,
    { callback_query: { data: `complete:${id}` } },
    'hook-secret',
  );
  expect(res.status).toBe(200);
  expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
});

test('lost reschedule race surfaces 409, not 500', async () => {
  const inner = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  const { id } = await bookAppointment(inner as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  const racyDb = {
    ...inner,
    prepare: (query: string) => {
      if (query.trim().toUpperCase().startsWith('UPDATE')) {
        return {
          bind: () => ({
            all: async () => ({ results: [] }),
            run: async () => {
              throw new Error('UNIQUE constraint failed: idx_unique_slot');
            },
          }),
        };
      }
      return inner.prepare(query);
    },
  };
  const res = await server.fetch(
    new Request(`http://localhost/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ appointment_time: '11:00' }),
    }),
    authed(racyDb),
  );
  expect(res.status).toBe(409);
});

test('PATCH with malformed JSON is 400', async () => {
  const db = makeMockDb();
  const res = await server.fetch(
    new Request('http://localhost/api/admin/appointments/abc', {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: '{bad json',
    }),
    authed(db),
  );
  expect(res.status).toBe(400);
});

test.each([null, 'hello', []])(
  'PATCH with non-object JSON body %j is 400',
  async (body) => {
    const db = makeMockDb();
    const res = await server.fetch(
      new Request('http://localhost/api/admin/appointments/abc', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
      authed(db),
    );
    expect(res.status).toBe(400);
  },
);

test('reschedule outside clinic hours is 400', async () => {
  const db = makeMockDb();
  const { bookAppointment } = await import('../src/tools');
  const { id } = await bookAppointment(db as never, {
    patientName: 'Ana',
    patientPhone: '09170000001',
    serviceType: 'cleaning',
    date: '2026-10-20',
    time: '10:00',
  });
  // time-of-day outside hours
  const early = await server.fetch(
    new Request(`http://localhost/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ appointment_time: '03:00' }),
    }),
    authed(db),
  );
  expect(early.status).toBe(400);
  // Sunday: clinic closed
  const sunday = await server.fetch(
    new Request(`http://localhost/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ appointment_date: '2026-10-25' }),
    }),
    authed(db),
  );
  expect(sunday.status).toBe(400);
  // Saturday before opening (Project 6 opens 10:00)
  const satAfternoon = await server.fetch(
    new Request(`http://localhost/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        appointment_date: '2026-10-24',
        appointment_time: '09:00',
      }),
    }),
    authed(db),
  );
  expect(satAfternoon.status).toBe(400);
  // Saturday morning: allowed
  const satMorning = await server.fetch(
    new Request(`http://localhost/api/admin/appointments/${id}`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        appointment_date: '2026-10-24',
        appointment_time: '10:00',
      }),
    }),
    authed(db),
  );
  expect(satMorning.status).toBe(200);
});
