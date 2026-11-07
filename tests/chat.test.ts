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

const env = {
  DB: makeMockDb(),
  AI: null,
  ADMIN_PASSWORD: 'test',
} as never;

function postChat(body: unknown): Promise<Response> {
  return server.fetch(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );
}

test('POST /api/chat books via tool intent', async () => {
  const res = await postChat({
    message: 'Book cleaning tomorrow 10:00, name Ana 09170000001',
    sessionId: 's1',
  });
  expect(res.status).toBe(200);
  expect(await res.json()).toHaveProperty('reply');
});

test('POST /api/chat without message is 400', async () => {
  const res = await postChat({ sessionId: 's1' });
  expect(res.status).toBe(400);
});

test('unknown route is 404', async () => {
  const res = await server.fetch(new Request('http://localhost/nope'), env);
  expect(res.status).toBe(404);
});

test('date-before-phone message stores the phone, not the date', async () => {
  const { handleChatMessage } = await import('../src/chat');
  const db = makeMockDb();
  const result = await handleChatMessage(
    db as never,
    'Book cleaning on 2026-10-20 at 10:00 name Ana 09170000001',
    undefined,
    '2026-10-01', // fixed "today" so the date is not in the past
  );
  expect(result.booked?.patient_phone).toBe('09170000001');
  expect(result.booked?.appointment_date).toBe('2026-10-20');
});
