import { test, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const here = dirname(fileURLToPath(import.meta.url));
const webFile = (name: string) => resolve(here, '../web', name);
// Static assets for the worker mock: index.html at web root, redirect stubs in web/public.
const publicFile = (name: string) =>
  name === 'index.html' ? webFile('index.html') : webFile(`public/${name}`);

const env = {
  DB: makeMockDb(),
  AI: null,
  ADMIN_PASSWORD: 'test',
  ASSETS: {
    fetch: async (req: Request) => {
      const name = new URL(req.url).pathname.replace(/^\//, '');
      const path = publicFile(name);
      if (!existsSync(path)) return new Response('Not found', { status: 404 });
      return new Response(readFileSync(path, 'utf8'), {
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    },
  },
} as never;

test('patient site calls the chat API and keeps a session id', () => {
  const src = readFileSync(webFile('src/hooks/useChat.ts'), 'utf8');
  expect(src).toContain('/api/chat');
  expect(src).toContain('localStorage');
});

test('admin dashboard calls the admin APIs and never prefills a password', () => {
  const src = readFileSync(webFile('src/pages/Admin.tsx'), 'utf8');
  expect(src).toContain('/api/admin/appointments');
  expect(src).not.toMatch(/useState\(['"]test['"]\)/);
  expect(src).not.toContain('dangerouslySetInnerHTML');
});

test('legacy receipt.html links redirect to the SPA receipt route', () => {
  const html = readFileSync(publicFile('receipt.html'), 'utf8');
  expect(html).toContain('/receipt/');
});

test('static asset routes serve the widgets', async () => {
  for (const path of ['/index.html', '/admin.html']) {
    const res = await server.fetch(new Request(`http://localhost${path}`), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  }
});

test('unknown static path is 404', async () => {
  const res = await server.fetch(
    new Request('http://localhost/missing.html'),
    env,
  );
  expect(res.status).toBe(404);
});
