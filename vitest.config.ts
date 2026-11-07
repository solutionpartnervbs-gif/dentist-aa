import { defineConfig } from 'vitest/config';

// Worker tests only; the web app has its own config (web/vite.config.ts).
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
