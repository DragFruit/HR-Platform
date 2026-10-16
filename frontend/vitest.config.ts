import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Юнит-тесты чистых функций (app/utils, server/utils без Nuxt auto-imports).
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
