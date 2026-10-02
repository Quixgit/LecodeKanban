/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Exposed on the public IP (23.19.228.158) on a non-standard port; see docs/adr/0004.
    host: process.env.LK_WEB_HOST ?? '0.0.0.0',
    port: Number(process.env.LK_WEB_PORT ?? 47100),
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.LK_API_URL ?? 'http://127.0.0.1:47101',
        changeOrigin: true,
        ws: true,
        // Append the real client IP to X-Forwarded-For (API trusts the rightmost entry).
        xfwd: true,
      },
    },
  },
  preview: {
    host: process.env.LK_WEB_HOST ?? '0.0.0.0',
    port: Number(process.env.LK_WEB_PORT ?? 47100),
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-select',
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'] },
  },
});
