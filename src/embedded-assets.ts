/**
 * Static site files packaged INSIDE the Worker, for deploys where the Workers Static Assets upload is unavailable
 * (see scripts/embed-assets.mjs and `npm run deploy:bundled`). Empty in the repo: with the normal config
 * (wrangler.jsonc) Cloudflare serves web/dist itself and this map is never used.
 */
export const EMBEDDED: Record<string, { type: string; b64: string }> = {};
