import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Unit tests only, and deliberately so.
 *
 * Everything under test here is a pure function or a function over a mocked
 * fetch — normalisation, hashing, payload shape, retry decisions. Nothing
 * touches Postgres or the live EMC tenant, so `npm test` needs no credentials
 * and cannot post an event to Meta by accident.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
