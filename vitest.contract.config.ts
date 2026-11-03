/**
 * The live contract suite, kept in its own config so it can never run on the
 * PR path by accident.
 *
 * It is the one suite in the project that touches the network (test plan §4),
 * so: node environment, no jsdom, no setup file, generous timeouts, and no
 * retries — a flake here is information about ESPN, not something to paper
 * over.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['contract/**/*.contract.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    retry: 0,
    // Sequential: a scheduled run should be a polite client, not thirty
    // parallel requests to an undocumented endpoint.
    fileParallelism: false,
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
  },
});
