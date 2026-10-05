/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as {
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/** The libraries worth naming on the Help page, with the versions this build was made with. */
const SHOWN_LIBS = [
  'react',
  'react-router-dom',
  '@tanstack/react-query',
  'framer-motion',
  'recharts',
  'tailwindcss',
  'vite',
  'typescript',
];
const libs = Object.fromEntries(
  SHOWN_LIBS.flatMap((name) => {
    const range = pkg.dependencies[name] ?? pkg.devDependencies[name];
    return range ? [[name, range.replace(/^[\^~]/, '')]] : [];
  }),
);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_LIBS__: JSON.stringify(libs),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Shown on the Help page; CI can pass the commit as LK_BUILD.
    __APP_VERSION__: JSON.stringify(
      process.env.LK_BUILD ? `${pkg.version} (${process.env.LK_BUILD})` : pkg.version,
    ),
  },
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
