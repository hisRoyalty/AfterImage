import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/unit/**/*.test.ts'], testTimeout: 60000 },
});
