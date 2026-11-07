import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(resolve(here, '../wrangler.jsonc'), 'utf8'),
) as { compatibility_date: string };

test('wrangler has required bindings and cron', () => {
  expect(config.compatibility_date).toBe('2026-10-15');
  const raw = JSON.stringify(config);
  expect(raw).toContain('DentalAgent');
  expect(raw).toContain('dental-appointments-db');
  expect(raw).toContain('0 0 * * *');
});
