import { describe, expect, it, vi } from 'vitest';

vi.mock('agents', () => ({ routeAgentRequest: async () => null }));
vi.mock('@cloudflare/ai-chat', () => ({
  AIChatAgent: class {
    protected env!: never;
    protected messages!: never[];
    constructor() {}
  },
}));

import server from '../src/server';
import { addDays } from '../src/nlu';
import { bookingWindow } from '../src/booking';
import { makeMockDb } from './mockdb';

const mkEnv = () => ({ DB: makeMockDb(), ADMIN_PASSWORD: 'x' }) as never;
const win = bookingWindow();
// first Wednesday on/after tomorrow (Project 6, opens 10:00) and first Sunday
const nextDow = (dow: number) => {
  let d = addDays(win.min, 1);
  while (new Date(d + 'T00:00:00Z').getUTCDay() !== dow) d = addDays(d, 1);
  return d;
};
const WED = nextDow(3), SUN = nextDow(0), MON = nextDow(1);

const post = (env: never, body: unknown) =>
  server.fetch(new Request('http://x/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
const avail = (env: never, date: string) => server.fetch(new Request(`http://x/api/availability?date=${date}`), env);
const good = { name: 'Ana Reyes', phone: '0917 123 4567', service: 'cleaning', date: WED, time: '10:00' };

describe('GET /api/availability', () => {
  it('returns slots and the right branch', async () => {
    const r = (await (await avail(mkEnv(), WED)).json()) as { open: boolean; slots: string[]; branch: { name: string } };
    expect(r.open).toBe(true);
    expect(r.slots[0]).toBe('10:00'); // Project 6 opens at 10
    expect(r.branch.name).toBe('Project 6 Branch');
    const m = (await (await avail(mkEnv(), MON)).json()) as { slots: string[]; branch: { name: string } };
    expect(m.slots[0]).toBe('09:00');
    expect(m.branch.name).toBe('San Nicolas Branch');
  });
  it('Sunday is closed, past and too-far dates have no slots, junk is 400', async () => {
    expect(await (await avail(mkEnv(), SUN)).json()).toMatchObject({ open: false, reason: 'closed', slots: [] });
    expect(await (await avail(mkEnv(), addDays(win.min, -3))).json()).toMatchObject({ reason: 'past', slots: [] });
    expect(await (await avail(mkEnv(), addDays(win.min, 200))).json()).toMatchObject({ reason: 'too_far' });
    expect((await avail(mkEnv(), 'nope')).status).toBe(400);
  });
  it('GET /api/config lists services and branches', async () => {
    const c = (await (await server.fetch(new Request('http://x/api/config'), mkEnv())).json()) as { services: unknown[]; branches: unknown[] };
    expect(c.services.length).toBe(6);
    expect(c.branches.length).toBe(2);
  });
});

describe('POST /api/book', () => {
  it('books, normalises the phone, and the slot disappears', async () => {
    const env = mkEnv();
    const r = await post(env, good);
    expect(r.status).toBe(201);
    const b = (await r.json()) as { reference: string; receiptPath: string; branch: string };
    expect(b.reference).toMatch(/^SUYAT-/);
    expect(b.receiptPath).toMatch(/^\/receipt\//);
    expect(b.branch).toBe('Project 6 Branch');
    const slots = ((await (await avail(env, WED)).json()) as { slots: string[] }).slots;
    expect(slots).not.toContain('10:00');
  });
  it('double booking is a 409 that asks the form to refresh', async () => {
    const env = mkEnv();
    await post(env, good);
    const r = await post(env, { ...good, name: 'Ben Cruz', phone: '09175550000' });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ refresh: true });
  });
  it('validates every field with a per-field message', async () => {
    const r = await post(mkEnv(), { name: '1', phone: '123', email: 'bad', service: 'hack', date: SUN, time: 'x' });
    expect(r.status).toBe(400);
    const { fields } = (await r.json()) as { fields: Record<string, string> };
    expect(Object.keys(fields).sort()).toEqual(['date', 'email', 'name', 'phone', 'service', 'time']);
  });
  it('rejects past dates, times outside the branch hours, and bad JSON', async () => {
    expect((await post(mkEnv(), { ...good, date: addDays(win.min, -1) })).status).toBe(400);
    expect((await post(mkEnv(), { ...good, time: '09:00' })).status).toBe(400); // Project 6 not open at 9
    const bad = await server.fetch(new Request('http://x/api/book', { method: 'POST', body: '{' }), mkEnv());
    expect(bad.status).toBe(400);
  });
  it('accepts +63 numbers and an optional email', async () => {
    const r = await post(mkEnv(), { ...good, phone: '+63 917 123 4567', email: 'ana@example.com' });
    expect(r.status).toBe(201);
  });
});
