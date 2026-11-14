import { realpathSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Windows: a lowercase drive letter in cwd makes Vitest load itself twice.
const root = realpathSync.native(process.cwd());

export default defineConfig({
  root,
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  test: { root, include: ['tests/unit/**/*.test.ts'], testTimeout: 60000 },
});
