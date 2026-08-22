import { defineConfig } from 'vite';

export default defineConfig({
  // Keep audio/video out of inlined data URIs (SRS §2.2).
  build: {
    assetsInlineLimit: 0,
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as never);
