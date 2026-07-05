import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// GitHub Pages serves a project site under /<repo>/. Only the production build needs that base;
// local dev and the E2E server stay at root so `npm run dev` and Playwright work unchanged.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gameroom-designer/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
}));
