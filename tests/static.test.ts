import { describe, expect, it, vi } from 'vitest';

vi.mock('agents', () => ({ routeAgentRequest: async () => null }));
vi.mock('@cloudflare/ai-chat', () => ({
  AIChatAgent: class {
    protected env!: never;
    protected messages!: never[];
    constructor() {}
  },
}));
vi.mock('../src/embedded-assets', () => ({
  EMBEDDED: {
    '/index.html': { type: 'text/html; charset=utf-8', b64: btoa('<!doctype html><title>home</title>') },
    '/assets/app-abc123.js': { type: 'text/javascript; charset=utf-8', b64: btoa('console.log(1)') },
    '/favicon.svg': { type: 'image/svg+xml', b64: btoa('<svg/>') },
  },
}));

import server from '../src/server';
import { makeMockDb } from './mockdb';

const env = { DB: makeMockDb(), ADMIN_PASSWORD: 'x' } as never; // no ASSETS binding = bundled deploy
const get = (path: string, method = 'GET') => server.fetch(new Request(`http://x${path}`, { method }), env);

describe('bundled site serving (no ASSETS binding)', () => {
  it('serves / and SPA routes as index.html (no-cache)', async () => {
    for (const p of ['/', '/admin', '/receipt/abc-123']) {
      const r = await get(p);
      expect(r.status).toBe(200);
      expect(await r.text()).toContain('<title>home</title>');
      expect(r.headers.get('cache-control')).toBe('no-cache');
    }
  });
  it('serves hashed assets immutable with the right type', async () => {
    const r = await get('/assets/app-abc123.js');
    expect(r.headers.get('content-type')).toContain('javascript');
    expect(r.headers.get('cache-control')).toContain('immutable');
    expect(await r.text()).toBe('console.log(1)');
  });
  it('missing files are 404, not the app shell', async () => {
    expect((await get('/assets/nope.js')).status).toBe(404);
    expect((await get('/images/missing.png')).status).toBe(404);
  });
  it('HEAD has no body; API routes are untouched', async () => {
    const h = await get('/', 'HEAD');
    expect(h.status).toBe(200);
    expect(await h.text()).toBe('');
    expect(await (await get('/api/health')).json()).toEqual({ ok: true });
    expect((await get('/api/nope')).status).toBe(404);
  });
});
