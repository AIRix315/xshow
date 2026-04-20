import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setup-tests.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'e2e/**',
        'src/**/*.e2e.test.ts',
        'src/**/*.test.{ts,tsx}',
        'src/setup-tests.ts',
        'src/setup.test.ts',
        'src/vite-env.d.ts',
        'src/types.ts',
      ],
    },
  },
});