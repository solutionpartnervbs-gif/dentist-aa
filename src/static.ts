import { EMBEDDED } from './embedded-assets.js';

const decoded = new Map<string, Uint8Array>();

function bytes(path: string): Uint8Array {
  let b = decoded.get(path);
  if (!b) {
    const bin = atob(EMBEDDED[path].b64);
    b = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    decoded.set(path, b);
  }
  return b;
}

export function hasEmbeddedSite(): boolean {
  return '/index.html' in EMBEDDED;
}

/**
 * Serve the packaged site: exact file, "/" -> index.html, and single-page-app fallback
 * (any other extension-less path -> index.html so /admin and /receipt/:id work on refresh).
 * Returns null when the path is a missing file (caller answers 404).
 */
export function serveEmbedded(pathname: string, method: string): Response | null {
  let path = pathname === '/' ? '/index.html' : pathname;
  if (!(path in EMBEDDED)) {
    if (/\.[a-z0-9]+$/i.test(path)) return null; // a missing file, not an app route
    path = '/index.html';
  }
  const file = EMBEDDED[path];
  const immutable = path.startsWith('/assets/'); // content-hashed by Vite
  return new Response(method === 'HEAD' ? null : (bytes(path) as unknown as BodyInit), {
    headers: {
      'content-type': file.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
}
