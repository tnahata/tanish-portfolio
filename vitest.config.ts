import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Minimal vitest setup for the ask agent's corpus pipeline and route handlers.
 *
 * Node environment: this code is filesystem and crypto (chunking, corpus loading), or a Next.js
 * Route Handler exercised as a plain async function (app/api/ask/route.ts), never DOM.
 * No coverage thresholds; the first pass is about catching real bugs, not hitting a percentage.
 *
 * `resolve.alias` mirrors tsconfig.json's `"@/*": ["./*"]`: app/api/ask/route.ts imports its
 * lib/ask dependencies as `@/lib/ask/...`, matching this project's existing convention
 * (components/UTMTracker.tsx imports `@/lib/useUTMPersistence`), rather than the relative `./`
 * imports lib/ask's own internal modules use among themselves. Vite/Vitest does not read
 * tsconfig `paths` on its own, so the alias needs to be declared here too.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
