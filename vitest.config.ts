import { defineConfig } from 'vitest/config';

/**
 * Minimal vitest setup for the ask agent's corpus pipeline.
 *
 * Node environment: this code is filesystem and crypto (chunking, corpus loading), never DOM.
 * No coverage thresholds; the first pass is about catching real chunking/validation bugs, not
 * hitting a percentage.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
